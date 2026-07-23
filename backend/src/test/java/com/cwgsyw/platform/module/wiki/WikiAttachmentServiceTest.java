package com.cwgsyw.platform.module.wiki;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.authorization.ResourceAuthorizationInitializer;
import com.cwgsyw.platform.module.authorization.ResourceDescriptorRepository;
import com.cwgsyw.platform.module.changedoc.MinioStorageService;
import com.cwgsyw.platform.module.sharedfile.SharedFileMapper;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFile;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WikiAttachmentServiceTest {
    @Mock MinioStorageService minioStorage;
    @Mock SharedFileMapper sharedFileMapper;
    @Mock WikiPageMapper pageMapper;
    @Mock ResourceAuthorizationInitializer resourceAuthorizationInitializer;
    @Mock ResourceDescriptorRepository resourceDescriptorRepository;
    @Mock AuditLogMapper auditLogMapper;
    @InjectMocks WikiAttachmentService service;

    @Test
    void deleteAttachment_storageFailureDoesNotLogicallyDeleteRecord() {
        SharedFile attachment = new SharedFile();
        attachment.setId(42L);
        attachment.setTenantId("default");
        attachment.setMinioKey("wiki/1/attachments/42.png");
        attachment.setSourceType("wiki_page");
        attachment.setSourceId(7L);
        when(sharedFileMapper.selectOne(any())).thenReturn(attachment);
        doThrow(BusinessException.serviceUnavailable("STORAGE_DELETE_FAILED", "storage unavailable"))
            .when(minioStorage).deleteOrThrow(attachment.getMinioKey());

        assertThatThrownBy(() -> service.deleteAttachment("default", 9L, 42L))
            .isInstanceOf(BusinessException.class)
            .extracting("httpStatus").isEqualTo(503);

        verify(sharedFileMapper, never()).deleteById(42L);
        verify(auditLogMapper, never()).insert(any(com.cwgsyw.platform.common.entity.AuditLog.class));
    }
}
