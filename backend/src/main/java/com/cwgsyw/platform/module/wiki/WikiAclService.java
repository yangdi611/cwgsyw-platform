package com.cwgsyw.platform.module.wiki;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.rbac.SysRoleMapper;
import com.cwgsyw.platform.module.rbac.entity.SysRole;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.wiki.dto.AclEntryDTO;
import com.cwgsyw.platform.module.wiki.dto.WikiAclDTO;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import com.cwgsyw.platform.module.wiki.entity.WikiPageAcl;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class WikiAclService {

    public static final List<String> ALL_PERMS = List.of("read", "write", "delete", "publish");

    private final WikiPageMapper pageMapper;
    private final WikiPageAclMapper aclMapper;
    private final AuditLogMapper auditLogMapper;
    private final RbacService rbacService;
    private final UserMapper userMapper;
    private final GroupMapper groupMapper;
    private final SysRoleMapper roleMapper;
    private final ObjectMapper objectMapper;
    private final WikiSpaceService spaceService;
    private final ActiveGroupReferenceValidator activeGroupReferenceValidator;

    private boolean isAdmin(String groupScope) {
        return "tenant".equals(groupScope) || "platform".equals(groupScope);
    }

    private List<WikiPageAcl> aclRows(Long pageId) {
        return aclMapper.selectList(new LambdaQueryWrapper<WikiPageAcl>()
                .eq(WikiPageAcl::getPageId, pageId));
    }

    public boolean hasPermission(String tenantId, Long pageId, Long userId, Long groupId,
                                  String groupScope, String requiredPerm) {
        if (isAdmin(groupScope)) return true;
        if (pageId == null) return true;

        List<WikiPageAcl> effective = resolveEffectiveAcl(tenantId, pageId);
        if (effective == null) return true;

        List<Long> roleIds = rbacService.getUserRoleIds(userId);
        for (WikiPageAcl acl : effective) {
            if (acl.getPermissions() == null || !acl.getPermissions().contains(requiredPerm)) continue;
            if (matches(acl, userId, groupId, roleIds)) return true;
        }
        return false;
    }

    /**
     * 供 write/delete/publish 场景与空间级权限做 OR 叠加时使用——与 {@link #hasPermission} 的唯一区别是
     * 页面链上完全没有自定义 ACL 时返回 false（不额外授予任何权限），而不是 true。
     * {@code hasPermission} 的"无自定义 ACL 则放行"是专为 read 可见性设计的默认值，
     * 一旦被写权限判断复用，会等价于"任何登录用户对没设过页面级 ACL 的页面都有写/删/发布权限"，
     * 完全绕过空间级 ACL——历史 bug，见 docs/plan/wiki/space_ACL/SPEC.md 3.1 节。
     */
    public boolean hasExplicitPermission(String tenantId, Long pageId, Long userId, Long groupId,
                                          String groupScope, String requiredPerm) {
        if (isAdmin(groupScope)) return true;
        if (pageId == null) return false;

        List<WikiPageAcl> effective = resolveEffectiveAcl(tenantId, pageId);
        if (effective == null) return false;

        List<Long> roleIds = rbacService.getUserRoleIds(userId);
        for (WikiPageAcl acl : effective) {
            if (acl.getPermissions() == null || !acl.getPermissions().contains(requiredPerm)) continue;
            if (matches(acl, userId, groupId, roleIds)) return true;
        }
        return false;
    }

    private boolean matches(WikiPageAcl acl, Long userId, Long groupId, List<Long> roleIds) {
        return switch (acl.getSubjectType()) {
            case "user" -> Objects.equals(acl.getSubjectId(), userId);
            case "group" -> groupId != null && Objects.equals(acl.getSubjectId(), groupId);
            case "role" -> roleIds.contains(acl.getSubjectId());
            default -> false;
        };
    }

    private List<WikiPageAcl> resolveEffectiveAcl(String tenantId, Long pageId) {
        List<WikiPage> chain = pageMapper.findAncestorChain(tenantId, pageId);
        for (WikiPage p : chain) {
            if (Boolean.FALSE.equals(p.getAclInherited())) {
                return aclRows(p.getId());
            }
        }
        return null;
    }

    public WikiAclDTO getAcl(String tenantId, Long pageId) {
        WikiPage page = pageMapper.selectById(pageId);
        if (page == null || !tenantId.equals(page.getTenantId())) {
            throw new IllegalArgumentException("页面不存在: " + pageId);
        }
        WikiAclDTO dto = new WikiAclDTO();
        dto.setPageId(pageId);
        boolean inherited = !Boolean.FALSE.equals(page.getAclInherited());
        dto.setInherited(inherited);
        dto.setEntries(toEntryDTOs(aclRows(pageId)));
        dto.setForcedEntries(spaceService.computePageForcedGrants(tenantId, page.getSpaceId()));
        // 当前处于继承状态时，把从祖先链解析出的有效权限也带给前端，供切到"自定义"时预填，
        // 避免管理员切换模式后误以为之前继承来的权限还在（实际上自定义后不再继承任何祖先设置）。
        if (inherited) {
            List<WikiPageAcl> ancestorEffective = resolveEffectiveAcl(tenantId, pageId);
            dto.setInheritedEntries(ancestorEffective == null ? List.of() : toEntryDTOs(ancestorEffective));
        } else {
            dto.setInheritedEntries(List.of());
        }
        return dto;
    }

    private List<AclEntryDTO> toEntryDTOs(List<WikiPageAcl> rows) {
        if (rows.isEmpty()) return new ArrayList<>();
        Set<Long> userIds = rows.stream().filter(r -> "user".equals(r.getSubjectType()))
                .map(WikiPageAcl::getSubjectId).collect(Collectors.toSet());
        Set<Long> groupIds = rows.stream().filter(r -> "group".equals(r.getSubjectType()))
                .map(WikiPageAcl::getSubjectId).collect(Collectors.toSet());
        Set<Long> roleIds = rows.stream().filter(r -> "role".equals(r.getSubjectType()))
                .map(WikiPageAcl::getSubjectId).collect(Collectors.toSet());

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

    @Transactional
    public void setAcl(String tenantId, Long pageId, Long operatorId, WikiAclDTO dto) {
        WikiPage page = pageMapper.selectById(pageId);
        if (page == null || !tenantId.equals(page.getTenantId())) {
            throw new IllegalArgumentException("页面不存在: " + pageId);
        }
        validateGroupEntries(tenantId, dto.getEntries());
        String beforeJson = snapshot(page, aclRows(pageId));

        page.setAclInherited(dto.isInherited());
        page.setUpdatedAt(LocalDateTime.now());
        pageMapper.updateById(page);

        for (WikiPageAcl row : aclRows(pageId)) {
            aclMapper.deleteById(row.getId());
        }

        if (!dto.isInherited() && dto.getEntries() != null) {
            for (AclEntryDTO e : dto.getEntries()) {
                if (e.getPermissions() == null || e.getPermissions().isEmpty()) continue;
                WikiPageAcl row = new WikiPageAcl();
                row.setTenantId(tenantId);
                row.setPageId(pageId);
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

        String afterJson = snapshot(page, aclRows(pageId));
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("wiki").action("acl_update")
                .targetId(pageId).targetType("wiki_page").operatorId(operatorId)
                .beforeJson(beforeJson).afterJson(afterJson)
                .remark("page=" + page.getTitle() + " inherited=" + dto.isInherited())
                .createdAt(LocalDateTime.now()).build());
    }

    private void validateGroupEntries(String tenantId, List<AclEntryDTO> entries) {
        if (entries == null) return;
        entries.stream().filter(entry -> "group".equals(entry.getSubjectType()))
            .map(AclEntryDTO::getSubjectId).distinct().sorted()
            .forEach(groupId -> activeGroupReferenceValidator.lockAndRequire(tenantId, groupId));
    }

    private String snapshot(WikiPage page, List<WikiPageAcl> rows) {
        try {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("inherited", !Boolean.FALSE.equals(page.getAclInherited()));
            m.put("entries", rows.stream().map(r -> Map.of(
                    "type", r.getSubjectType(), "id", r.getSubjectId(),
                    "perms", r.getPermissions() == null ? List.of() : r.getPermissions()
            )).collect(Collectors.toList()));
            return objectMapper.writeValueAsString(m);
        } catch (Exception e) { return "{}"; }
    }
}
