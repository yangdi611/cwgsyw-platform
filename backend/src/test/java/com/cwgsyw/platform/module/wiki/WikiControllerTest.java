package com.cwgsyw.platform.module.wiki;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.authorization.AuthorizationService;
import com.cwgsyw.platform.module.wiki.dto.CreateSpaceRequest;
import com.cwgsyw.platform.module.wiki.entity.WikiPageVersion;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.eq;

@ExtendWith(MockitoExtension.class)
class WikiControllerTest {
    @Mock private WikiSpaceService spaceService;
    @Mock private WikiPageService pageService;
    @Mock private WikiAclService aclService;
    @Mock private WikiBacklinkService backlinkService;
    @Mock private WikiAttachmentService attachmentService;
    @Mock private WikiExportService exportService;
    @Mock private WikiCommentService commentService;
    @Mock private AuthorizationService authorizationService;
    @InjectMocks private WikiController controller;

    @Test
    void administratorMustExplicitlySelectOwnerGroup() {
        SecurityUser administrator = user(1L, 2L, "platform");
        CreateSpaceRequest request = new CreateSpaceRequest();
        request.setName("space");

        assertThatThrownBy(() -> controller.createSpace(request, administrator))
            .isInstanceOf(BusinessException.class)
            .extracting("errorCode").isEqualTo("RESOURCE_GROUP_REQUIRED");
        verify(spaceService, never()).createSpace(any(), any(), any(), any(), any());
    }

    @Test
    void groupUserUsesSessionGroupInsteadOfSubmittedGroup() {
        SecurityUser groupUser = user(2L, 7L, "group");
        CreateSpaceRequest request = new CreateSpaceRequest();
        request.setName("space");
        request.setOwnerGroupId(99L);
        org.mockito.Mockito.when(authorizationService.canUseOwnerGroup(groupUser, 7L)).thenReturn(true);
        org.mockito.Mockito.when(authorizationService.decideCreateWithCompatibility(groupUser, "wiki", "wiki:create", 7L, true)).thenReturn(false);

        assertThatThrownBy(() -> controller.createSpace(request, groupUser))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(authorizationService).canUseOwnerGroup(groupUser, 7L);
        verify(authorizationService).decideCreateWithCompatibility(groupUser, "wiki", "wiki:create", 7L, true);
    }

    @Test
    void missingSpaceReturnsNotFoundBeforeAuthorization() {
        SecurityUser administrator = user(1L, 2L, "platform");
        when(spaceService.exists("default", 99L)).thenReturn(false);

        assertThatThrownBy(() -> controller.getTree(99L, administrator))
            .isInstanceOf(BusinessException.class)
            .extracting("httpStatus").isEqualTo(404);
        verify(spaceService, never()).canReadSpace(99L, administrator);
    }

    @Test
    void attachmentDeleteMapsWriteAclToExistingUpdatePermission() {
        SecurityUser editor = new SecurityUser(3L, "editor", "", "default", 1L, "tenant", Set.of("wiki:update"));
        when(attachmentService.attachmentPageId("default", 42L)).thenReturn(88L);
        when(pageService.exists("default", 88L)).thenReturn(true);

        controller.deleteAttachment(42L, editor);

        verify(authorizationService).requireWithCompatibility(
            eq(editor), eq("wiki"), eq("wiki:update"), eq("wiki_page"), eq(88L), eq(2), any(java.util.function.BooleanSupplier.class));
        verify(attachmentService).deleteAttachment("default", 3L, 42L);
    }

    @Test
    void exportVersionDelegatesTheRequestedSnapshotAfterReadAuthorization() throws Exception {
        SecurityUser reader = user(3L, 7L, "group");
        WikiPageVersion version = new WikiPageVersion();
        version.setPageId(88L);
        version.setVersion(2);
        version.setTitle("历史标题");
        version.setContent("历史正文");
        HttpServletResponse response = org.mockito.Mockito.mock(HttpServletResponse.class);
        when(pageService.exists("default", 88L)).thenReturn(true);
        when(pageService.getVersionForExport("default", 88L, 2)).thenReturn(version);

        controller.exportVersion(88L, 2, response, reader);

        verify(authorizationService).requireWithCompatibility(
            eq(reader), eq("wiki"), eq("wiki:read"), eq("wiki_page"), eq(88L), eq(4), any(java.util.function.BooleanSupplier.class));
        verify(exportService).exportVersion(version, response);
    }

    private SecurityUser user(Long userId, Long groupId, String groupScope) {
        return new SecurityUser(userId, "user" + userId, "", "default", groupId, groupScope, Set.of("wiki:create"));
    }
}
