package com.cwgsyw.platform.module.wiki;

import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.rbac.entity.SysPermission;
import com.cwgsyw.platform.module.rbac.entity.SysRole;
import com.cwgsyw.platform.module.wiki.dto.WikiSpaceAclDTO;
import com.cwgsyw.platform.module.wiki.entity.WikiSpace;
import com.cwgsyw.platform.module.wiki.entity.WikiSpaceAcl;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WikiSpaceServiceTest {

    @Mock WikiSpaceMapper spaceMapper;
    @Mock WikiPageMapper pageMapper;
    @Mock WikiSpaceAclMapper spaceAclMapper;
    @Mock com.cwgsyw.platform.common.AuditLogMapper auditLogMapper;
    @Mock com.cwgsyw.platform.module.user.UserMapper userMapper;
    @Mock com.cwgsyw.platform.module.org.GroupMapper groupMapper;
    @Mock com.cwgsyw.platform.module.rbac.SysRoleMapper roleMapper;
    @Mock RbacService rbacService;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    @Mock com.cwgsyw.platform.module.authorization.AuthorizationService authorizationService;
    @Mock com.cwgsyw.platform.module.authorization.AuthorizationResourceMigrationService resourceMigrationService;
    @Mock ActiveGroupReferenceValidator activeGroupReferenceValidator;

    @InjectMocks WikiSpaceService service;

    @BeforeEach
    void setUpAuthorizationCompatibility() {
        lenient().when(authorizationService.decideWithCompatibility(
            any(), anyString(), anyString(), anyString(), anyLong(), anyInt(), anyBoolean()))
            .thenAnswer(invocation -> invocation.getArgument(6));
        lenient().when(authorizationService.decideWithPolicyCompatibility(
            any(), anyString(), anyString(), anyString(), anyLong(), anyInt(), anyBoolean(), anyBoolean()))
            .thenAnswer(invocation -> invocation.getArgument(7));
    }

    private SecurityUser user(Long userId, String groupScope, Set<String> perms) {
        return new SecurityUser(userId, "u" + userId, "pw", "default", 1L, groupScope, perms);
    }

    private WikiSpace userSpace(Long id, Long createdBy) {
        WikiSpace s = new WikiSpace();
        s.setId(id);
        s.setTenantId("default");
        s.setCreatedBy(createdBy);
        s.setSeedKey(null);
        return s;
    }

    private WikiSpace systemSpace(Long id) {
        WikiSpace s = new WikiSpace();
        s.setId(id);
        s.setTenantId("default");
        s.setCreatedBy(0L);
        s.setSeedKey("manual");
        s.setWriteScope("none");
        return s;
    }

    private WikiSpaceAcl aclRow(String subjectType, Long subjectId, List<String> perms) {
        WikiSpaceAcl row = new WikiSpaceAcl();
        row.setSubjectType(subjectType);
        row.setSubjectId(subjectId);
        row.setPermissions(perms);
        return row;
    }

    // ── admin/super_admin ────────────────────────────────────────────────

    @Test
    void hasWritePermission_admin_alwaysAllowed_withoutQueryingAcl() {
        SecurityUser admin = user(1L, "tenant", Set.of());
        when(spaceMapper.selectById(100L)).thenReturn(userSpace(100L, 99L));
        assertThat(service.hasWritePermission("default", 100L, admin, "update")).isTrue();
        verify(spaceAclMapper, never()).selectList(any());
    }

    @Test
    void hasWritePermission_superAdminPlatformScope_alwaysAllowed() {
        SecurityUser superAdmin = user(1L, "platform", Set.of());
        when(spaceMapper.selectById(100L)).thenReturn(userSpace(100L, 99L));
        assertThat(service.hasWritePermission("default", 100L, superAdmin, "delete")).isTrue();
    }

    // ── 角色自带权限（回归核心用例，见 SPEC 6.1/12.1） ─────────────────────

    @Test
    void hasWritePermission_memberWithRolePermission_regressionAllowed() {
        SecurityUser member = user(2L, "group", Set.of("wiki:update"));
        when(spaceMapper.selectById(100L)).thenReturn(userSpace(100L, 99L));

        assertThat(service.hasWritePermission("default", 100L, member, "update")).isTrue();
        verify(spaceAclMapper, never()).selectList(any());
    }

    // ── 创建人分支 ───────────────────────────────────────────────────────

    @Test
    void hasWritePermission_creator_allowedEvenWithoutRolePermission() {
        SecurityUser viewer = user(3L, "group", Set.of("wiki:read"));
        WikiSpace mySpace = userSpace(100L, 3L);
        when(spaceMapper.selectById(100L)).thenReturn(mySpace);

        assertThat(service.hasWritePermission("default", 100L, viewer, "create")).isTrue();
        assertThat(service.hasWritePermission("default", 100L, viewer, "delete")).isTrue();
    }

    // ── 拒绝：既非创建人也非 admin，角色权限不足，未被 ACL 授权 ──────────

    @Test
    void hasWritePermission_viewerNotCreatorNotAcl_denied() {
        SecurityUser viewer = user(4L, "group", Set.of("wiki:read"));
        WikiSpace otherUsersSpace = userSpace(100L, 999L);
        when(spaceMapper.selectById(100L)).thenReturn(otherUsersSpace);
        when(spaceAclMapper.selectList(any())).thenReturn(List.of());
        when(rbacService.getUserRoleIds(4L)).thenReturn(List.of());

        assertThat(service.hasWritePermission("default", 100L, viewer, "update")).isFalse();
    }

    @Test
    void checkCanWrite_denied_throwsAccessDenied() {
        SecurityUser viewer = user(4L, "group", Set.of("wiki:read"));
        WikiSpace otherUsersSpace = userSpace(100L, 999L);
        when(spaceMapper.selectById(100L)).thenReturn(otherUsersSpace);
        when(spaceAclMapper.selectList(any())).thenReturn(List.of());
        when(rbacService.getUserRoleIds(4L)).thenReturn(List.of());

        assertThatThrownBy(() -> service.checkCanWrite("default", 100L, viewer, "update"))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ── 空间 ACL 授权分支 ────────────────────────────────────────────────

    @Test
    void hasWritePermission_viewerGrantedUpdateByAcl_allowedForUpdateOnly() {
        SecurityUser viewer = user(5L, "group", Set.of("wiki:read"));
        WikiSpace otherUsersSpace = userSpace(100L, 999L);
        when(spaceMapper.selectById(100L)).thenReturn(otherUsersSpace);
        when(spaceAclMapper.selectList(any()))
                .thenReturn(List.of(aclRow("user", 5L, List.of("update"))));
        when(rbacService.getUserRoleIds(5L)).thenReturn(List.of());

        assertThat(service.hasWritePermission("default", 100L, viewer, "update")).isTrue();
        assertThat(service.hasWritePermission("default", 100L, viewer, "delete")).isFalse();
    }

    @Test
    void hasWritePermission_aclDoesNotCrossSpaces() {
        SecurityUser viewer = user(6L, "group", Set.of("wiki:read"));
        WikiSpace spaceA = userSpace(100L, 999L);
        when(rbacService.getUserRoleIds(6L)).thenReturn(List.of());

        // 空间 A：授权 update
        when(spaceMapper.selectById(100L)).thenReturn(spaceA);
        when(spaceAclMapper.selectList(any()))
                .thenReturn(List.of(aclRow("user", 6L, List.of("update"))));
        assertThat(service.hasWritePermission("default", 100L, viewer, "update")).isTrue();

        // 空间 B：同一用户同一动作，但 B 没有任何 ACL 授权行，重置 mock 后应被拒绝
        reset(spaceAclMapper);
        WikiSpace spaceB = userSpace(200L, 999L);
        when(spaceMapper.selectById(200L)).thenReturn(spaceB);
        when(spaceAclMapper.selectList(any())).thenReturn(List.of());
        assertThat(service.hasWritePermission("default", 200L, viewer, "update")).isFalse();
    }

    @Test
    void hasWritePermission_roleAcl_matchesByRoleId() {
        SecurityUser viewer = user(7L, "group", Set.of("wiki:read"));
        WikiSpace otherUsersSpace = userSpace(100L, 999L);
        when(spaceMapper.selectById(100L)).thenReturn(otherUsersSpace);
        when(spaceAclMapper.selectList(any()))
                .thenReturn(List.of(aclRow("role", 10L, List.of("publish"))));
        when(rbacService.getUserRoleIds(7L)).thenReturn(List.of(10L));

        assertThat(service.hasWritePermission("default", 100L, viewer, "publish")).isTrue();
    }

    @Test
    void hasWritePermission_groupAcl_matchesByGroupId() {
        SecurityUser viewer = user(8L, "group", Set.of("wiki:read"));
        WikiSpace otherUsersSpace = userSpace(100L, 999L);
        when(spaceMapper.selectById(100L)).thenReturn(otherUsersSpace);
        when(spaceAclMapper.selectList(any()))
                .thenReturn(List.of(aclRow("group", 1L, List.of("delete"))));
        when(rbacService.getUserRoleIds(8L)).thenReturn(List.of());

        assertThat(service.hasWritePermission("default", 100L, viewer, "delete")).isTrue();
    }

    // ── 系统空间短路 ─────────────────────────────────────────────────────

    @Test
    void hasWritePermission_systemSpace_ignoresCreatorAndAcl() {
        SecurityUser viewer = user(9L, "group", Set.of("wiki:read"));
        WikiSpace sysSpace = systemSpace(300L);
        sysSpace.setCreatedBy(9L); // 即使 created_by 恰好等于当前用户
        when(spaceMapper.selectById(300L)).thenReturn(sysSpace);

        assertThat(service.hasWritePermission("default", 300L, viewer, "update")).isFalse();
        verify(authorizationService).decideWithPolicyCompatibility(viewer, "wiki", "wiki:update",
            "wiki_space", 300L, 2, false, false);
        verify(spaceAclMapper, never()).selectList(any());
    }

    @Test
    void hasWritePermission_lockedSystemSpace_constrainsEnforcedAuthorization() {
        SecurityUser superAdmin = user(1L, "platform", Set.of("wiki:create"));
        when(spaceMapper.selectById(300L)).thenReturn(systemSpace(300L));
        when(authorizationService.decideWithPolicyCompatibility(superAdmin, "wiki", "wiki:create",
            "wiki_space", 300L, 3, false, false)).thenReturn(false);

        assertThat(service.hasWritePermission("default", 300L, superAdmin, "create")).isFalse();

        verify(authorizationService).decideWithPolicyCompatibility(superAdmin, "wiki", "wiki:create",
            "wiki_space", 300L, 3, false, false);
        verify(authorizationService, never()).decideWithCompatibility(any(), anyString(), anyString(),
            anyString(), anyLong(), anyInt(), anyBoolean());
    }

    @Test
    void hasWritePermission_systemSpace_roleAndAdminStillWork() {
        SecurityUser admin = user(1L, "tenant", Set.of());
        SecurityUser memberWithRole = user(9L, "group", Set.of("wiki:update"));
        WikiSpace systemSpace = systemSpace(300L);
        systemSpace.setWriteScope("all");
        when(spaceMapper.selectById(300L)).thenReturn(systemSpace);

        assertThat(service.hasWritePermission("default", 300L, admin, "update")).isTrue();
        assertThat(service.hasWritePermission("default", 300L, memberWithRole, "update")).isTrue();
    }

    // ── canManageAcl / getAcl / setAcl 权限校验 ─────────────────────────

    @Test
    void canManageAcl_creatorOrAdmin_true() {
        WikiSpace mySpace = userSpace(100L, 3L);
        SecurityUser creator = user(3L, "group", Set.of());
        SecurityUser admin = user(1L, "tenant", Set.of());
        SecurityUser stranger = user(4L, "group", Set.of());

        assertThat(service.canManageAcl(mySpace, creator)).isTrue();
        assertThat(service.canManageAcl(mySpace, admin)).isTrue();
        assertThat(service.canManageAcl(mySpace, stranger)).isFalse();
    }

    @Test
    void getAcl_nonCreatorNonAdmin_throwsAccessDenied() {
        WikiSpace mySpace = userSpace(100L, 3L);
        when(spaceMapper.selectById(100L)).thenReturn(mySpace);
        SecurityUser stranger = user(4L, "group", Set.of());

        assertThatThrownBy(() -> service.getAcl("default", 100L, stranger))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ── getAcl 的 forcedEntries（角色维度："即使弹窗里不勾也天然生效"）────────

    private SysRole role(Long id, String scope, String name) {
        SysRole r = new SysRole();
        r.setId(id);
        r.setScope(scope);
        r.setName(name);
        return r;
    }

    @Test
    void getAcl_adminScopeRole_alwaysForcedForAllSpaceVerbs() {
        WikiSpace mySpace = userSpace(100L, 3L);
        SecurityUser creator = user(3L, "group", Set.of());
        when(spaceMapper.selectById(100L)).thenReturn(mySpace);
        when(spaceAclMapper.selectList(any())).thenReturn(List.of());
        when(roleMapper.selectList(any())).thenReturn(List.of(role(1L, "platform", "super_admin")));

        WikiSpaceAclDTO dto = service.getAcl("default", 100L, creator);

        assertThat(dto.getForcedEntries()).hasSize(1);
        com.cwgsyw.platform.module.wiki.dto.AclForcedGrantDTO forced = dto.getForcedEntries().get(0);
        assertThat(forced.getSubjectType()).isEqualTo("role");
        assertThat(forced.getSubjectId()).isEqualTo(1L);
        assertThat(forced.getReason()).isEqualTo("admin_scope");
        assertThat(forced.getPermissions()).containsExactlyInAnyOrder("create", "update", "delete", "publish");
        // admin scope 分支不查询角色原生权限
        verify(rbacService, never()).getPermissionsByRoleId(anyLong(), anyString());
    }

    @Test
    void getAcl_roleWithNativeWikiPermission_forcedOnlyForThatVerb() {
        WikiSpace mySpace = userSpace(100L, 3L);
        SecurityUser creator = user(3L, "group", Set.of());
        when(spaceMapper.selectById(100L)).thenReturn(mySpace);
        when(spaceAclMapper.selectList(any())).thenReturn(List.of());
        SysRole member = role(2L, "group", "member");
        when(roleMapper.selectList(any())).thenReturn(List.of(member));
        SysPermission wikiUpdate = new SysPermission();
        wikiUpdate.setCode("wiki:update");
        when(rbacService.getPermissionsByRoleId(2L, "default")).thenReturn(List.of(wikiUpdate));

        WikiSpaceAclDTO dto = service.getAcl("default", 100L, creator);

        assertThat(dto.getForcedEntries()).hasSize(1);
        com.cwgsyw.platform.module.wiki.dto.AclForcedGrantDTO forced = dto.getForcedEntries().get(0);
        assertThat(forced.getReason()).isEqualTo("role_permission");
        assertThat(forced.getPermissions()).containsExactly("update");
    }

    @Test
    void getAcl_roleWithoutAdminOrNativePermission_notInForcedList() {
        WikiSpace mySpace = userSpace(100L, 3L);
        SecurityUser creator = user(3L, "group", Set.of());
        when(spaceMapper.selectById(100L)).thenReturn(mySpace);
        when(spaceAclMapper.selectList(any())).thenReturn(List.of());
        when(roleMapper.selectList(any())).thenReturn(List.of(role(4L, "group", "普通角色")));
        when(rbacService.getPermissionsByRoleId(4L, "default")).thenReturn(List.of());

        WikiSpaceAclDTO dto = service.getAcl("default", 100L, creator);

        assertThat(dto.getForcedEntries()).isEmpty();
    }

    // ── computePageForcedGrants：页面级弹窗使用，叠加创建人 + 显式空间 ACL，动词映射 update→write ──

    @Test
    void computePageForcedGrants_creator_forcedForWriteDeletePublish() {
        WikiSpace mySpace = userSpace(100L, 3L);
        when(spaceMapper.selectById(100L)).thenReturn(mySpace);
        when(spaceAclMapper.selectList(any())).thenReturn(List.of());
        when(roleMapper.selectList(any())).thenReturn(List.of());

        List<com.cwgsyw.platform.module.wiki.dto.AclForcedGrantDTO> forced =
                service.computePageForcedGrants("default", 100L);

        assertThat(forced).hasSize(1);
        assertThat(forced.get(0).getSubjectType()).isEqualTo("user");
        assertThat(forced.get(0).getSubjectId()).isEqualTo(3L);
        assertThat(forced.get(0).getReason()).isEqualTo("creator");
        // 动词已映射：update → write
        assertThat(forced.get(0).getPermissions()).containsExactlyInAnyOrder("write", "delete", "publish");
    }

    @Test
    void computePageForcedGrants_explicitSpaceAcl_mappedToPageVerbs() {
        WikiSpace otherUsersSpace = userSpace(100L, 999L);
        when(spaceMapper.selectById(100L)).thenReturn(otherUsersSpace);
        when(spaceAclMapper.selectList(any()))
                .thenReturn(List.of(aclRow("group", 7L, List.of("update", "publish"))));
        when(roleMapper.selectList(any())).thenReturn(List.of());

        List<com.cwgsyw.platform.module.wiki.dto.AclForcedGrantDTO> forced =
                service.computePageForcedGrants("default", 100L);

        // 空间创建人（999）恒定强制 + 显式空间 ACL 命中的组（7），两条都应出现
        assertThat(forced).hasSize(2);
        var groupEntry = forced.stream().filter(f -> "group".equals(f.getSubjectType())).findFirst().orElseThrow();
        assertThat(groupEntry.getSubjectId()).isEqualTo(7L);
        assertThat(groupEntry.getReason()).isEqualTo("space_acl");
        assertThat(groupEntry.getPermissions()).containsExactlyInAnyOrder("write", "publish");
        var creatorEntry = forced.stream().filter(f -> "user".equals(f.getSubjectType())).findFirst().orElseThrow();
        assertThat(creatorEntry.getSubjectId()).isEqualTo(999L);
        assertThat(creatorEntry.getReason()).isEqualTo("creator");
    }

    @Test
    void computePageForcedGrants_systemSpace_ignoresCreatorAndExplicitAcl() {
        WikiSpace sysSpace = systemSpace(300L);
        when(spaceMapper.selectById(300L)).thenReturn(sysSpace);
        when(roleMapper.selectList(any())).thenReturn(List.of());

        List<com.cwgsyw.platform.module.wiki.dto.AclForcedGrantDTO> forced =
                service.computePageForcedGrants("default", 300L);

        assertThat(forced).isEmpty();
        verify(spaceAclMapper, never()).selectList(any());
    }

    @Test
    void setAcl_filtersOutReadPermission() {
        WikiSpace mySpace = userSpace(100L, 3L);
        when(spaceMapper.selectById(100L)).thenReturn(mySpace);
        SecurityUser creator = user(3L, "group", Set.of());

        com.cwgsyw.platform.module.wiki.dto.SpaceAclEntryDTO entry =
                new com.cwgsyw.platform.module.wiki.dto.SpaceAclEntryDTO();
        entry.setSubjectType("user");
        entry.setSubjectId(5L);
        entry.setPermissions(List.of("read", "update"));

        com.cwgsyw.platform.module.wiki.dto.WikiSpaceAclDTO dto =
                new com.cwgsyw.platform.module.wiki.dto.WikiSpaceAclDTO();
        dto.setSpaceId(100L);
        dto.setEntries(List.of(entry));

        service.setAcl("default", 100L, 3L, creator, dto);

        org.mockito.ArgumentCaptor<WikiSpaceAcl> captor = org.mockito.ArgumentCaptor.forClass(WikiSpaceAcl.class);
        verify(spaceAclMapper).insert(captor.capture());
        assertThat(captor.getValue().getPermissions()).containsExactly("update");
    }

    @Test
    void setAclValidatesGroupSubjectsInAscendingOrderBeforeMutation() {
        WikiSpace mySpace = userSpace(100L, 3L);
        when(spaceMapper.selectById(100L)).thenReturn(mySpace);
        SecurityUser creator = user(3L, "group", Set.of());
        com.cwgsyw.platform.module.wiki.dto.SpaceAclEntryDTO first =
            new com.cwgsyw.platform.module.wiki.dto.SpaceAclEntryDTO();
        first.setSubjectType("group");
        first.setSubjectId(9L);
        first.setPermissions(List.of("update"));
        com.cwgsyw.platform.module.wiki.dto.SpaceAclEntryDTO second =
            new com.cwgsyw.platform.module.wiki.dto.SpaceAclEntryDTO();
        second.setSubjectType("group");
        second.setSubjectId(4L);
        second.setPermissions(List.of("publish"));
        WikiSpaceAclDTO dto = new WikiSpaceAclDTO();
        dto.setEntries(List.of(first, second));

        service.setAcl("default", 100L, 3L, creator, dto);

        var order = inOrder(activeGroupReferenceValidator, spaceAclMapper);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 4L);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 9L);
        order.verify(spaceAclMapper).delete(any());
    }
}
