package com.cwgsyw.platform.module.org;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.authorization.AuthorizationWriteLockService;
import com.cwgsyw.platform.module.org.dto.GroupMembershipRequest;
import com.cwgsyw.platform.module.org.dto.UserGroupMembershipVO;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.org.entity.UserGroupMembership;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.rbac.SysRoleMapper;
import com.cwgsyw.platform.module.rbac.RoleAssignmentMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.HashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class GroupMembershipService {
    private final UserGroupMembershipMapper membershipMapper;
    private final UserMapper userMapper;
    private final GroupMapper groupMapper;
    private final AuditLogMapper auditLogMapper;
    private final RbacService rbacService;
    private final SysRoleMapper roleMapper;
    private final RoleAssignmentMapper roleAssignmentMapper;
    private final AuthorizationWriteLockService authorizationWriteLockService;
    private final ActiveGroupReferenceValidator activeGroupReferenceValidator;

    public List<UserGroupMembershipVO> list(Long userId, String tenantId) {
        requireUser(userId, tenantId);
        return membershipMapper.selectList(new LambdaQueryWrapper<UserGroupMembership>()
                .eq(UserGroupMembership::getTenantId, tenantId)
                .eq(UserGroupMembership::getUserId, userId)
                .eq(UserGroupMembership::getIsDeleted, false)
                .orderByDesc(UserGroupMembership::getIsPrimary)
                .orderByAsc(UserGroupMembership::getId))
            .stream()
            .map(membership -> toVo(membership, groupMapper.selectById(membership.getGroupId())))
            .toList();
    }

    public List<Long> findGroupIds(Long userId, String tenantId) {
        return membershipMapper.findActiveGroupIds(tenantId, userId);
    }

    public List<User> findUsersByGroup(Long groupId, String tenantId) {
        requireGroup(groupId, tenantId);
        List<Long> userIds = membershipMapper.findUserIdsByGroup(tenantId, groupId);
        return userIds.isEmpty() ? List.of() : userMapper.selectBatchIds(userIds).stream()
            .filter(user -> tenantId.equals(user.getTenantId()))
            .toList();
    }

    @Transactional
    public UserGroupMembership add(Long userId, GroupMembershipRequest request,
                                   String tenantId, Long operatorId) {
        requireUser(userId, tenantId);
        requireGroup(request.getGroupId(), tenantId);
        authorizationWriteLockService.lockUserAuthorization(tenantId, userId);
        activeGroupReferenceValidator.lockAndRequire(tenantId, request.getGroupId());
        boolean primary = Boolean.TRUE.equals(request.getPrimary());
        if (primary) {
            java.util.TreeSet<Long> groupIds = new java.util.TreeSet<>(
                membershipMapper.findActiveGroupIds(tenantId, userId));
            groupIds.add(request.getGroupId());
            groupIds.forEach(groupId ->
                authorizationWriteLockService.lockGroupAssignment(tenantId, userId, groupId));
        } else {
            authorizationWriteLockService.lockGroupAssignment(tenantId, userId, request.getGroupId());
        }
        User user = requireUser(userId, tenantId);
        Group group = requireGroup(request.getGroupId(), tenantId);
        if (isSuperAdmin(userId)) throw new IllegalArgumentException("超级管理员必须保持无组状态");
        UserGroupMembership existing = find(userId, group.getId(), tenantId);
        if ("unassigned".equals(group.getGroupType())) {
            validateUnassignedMembership(user, request, tenantId, existing);
        }

        if (existing == null) {
            existing = new UserGroupMembership();
            existing.setTenantId(tenantId);
            existing.setUserId(userId);
            existing.setGroupId(group.getId());
            existing.setOriginType("manual");
            existing.setCreatedBy(operatorId);
        }
        existing.setMembershipRole(request.getMembershipRole());
        existing.setIsPrimary(primary);
        existing.setUpdatedBy(operatorId);

        if (primary) {
            clearPrimary(userId, tenantId, operatorId);
            user.setGroupId(group.getId());
            userMapper.updateById(user);
        }

        if (existing.getId() == null) membershipMapper.insert(existing);
        else membershipMapper.updateById(existing);

        audit(tenantId, operatorId, userId, "membership_add",
            "添加组成员关系: group=" + group.getId() + ", role=" + existing.getMembershipRole());
        return existing;
    }

    @Transactional
    public void setPrimaryMembership(Long userId, Long groupId, String tenantId, Long operatorId) {
        GroupMembershipRequest request = new GroupMembershipRequest();
        request.setGroupId(groupId);
        request.setMembershipRole("member");
        request.setPrimary(true);
        UserGroupMembership existing = find(userId, groupId, tenantId);
        if (existing != null && "leader".equals(existing.getMembershipRole())) {
            request.setMembershipRole("leader");
        }
        add(userId, request, tenantId, operatorId);
    }

    @Transactional
    public void syncPrimaryMembership(Long userId, Long groupId, String tenantId, Long operatorId) {
        if (groupId == null) {
            authorizationWriteLockService.lockUserAuthorization(tenantId, userId);
            List<Long> activeGroupIds = membershipMapper.findActiveGroupIds(tenantId, userId);
            activeGroupIds.stream().sorted().forEach(activeGroupId ->
                authorizationWriteLockService.lockGroupAssignment(tenantId, userId, activeGroupId));
            clearPrimary(userId, tenantId, operatorId);
            return;
        }
        setPrimaryMembership(userId, groupId, tenantId, operatorId);
    }

    @Transactional
    public void remove(Long userId, Long membershipId, String tenantId, Long operatorId) {
        // 初步读取只为获取 tenant/user/group 并验证路径所有权
        UserGroupMembership preliminaryMembership = membershipMapper.selectById(membershipId);
        if (preliminaryMembership == null || !tenantId.equals(preliminaryMembership.getTenantId())
                || !userId.equals(preliminaryMembership.getUserId())) {
            throw new IllegalArgumentException("成员关系不存在");
        }

        // 获取锁
        authorizationWriteLockService.lockUserAuthorization(tenantId, userId);
        authorizationWriteLockService.lockGroupAssignment(
            tenantId, preliminaryMembership.getUserId(), preliminaryMembership.getGroupId());

        // 重新读取活动 membership
        UserGroupMembership membership = membershipMapper.selectOne(new LambdaQueryWrapper<UserGroupMembership>()
            .eq(UserGroupMembership::getId, membershipId)
            .eq(UserGroupMembership::getTenantId, tenantId)
            .eq(UserGroupMembership::getUserId, userId)
            .eq(UserGroupMembership::getGroupId, preliminaryMembership.getGroupId())
            .eq(UserGroupMembership::getIsDeleted, false));

        if (membership == null) {
            throw new IllegalStateException("membership 已被删除或状态已变化");
        }

        removeMembershipLocked(membership, tenantId, operatorId);
    }

    @Transactional
    public void removeByGroup(Long userId, Long groupId, String tenantId, Long operatorId) {
        requireUser(userId, tenantId);
        authorizationWriteLockService.lockUserAuthorization(tenantId, userId);
        authorizationWriteLockService.lockGroupAssignment(tenantId, userId, groupId);

        UserGroupMembership membership = find(userId, groupId, tenantId);
        if (membership == null) {
            // 旧主组兼容分支：重新读取 user 并验证
            User user = requireUser(userId, tenantId);
            if (!groupId.equals(user.getGroupId())) {
                throw new IllegalArgumentException("用户不在当前组中");
            }

            // 撤销 assignments
            List<Long> revokedAssignmentIds = revokeMatchingGroupAssignmentsLocked(
                tenantId, userId, groupId, operatorId);

            // 清空主组
            clearPrimaryGroupIfMatches(tenantId, userId, groupId, operatorId);

            // 审计（有界）
            String remark = "移除尚未回填的旧主组关系: group=" + groupId;
            if (!revokedAssignmentIds.isEmpty()) {
                if (revokedAssignmentIds.size() <= 5) {
                    remark += ", revoked_assignment_ids=" + revokedAssignmentIds;
                } else {
                    remark += ", revoked_count=" + revokedAssignmentIds.size()
                        + ", first_5=" + revokedAssignmentIds.subList(0, 5) + "...";
                }
            }
            audit(tenantId, operatorId, userId, "membership_remove_legacy", remark);
            return;
        }

        removeMembershipLocked(membership, tenantId, operatorId);
    }

    private void removeMembershipLocked(UserGroupMembership membership, String tenantId, Long operatorId) {
        // 清空主组（如果是主 membership）
        if (Boolean.TRUE.equals(membership.getIsPrimary())) {
            clearPrimaryGroupIfMatches(tenantId, membership.getUserId(), membership.getGroupId(), operatorId);
        }

        // 软撤销与该 membership 匹配的 group assignments
        List<Long> revokedAssignmentIds = revokeMatchingGroupAssignmentsLocked(
            tenantId, membership.getUserId(), membership.getGroupId(), operatorId);

        // 软删除 membership：使用原子更新方法
        int updated = membershipMapper.softDeleteActive(
            membership.getId(), tenantId, membership.getUserId(), membership.getGroupId(), operatorId);

        if (updated != 1) {
            throw new IllegalStateException("membership 软删除失败或状态已变化");
        }

        // 审计：记录 membership 删除和被撤销的 assignment IDs（有界）
        String remark = "移除组成员关系: group=" + membership.getGroupId();
        if (!revokedAssignmentIds.isEmpty()) {
            if (revokedAssignmentIds.size() <= 5) {
                remark += ", revoked_assignment_ids=" + revokedAssignmentIds;
            } else {
                remark += ", revoked_count=" + revokedAssignmentIds.size()
                    + ", first_5=" + revokedAssignmentIds.subList(0, 5) + "...";
            }
        }
        audit(tenantId, operatorId, membership.getUserId(), "membership_remove", remark);
    }

    private List<Long> revokeMatchingGroupAssignmentsLocked(String tenantId, Long userId, Long groupId, Long operatorId) {
        // 查找匹配的活动 group assignments
        var matchingAssignments = roleAssignmentMapper.selectList(
            new LambdaQueryWrapper<com.cwgsyw.platform.module.rbac.entity.RoleAssignment>()
                .eq(com.cwgsyw.platform.module.rbac.entity.RoleAssignment::getTenantId, tenantId)
                .eq(com.cwgsyw.platform.module.rbac.entity.RoleAssignment::getUserId, userId)
                .eq(com.cwgsyw.platform.module.rbac.entity.RoleAssignment::getScopeType, "group")
                .eq(com.cwgsyw.platform.module.rbac.entity.RoleAssignment::getScopeId, groupId)
                .eq(com.cwgsyw.platform.module.rbac.entity.RoleAssignment::getIsDeleted, false)
        );

        List<Long> revokedIds = new java.util.ArrayList<>();

        for (var assignment : matchingAssignments) {
            // 软删除 assignment：使用原子更新方法
            int updated = roleAssignmentMapper.softDeleteActiveGroupAssignment(
                assignment.getId(), tenantId, userId, groupId, operatorId);

            if (updated == 1) {
                revokedIds.add(assignment.getId());

                // 为每个撤销写审计
                audit(tenantId, operatorId, userId, "assignment_revoke_on_membership_removal",
                    "因 membership 删除撤销 assignment: id=" + assignment.getId() +
                    ", role=" + assignment.getRoleId() + ", group=" + groupId);
            } else {
                throw new IllegalStateException("assignment 软删除失败: id=" + assignment.getId());
            }
        }

        return revokedIds;
    }

    private void clearPrimaryGroupIfMatches(String tenantId, Long userId, Long groupId, Long operatorId) {
        int updated = userMapper.clearPrimaryGroup(tenantId, userId, groupId, operatorId);
        if (updated != 1) {
            throw new IllegalStateException("主组清理失败或状态已变化");
        }
    }

    private void clearPrimary(Long userId, String tenantId, Long operatorId) {
        membershipMapper.update(null, new LambdaUpdateWrapper<UserGroupMembership>()
            .eq(UserGroupMembership::getTenantId, tenantId)
            .eq(UserGroupMembership::getUserId, userId)
            .eq(UserGroupMembership::getIsPrimary, true)
            .set(UserGroupMembership::getIsPrimary, false)
            .set(UserGroupMembership::getUpdatedBy, operatorId)
            .set(UserGroupMembership::getUpdatedAt, LocalDateTime.now()));
    }

    private UserGroupMembership find(Long userId, Long groupId, String tenantId) {
        return membershipMapper.selectOne(new LambdaQueryWrapper<UserGroupMembership>()
            .eq(UserGroupMembership::getTenantId, tenantId)
            .eq(UserGroupMembership::getUserId, userId)
            .eq(UserGroupMembership::getGroupId, groupId));
    }

    private User requireUser(Long userId, String tenantId) {
        User user = userMapper.selectById(userId);
        if (user == null || !tenantId.equals(user.getTenantId())) {
            throw new IllegalArgumentException("用户不存在");
        }
        return user;
    }

    private Group requireGroup(Long groupId, String tenantId) {
        Group group = groupMapper.selectById(groupId);
        if (group == null || !tenantId.equals(group.getTenantId())) {
            throw new IllegalArgumentException("用户组不存在");
        }
        return group;
    }

    private void validateUnassignedMembership(User user, GroupMembershipRequest request, String tenantId,
                                              UserGroupMembership existing) {
        if (!Boolean.TRUE.equals(request.getPrimary())) {
            throw new IllegalArgumentException("未分配组只能作为账户主组");
        }
        if (!"member".equals(request.getMembershipRole())) {
            throw new IllegalArgumentException("未分配组不能设置组长");
        }
        long businessMemberships = membershipMapper.selectList(new LambdaQueryWrapper<UserGroupMembership>()
                .eq(UserGroupMembership::getTenantId, tenantId)
                .eq(UserGroupMembership::getUserId, user.getId()))
            .stream()
            .filter(membership -> existing == null || !membership.getId().equals(existing.getId()))
            .map(membership -> groupMapper.selectById(membership.getGroupId()))
            .filter(group -> group != null && "business".equals(group.getGroupType()))
            .count();
        if (businessMemberships > 0) {
            throw new IllegalArgumentException("用户已属于业务组，不能放入未分配组");
        }
        if (user.getGroupId() != null) {
            Group legacyPrimaryGroup = groupMapper.selectById(user.getGroupId());
            if (legacyPrimaryGroup != null && "business".equals(legacyPrimaryGroup.getGroupType())) {
                throw new IllegalArgumentException("用户当前主组仍是业务组，不能放入未分配组");
            }
        }
        if (hasGroupScopedRole(user.getId(), tenantId)) {
            throw new IllegalArgumentException("用户持有组作用域角色，必须选择真实业务组");
        }
    }

    private boolean hasGroupScopedRole(Long userId, String tenantId) {
        boolean legacyGroupRole = rbacService.getUserRoleIds(userId).stream()
            .map(roleMapper::selectById)
            .anyMatch(role -> role != null && "group".equals(role.getScope()));
        return legacyGroupRole || roleAssignmentMapper.findEffectiveScopes(tenantId, userId).contains("group");
    }

    private boolean isSuperAdmin(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) return false;
        Set<Long> roleIds = new HashSet<>(roleAssignmentMapper.findEffectiveRoleIds(user.getTenantId(), userId));
        return !roleIds.isEmpty() && roleMapper.selectBatchIds(roleIds).stream()
            .anyMatch(role -> "super_admin".equals(role.getCode()));
    }

    private UserGroupMembershipVO toVo(UserGroupMembership membership, Group group) {
        UserGroupMembershipVO vo = new UserGroupMembershipVO();
        vo.setId(membership.getId());
        vo.setGroupId(membership.getGroupId());
        vo.setGroupName(group == null ? null : group.getName());
        vo.setMembershipRole(membership.getMembershipRole());
        vo.setPrimary(membership.getIsPrimary());
        vo.setOriginType(membership.getOriginType());
        return vo;
    }

    private void audit(String tenantId, Long operatorId, Long userId, String action, String remark) {
        int inserted = auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId)
            .module("authorization")
            .action(action)
            .targetId(userId)
            .targetType("user")
            .operatorId(operatorId)
            .remark(remark)
            .createdAt(LocalDateTime.now())
            .build());

        if (inserted != 1) {
            throw new IllegalStateException("审计日志写入失败");
        }
    }
}
