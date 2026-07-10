package com.cwgsyw.platform.module.sharedfile;

import com.cwgsyw.platform.security.SecurityUser;
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

@ExtendWith(MockitoExtension.class)
class SharedFileControllerTest {

    @Mock SharedFileService fileService;
    @Mock SharedFolderService folderService;
    @Mock SharedFolderAclService aclService;
    @Mock SecurityUser user;

    private SharedFileController controller;

    @BeforeEach
    void setUp() {
        controller = new SharedFileController(fileService, folderService, aclService);
        when(user.getTenantId()).thenReturn("default");
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

    private void assertResponseBody(ResponseEntity<InputStreamResource> response, byte[] expected)
            throws Exception {
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getInputStream().readAllBytes()).isEqualTo(expected);
    }
}
