package com.cwgsyw.platform.module.rbac;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.rbac.dto.CreateRoleRequest;
import com.cwgsyw.platform.module.rbac.dto.UpdateRoleRequest;
import com.cwgsyw.platform.module.rbac.entity.RoleAssignment;
import com.cwgsyw.platform.module.rbac.entity.SysPermission;
import com.cwgsyw.platform.module.rbac.entity.SysRole;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class RoleManagementService {
    private final SysRoleMapper roleMapper;
    private final SysPermissionMapper permissionMapper;
    private final SysUserRoleMapper userRoleMapper;
    private final RoleAssignmentMapper assignmentMapper;
    private final RbacService rbacService;
    private final AuditLogMapper auditLogMapper;

    public PageResult<SysRole> list(int page, int size, String tenantId) {
        LambdaQueryWrapper<SysRole> query = new LambdaQueryWrapper<SysRole>()
            .eq(SysRole::getTenantId, tenantId)
            .orderByDesc(SysRole::getIsBuiltin)
            .orderByAsc(SysRole::getId);
        Page<SysRole> result = roleMapper.selectPage(new Page<>(page, size, false), query);
        result.setTotal(roleMapper.selectCount(new LambdaQueryWrapper<SysRole>()
            .eq(SysRole::getTenantId, tenantId)));
        return PageResult.of(result);
    }

    @Transactional
    public SysRole create(CreateRoleRequest request, String tenantId, Long operatorId,
                          Set<String> operatorPermissions, String operatorScope) {
        Long duplicateCount = roleMapper.selectCount(new LambdaQueryWrapper<SysRole>()
            .eq(SysRole::getTenantId, tenantId)
            .eq(SysRole::getCode, request.getCode()));
        if (duplicateCount > 0) throw new IllegalArgumentException("角色编码已存在");
        validatePermissions(request.getPermissionIds());
        validateDelegation(request.getPermissionIds(), operatorPermissions, operatorScope);

        SysRole role = new SysRole();
        role.setTenantId(tenantId);
        role.setName(request.getName());
        role.setCode(request.getCode());
        role.setDescription(request.getDescription());
        role.setScope("group");
        role.setRoleType("functional");
        role.setIsBuiltin(false);
        role.setIsLegacy(false);
        role.setCreatedBy(operatorId);
        roleMapper.insert(role);
        rbacService.assignPermissionsToRole(role.getId(), request.getPermissionIds());
        audit(tenantId, operatorId, role.getId(), "role_create", "创建功能角色: " + role.getCode());
        return role;
    }

    @Transactional
    public SysRole update(Long roleId, UpdateRoleRequest request, String tenantId, Long operatorId,
                          Set<String> operatorPermissions, String operatorScope) {
        SysRole role = requireCustomRole(roleId, tenantId);
        role.setName(request.getName());
        role.setDescription(request.getDescription());
        role.setUpdatedBy(operatorId);
        roleMapper.updateById(role);
        if (request.getPermissionIds() != null) {
            validatePermissions(request.getPermissionIds());
            validateDelegation(request.getPermissionIds(), operatorPermissions, operatorScope);
            rbacService.assignPermissionsToRole(roleId, request.getPermissionIds());
        }
        audit(tenantId, operatorId, roleId, "role_update", "更新功能角色: " + role.getCode());
        return role;
    }

    @Transactional
    public void assignPermissions(Long roleId, List<Long> permissionIds,
                                  String tenantId, Long operatorId,
                                  Set<String> operatorPermissions, String operatorScope) {
        SysRole role = requireCustomRole(roleId, tenantId);
        validatePermissions(permissionIds);
        validateDelegation(permissionIds, operatorPermissions, operatorScope);
        rbacService.assignPermissionsToRole(roleId, permissionIds == null ? List.of() : permissionIds);
        audit(tenantId, operatorId, roleId, "role_permissions_update",
            "更新功能角色权限: " + role.getCode());
    }

    @Transactional
    public void delete(Long roleId, String tenantId, Long operatorId) {
        SysRole role = requireCustomRole(roleId, tenantId);
        if (!userRoleMapper.findUserIdsByRoleIds(List.of(roleId)).isEmpty()) {
            throw new IllegalArgumentException("角色仍被旧账户授权使用，无法删除");
        }
        Long assignmentCount = assignmentMapper.selectCount(new LambdaQueryWrapper<RoleAssignment>()
            .eq(RoleAssignment::getTenantId, tenantId)
            .eq(RoleAssignment::getRoleId, roleId));
        if (assignmentCount > 0) throw new IllegalArgumentException("角色仍有有效分配，无法删除");
        role.setDeletedAt(LocalDateTime.now());
        role.setDeletedBy(operatorId);
        roleMapper.deleteById(role);
        audit(tenantId, operatorId, roleId, "role_delete", "删除功能角色: " + role.getCode());
    }

    private SysRole requireCustomRole(Long roleId, String tenantId) {
        SysRole role = roleMapper.selectById(roleId);
        if (role == null || !tenantId.equals(role.getTenantId())) {
            throw new IllegalArgumentException("角色不存在");
        }
        if (Boolean.TRUE.equals(role.getIsBuiltin()) || !"functional".equals(role.getRoleType())) {
            throw new IllegalArgumentException("内置或管理角色受保护，不能修改");
        }
        return role;
    }

    private void validatePermissions(List<Long> permissionIds) {
        List<Long> ids = permissionIds == null ? List.of() : permissionIds.stream().distinct().toList();
        if (ids.isEmpty()) return;
        List<SysPermission> permissions = permissionMapper.selectBatchIds(ids);
        if (permissions.size() != ids.size()) throw new IllegalArgumentException("包含不存在的权限");
    }

    private void validateDelegation(List<Long> permissionIds, Set<String> operatorPermissions,
                                    String operatorScope) {
        if ("platform".equals(operatorScope) || permissionIds == null || permissionIds.isEmpty()) return;
        List<String> requestedCodes = permissionMapper.selectBatchIds(permissionIds).stream()
            .map(SysPermission::getCode)
            .toList();
        if (!operatorPermissions.containsAll(requestedCodes)) {
            throw new IllegalArgumentException("不能授予当前操作者不具备的权限");
        }
    }

    private void audit(String tenantId, Long operatorId, Long roleId, String action, String remark) {
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId)
            .module("authorization")
            .action(action)
            .targetId(roleId)
            .targetType("role")
            .operatorId(operatorId)
            .remark(remark)
            .createdAt(LocalDateTime.now())
            .build());
    }
}
