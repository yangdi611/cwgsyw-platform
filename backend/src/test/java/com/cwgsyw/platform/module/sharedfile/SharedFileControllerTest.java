package com.cwgsyw.platform.module.sharedfile;

import com.cwgsyw.platform.security.SecurityUser;
import com.cwgsyw.platform.module.authorization.AuthorizationService;
import com.cwgsyw.platform.module.sharedfile.dto.UpdateSharedFileRequest;
import com.cwgsyw.platform.module.sharedfile.dto.UpdateFolderRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.ArgumentMatchers.*;

@ExtendWith(MockitoExtension.class)
class SharedFileControllerTest {

    @Mock SharedFileService fileService;
    @Mock SharedFolderService folderService;
    @Mock SharedFolderAclService aclService;
    @Mock AuthorizationService authorizationService;
    @Mock SecurityUser user;

    private SharedFileController controller;

    @BeforeEach
    void setUp() {
        controller = new SharedFileController(fileService, folderService, aclService, authorizationService);
        lenient().when(user.getTenantId()).thenReturn("default");
    }

    @Test
    void download_returnsAttachmentWithFilenameMimeAndBytes() throws Exception {
        byte[] bytes = "content".getBytes(StandardCharsets.UTF_8);
        when(fileService.getFileContent("default", 2L)).thenReturn(
                new SharedFileService.FileContent(
                        "变更方案.docx", bytes.length, new ByteArrayInputStream(bytes)));

        ResponseEntity<InputStreamResource> response = controller.download(2L, user);

        assertThat(response.getHeaders().getContentDisposition().getType()).isEqualTo("attachment");
        assertThat(response.getHeaders().getContentDisposition().getFilename()).isEqualTo("变更方案.docx");
        assertThat(response.getHeaders().getContentType()).isEqualTo(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
        assertThat(response.getHeaders().getContentLength()).isEqualTo(bytes.length);
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        assertResponseBody(response, bytes);
    }

    @Test
    void preview_returnsInlineContentDisposition() throws Exception {
        byte[] bytes = "%PDF".getBytes(StandardCharsets.UTF_8);
        when(fileService.getFileContent("default", 3L)).thenReturn(
                new SharedFileService.FileContent("report.pdf", bytes.length, new ByteArrayInputStream(bytes)));

        ResponseEntity<InputStreamResource> response = controller.preview(3L, user);

        assertThat(response.getHeaders().getContentDisposition().getType()).isEqualTo("inline");
        assertThat(response.getHeaders().getContentDisposition().getFilename()).isEqualTo("report.pdf");
        assertThat(response.getHeaders().getFirst(HttpHeaders.CONTENT_TYPE)).isEqualTo("application/pdf");
        assertResponseBody(response, bytes);
    }

    @Test
    void deleteFile_checksParentContainerPermission() {
        controller.deleteFile(9L, user);

        verify(authorizationService).requireParentWithCompatibility(user, "shared_file",
            "shared_file:delete", "shared_file", 9L, 3, true);
        verify(fileService).deleteFile(user, 9L);
    }

    @Test
    void updateFile_checksParentContainerPermission() {
        UpdateSharedFileRequest request = new UpdateSharedFileRequest();
        request.setName("renamed document");

        controller.updateFile(9L, request, user);

        verify(authorizationService).requireParentWithCompatibility(user, "shared_file",
            "shared_file:update", "shared_file", 9L, 2, true);
        verify(fileService).updateFile(user, 9L, "renamed document", null, false);
    }

    @Test
    void updateFile_checksBothManageBoundariesForMove() {
        UpdateSharedFileRequest request = new UpdateSharedFileRequest();
        request.setParentId(3L);

        controller.updateFile(9L, request, user);

        verify(authorizationService).requireParentWithCompatibility(user, "shared_file",
            "shared_file:manage", "shared_file", 9L, 3, true);
        verify(authorizationService).requireWithCompatibility(user, "shared_file",
            "shared_file:manage", "shared_folder", 3L, 3, true);
        verify(fileService).updateFile(user, 9L, null, 3L, true);
    }

    @Test
    void updateFolder_checksUpdatePermissionForRename() {
        UpdateFolderRequest request = new UpdateFolderRequest();
        request.setName("renamed folder");

        controller.updateFolder(9L, request, user);

        verify(authorizationService).requireParentWithCompatibility(user, "shared_file",
            "shared_file:update", "shared_folder", 9L, 2, true);
        verify(folderService).updateFolder("default", null, 9L, "renamed folder", null, false);
    }

    @Test
    void updateFolder_checksBothManageBoundariesForMove() {
        UpdateFolderRequest request = new UpdateFolderRequest();
        request.setParentId(3L);

        controller.updateFolder(9L, request, user);

        verify(authorizationService).requireParentWithCompatibility(user, "shared_file",
            "shared_file:manage", "shared_folder", 9L, 3, true);
        verify(authorizationService).requireWithCompatibility(user, "shared_file",
            "shared_file:manage", "shared_folder", 3L, 3, true);
        verify(folderService).updateFolder("default", null, 9L, null, 3L, true);
    }

    @Test
    void enforcedFolderAclReadDoesNotUseLegacyAclService() {
        when(authorizationService.isEnforced(user, "shared_file")).thenReturn(true);

        assertThat(org.assertj.core.api.Assertions.catchThrowable(
            () -> controller.getFolderAcl(9L, user))).isInstanceOf(IllegalStateException.class);
        verify(aclService, never()).getAcl(anyString(), anyLong());
    }

    private void assertResponseBody(ResponseEntity<InputStreamResource> response, byte[] expected)
            throws Exception {
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getInputStream().readAllBytes()).isEqualTo(expected);
    }
}
