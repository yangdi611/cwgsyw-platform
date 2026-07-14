package com.cwgsyw.platform.module.sharedfile;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.changedoc.MinioStorageService;
import com.cwgsyw.platform.module.authorization.AuthorizationResourceMigrationService;
import com.cwgsyw.platform.module.authorization.AuthorizationService;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.org.GroupLifecycleException;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFile;
import com.cwgsyw.platform.module.user.UserMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;

@ExtendWith(MockitoExtension.class)
class SharedFileServiceTest {

    @Mock SharedFileMapper fileMapper;
    @Mock SharedFolderService folderService;
    @Mock SharedFolderAclService aclService;
    @Mock MinioStorageService storageService;
    @Mock AuditLogMapper auditLogMapper;
    @Mock UserMapper userMapper;
    @Mock AuthorizationResourceMigrationService resourceMigrationService;
    @Mock AuthorizationService authorizationService;
    @Mock ActiveGroupReferenceValidator activeGroupReferenceValidator;

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

    @Test
    void uploadFile_validatesOwnerAndVisibleGroupsInAscendingOrderBeforeMinio() {
        var file = new org.springframework.mock.web.MockMultipartFile(
            "file", "evidence.pdf", "application/pdf", "body".getBytes(StandardCharsets.UTF_8));

        service.uploadFile("default", 9L, file, null, List.of(5L, 3L, 5L), 4L, "tenant");

        var order = inOrder(activeGroupReferenceValidator, storageService);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 3L);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 4L);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 5L);
        order.verify(storageService).upload(any(), any(), any(Long.class), any());
        org.mockito.ArgumentCaptor<SharedFile> saved = org.mockito.ArgumentCaptor.forClass(SharedFile.class);
        verify(fileMapper).insert(saved.capture());
        assertThat(saved.getValue().getVisibleGroups()).containsExactly(3L, 5L);
    }

    @Test
    void uploadFile_rejectsInactiveVisibleGroupBeforeMinioOrDatabaseWrite() {
        var file = new org.springframework.mock.web.MockMultipartFile(
            "file", "evidence.pdf", "application/pdf", "body".getBytes(StandardCharsets.UTF_8));
        when(activeGroupReferenceValidator.lockAndRequire("default", 4L)).thenReturn(null);
        doThrow(new GroupLifecycleException(409, "GROUP_REFERENCE_INACTIVE", "inactive"))
            .when(activeGroupReferenceValidator).lockAndRequire("default", 7L);

        assertThatThrownBy(() -> service.uploadFile(
            "default", 9L, file, null, List.of(7L), 4L, "tenant"))
            .isInstanceOf(GroupLifecycleException.class);

        verify(storageService, never()).upload(any(), any(), any(Long.class), any());
        verify(fileMapper, never()).insert(any(SharedFile.class));
    }
}
