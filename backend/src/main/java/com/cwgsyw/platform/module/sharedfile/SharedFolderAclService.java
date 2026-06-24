package com.cwgsyw.platform.module.sharedfile;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.rbac.entity.SysRole;
import com.cwgsyw.platform.module.rbac.SysRoleMapper;
import com.cwgsyw.platform.module.sharedfile.dto.AclEntryDTO;
import com.cwgsyw.platform.module.sharedfile.dto.FolderAclDTO;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFolder;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFolderAcl;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 文件夹 ACL：覆盖式继承（NTFS 风格）。
 * <p>生效 ACL = 自下而上第一个 acl_inherited=false 的祖先的 ACL 行；
 * 若整条链都继承，则视为无 ACL 限制（仅受 RBAC 控制）。
 * <p>admin/super_admin（groupScope=tenant/platform）始终绕过 ACL。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SharedFolderAclService {

    private final SharedFolderMapper folderMapper;
    private final SharedFolderAclMapper aclMapper;
    private final AuditLogMapper auditLogMapper;
    private final RbacService rbacService;
    private final UserMapper userMapper;
    private final GroupMapper groupMapper;
    private final SysRoleMapper roleMapper;
    private final ObjectMapper objectMapper;

    public static final List<String> ALL_PERMS = List.of("read", "write", "update", "delete");

    private boolean isAdmin(String groupScope) {
        return "tenant".equals(groupScope) || "platform".equals(groupScope);
    }

    /** 读取某文件夹的 ACL 行（用 LambdaQueryWrapper 确保 JacksonTypeHandler 生效） */
    private List<SharedFolderAcl> aclRows(Long folderId) {
        return aclMapper.selectList(new LambdaQueryWrapper<SharedFolderAcl>()
                .eq(SharedFolderAcl::getFolderId, folderId));
    }

    /**
     * 校验用户对某文件夹是否有指定权限。folderId 为 null（根/全部文件）时不受 ACL 约束。
     */
    public boolean hasPermission(String tenantId, Long folderId, Long userId, Long groupId,
                                 String groupScope, String requiredPerm) {
        if (isAdmin(groupScope)) return true;
        if (folderId == null) return true; // 根层不做 ACL 限制

        List<SharedFolderAcl> effective = resolveEffectiveAcl(tenantId, folderId);
        if (effective == null) return true; // 整条链都继承 → 无限制

        List<Long> roleIds = rbacService.getUserRoleIds(userId);
        for (SharedFolderAcl acl : effective) {
            if (acl.getPermissions() == null || !acl.getPermissions().contains(requiredPerm)) continue;
            if (matches(acl, userId, groupId, roleIds)) return true;
        }
        return false;
    }

    private boolean matches(SharedFolderAcl acl, Long userId, Long groupId, List<Long> roleIds) {
        return switch (acl.getSubjectType()) {
            case "user" -> Objects.equals(acl.getSubjectId(), userId);
            case "group" -> groupId != null && Objects.equals(acl.getSubjectId(), groupId);
            case "role" -> roleIds.contains(acl.getSubjectId());
            default -> false;
        };
    }

    /**
     * 自下而上找第一个 acl_inherited=false 的祖先，返回其 ACL 行。
     * 返回 null 表示整条链都继承（无自定义 ACL，不做限制）。
     */
    private List<SharedFolderAcl> resolveEffectiveAcl(String tenantId, Long folderId) {
        List<SharedFolder> chain = folderMapper.findAncestorChain(tenantId, folderId);
        for (SharedFolder f : chain) {
            if (Boolean.FALSE.equals(f.getAclInherited())) {
                return aclRows(f.getId());
            }
        }
        return null;
    }

    /** 读取某文件夹自身的 ACL 配置（含 inherited 标志和解析后的名称） */
    public FolderAclDTO getAcl(String tenantId, Long folderId) {
        SharedFolder folder = folderMapper.selectById(folderId);
        if (folder == null || !tenantId.equals(folder.getTenantId())) {
            throw new IllegalArgumentException("文件夹不存在: " + folderId);
        }
        List<SharedFolderAcl> rows = aclRows(folderId);

        FolderAclDTO dto = new FolderAclDTO();
        dto.setFolderId(folderId);
        dto.setInherited(!Boolean.FALSE.equals(folder.getAclInherited()));
        dto.setEntries(toEntryDTOs(rows));
        return dto;
    }

    private List<AclEntryDTO> toEntryDTOs(List<SharedFolderAcl> rows) {
        if (rows.isEmpty()) return new ArrayList<>();

        Set<Long> userIds = rows.stream().filter(r -> "user".equals(r.getSubjectType()))
                .map(SharedFolderAcl::getSubjectId).collect(Collectors.toSet());
        Set<Long> groupIds = rows.stream().filter(r -> "group".equals(r.getSubjectType()))
                .map(SharedFolderAcl::getSubjectId).collect(Collectors.toSet());
        Set<Long> roleIds = rows.stream().filter(r -> "role".equals(r.getSubjectType()))
                .map(SharedFolderAcl::getSubjectId).collect(Collectors.toSet());

        Map<Long, String> userNames = userIds.isEmpty() ? Map.of() :
                userMapper.selectBatchIds(userIds).stream().collect(Collectors.toMap(
                        User::getId, u -> u.getRealName() != null ? u.getRealName() : u.getUsername()));
        Map<Long, String> groupNames = groupIds.isEmpty() ? Map.of() :
                groupMapper.selectBatchIds(groupIds).stream().collect(Collectors.toMap(
                        Group::getId, Group::getName));
        Map<Long, String> roleNames = roleIds.isEmpty() ? Map.of() :
                roleMapper.selectBatchIds(roleIds).stream().collect(Collectors.toMap(
                        SysRole::getId, SysRole::getName));

        return rows.stream().map(r -> {
            AclEntryDTO e = new AclEntryDTO();
            e.setSubjectType(r.getSubjectType());
            e.setSubjectId(r.getSubjectId());
            e.setPermissions(r.getPermissions());
            e.setSubjectName(switch (r.getSubjectType()) {
                case "user" -> userNames.getOrDefault(r.getSubjectId(), "用户#" + r.getSubjectId());
                case "group" -> groupNames.getOrDefault(r.getSubjectId(), "组#" + r.getSubjectId());
                case "role" -> roleNames.getOrDefault(r.getSubjectId(), "角色#" + r.getSubjectId());
                default -> String.valueOf(r.getSubjectId());
            });
            return e;
        }).collect(Collectors.toList());
    }

    /** 全量替换某文件夹的 ACL（含 inherited 标志），写审计日志 */
    @Transactional
    public void setAcl(String tenantId, Long folderId, Long operatorId, FolderAclDTO dto) {
        SharedFolder folder = folderMapper.selectById(folderId);
        if (folder == null || !tenantId.equals(folder.getTenantId())) {
            throw new IllegalArgumentException("文件夹不存在: " + folderId);
        }
        String beforeJson = snapshot(folder, aclRows(folderId));

        folder.setAclInherited(dto.isInherited());
        folder.setUpdatedAt(LocalDateTime.now());
        folderMapper.updateById(folder);

        // 软删旧条目
        for (SharedFolderAcl row : aclRows(folderId)) {
            aclMapper.deleteById(row.getId());
        }

        // 自定义模式写入新条目
        if (!dto.isInherited() && dto.getEntries() != null) {
            for (AclEntryDTO e : dto.getEntries()) {
                if (e.getPermissions() == null || e.getPermissions().isEmpty()) continue;
                SharedFolderAcl row = new SharedFolderAcl();
                row.setTenantId(tenantId);
                row.setFolderId(folderId);
                row.setSubjectType(e.getSubjectType());
                row.setSubjectId(e.getSubjectId());
                row.setPermissions(e.getPermissions().stream()
                        .filter(ALL_PERMS::contains).collect(Collectors.toList()));
                row.setCreatedBy(operatorId);
                row.setCreatedAt(LocalDateTime.now());
                row.setUpdatedAt(LocalDateTime.now());
                aclMapper.insert(row);
            }
        }

        String afterJson = snapshot(folder, aclRows(folderId));
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("shared_file").action("acl_update")
                .targetId(folderId).targetType("shared_folder").operatorId(operatorId)
                .beforeJson(beforeJson).afterJson(afterJson)
                .remark("folder=" + folder.getName() + " inherited=" + dto.isInherited())
                .createdAt(LocalDateTime.now()).build());
    }

    private String snapshot(SharedFolder folder, List<SharedFolderAcl> rows) {
        try {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("inherited", !Boolean.FALSE.equals(folder.getAclInherited()));
            m.put("entries", rows.stream().map(r -> Map.of(
                    "type", r.getSubjectType(), "id", r.getSubjectId(),
                    "perms", r.getPermissions() == null ? List.of() : r.getPermissions()
            )).collect(Collectors.toList()));
            return objectMapper.writeValueAsString(m);
        } catch (Exception e) { return "{}"; }
    }
}

