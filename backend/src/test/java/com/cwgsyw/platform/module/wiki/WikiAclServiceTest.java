package com.cwgsyw.platform.module.wiki;

import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.wiki.dto.AclForcedGrantDTO;
import com.cwgsyw.platform.module.wiki.dto.WikiAclDTO;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import com.cwgsyw.platform.module.wiki.entity.WikiPageAcl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WikiAclServiceTest {

    @Mock WikiPageMapper pageMapper;
    @Mock WikiPageAclMapper aclMapper;
    @Mock com.cwgsyw.platform.common.AuditLogMapper auditLogMapper;
    @Mock RbacService rbacService;
    @Mock com.cwgsyw.platform.module.user.UserMapper userMapper;
    @Mock com.cwgsyw.platform.module.org.GroupMapper groupMapper;
    @Mock com.cwgsyw.platform.module.rbac.SysRoleMapper roleMapper;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    @Mock WikiSpaceService spaceService;

    @InjectMocks WikiAclService service;

    private WikiPage page(Long id) {
        WikiPage p = new WikiPage();
        p.setId(id);
        p.setTenantId("default");
        p.setSpaceId(200L);
        p.setAclInherited(true);
        return p;
    }

    // ── hasPermission（read 场景）：链上无自定义 ACL 时默认放行 ──

    @Test
    void hasPermission_noCustomAclInChain_defaultsToTrue() {
        when(pageMapper.findAncestorChain("default", 88L)).thenReturn(List.of(page(88L)));

        boolean result = service.hasPermission("default", 88L, 5L, 1L, "group", "read");
        assertThat(result).isTrue();
    }

    // ── hasExplicitPermission（write/delete/publish 场景）：链上无自定义 ACL 时必须拒绝，
    //    不能像 hasPermission 一样默认放行，否则任何登录用户对未设置过页面级 ACL 的页面
    //    都会拥有写权限，绕过空间级 ACL（回归测试，见 WikiSpaceService.hasWritePermission 的 OR 叠加设计）──

    @Test
    void hasExplicitPermission_noCustomAclInChain_defaultsToFalse() {
        when(pageMapper.findAncestorChain("default", 88L)).thenReturn(List.of(page(88L)));

        boolean result = service.hasExplicitPermission("default", 88L, 5L, 1L, "group", "write");
        assertThat(result).isFalse();
    }

    @Test
    void hasExplicitPermission_adminAlwaysAllowed() {
        boolean result = service.hasExplicitPermission("default", 88L, 5L, 1L, "tenant", "write");
        assertThat(result).isTrue();
        verifyNoInteractions(pageMapper);
    }

    @Test
    void hasExplicitPermission_customAclGrantsRole_allowed() {
        WikiPage inherited = page(88L);
        WikiPage customized = page(1L);
        customized.setAclInherited(false);
        when(pageMapper.findAncestorChain("default", 88L)).thenReturn(List.of(inherited, customized));

        com.cwgsyw.platform.module.wiki.entity.WikiPageAcl acl =
                new com.cwgsyw.platform.module.wiki.entity.WikiPageAcl();
        acl.setSubjectType("role");
        acl.setSubjectId(4L);
        acl.setPermissions(List.of("write"));
        when(aclMapper.selectList(any())).thenReturn(List.of(acl));
        when(rbacService.getUserRoleIds(5L)).thenReturn(List.of(4L));

        boolean result = service.hasExplicitPermission("default", 88L, 5L, 1L, "group", "write");
        assertThat(result).isTrue();
    }

    @Test
    void hasExplicitPermission_customAclDoesNotMatchSubject_denied() {
        WikiPage customized = page(88L);
        customized.setAclInherited(false);
        when(pageMapper.findAncestorChain("default", 88L)).thenReturn(List.of(customized));

        com.cwgsyw.platform.module.wiki.entity.WikiPageAcl acl =
                new com.cwgsyw.platform.module.wiki.entity.WikiPageAcl();
        acl.setSubjectType("role");
        acl.setSubjectId(4L);
        acl.setPermissions(List.of("write"));
        when(aclMapper.selectList(any())).thenReturn(List.of(acl));
        when(rbacService.getUserRoleIds(5L)).thenReturn(List.of(9L));

        boolean result = service.hasExplicitPermission("default", 88L, 5L, 1L, "group", "write");
        assertThat(result).isFalse();
    }

    // ── getAcl：inheritedEntries 预填 + forcedEntries 委托给 WikiSpaceService ──

    @Test
    void getAcl_pageInherited_prefillsInheritedEntriesFromNearestCustomAncestor() {
        WikiPage self = page(88L); // 自身继承
        WikiPage customAncestor = page(1L);
        customAncestor.setAclInherited(false);
        when(pageMapper.selectById(88L)).thenReturn(self);
        when(pageMapper.findAncestorChain("default", 88L)).thenReturn(List.of(self, customAncestor));

        WikiPageAcl ancestorAcl = new WikiPageAcl();
        ancestorAcl.setSubjectType("group");
        ancestorAcl.setSubjectId(7L);
        ancestorAcl.setPermissions(List.of("write"));
        when(aclMapper.selectList(any())).thenReturn(List.of(), List.of(ancestorAcl));
        when(spaceService.computePageForcedGrants("default", 200L)).thenReturn(List.of());

        WikiAclDTO dto = service.getAcl("default", 88L);

        assertThat(dto.isInherited()).isTrue();
        assertThat(dto.getEntries()).isEmpty(); // 页面自身没有行
        assertThat(dto.getInheritedEntries()).hasSize(1);
        assertThat(dto.getInheritedEntries().get(0).getSubjectId()).isEqualTo(7L);
        assertThat(dto.getInheritedEntries().get(0).getPermissions()).containsExactly("write");
    }

    @Test
    void getAcl_pageCustom_inheritedEntriesEmpty() {
        WikiPage self = page(88L);
        self.setAclInherited(false);
        when(pageMapper.selectById(88L)).thenReturn(self);
        when(aclMapper.selectList(any())).thenReturn(List.of());
        when(spaceService.computePageForcedGrants("default", 200L)).thenReturn(List.of());

        WikiAclDTO dto = service.getAcl("default", 88L);

        assertThat(dto.isInherited()).isFalse();
        assertThat(dto.getInheritedEntries()).isEmpty();
        // 自定义状态不需要再查一次祖先链
        verify(pageMapper, never()).findAncestorChain(any(), any());
    }

    @Test
    void getAcl_delegatesForcedEntriesToSpaceService() {
        WikiPage self = page(88L);
        when(pageMapper.selectById(88L)).thenReturn(self);
        when(pageMapper.findAncestorChain("default", 88L)).thenReturn(List.of(self));
        when(aclMapper.selectList(any())).thenReturn(List.of());
        AclForcedGrantDTO forced = new AclForcedGrantDTO();
        forced.setSubjectType("role");
        forced.setSubjectId(1L);
        forced.setPermissions(List.of("write", "delete", "publish"));
        forced.setReason("admin_scope");
        when(spaceService.computePageForcedGrants("default", 200L)).thenReturn(List.of(forced));

        WikiAclDTO dto = service.getAcl("default", 88L);

        assertThat(dto.getForcedEntries()).containsExactly(forced);
    }
}
