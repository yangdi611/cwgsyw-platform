package com.cwgsyw.platform.module.sharedfile;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.changedoc.MinioStorageService;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFile;
import com.cwgsyw.platform.module.user.UserMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SharedFileServiceTest {

    @Mock SharedFileMapper fileMapper;
    @Mock SharedFolderService folderService;
    @Mock SharedFolderAclService aclService;
    @Mock MinioStorageService storageService;
    @Mock AuditLogMapper auditLogMapper;
    @Mock UserMapper userMapper;

    @InjectMocks SharedFileService service;

    @Test
    void getFileContent_returnsStoredMetadataAndStream() throws Exception {
        byte[] bytes = "shared file".getBytes(StandardCharsets.UTF_8);
        SharedFile file = new SharedFile();
        file.setOriginalName("变更方案.docx");
        file.setSizeBytes(1L);
        file.setMinioKey("shared/2/change.docx");
        when(fileMapper.selectOne(any())).thenReturn(file);
        when(storageService.objectSize(file.getMinioKey())).thenReturn((long) bytes.length);
        when(storageService.download(file.getMinioKey())).thenReturn(new ByteArrayInputStream(bytes));

        SharedFileService.FileContent content = service.getFileContent("default", 2L);

        assertThat(content.originalName()).isEqualTo("变更方案.docx");
        assertThat(content.sizeBytes()).isEqualTo(bytes.length);
        assertThat(content.stream().readAllBytes()).isEqualTo(bytes);
        verify(storageService).objectSize("shared/2/change.docx");
        verify(storageService).download("shared/2/change.docx");
    }

    @Test
    void getFileContent_rejectsMissingTenantFileBeforeStorageAccess() {
        when(fileMapper.selectOne(any())).thenReturn(null);

        assertThatThrownBy(() -> service.getFileContent("other-tenant", 2L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("文件不存在: 2");
        verify(storageService, never()).objectSize(any());
        verify(storageService, never()).download(any());
    }
}
