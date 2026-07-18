package com.cwgsyw.platform.module.wiki;

import com.cwgsyw.platform.module.wiki.dto.SavePageRequest;
import com.cwgsyw.platform.module.wiki.dto.CreatePageRequest;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import com.cwgsyw.platform.module.wiki.entity.WikiPageVersion;
import com.cwgsyw.platform.module.workflow.event.WorkflowBusinessInstance;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowRuntimeFacade;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowStartCommand;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
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
    @Mock com.cwgsyw.platform.module.authorization.AuthorizationService authorizationService;
    @Mock com.cwgsyw.platform.module.authorization.AuthorizationResourceMigrationService resourceMigrationService;
    @Mock WorkflowRuntimeFacade workflowRuntimeFacade;
    @Mock WikiAttachmentService attachmentService;

    @InjectMocks WikiPageService service;

    @BeforeEach
    void setUpAuthorizationCompatibility() {
        lenient().when(authorizationService.decideWithCompatibility(
            any(), anyString(), anyString(), anyString(), anyLong(), anyInt(), anyBoolean()))
            .thenAnswer(invocation -> invocation.getArgument(6));
        lenient().when(authorizationService.decideWithCompatibility(
            any(), anyString(), anyString(), anyString(), anyLong(), anyInt(),
            any(java.util.function.BooleanSupplier.class)))
            .thenAnswer(invocation -> ((java.util.function.BooleanSupplier) invocation.getArgument(6))
                .getAsBoolean());
    }

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
        p.setIsDeleted(false);
        return p;
    }

    @Test
    void search_enforcedAccessFiltersBeforePaginating() {
        SecurityUser reader = user(5L, "platform", Set.of("wiki:read"));
        when(authorizationService.isEnforced(reader, "wiki")).thenReturn(true);
        when(pageMapper.search("default", "query", Integer.MAX_VALUE, 0)).thenReturn(List.of(
            searchRow(1L), searchRow(2L), searchRow(3L)));
        when(authorizationService.decide(reader, "wiki:read", "wiki_page", 1L, 4))
            .thenReturn(com.cwgsyw.platform.module.authorization.AuthorizationDecision.builder().allowed(false).build());
        when(authorizationService.decide(reader, "wiki:read", "wiki_page", 2L, 4))
            .thenReturn(com.cwgsyw.platform.module.authorization.AuthorizationDecision.builder().allowed(true).build());
        when(authorizationService.decide(reader, "wiki:read", "wiki_page", 3L, 4))
            .thenReturn(com.cwgsyw.platform.module.authorization.AuthorizationDecision.builder().allowed(true).build());

        var result = service.search("default", "query", null, 2, 1, reader);

        assertThat(result.getTotal()).isEqualTo(2);
        assertThat(result.getRecords()).extracting("pageId").containsExactly(3L);
    }

    private Map<String, Object> searchRow(Long id) {
        return Map.of("id", id, "space_id", 10L, "title", "page-" + id, "highlight", "query");
    }

    // ── OR 叠加：空间未授权但页面级 ACL 单独授予 write 时应成功（SPEC 12.1） ──

    @Test
    void savePage_spaceDeniedButPageAclGrantsWrite_succeeds() {
        WikiPage page = page(88L, 100L);
        when(pageMapper.selectById(88L)).thenReturn(page);
        SecurityUser viewer = user(5L, "group", Set.of("wiki:update"));

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
        SecurityUser viewer = user(5L, "group", Set.of("wiki:update"));

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
        SecurityUser creator = user(3L, "group", Set.of("wiki:update"));

        when(spaceService.hasWritePermission(eq("default"), eq(100L), eq(creator), anyString())).thenReturn(true);

        SavePageRequest req = new SavePageRequest();
        req.setTitle("新标题");
        req.setContent("新内容");

        service.savePage("default", creator, 88L, req);
        verify(aclService, never()).hasExplicitPermission(any(), any(), any(), any(), any(), any());
    }

    @Test
    void savePage_enforcedDecisionDoesNotEvaluateLegacyWikiAcl() {
        WikiPage page = page(88L, 100L);
        when(pageMapper.selectById(88L)).thenReturn(page);
        SecurityUser editor = user(5L, "group", Set.of("wiki:update"));
        reset(authorizationService);
        when(authorizationService.decideWithCompatibility(
            any(), anyString(), anyString(), anyString(), anyLong(), anyInt(),
            any(java.util.function.BooleanSupplier.class))).thenReturn(true);

        SavePageRequest req = new SavePageRequest();
        req.setTitle("新标题");
        req.setContent("新内容");
        service.savePage("default", editor, 88L, req);

        verifyNoInteractions(spaceService, aclService);
        verify(pageMapper).updateById(any(WikiPage.class));
    }

    // ── revert 回归：viewer 被空间 ACL 授予 update 后，可成功回滚版本 ─────

    @Test
    void revert_spaceGrantedUpdate_succeedsAndForwardsToSavePage() {
        WikiPage page = page(88L, 100L);
        when(pageMapper.selectById(88L)).thenReturn(page);
        SecurityUser grantedViewer = user(5L, "group", Set.of("wiki:update"));

        WikiPageVersion v = new WikiPageVersion();
        v.setPageId(88L);
        v.setVersion(1);
        v.setTitle("旧标题");
        v.setContent("旧内容");
        when(versionMapper.selectOne(any())).thenReturn(v);

        when(spaceService.hasWritePermission("default", 100L, grantedViewer, "update")).thenReturn(true);

        var vo = service.revert("default", 88L, 1, grantedViewer);
        assertThat(vo.getTitle()).isEqualTo("旧标题");
        assertThat(vo.getContent()).isEqualTo("旧内容");
        assertThat(page.getCurrentVersion()).isEqualTo(2);
        verify(pageMapper).updateById(page);
        verify(versionMapper).insert(argThat((WikiPageVersion saved) -> saved.getPageId().equals(88L)
            && saved.getVersion().equals(2)
            && saved.getTitle().equals("旧标题")
            && saved.getContent().equals("旧内容")
            && saved.getComment().equals("回滚到版本 1")));
    }

    @Test
    void revert_incompleteSnapshot_throwsBeforePageUpdate() {
        WikiPageVersion v = new WikiPageVersion();
        v.setPageId(88L);
        v.setVersion(1);
        v.setTitle("旧标题");
        v.setContent("");
        when(versionMapper.selectOne(any())).thenReturn(v);

        assertThatThrownBy(() -> service.revert("default", 88L, 1, user(5L, "group", Set.of("wiki:update"))))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("版本快照内容不完整");
        verify(pageMapper, never()).updateById(any(WikiPage.class));
        verify(versionMapper, never()).insert(any(WikiPageVersion.class));
    }

    @Test
    void getVersionForExport_returnsTheRequestedTenantSnapshot() {
        WikiPageVersion snapshot = new WikiPageVersion();
        snapshot.setTenantId("default");
        snapshot.setPageId(88L);
        snapshot.setVersion(2);
        snapshot.setTitle("历史标题");
        snapshot.setContent("历史正文");
        when(versionMapper.selectOne(any())).thenReturn(snapshot);

        WikiPageVersion result = service.getVersionForExport("default", 88L, 2);

        assertThat(result.getTitle()).isEqualTo("历史标题");
        assertThat(result.getContent()).isEqualTo("历史正文");
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

        assertThatThrownBy(() -> service.revert("default", 88L, 1, stranger))
                .isInstanceOf(AccessDeniedException.class);
        verify(pageMapper, never()).updateById(any(WikiPage.class));
    }

    // ── createPage：仅空间级校验，不叠加页面级判断 ──────────────────────

    @Test
    void createPage_spaceCreateDenied_throwsBeforeInsert() {
        SecurityUser viewer = user(7L, "group", Set.of("wiki:read"));
        var req = new com.cwgsyw.platform.module.wiki.dto.CreatePageRequest();
        req.setSpaceId(100L);
        req.setTitle("新页面");

        doThrow(new AccessDeniedException("denied")).when(spaceService)
            .checkCanWrite("default", 100L, viewer, "create");

        assertThatThrownBy(() -> service.createPage("default", viewer, req))
                .isInstanceOf(AccessDeniedException.class);
        verify(pageMapper, never()).insert(any(WikiPage.class));
    }

    @Test
    void createChildPage_checksCreatePermissionOnParentPage() {
        SecurityUser editor = user(7L, "group", Set.of("wiki:update"));
        WikiPage parent = page(44L, 100L);
        when(pageMapper.selectById(44L)).thenReturn(parent);
        when(spaceService.hasWritePermission("default", 100L, editor, "update")).thenReturn(false);

        var req = new com.cwgsyw.platform.module.wiki.dto.CreatePageRequest();
        req.setSpaceId(100L);
        req.setParentId(44L);
        req.setTitle("子页面");

        assertThatThrownBy(() -> service.createPage("default", editor, req))
            .isInstanceOf(AccessDeniedException.class);
        verify(spaceService).hasWritePermission("default", 100L, editor, "update");
        verify(pageMapper, never()).insert(any(WikiPage.class));
    }

    @Test
    void createChildPage_ownerCanCreateThroughParentWritePermission() {
        SecurityUser owner = user(7L, "group", Set.of("wiki:update"));
        when(spaceService.hasWritePermission("default", 100L, owner, "update")).thenReturn(true);
        WikiPage parent = page(44L, 100L);
        when(pageMapper.selectById(44L)).thenReturn(parent);
        when(spaceService.hasWritePermission("default", 100L, owner, "update")).thenReturn(true);
        when(pageMapper.selectList(any())).thenReturn(List.of());
        when(pageMapper.insert(any(WikiPage.class))).thenAnswer(invocation -> {
            invocation.getArgument(0, WikiPage.class).setId(45L);
            return 1;
        });

        var req = new com.cwgsyw.platform.module.wiki.dto.CreatePageRequest();
        req.setSpaceId(100L);
        req.setParentId(44L);
        req.setTitle("子页面");

        var result = service.createPage("default", owner, req);

        assertThat(result.getId()).isEqualTo(45L);
        verify(pageMapper).insert(any(WikiPage.class));
    }

    @Test
    void createPage_doesNotCreateEmptyRevertableVersion() {
        SecurityUser owner = user(7L, "group", Set.of("wiki:create"));
        when(pageMapper.selectList(any())).thenReturn(List.of());
        when(pageMapper.insert(any(WikiPage.class))).thenAnswer(invocation -> {
            invocation.getArgument(0, WikiPage.class).setId(45L);
            return 1;
        });

        var req = new com.cwgsyw.platform.module.wiki.dto.CreatePageRequest();
        req.setSpaceId(100L);
        req.setTitle("新页面");
        service.createPage("default", owner, req);

        verify(versionMapper, never()).insert(any(WikiPageVersion.class));
    }

    @Test
    void createPage_trimsTitleBeforePersisting() {
        SecurityUser owner = user(7L, "group", Set.of("wiki:create"));
        when(pageMapper.selectCount(any())).thenReturn(0L);
        when(pageMapper.selectList(any())).thenReturn(List.of());
        when(pageMapper.insert(any(WikiPage.class))).thenAnswer(invocation -> {
            invocation.getArgument(0, WikiPage.class).setId(45L);
            return 1;
        });
        CreatePageRequest req = new CreatePageRequest();
        req.setSpaceId(100L);
        req.setTitle("  新页面  ");

        service.createPage("default", owner, req);

        verify(pageMapper).insert(org.mockito.ArgumentMatchers.<WikiPage>argThat(
            page -> page.getTitle().equals("新页面")));
    }

    @Test
    void createPage_blankTitle_throwsBeforeInsert() {
        CreatePageRequest req = new CreatePageRequest();
        req.setSpaceId(100L);
        req.setTitle("   ");

        assertThatThrownBy(() -> service.createPage("default", user(7L, "group", Set.of("wiki:create")), req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("页面标题不能为空");
        verify(pageMapper, never()).insert(any(WikiPage.class));
    }

    @Test
    void createPage_overlongTitle_throwsBeforeInsert() {
        CreatePageRequest req = new CreatePageRequest();
        req.setSpaceId(100L);
        req.setTitle("x".repeat(256));

        assertThatThrownBy(() -> service.createPage("default", user(7L, "group", Set.of("wiki:create")), req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("页面标题不能超过 255 个字符");
        verify(pageMapper, never()).insert(any(WikiPage.class));
    }

    @Test
    void createPage_duplicateSiblingTitle_throwsBeforeInsert() {
        SecurityUser owner = user(7L, "group", Set.of("wiki:create"));
        when(pageMapper.selectCount(any())).thenReturn(1L);
        CreatePageRequest req = new CreatePageRequest();
        req.setSpaceId(100L);
        req.setTitle("已存在");

        assertThatThrownBy(() -> service.createPage("default", owner, req))
            .isInstanceOf(BusinessException.class)
            .hasMessage("同级页面标题已存在");
        verify(pageMapper, never()).insert(any(WikiPage.class));
    }

    @Test
    void savePage_duplicateSiblingTitle_throwsBeforeUpdateOrVersion() {
        WikiPage page = page(88L, 100L);
        when(pageMapper.selectById(88L)).thenReturn(page);
        when(pageMapper.selectCount(any())).thenReturn(1L);
        SecurityUser owner = user(7L, "group", Set.of("wiki:update"));
        when(spaceService.hasWritePermission("default", 100L, owner, "update")).thenReturn(true);
        SavePageRequest req = new SavePageRequest();
        req.setTitle("已存在");
        req.setContent("正文");

        assertThatThrownBy(() -> service.savePage("default", owner, 88L, req))
            .isInstanceOf(BusinessException.class)
            .hasMessage("同级页面标题已存在");
        verify(pageMapper, never()).updateById(any(WikiPage.class));
        verify(versionMapper, never()).insert(any(WikiPageVersion.class));
    }

    @Test
    void movePage_duplicateTargetSiblingTitle_throwsBeforeUpdate() {
        WikiPage page = page(88L, 100L);
        page.setTitle("已存在");
        when(pageMapper.selectById(88L)).thenReturn(page);
        when(pageMapper.findDescendantIds(88L)).thenReturn(List.of(88L));
        when(pageMapper.selectCount(any())).thenReturn(1L);

        assertThatThrownBy(() -> service.movePage("default", 88L, 22L, 1,
            user(5L, "group", Set.of("wiki:update"))))
            .isInstanceOf(BusinessException.class)
            .hasMessage("同级页面标题已存在");
        verify(pageMapper, never()).updateById(any(WikiPage.class));
    }

    // ── deletePage / movePage / publishDirect 权限闸门 ──────────────────

    @Test
    void deletePage_denied_throwsAndNoDelete() {
        WikiPage page = page(88L, 100L);
        when(pageMapper.selectById(88L)).thenReturn(page);
        SecurityUser stranger = user(6L, "group", Set.of("wiki:read"));

        doThrow(new AccessDeniedException("denied")).when(authorizationService)
            .requireParentWithCompatibility(eq(stranger), eq("wiki"), eq("wiki:delete"),
                eq("wiki_page"), eq(88L), eq(3), any(java.util.function.BooleanSupplier.class));

        assertThatThrownBy(() -> service.deletePage("default", 88L, stranger))
                .isInstanceOf(AccessDeniedException.class);
        verify(pageMapper, never()).deleteById(any(Long.class));
    }

    @Test
    void deletePage_reclaimsAttachmentsBeforeLogicalDelete() {
        WikiPage page = page(88L, 100L);
        when(pageMapper.selectById(88L)).thenReturn(page);
        when(pageMapper.findDescendantIds(88L)).thenReturn(List.of(88L));
        SecurityUser owner = user(5L, "group", Set.of("wiki:delete"));

        service.deletePage("default", 88L, owner);

        var order = inOrder(attachmentService, pageMapper);
        order.verify(attachmentService).deleteAttachmentsForPages("default", 5L, List.of(88L));
        order.verify(pageMapper).deleteById(88L);
    }

    @Test
    void movePage_checksSourceAndTargetContainers() {
        WikiPage page = page(88L, 100L);
        page.setParentId(12L);
        when(pageMapper.selectById(88L)).thenReturn(page);
        when(pageMapper.findDescendantIds(88L)).thenReturn(List.of(88L));
        SecurityUser editor = user(5L, "group", Set.of("wiki:update"));
        service.movePage("default", 88L, 22L, 1, editor);

        verify(authorizationService).requireParentWithCompatibility(eq(editor), eq("wiki"), eq("wiki:update"),
            eq("wiki_page"), eq(88L), eq(3), any(java.util.function.BooleanSupplier.class));
        verify(authorizationService).requireWithCompatibility(eq(editor), eq("wiki"), eq("wiki:update"),
            eq("wiki_page"), eq(22L), eq(3), any(java.util.function.BooleanSupplier.class));
    }

    @Test
    void publishDirect_granted_succeeds() {
        WikiPage page = page(88L, 100L);
        when(pageMapper.selectById(88L)).thenReturn(page);
        SecurityUser creator = user(3L, "group", Set.of("wiki:publish"));

        when(spaceService.hasWritePermission("default", 100L, creator, "publish")).thenReturn(true);

        service.publishDirect("default", 88L, creator);
        verify(pageMapper).updateById(any(WikiPage.class));
    }

    @Test
    void submitForReview_startsBoundBusinessWorkflowAndMarksPageReview() {
        WikiPage page = page(88L, 100L);
        SecurityUser creator = user(3L, "group", Set.of("wiki:publish"));
        WorkflowBusinessInstance instance = new WorkflowBusinessInstance();
        instance.setProcessInstanceId("process-88");
        when(pageMapper.selectById(88L)).thenReturn(page);
        when(spaceService.hasWritePermission("default", 100L, creator, "publish")).thenReturn(true);
        when(workflowRuntimeFacade.startBusinessProcess(any())).thenReturn(instance);

        service.submitForReview("default", 88L, creator);

        var command = ArgumentCaptor.forClass(WorkflowStartCommand.class);
        verify(workflowRuntimeFacade).startBusinessProcess(command.capture());
        assertThat(command.getValue().getTenantId()).isEqualTo("default");
        assertThat(command.getValue().getBusinessType()).isEqualTo("wiki_page");
        assertThat(command.getValue().getBusinessId()).isEqualTo("88");
        assertThat(command.getValue().getSubmitterId()).isEqualTo(3L);
        assertThat(page.getStatus()).isEqualTo("review");
        assertThat(page.getProcessInstanceId()).isEqualTo("process-88");
        verify(pageMapper).updateById(page);
        verify(auditLogMapper).insert(any(AuditLog.class));
    }

    @Test
    void submitForReview_workflowStartFailureLeavesPageDraftWithoutWrites() {
        WikiPage page = page(88L, 100L);
        SecurityUser creator = user(3L, "group", Set.of("wiki:publish"));
        when(pageMapper.selectById(88L)).thenReturn(page);
        when(spaceService.hasWritePermission("default", 100L, creator, "publish")).thenReturn(true);
        when(workflowRuntimeFacade.startBusinessProcess(any()))
            .thenThrow(new IllegalStateException("missing workflow binding"));

        assertThatThrownBy(() -> service.submitForReview("default", 88L, creator))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("missing workflow binding");

        assertThat(page.getStatus()).isEqualTo("draft");
        assertThat(page.getProcessInstanceId()).isNull();
        verify(pageMapper, never()).updateById(any(WikiPage.class));
        verify(auditLogMapper, never()).insert(any(AuditLog.class));
    }
}
