package com.cwgsyw.platform.module.task.runtime;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.task.runtime.entity.TaskSubmissionAttachment;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskSubmissionAttachmentMapper;
import com.cwgsyw.platform.module.task.runtime.service.TaskAttachmentStorage;
import com.cwgsyw.platform.module.task.runtime.service.TaskDraftAttachmentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskDraftAttachmentServiceTest {
    @Mock TaskSubmissionAttachmentMapper submissionAttachmentMapper;
    private TaskDraftAttachmentService service;
    private AtomicInteger downloadCalls;

    @BeforeEach
    void setUp() {
        downloadCalls = new AtomicInteger();
        TaskAttachmentStorage storage = new TaskAttachmentStorage(null) {
            @Override
            public InputStream download(String objectKey) {
                downloadCalls.incrementAndGet();
                return new ByteArrayInputStream(new byte[] {1, 2, 3});
            }
        };
        service = new TaskDraftAttachmentService(null, submissionAttachmentMapper, storage, null);
    }

    @Test
    void submissionDownloadUsesTenantSubmissionAndAttachmentIdentity() throws Exception {
        TaskSubmissionAttachment attachment = new TaskSubmissionAttachment();
        attachment.setId(30L);
        attachment.setTenantId("tenant-a");
        attachment.setSubmissionId(20L);
        attachment.setFieldKey("evidence");
        attachment.setFileName("evidence.pdf");
        attachment.setFileType("application/pdf");
        attachment.setSizeBytes(3L);
        attachment.setObjectKey("tasks/tenant-a/10/submissions/20/object");
        attachment.setSensitive(true);
        when(submissionAttachmentMapper.selectOne(any())).thenReturn(attachment);
        var content = service.downloadSubmission("tenant-a", 20L, 30L);

        assertThat(content.fieldKey()).isEqualTo("evidence");
        assertThat(content.fileName()).isEqualTo("evidence.pdf");
        assertThat(content.sensitive()).isTrue();
        assertThat(content.stream().readAllBytes()).containsExactly(1, 2, 3);
        assertThat(downloadCalls).hasValue(1);
    }

    @Test
    void missingAttachmentDoesNotTouchObjectStorage() {
        when(submissionAttachmentMapper.selectOne(any())).thenReturn(null);

        assertThatThrownBy(() -> service.downloadSubmission("tenant-a", 20L, 99L))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("TASK_ATTACHMENT_NOT_FOUND"));

        assertThat(downloadCalls).hasValue(0);
    }
}
