package com.cwgsyw.platform.module.org;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.org.dto.GroupMembershipRequest;
import com.cwgsyw.platform.module.org.dto.UserGroupMembershipVO;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.org.entity.UserGroupMembership;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.rbac.SysRoleMapper;
import com.cwgsyw.platform.module.rbac.RoleAssignmentMapper;
import com.cwgsyw.platform.module.rbac.SysUserRoleMapper;
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
    private final SysUserRoleMapper userRoleMapper;

    public List<UserGroupMembershipVO> list(Long userId, String tenantId) {
        requireUser(userId, tenantId);
        return membershipMapper.selectList(new LambdaQueryWrapper<UserGroupMembership>()
                .eq(UserGroupMembership::getTenantId, tenantId)
                .eq(UserGroupMembership::getUserId, userId)
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
        User user = requireUser(userId, tenantId);
        Group group = requireGroup(request.getGroupId(), tenantId);
        if (isSuperAdmin(userId)) throw new IllegalArgumentException("超级管理员必须保持无组状态");
        UserGroupMembership existing = find(userId, group.getId(), tenantId);
        boolean primary = Boolean.TRUE.equals(request.getPrimary());
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
            clearPrimary(userId, tenantId, operatorId);
            return;
        }
        setPrimaryMembership(userId, groupId, tenantId, operatorId);
    }

    @Transactional
    public void remove(Long userId, Long membershipId, String tenantId, Long operatorId) {
        UserGroupMembership membership = membershipMapper.selectById(membershipId);
        if (membership == null || !tenantId.equals(membership.getTenantId())
                || !userId.equals(membership.getUserId())) {
            throw new IllegalArgumentException("成员关系不存在");
        }
        removeMembership(membership, tenantId, operatorId);
    }

    @Transactional
    public void removeByGroup(Long userId, Long groupId, String tenantId, Long operatorId) {
        UserGroupMembership membership = find(userId, groupId, tenantId);
        if (membership == null) {
            User user = requireUser(userId, tenantId);
            if (!groupId.equals(user.getGroupId())) throw new IllegalArgumentException("用户不在当前组中");
            user.setGroupId(null);
            userMapper.updateById(user);
            audit(tenantId, operatorId, userId, "membership_remove_legacy",
                "移除尚未回填的旧主组关系: group=" + groupId);
            return;
        }
        removeMembership(membership, tenantId, operatorId);
    }

    private void removeMembership(UserGroupMembership membership, String tenantId, Long operatorId) {
        if (Boolean.TRUE.equals(membership.getIsPrimary())) {
            User user = requireUser(membership.getUserId(), tenantId);
            if (membership.getGroupId().equals(user.getGroupId())) {
                user.setGroupId(null);
                userMapper.updateById(user);
            }
        }
        membership.setDeletedAt(LocalDateTime.now());
        membership.setDeletedBy(operatorId);
        membershipMapper.deleteById(membership);
        audit(tenantId, operatorId, membership.getUserId(), "membership_remove",
            "移除组成员关系: group=" + membership.getGroupId());
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
        Set<Long> roleIds = new HashSet<>(userRoleMapper.findRoleIdsByUserId(userId));
        roleIds.addAll(roleAssignmentMapper.findEffectiveRoleIds(user.getTenantId(), userId));
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
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId)
            .module("authorization")
            .action(action)
            .targetId(userId)
            .targetType("user")
            .operatorId(operatorId)
            .remark(remark)
            .createdAt(LocalDateTime.now())
            .build());
    }
}
