package com.cwgsyw.platform.module.rbac;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.authorization.AuthorizationWriteLockService;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.org.UserGroupMembershipMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.rbac.dto.RoleAssignmentRequest;
import com.cwgsyw.platform.module.rbac.dto.RoleAssignmentVO;
import com.cwgsyw.platform.module.rbac.entity.RoleAssignment;
import com.cwgsyw.platform.module.rbac.entity.SysPermission;
import com.cwgsyw.platform.module.rbac.entity.SysRole;
import com.cwgsyw.platform.module.rbac.entity.SysUserRole;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class RoleAssignmentService {
    private final RoleAssignmentMapper assignmentMapper;
    private final SysUserRoleMapper userRoleMapper;
    private final SysRoleMapper roleMapper;
    private final UserMapper userMapper;
    private final GroupMapper groupMapper;
    private final AuditLogMapper auditLogMapper;
    private final SysRolePermissionMapper rolePermissionMapper;
    private final SysPermissionMapper permissionMapper;
    private final UserGroupMembershipMapper membershipMapper;
    private final AuthorizationWriteLockService authorizationWriteLockService;
    private final ActiveGroupReferenceValidator activeGroupReferenceValidator;

    public List<RoleAssignmentVO> list(Long userId, String tenantId) {
        requireUser(userId, tenantId);
        return assignmentMapper.selectList(new LambdaQueryWrapper<RoleAssignment>()
                .eq(RoleAssignment::getTenantId, tenantId)
                .eq(RoleAssignment::getUserId, userId)
                .orderByAsc(RoleAssignment::getId))
            .stream().map(this::toVo).toList();
    }

    public List<Long> findEffectiveRoleIds(Long userId, String tenantId) {
        return assignmentMapper.findEffectiveRoleIds(tenantId, userId);
    }

    public List<String> findEffectiveScopes(Long userId, String tenantId) {
        return assignmentMapper.findEffectiveScopes(tenantId, userId);
    }

    public List<String> findEffectiveScopesForPermission(Long userId, String tenantId,
                                                          String permissionCode) {
        return assignmentMapper.findEffectiveScopesForPermission(tenantId, userId, permissionCode);
    }

    @Transactional
    public RoleAssignment add(Long userId, RoleAssignmentRequest request,
                              String tenantId, Long operatorId,
                              Set<String> operatorPermissions, String operatorScope,
                              Long operatorGroupId) {
        authorizationWriteLockService.lockUserAuthorization(tenantId, userId);
        User user = requireUser(userId, tenantId);
        authorizationWriteLockService.lockRoleAuthorization(tenantId, request.getRoleId());
        SysRole role = requireRole(request.getRoleId(), tenantId);
        validateScope(request.getScopeType(), request.getScopeId(), tenantId);
        validateOperatorScope(request.getScopeType(), request.getScopeId(), operatorScope, operatorGroupId);
        if ("group".equals(request.getScopeType())) {
            authorizationWriteLockService.lockGroupAssignment(tenantId, userId, request.getScopeId());
            if (!membershipMapper.findActiveGroupIds(tenantId, userId).contains(request.getScopeId())) {
                throw new IllegalArgumentException("用户不属于目标作用域组");
            }
        }
        if (Boolean.TRUE.equals(role.getIsBuiltin())) {
            throw new IllegalArgumentException("内置角色不能通过新作用域分配入口授予");
        }
        validateDelegation(role, operatorPermissions, operatorScope);
        Long duplicateCount = assignmentMapper.selectCount(new LambdaQueryWrapper<RoleAssignment>()
            .eq(RoleAssignment::getTenantId, tenantId)
            .eq(RoleAssignment::getUserId, userId)
            .eq(RoleAssignment::getRoleId, role.getId())
            .eq(RoleAssignment::getScopeType, request.getScopeType())
            .eq(request.getScopeId() != null, RoleAssignment::getScopeId, request.getScopeId())
            .isNull(request.getScopeId() == null, RoleAssignment::getScopeId));
        if (duplicateCount > 0) throw new IllegalArgumentException("相同作用域的角色分配已存在");

        RoleAssignment assignment = new RoleAssignment();
        assignment.setTenantId(tenantId);
        assignment.setUserId(user.getId());
        assignment.setRoleId(role.getId());
        assignment.setScopeType(request.getScopeType());
        assignment.setScopeId(request.getScopeId());
        assignment.setValidUntil(request.getValidUntil());
        assignment.setOriginType("manual");
        assignment.setCreatedBy(operatorId);
        assignmentMapper.insert(assignment);
        audit(tenantId, operatorId, userId, "role_assignment_add",
            "分配角色: role=" + role.getCode() + ", scope=" + assignment.getScopeType()
                + ":" + assignment.getScopeId());
        return assignment;
    }

    @Transactional
    public void remove(Long userId, Long assignmentId, String tenantId, Long operatorId) {
        authorizationWriteLockService.lockUserAuthorization(tenantId, userId);
        RoleAssignment assignment = assignmentMapper.selectById(assignmentId);
        if (assignment == null || !tenantId.equals(assignment.getTenantId())
                || !userId.equals(assignment.getUserId())) {
            throw new IllegalArgumentException("角色分配不存在");
        }
        authorizationWriteLockService.lockRoleAuthorization(tenantId, assignment.getRoleId());
        SysRole role = roleMapper.selectById(assignment.getRoleId());
        if (role != null && "super_admin".equals(role.getCode())) {
            throw new IllegalArgumentException("不能通过通用入口撤销超级管理员");
        }
        if ("group".equals(assignment.getScopeType()) && assignment.getScopeId() != null) {
            authorizationWriteLockService.lockGroupAssignment(tenantId, userId, assignment.getScopeId());
        }
        int updated = assignmentMapper.softDeleteActiveAssignment(
            assignmentId, tenantId, userId, operatorId);
        if (updated != 1) {
            throw new IllegalStateException("角色分配撤销失败或状态已变化");
        }
        audit(tenantId, operatorId, userId, "role_assignment_remove",
            "撤销角色分配: assignment=" + assignmentId);
    }

    @Transactional
    public void replaceLegacyRoles(Long userId, List<Long> roleIds,
                                   String tenantId, Long primaryGroupId, Long operatorId) {
        authorizationWriteLockService.lockUserAuthorization(tenantId, userId);
        List<RoleAssignment> generatedAssignments = assignmentMapper.selectList(
            new LambdaQueryWrapper<RoleAssignment>()
                .eq(RoleAssignment::getTenantId, tenantId)
                .eq(RoleAssignment::getUserId, userId)
                .ne(RoleAssignment::getOriginType, "manual"));
        java.util.TreeSet<Long> lockedRoleIds = new java.util.TreeSet<>(roleIds);
        generatedAssignments.stream()
            .map(RoleAssignment::getRoleId)
            .filter(java.util.Objects::nonNull)
            .forEach(lockedRoleIds::add);
        lockedRoleIds.forEach(roleId ->
            authorizationWriteLockService.lockRoleAuthorization(tenantId, roleId));
        List<SysRole> roles = roleIds.stream()
            .map(roleId -> requireRole(roleId, tenantId))
            .toList();
        java.util.TreeSet<Long> lockedGroupIds = generatedAssignments.stream()
            .filter(assignment -> "group".equals(assignment.getScopeType()))
            .map(RoleAssignment::getScopeId)
            .filter(java.util.Objects::nonNull)
            .collect(java.util.stream.Collectors.toCollection(java.util.TreeSet::new));
        if (primaryGroupId != null && roles.stream().anyMatch(role -> "group".equals(role.getScope()))) {
            lockedGroupIds.add(primaryGroupId);
        }
        lockedGroupIds.forEach(groupId ->
            authorizationWriteLockService.lockGroupAssignment(tenantId, userId, groupId));
        Long effectivePrimaryGroupId = resolveActivePrimaryGroup(
            userId, tenantId, primaryGroupId, roles);

        userRoleMapper.delete(new LambdaQueryWrapper<SysUserRole>()
            .eq(SysUserRole::getUserId, userId));
        roles.forEach(role -> {
            SysUserRole userRole = new SysUserRole();
            userRole.setUserId(userId);
            userRole.setRoleId(role.getId());
            userRoleMapper.insert(userRole);
        });

        for (RoleAssignment assignment : generatedAssignments) {
            int updated = assignmentMapper.softDeleteActiveAssignment(
                assignment.getId(), tenantId, userId, operatorId);
            if (updated != 1) {
                throw new IllegalStateException("兼容角色分配撤销失败或状态已变化");
            }
        }

        roles.forEach(role -> {
            RoleAssignment assignment = compatibilityAssignment(
                userId, role, tenantId, effectivePrimaryGroupId, operatorId);
            if (assignment != null && !hasActiveAssignment(assignment)) assignmentMapper.insert(assignment);
        });
    }

    private Long resolveActivePrimaryGroup(Long userId, String tenantId, Long primaryGroupId,
                                           List<SysRole> roles) {
        if (primaryGroupId == null || roles.stream().noneMatch(role -> "group".equals(role.getScope()))) {
            return null;
        }
        User currentUser = requireUser(userId, tenantId);
        if (!primaryGroupId.equals(currentUser.getGroupId())) {
            return null;
        }
        return membershipMapper.findActiveGroupIds(tenantId, userId).contains(primaryGroupId)
            ? primaryGroupId
            : null;
    }

    private RoleAssignment compatibilityAssignment(Long userId, SysRole role, String tenantId,
                                                   Long primaryGroupId, Long operatorId) {
        String scope = role.getScope();
        if ("group".equals(scope) && primaryGroupId == null) return null;
        if (!List.of("platform", "tenant", "group").contains(scope)) return null;
        if ("group".equals(scope)) {
            Group group = groupMapper.selectById(primaryGroupId);
            if (group == null || !tenantId.equals(group.getTenantId())
                    || "unassigned".equals(group.getGroupType())) return null;
        }
        RoleAssignment assignment = new RoleAssignment();
        assignment.setTenantId(tenantId);
        assignment.setUserId(userId);
        assignment.setRoleId(role.getId());
        assignment.setScopeType(scope);
        assignment.setScopeId("group".equals(scope) ? primaryGroupId : null);
        assignment.setOriginType("compatibility");
        assignment.setOriginKey("sys_user_role:" + userId + ":" + role.getId());
        assignment.setCreatedBy(operatorId);
        return assignment;
    }

    private void validateScope(String scopeType, Long scopeId, String tenantId) {
        if ("tenant".equals(scopeType)) {
            if (scopeId != null) throw new IllegalArgumentException("tenant scope 不接受 scopeId");
            return;
        }
        if (!"group".equals(scopeType) || scopeId == null) {
            throw new IllegalArgumentException("group scope 必须提供 scopeId");
        }
        activeGroupReferenceValidator.lockAndRequire(tenantId, scopeId);
    }

    private void validateOperatorScope(String scopeType, Long scopeId,
                                       String operatorScope, Long operatorGroupId) {
        if ("platform".equals(operatorScope) || "tenant".equals(operatorScope)) return;
        if (!"group".equals(scopeType) || operatorGroupId == null || !operatorGroupId.equals(scopeId)) {
            throw new IllegalArgumentException("组级管理员只能在自己的主组内分配角色");
        }
    }

    private boolean hasActiveAssignment(RoleAssignment assignment) {
        return assignmentMapper.selectCount(new LambdaQueryWrapper<RoleAssignment>()
            .eq(RoleAssignment::getTenantId, assignment.getTenantId())
            .eq(RoleAssignment::getUserId, assignment.getUserId())
            .eq(RoleAssignment::getRoleId, assignment.getRoleId())
            .eq(RoleAssignment::getScopeType, assignment.getScopeType())
            .eq(assignment.getScopeId() != null, RoleAssignment::getScopeId, assignment.getScopeId())
            .isNull(assignment.getScopeId() == null, RoleAssignment::getScopeId)) > 0;
    }

    private User requireUser(Long userId, String tenantId) {
        User user = userMapper.selectById(userId);
        if (user == null || !tenantId.equals(user.getTenantId())) {
            throw new IllegalArgumentException("用户不存在");
        }
        return user;
    }

    private SysRole requireRole(Long roleId, String tenantId) {
        SysRole role = roleMapper.selectById(roleId);
        if (role == null || !tenantId.equals(role.getTenantId())) {
            throw new IllegalArgumentException("角色不存在");
        }
        return role;
    }

    private void validateDelegation(SysRole role, Set<String> operatorPermissions, String operatorScope) {
        if ("platform".equals(operatorScope)) return;
        List<Long> permissionIds = rolePermissionMapper.findPermissionIdsByRoleIds(List.of(role.getId()));
        List<String> permissionCodes = permissionIds.isEmpty() ? List.of()
            : permissionMapper.selectBatchIds(permissionIds).stream().map(SysPermission::getCode).toList();
        if (!operatorPermissions.containsAll(permissionCodes)) {
            throw new IllegalArgumentException("不能分配包含当前操作者无权委派权限的角色");
        }
    }

    private RoleAssignmentVO toVo(RoleAssignment assignment) {
        SysRole role = roleMapper.selectById(assignment.getRoleId());
        RoleAssignmentVO vo = new RoleAssignmentVO();
        vo.setId(assignment.getId());
        vo.setRoleId(assignment.getRoleId());
        vo.setRoleName(role == null ? null : role.getName());
        vo.setRoleCode(role == null ? null : role.getCode());
        vo.setScopeType(assignment.getScopeType());
        vo.setScopeId(assignment.getScopeId());
        if ("group".equals(assignment.getScopeType()) && assignment.getScopeId() != null) {
            Group group = groupMapper.selectById(assignment.getScopeId());
            vo.setScopeName(group == null ? null : group.getName());
        }
        vo.setValidUntil(assignment.getValidUntil());
        vo.setOriginType(assignment.getOriginType());
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
