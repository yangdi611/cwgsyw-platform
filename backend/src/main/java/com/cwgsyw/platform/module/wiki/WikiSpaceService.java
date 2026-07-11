package com.cwgsyw.platform.module.wiki;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.rbac.SysRoleMapper;
import com.cwgsyw.platform.module.rbac.entity.SysPermission;
import com.cwgsyw.platform.module.rbac.entity.SysRole;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.wiki.dto.AclForcedGrantDTO;
import com.cwgsyw.platform.module.wiki.dto.SpaceAclEntryDTO;
import com.cwgsyw.platform.module.wiki.dto.WikiSpaceAclDTO;
import com.cwgsyw.platform.module.wiki.dto.WikiSpaceVO;
import com.cwgsyw.platform.module.wiki.entity.WikiSpace;
import com.cwgsyw.platform.module.wiki.entity.WikiSpaceAcl;
import com.cwgsyw.platform.security.SecurityUser;
import com.cwgsyw.platform.module.authorization.AuthorizationService;
import com.cwgsyw.platform.module.authorization.AuthorizationResourceMigrationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WikiSpaceService {

    /** 空间级 ACL 合法动词，不含 read（所有登录用户对用户自建空间恒定可读，见 SPEC 3.3 节） */
    public static final List<String> SPACE_ACL_PERMS = List.of("create", "update", "delete", "publish");

    private final WikiSpaceMapper spaceMapper;
    private final WikiPageMapper pageMapper;
    private final WikiSpaceAclMapper spaceAclMapper;
    private final AuditLogMapper auditLogMapper;
    private final UserMapper userMapper;
    private final GroupMapper groupMapper;
    private final SysRoleMapper roleMapper;
    private final RbacService rbacService;
    private final ObjectMapper objectMapper;
    private final AuthorizationService authorizationService;
    private final AuthorizationResourceMigrationService resourceMigrationService;

    private boolean isAdmin(String groupScope) {
        return "tenant".equals(groupScope) || "platform".equals(groupScope);
    }

    public List<WikiSpaceVO> listSpaces(String tenantId, SecurityUser user) {
        List<WikiSpace> spaces = spaceMapper.selectList(new LambdaQueryWrapper<WikiSpace>()
                .eq(WikiSpace::getTenantId, tenantId));
        return spaces.stream().filter(space -> canReadSpace(space.getId(), user)).map(s -> {
            long count = pageMapper.selectCount(new LambdaQueryWrapper<
                    com.cwgsyw.platform.module.wiki.entity.WikiPage>()
                    .eq(com.cwgsyw.platform.module.wiki.entity.WikiPage::getSpaceId, s.getId()));
            User creator = userMapper.selectById(s.getCreatedBy());
            return toVO(s, count, creator, user);
        }).collect(Collectors.toList());
    }

    public boolean canReadSpace(Long spaceId, SecurityUser user) {
        return authorizationService.decideWithCompatibility(user, "wiki", "wiki:read",
            "wiki_space", spaceId, 5, true);
    }

    @Transactional
    public WikiSpaceVO createSpace(String tenantId, SecurityUser user, String name, String description,
                                   Long ownerGroupId) {
        Long userId = user.getUserId();
        WikiSpace space = new WikiSpace();
        space.setTenantId(tenantId);
        space.setName(name);
        space.setDescription(description);
        space.setCreatedBy(userId);
        space.setCreatedAt(LocalDateTime.now());
        space.setUpdatedAt(LocalDateTime.now());
        spaceMapper.insert(space);
        resourceMigrationService.initializeCreatedResource(tenantId, "wiki_space", space.getId(),
            userId, ownerGroupId, 02770);
        // 创建人所在组自动获得空间全权限（create/update/delete/publish），使团队协作无需手动授权；
        // 创建人本人已经通过 hasWritePermission 的“创建人”分支天然放行，此处只补组维度。
        // 创建人无归属组（如平台管理员建空间）时静默跳过，不阻断建空间流程。
        if (ownerGroupId != null) {
            WikiSpaceAcl groupAcl = new WikiSpaceAcl();
            groupAcl.setTenantId(tenantId);
            groupAcl.setSpaceId(space.getId());
            groupAcl.setSubjectType("group");
            groupAcl.setSubjectId(ownerGroupId);
            groupAcl.setPermissions(SPACE_ACL_PERMS);
            groupAcl.setCreatedBy(userId);
            groupAcl.setCreatedAt(LocalDateTime.now());
            groupAcl.setUpdatedAt(LocalDateTime.now());
            spaceAclMapper.insert(groupAcl);
        }
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("wiki").action("create")
                .targetId(space.getId()).targetType("wiki_space").operatorId(userId)
                .afterJson(toJson(space)).createdAt(LocalDateTime.now()).build());
        User creator = userMapper.selectById(userId);
        return toVO(space, 0L, creator, user);
    }

    @Transactional
    public WikiSpaceVO updateSpace(String tenantId, Long spaceId, SecurityUser user, String name, String description) {
        WikiSpace space = requireSpace(tenantId, spaceId);
        checkCanWrite(tenantId, spaceId, user, "update");
        Long userId = user.getUserId();
        String before = toJson(space);
        space.setName(name);
        space.setDescription(description);
        space.setUpdatedBy(userId);
        space.setUpdatedAt(LocalDateTime.now());
        spaceMapper.updateById(space);
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("wiki").action("update")
                .targetId(spaceId).targetType("wiki_space").operatorId(userId)
                .beforeJson(before).afterJson(toJson(space)).createdAt(LocalDateTime.now()).build());
        long count = pageMapper.selectCount(new LambdaQueryWrapper<
                com.cwgsyw.platform.module.wiki.entity.WikiPage>()
                .eq(com.cwgsyw.platform.module.wiki.entity.WikiPage::getSpaceId, spaceId));
        User creator = userMapper.selectById(space.getCreatedBy());
        return toVO(space, count, creator, user);
    }

    @Transactional
    public void deleteSpace(String tenantId, Long spaceId, Long userId) {
        WikiSpace space = spaceMapper.selectById(spaceId);
        if (space == null || !tenantId.equals(space.getTenantId())) throw new IllegalArgumentException("空间不存在");
        long count = pageMapper.selectCount(new LambdaQueryWrapper<
                com.cwgsyw.platform.module.wiki.entity.WikiPage>()
                .eq(com.cwgsyw.platform.module.wiki.entity.WikiPage::getSpaceId, spaceId));
        if (count > 0) throw new IllegalStateException("空间非空，请先删除全部页面");
        String before = toJson(space);
        spaceMapper.deleteById(spaceId);   // @TableLogic 逻辑删除
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("wiki").action("delete")
                .targetId(spaceId).targetType("wiki_space").operatorId(userId)
                .beforeJson(before).createdAt(LocalDateTime.now()).build());
    }

    /**
     * 空间级写权限判定。系统空间（seedKey != null）必须最先判断，且完全独立于 admin/角色原生权限——
     * 此前的判断顺序是 admin → 角色原生权限 → 系统空间短路 → 创建人 → 空间 ACL，导致任何带 wiki:update
     * 等原生权限的角色（甚至 admin/super_admin 本身）都能绕过系统空间的锁定，2026-07-06 修复：
     *   - write_scope=all（Bug 反馈与建议）：所有登录用户可 create/update/publish；delete 仅 admin/super_admin
     *     （管理员保留清理垃圾/违规反馈的能力，其余人不可删，防止误删他人反馈）
     *   - 其余取值（none/super_admin_only，平台使用手册/Release Notes）：任何人（含 admin/super_admin）
     *     都不可创建/写/改/删/发布，只能通过评论反馈——内容由 WikiManualSeeder 从 manifest.yaml 单向维护，
     *     开放 UI 编辑会与源文件产生分歧
     * 用户自建空间（seedKey == null）维持原判定顺序：admin → 角色自带权限 → 创建人 → 空间 ACL 命中，
     * 任一满足即放行（见 SPEC 6.1 节）。步骤 2（角色自带权限）是对 PRD 5.2 节伪代码遗漏分支的修正，
     * 缺了这一步会导致现有 member/group_leader 角色的正常编辑能力被整体回归。
     * 返回 boolean 而非直接抛异常——便于在 WikiPageService.checkWritePermission 中与页面级 ACL 做 OR 组合判断。
     */
    public boolean hasWritePermission(String tenantId, Long spaceId, SecurityUser user, String action) {
        WikiSpace space = spaceMapper.selectById(spaceId);
        if (space == null || !tenantId.equals(space.getTenantId())) {
            throw new IllegalArgumentException("空间不存在: " + spaceId);
        }
        String permissionCode = "wiki:" + action;
        int requiredBits = "create".equals(action) ? 3 : 2;
        if (space.getSeedKey() != null) {
            boolean policyAllowed = "all".equals(space.getWriteScope())
                && (!"delete".equals(action) || isAdmin(user.getGroupScope()));
            return authorizationService.decideWithPolicyCompatibility(user, "wiki", permissionCode,
                "wiki_space", spaceId, requiredBits, policyAllowed, policyAllowed);
        }
        if (authorizationService.isEnforced(user, "wiki")) {
            return authorizationService.decideWithCompatibility(user, "wiki", permissionCode,
                "wiki_space", spaceId, requiredBits, false);
        }
        boolean legacyAllowed = isAdmin(user.getGroupScope())
            || user.getPermissions().contains("wiki:" + action)
            || (space.getCreatedBy() != null && space.getCreatedBy().equals(user.getUserId()));
        if (!legacyAllowed) {
            List<WikiSpaceAcl> rows = spaceAclMapper.selectList(new LambdaQueryWrapper<WikiSpaceAcl>()
                .eq(WikiSpaceAcl::getSpaceId, spaceId));
            List<Long> roleIds = rbacService.getUserRoleIds(user.getUserId());
            legacyAllowed = rows.stream().anyMatch(acl -> acl.getPermissions() != null
                && acl.getPermissions().contains(action)
                && matches(acl, user.getUserId(), user.getGroupId(), roleIds));
        }
        return authorizationService.decideWithCompatibility(user, "wiki", permissionCode,
            "wiki_space", spaceId, requiredBits, legacyAllowed);
    }

    /**
     * checkCanWrite = hasWritePermission 的强制版本，供只需要单一空间级判断（不需要叠加页面级 ACL）
     * 的调用点直接使用，例如 updateSpace（空间本身没有页面级 ACL 概念）。
     * 失败直接抛 AccessDeniedException，调用方不必再手动检查返回值。
     */
    public void checkCanWrite(String tenantId, Long spaceId, SecurityUser user, String action) {
        if (!hasWritePermission(tenantId, spaceId, user, action)) {
            throw new AccessDeniedException("无权限在此空间执行 " + action);
        }
    }

    private boolean matches(WikiSpaceAcl acl, Long userId, Long groupId, List<Long> roleIds) {
        return switch (acl.getSubjectType()) {
            case "user" -> Objects.equals(acl.getSubjectId(), userId);
            case "group" -> groupId != null && Objects.equals(acl.getSubjectId(), groupId);
            case "role" -> roleIds.contains(acl.getSubjectId());
            default -> false;
        };
    }

    /** 创建人或 admin/super_admin 才能查看/修改空间 ACL。 */
    public boolean canManageAcl(WikiSpace space, SecurityUser user) {
        if (isAdmin(user.getGroupScope())) return true;
        return space.getCreatedBy() != null && space.getCreatedBy().equals(user.getUserId());
    }

    public WikiSpaceAclDTO getAcl(String tenantId, Long spaceId, SecurityUser user) {
        WikiSpace space = requireSpace(tenantId, spaceId);
        if (!canManageAcl(space, user)) throw new AccessDeniedException("无权限管理此空间的授权");
        List<WikiSpaceAcl> rows = spaceAclMapper.selectList(new LambdaQueryWrapper<WikiSpaceAcl>()
                .eq(WikiSpaceAcl::getSpaceId, spaceId));
        WikiSpaceAclDTO dto = new WikiSpaceAclDTO();
        dto.setSpaceId(spaceId);
        dto.setEntries(rows.stream().map(this::toEntryDTO).collect(Collectors.toList()));
        dto.setForcedEntries(computeRoleForcedGrants(SPACE_ACL_PERMS));
        return dto;
    }

    /**
     * 计算"无论本空间 ACL 弹窗里怎么勾选，该角色都天然拥有"的权限——admin scope 或角色原生带 wiki:&lt;action&gt;
     * 权限。只覆盖角色维度：组和用户在空间 ACL 弹窗里没有与生俱来的权限，只有这里编辑的显式行本身，
     * 所以不需要为它们计算强制项（避免"自己给自己囤灰显"的怪异体验）。
     * perms 传入的动词集合决定输出的 permissions 取值范围（空间用 SPACE_ACL_PERMS，页面用页面动词集）。
     */
    private List<AclForcedGrantDTO> computeRoleForcedGrants(List<String> spaceVerbs) {
        List<SysRole> roles = roleMapper.selectList(null);
        List<AclForcedGrantDTO> result = new ArrayList<>();
        for (SysRole role : roles) {
            boolean admin = isAdmin(role.getScope());
            Set<String> nativePerms = admin ? Set.of() : rbacService.getPermissionsByRoleId(role.getId())
                    .stream().map(SysPermission::getCode)
                    .filter(code -> code != null && code.startsWith("wiki:"))
                    .map(code -> code.substring("wiki:".length()))
                    .collect(Collectors.toSet());
            List<String> forced;
            String reason;
            if (admin) {
                forced = spaceVerbs;
                reason = "admin_scope";
            } else if (!nativePerms.isEmpty()) {
                forced = spaceVerbs.stream().filter(nativePerms::contains).collect(Collectors.toList());
                reason = "role_permission";
            } else {
                continue;
            }
            if (forced.isEmpty()) continue;
            AclForcedGrantDTO dto = new AclForcedGrantDTO();
            dto.setSubjectType("role");
            dto.setSubjectId(role.getId());
            dto.setSubjectName(role.getName());
            dto.setPermissions(forced);
            dto.setReason(reason);
            result.add(dto);
        }
        return result;
    }

    /**
     * 供页面级 ACL 弹窗使用：在角色强制项基础上，叠加"空间创建人"（人员维度）和"显式空间 ACL 命中"
     * （角色/组/用户三个维度都可能命中）两类空间级放行来源，一并转换成页面动词（update→write）。
     * 这些叠加项一旦命中，页面级 ACL 里对应的勾选框无论怎么设置都不会真正生效——见
     * WikiPageService.checkWritePermission 的 OR 叠加逻辑，本方法只是把该逻辑"预先算出来"给前端展示。
     */
    public List<AclForcedGrantDTO> computePageForcedGrants(String tenantId, Long spaceId) {
        WikiSpace space = requireSpace(tenantId, spaceId);
        List<String> pageVerbs = List.of("update", "delete", "publish"); // 空间动词命名，稍后映射成页面动词
        List<AclForcedGrantDTO> result = new ArrayList<>(computeRoleForcedGrants(pageVerbs));

        if (space.getSeedKey() == null) {
            if (space.getCreatedBy() != null) {
                AclForcedGrantDTO creator = new AclForcedGrantDTO();
                creator.setSubjectType("user");
                creator.setSubjectId(space.getCreatedBy());
                creator.setSubjectName(resolveSubjectName("user", space.getCreatedBy()));
                creator.setPermissions(pageVerbs);
                creator.setReason("creator");
                result.add(creator);
            }
            List<WikiSpaceAcl> rows = spaceAclMapper.selectList(new LambdaQueryWrapper<WikiSpaceAcl>()
                    .eq(WikiSpaceAcl::getSpaceId, spaceId));
            for (WikiSpaceAcl row : rows) {
                if (row.getPermissions() == null || row.getPermissions().isEmpty()) continue;
                List<String> matched = row.getPermissions().stream()
                        .filter(pageVerbs::contains).collect(Collectors.toList());
                if (matched.isEmpty()) continue;
                AclForcedGrantDTO dto = new AclForcedGrantDTO();
                dto.setSubjectType(row.getSubjectType());
                dto.setSubjectId(row.getSubjectId());
                dto.setSubjectName(resolveSubjectName(row.getSubjectType(), row.getSubjectId()));
                dto.setPermissions(matched);
                dto.setReason("space_acl");
                result.add(dto);
            }
        }
        // 空间动词 → 页面动词：update→write，delete/publish 原样；create 无页面对应项，不参与页面弹窗。
        for (AclForcedGrantDTO dto : result) {
            dto.setPermissions(dto.getPermissions().stream()
                    .map(p -> "update".equals(p) ? "write" : p)
                    .collect(Collectors.toList()));
        }
        return result;
    }

    @Transactional
    public void setAcl(String tenantId, Long spaceId, Long operatorId, SecurityUser user, WikiSpaceAclDTO dto) {
        WikiSpace space = requireSpace(tenantId, spaceId);
        if (!canManageAcl(space, user)) throw new AccessDeniedException("无权限管理此空间的授权");

        List<WikiSpaceAcl> before = spaceAclMapper.selectList(new LambdaQueryWrapper<WikiSpaceAcl>()
                .eq(WikiSpaceAcl::getSpaceId, spaceId));
        String beforeJson = snapshot(before);

        spaceAclMapper.delete(new LambdaQueryWrapper<WikiSpaceAcl>().eq(WikiSpaceAcl::getSpaceId, spaceId));
        if (dto.getEntries() != null) {
            for (SpaceAclEntryDTO e : dto.getEntries()) {
                if (e.getPermissions() == null || e.getPermissions().isEmpty()) continue;
                WikiSpaceAcl row = new WikiSpaceAcl();
                row.setTenantId(tenantId);
                row.setSpaceId(spaceId);
                row.setSubjectType(e.getSubjectType());
                row.setSubjectId(e.getSubjectId());
                row.setPermissions(e.getPermissions().stream()
                        .filter(SPACE_ACL_PERMS::contains).collect(Collectors.toList()));
                row.setCreatedBy(operatorId);
                row.setCreatedAt(LocalDateTime.now());
                row.setUpdatedAt(LocalDateTime.now());
                spaceAclMapper.insert(row);
            }
        }

        List<WikiSpaceAcl> after = spaceAclMapper.selectList(new LambdaQueryWrapper<WikiSpaceAcl>()
                .eq(WikiSpaceAcl::getSpaceId, spaceId));
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("wiki").action("space_acl_update")
                .targetId(spaceId).targetType("wiki_space").operatorId(operatorId)
                .beforeJson(beforeJson).afterJson(snapshot(after))
                .remark("space=" + space.getName())
                .createdAt(LocalDateTime.now()).build());
    }

    private WikiSpace requireSpace(String tenantId, Long spaceId) {
        WikiSpace space = spaceMapper.selectById(spaceId);
        if (space == null || !tenantId.equals(space.getTenantId())) {
            throw new IllegalArgumentException("空间不存在: " + spaceId);
        }
        return space;
    }

    private String snapshot(List<WikiSpaceAcl> rows) {
        try {
            List<Map<String, Object>> entries = rows.stream().map(r -> Map.of(
                    "type", r.getSubjectType(), "id", r.getSubjectId(),
                    "perms", r.getPermissions() == null ? List.of() : r.getPermissions()
            )).collect(Collectors.toList());
            return objectMapper.writeValueAsString(Map.of("entries", entries));
        } catch (Exception e) { return "{}"; }
    }

    private SpaceAclEntryDTO toEntryDTO(WikiSpaceAcl row) {
        SpaceAclEntryDTO dto = new SpaceAclEntryDTO();
        dto.setSubjectType(row.getSubjectType());
        dto.setSubjectId(row.getSubjectId());
        dto.setPermissions(row.getPermissions());
        dto.setSubjectName(resolveSubjectName(row.getSubjectType(), row.getSubjectId()));
        return dto;
    }

    private String resolveSubjectName(String subjectType, Long subjectId) {
        return switch (subjectType) {
            case "user" -> {
                User u = userMapper.selectById(subjectId);
                yield u == null ? "用户#" + subjectId
                        : (u.getRealName() != null ? u.getRealName() : u.getUsername());
            }
            case "group" -> {
                Group g = groupMapper.selectById(subjectId);
                yield g == null ? "组#" + subjectId : g.getName();
            }
            case "role" -> {
                SysRole r = roleMapper.selectById(subjectId);
                yield r == null ? "角色#" + subjectId : r.getName();
            }
            default -> String.valueOf(subjectId);
        };
    }

    private WikiSpaceVO toVO(WikiSpace s, long pageCount, User creator, SecurityUser currentUser) {
        WikiSpaceVO vo = new WikiSpaceVO();
        vo.setId(s.getId());
        vo.setName(s.getName());
        vo.setDescription(s.getDescription());
        vo.setPageCount(pageCount);
        vo.setUpdatedAt(s.getUpdatedAt());
        vo.setCreatedByName(creator != null ?
                (creator.getRealName() != null ? creator.getRealName() : creator.getUsername()) : null);
        vo.setSystem(s.getSeedKey() != null);
        vo.setWriteScope(s.getWriteScope());
        // 只读：系统空间且写范围不是 all（none/super_admin_only 均为锁定，任何人都不可写，见 hasWritePermission）
        vo.setReadOnly(s.getWriteScope() != null && !"all".equals(s.getWriteScope()));
        vo.setCreatedBy(s.getCreatedBy());
        boolean legacyCanManageAcl = currentUser.getPermissions().contains("wiki:manage_acl")
            && canManageAcl(s, currentUser);
        vo.setCanManageAcl(authorizationService.decideWithCompatibility(currentUser, "wiki",
            "wiki:manage_acl", "wiki_space", s.getId(), 2, legacyCanManageAcl));
        vo.setCanCreatePage(hasWritePermission(s.getTenantId(), s.getId(), currentUser, "create"));
        return vo;
    }

    private String toJson(Object obj) {
        try { return objectMapper.writeValueAsString(obj); } catch (Exception e) { return "{}"; }
    }
}
