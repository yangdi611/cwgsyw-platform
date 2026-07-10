package com.cwgsyw.platform.module.wiki;

import com.cwgsyw.platform.module.wiki.dto.SavePageRequest;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import com.cwgsyw.platform.module.wiki.entity.WikiPageVersion;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WikiPageServiceTest {

    @Mock WikiPageMapper pageMapper;
    @Mock WikiPageVersionMapper versionMapper;
    @Mock WikiSpaceMapper spaceMapper;
    @Mock WikiBacklinkMapper backlinkMapper;
    @Mock WikiBacklinkService backlinkService;
    @Mock WikiAclService aclService;
    @Mock WikiSpaceService spaceService;
    @Mock com.cwgsyw.platform.common.AuditLogMapper auditLogMapper;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    @Mock com.cwgsyw.platform.module.notification.NotificationService notificationService;
    @Mock com.cwgsyw.platform.module.user.UserMapper userMapper;

    @InjectMocks WikiPageService service;

    private SecurityUser user(Long userId, String groupScope, Set<String> perms) {
        return new SecurityUser(userId, "u" + userId, "pw", "default", 1L, groupScope, perms);
    }

    private WikiPage page(Long id, Long spaceId) {
        WikiPage p = new WikiPage();
        p.setId(id);
        p.setTenantId("default");
        p.setSpaceId(spaceId);
        p.setTitle("t");
        p.setContent("c");
        p.setStatus("draft");
        p.setCurrentVersion(1);
        return p;
    }

    // ── OR 叠加：空间未授权但页面级 ACL 单独授予 write 时应成功（SPEC 12.1） ──

    @Test
    void savePage_spaceDeniedButPageAclGrantsWrite_succeeds() {
        WikiPage page = page(88L, 100L);
        when(pageMapper.selectById(88L)).thenReturn(page);
        SecurityUser viewer = user(5L, "group", Set.of("wiki:read"));

        when(spaceService.hasWritePermission("default", 100L, viewer, "update")).thenReturn(false);
        when(aclService.hasExplicitPermission("default", 88L, 5L, 1L, "group", "write")).thenReturn(true);

        SavePageRequest req = new SavePageRequest();
        req.setTitle("新标题");
        req.setContent("新内容");

        var vo = service.savePage("default", viewer, 88L, req);
        assertThat(vo.getId()).isEqualTo(88L);
        verify(pageMapper).updateById(any(WikiPage.class));
    }

    @Test
    void savePage_spaceDeniedAndPageAclDenied_throws() {
        WikiPage page = page(88L, 100L);
        when(pageMapper.selectById(88L)).thenReturn(page);
        SecurityUser viewer = user(5L, "group", Set.of("wiki:read"));

        when(spaceService.hasWritePermission("default", 100L, viewer, "update")).thenReturn(false);
        when(aclService.hasExplicitPermission("default", 88L, 5L, 1L, "group", "write")).thenReturn(false);

        SavePageRequest req = new SavePageRequest();
        req.setTitle("新标题");
        req.setContent("新内容");

        assertThatThrownBy(() -> service.savePage("default", viewer, 88L, req))
                .isInstanceOf(AccessDeniedException.class);
        verify(pageMapper, never()).updateById(any(WikiPage.class));
    }

    @Test
    void savePage_spaceGranted_doesNotConsultPageAcl() {
        WikiPage page = page(88L, 100L);
        when(pageMapper.selectById(88L)).thenReturn(page);
        SecurityUser creator = user(3L, "group", Set.of("wiki:read"));

        when(spaceService.hasWritePermission(eq("default"), eq(100L), eq(creator), anyString())).thenReturn(true);

        SavePageRequest req = new SavePageRequest();
        req.setTitle("新标题");
        req.setContent("新内容");

        service.savePage("default", creator, 88L, req);
        verify(aclService, never()).hasExplicitPermission(any(), any(), any(), any(), any(), any());
    }

    // ── revert 回归：viewer 被空间 ACL 授予 update 后，可成功回滚版本 ─────

    @Test
    void revert_spaceGrantedUpdate_succeedsAndForwardsToSavePage() {
        WikiPage page = page(88L, 100L);
        when(pageMapper.selectById(88L)).thenReturn(page);
        SecurityUser grantedViewer = user(5L, "group", Set.of("wiki:read"));

        WikiPageVersion v = new WikiPageVersion();
        v.setPageId(88L);
        v.setVersion(1);
        v.setTitle("旧标题");
        v.setContent("旧内容");
        when(versionMapper.selectOne(any())).thenReturn(v);

        when(spaceService.hasWritePermission("default", 100L, grantedViewer, "update")).thenReturn(true);

        var vo = service.revert("default", 88L, 1, grantedViewer);
        assertThat(vo.getTitle()).isEqualTo("旧标题");
        verify(pageMapper).updateById(any(WikiPage.class));
    }

    @Test
    void revert_notGranted_throwsAndDoesNotUpdate() {
        WikiPage page = page(88L, 100L);
        when(pageMapper.selectById(88L)).thenReturn(page);
        SecurityUser stranger = user(6L, "group", Set.of("wiki:read"));

        WikiPageVersion v = new WikiPageVersion();
        v.setPageId(88L);
        v.setVersion(1);
        v.setTitle("旧标题");
        v.setContent("旧内容");
        when(versionMapper.selectOne(any())).thenReturn(v);

        when(spaceService.hasWritePermission("default", 100L, stranger, "update")).thenReturn(false);
        when(aclService.hasExplicitPermission("default", 88L, 6L, 1L, "group", "write")).thenReturn(false);

        assertThatThrownBy(() -> service.revert("default", 88L, 1, stranger))
                .isInstanceOf(AccessDeniedException.class);
        verify(pageMapper, never()).updateById(any(WikiPage.class));
    }

    // ── createPage：仅空间级校验，不叠加页面级判断 ──────────────────────

    @Test
    void createPage_spaceCreateDenied_throwsBeforeInsert() {
        SecurityUser viewer = user(7L, "group", Set.of("wiki:read"));
        doThrow(new AccessDeniedException("无权限在此空间执行 create"))
                .when(spaceService).checkCanWrite("default", 100L, viewer, "create");

        var req = new com.cwgsyw.platform.module.wiki.dto.CreatePageRequest();
        req.setSpaceId(100L);
        req.setTitle("新页面");

        assertThatThrownBy(() -> service.createPage("default", viewer, req))
                .isInstanceOf(AccessDeniedException.class);
        verify(pageMapper, never()).insert(any(WikiPage.class));
    }

    // ── deletePage / movePage / publishDirect 权限闸门 ──────────────────

    @Test
    void deletePage_denied_throwsAndNoDelete() {
        WikiPage page = page(88L, 100L);
        when(pageMapper.selectById(88L)).thenReturn(page);
        SecurityUser stranger = user(6L, "group", Set.of("wiki:read"));

        when(spaceService.hasWritePermission("default", 100L, stranger, "delete")).thenReturn(false);
        when(aclService.hasExplicitPermission("default", 88L, 6L, 1L, "group", "delete")).thenReturn(false);

        assertThatThrownBy(() -> service.deletePage("default", 88L, stranger))
                .isInstanceOf(AccessDeniedException.class);
        verify(pageMapper, never()).deleteById(any(Long.class));
    }

    @Test
    void publishDirect_granted_succeeds() {
        WikiPage page = page(88L, 100L);
        when(pageMapper.selectById(88L)).thenReturn(page);
        SecurityUser creator = user(3L, "group", Set.of("wiki:read"));

        when(spaceService.hasWritePermission("default", 100L, creator, "publish")).thenReturn(true);

        service.publishDirect("default", 88L, creator);
        verify(pageMapper).updateById(any(WikiPage.class));
    }
}
