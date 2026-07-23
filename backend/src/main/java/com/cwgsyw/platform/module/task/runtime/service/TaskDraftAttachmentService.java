package com.cwgsyw.platform.module.task.runtime.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.task.runtime.dto.TaskDraftAttachmentVO;
import com.cwgsyw.platform.module.task.runtime.entity.TaskDraftAttachment;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.runtime.entity.TaskSubmissionAttachment;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskDraftAttachmentMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskSubmissionAttachmentMapper;
import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.module.task.template.dto.TaskTemplateVersionVO;
import com.cwgsyw.platform.module.task.template.service.TaskTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TaskDraftAttachmentService {
    private static final long MAX_ATTACHMENT_BYTES = 50L * 1024 * 1024;
    private final TaskDraftAttachmentMapper draftAttachmentMapper;
    private final TaskSubmissionAttachmentMapper submissionAttachmentMapper;
    private final TaskAttachmentStorage storage;
    private final TaskTemplateService templateService;

    @Transactional(rollbackFor = Exception.class)
    public TaskDraftAttachmentVO upload(TaskInstance task, Integer revision, String fieldKey,
                                        MultipartFile file, Long userId) {
        if (file == null || file.isEmpty()) throw BusinessException.badRequest("TASK_ATTACHMENT_EMPTY", "附件不能为空");
        if (file.getSize() > MAX_ATTACHMENT_BYTES) throw BusinessException.badRequest("TASK_ATTACHMENT_TOO_LARGE", "单个附件不能超过 50MB");
        TaskFieldDefinition field = requireAttachmentField(task, fieldKey);
        validateFieldSize(field, file.getSize());
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException exception) {
            throw BusinessException.badRequest("TASK_ATTACHMENT_READ_FAILED", "无法读取附件");
        }
        String objectKey = "tasks/" + task.getTenantId() + "/" + task.getId() + "/draft/" + UUID.randomUUID();
        storage.upload(objectKey, new java.io.ByteArrayInputStream(bytes), bytes.length, contentType(file));
        TaskDraftAttachment attachment = new TaskDraftAttachment();
        attachment.setTenantId(task.getTenantId());
        attachment.setTaskId(task.getId());
        attachment.setDraftRevision(revision);
        attachment.setFieldKey(fieldKey);
        attachment.setFileName(safeName(file.getOriginalFilename()));
        attachment.setFileType(contentType(file));
        attachment.setSizeBytes(file.getSize());
        attachment.setObjectKey(objectKey);
        attachment.setChecksum(sha256(bytes));
        attachment.setUploadedBy(userId);
        attachment.setUploadedAt(LocalDateTime.now());
        try {
            draftAttachmentMapper.insert(attachment);
        } catch (RuntimeException exception) {
            storage.delete(objectKey);
            throw exception;
        }
        return toVO(attachment);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(TaskInstance task, Integer revision, Long attachmentId) {
        TaskDraftAttachment attachment = draftAttachmentMapper.selectOne(new LambdaQueryWrapper<TaskDraftAttachment>()
            .eq(TaskDraftAttachment::getTenantId, task.getTenantId()).eq(TaskDraftAttachment::getTaskId, task.getId())
            .eq(TaskDraftAttachment::getDraftRevision, revision).eq(TaskDraftAttachment::getId, attachmentId));
        if (attachment == null) throw new BusinessException(404, "TASK_ATTACHMENT_NOT_FOUND", "附件不存在");
        storage.delete(attachment.getObjectKey());
        draftAttachmentMapper.deleteById(attachmentId);
    }

    public List<TaskDraftAttachmentVO> list(String tenantId, Long taskId, Integer revision) {
        return find(tenantId, taskId, revision).stream().map(this::toVO).toList();
    }

    public SubmissionAttachmentContent downloadSubmission(String tenantId, Long submissionId, Long attachmentId) {
        TaskSubmissionAttachment attachment = findSubmission(tenantId, submissionId, attachmentId);
        return new SubmissionAttachmentContent(attachment.getFieldKey(), attachment.getFileName(), attachment.getFileType(),
            attachment.getSizeBytes(), attachment.getSensitive(), storage.download(attachment.getObjectKey()));
    }

    /** Loads immutable metadata without touching object storage, so callers can authorize first. */
    public TaskSubmissionAttachment findSubmission(String tenantId, Long submissionId, Long attachmentId) {
        TaskSubmissionAttachment attachment = submissionAttachmentMapper.selectOne(
            new LambdaQueryWrapper<TaskSubmissionAttachment>()
                .eq(TaskSubmissionAttachment::getTenantId, tenantId)
                .eq(TaskSubmissionAttachment::getSubmissionId, submissionId)
                .eq(TaskSubmissionAttachment::getId, attachmentId));
        if (attachment == null) throw new BusinessException(404, "TASK_ATTACHMENT_NOT_FOUND", "附件不存在");
        return attachment;
    }

    public List<TaskDraftAttachment> find(String tenantId, Long taskId, Integer revision) {
        if (revision == null || revision <= 0) return List.of();
        return draftAttachmentMapper.selectList(new LambdaQueryWrapper<TaskDraftAttachment>()
            .eq(TaskDraftAttachment::getTenantId, tenantId).eq(TaskDraftAttachment::getTaskId, taskId)
            .eq(TaskDraftAttachment::getDraftRevision, revision).orderByAsc(TaskDraftAttachment::getUploadedAt));
    }

    public void carryForward(String tenantId, Long taskId, Integer currentRevision, Integer nextRevision) {
        if (currentRevision != null && currentRevision >= 0) {
            draftAttachmentMapper.carryForward(tenantId, taskId, currentRevision, nextRevision);
        }
    }

    public List<TaskSubmissionAttachment> freeze(String tenantId, Long taskId, Integer revision,
                                                 Long submissionId, List<TaskFieldDefinition> fields) {
        Set<String> sensitiveFields = fields.stream().filter(field -> Boolean.TRUE.equals(field.getSensitive()))
            .map(TaskFieldDefinition::getKey).collect(java.util.stream.Collectors.toSet());
        return find(tenantId, taskId, revision).stream().map(draft -> {
            String frozenKey = "tasks/" + tenantId + "/" + taskId + "/submissions/" + submissionId + "/" + UUID.randomUUID();
            storage.copy(draft.getObjectKey(), frozenKey);
            registerRollbackCleanup(frozenKey);
            TaskSubmissionAttachment frozen = new TaskSubmissionAttachment();
            frozen.setTenantId(tenantId);
            frozen.setSubmissionId(submissionId);
            frozen.setFieldKey(draft.getFieldKey());
            frozen.setFileName(draft.getFileName());
            frozen.setFileType(draft.getFileType());
            frozen.setSizeBytes(draft.getSizeBytes());
            frozen.setObjectKey(frozenKey);
            frozen.setChecksum(draft.getChecksum());
            frozen.setSensitive(sensitiveFields.contains(draft.getFieldKey()));
            frozen.setUploadedBy(draft.getUploadedBy());
            frozen.setUploadedAt(draft.getUploadedAt());
            try {
                submissionAttachmentMapper.insert(frozen);
            } catch (RuntimeException exception) {
                storage.delete(frozenKey);
                throw exception;
            }
            return frozen;
        }).toList();
    }

    public Map<String, List<Long>> restoreFromSubmission(String tenantId, Long taskId, Integer revision,
                                                         List<TaskSubmissionAttachment> attachments) {
        Map<String, List<Long>> restored = new LinkedHashMap<>();
        for (TaskSubmissionAttachment source : attachments) {
            String draftKey = "tasks/" + tenantId + "/" + taskId + "/draft/" + UUID.randomUUID();
            storage.copy(source.getObjectKey(), draftKey);
            registerRollbackCleanup(draftKey);
            TaskDraftAttachment draft = new TaskDraftAttachment();
            draft.setTenantId(tenantId);
            draft.setTaskId(taskId);
            draft.setDraftRevision(revision);
            draft.setFieldKey(source.getFieldKey());
            draft.setFileName(source.getFileName());
            draft.setFileType(source.getFileType());
            draft.setSizeBytes(source.getSizeBytes());
            draft.setObjectKey(draftKey);
            draft.setChecksum(source.getChecksum());
            draft.setUploadedBy(source.getUploadedBy());
            draft.setUploadedAt(source.getUploadedAt());
            try {
                draftAttachmentMapper.insert(draft);
            } catch (RuntimeException exception) {
                storage.delete(draftKey);
                throw exception;
            }
            restored.computeIfAbsent(draft.getFieldKey(), ignored -> new java.util.ArrayList<>()).add(draft.getId());
        }
        return restored;
    }

    private void registerRollbackCleanup(String objectKey) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == STATUS_ROLLED_BACK) storage.delete(objectKey);
            }
        });
    }

    private TaskFieldDefinition requireAttachmentField(TaskInstance task, String fieldKey) {
        TaskTemplateVersionVO template = templateService.getVersion(task.getTenantId(), task.getTemplateVersionId());
        return template.getFields().stream().filter(field -> field.getKey().equals(fieldKey))
            .filter(field -> Set.of("file", "image").contains(field.getType()))
            .findFirst().orElseThrow(() -> BusinessException.badRequest("TASK_ATTACHMENT_FIELD_INVALID", "目标字段不是附件字段"));
    }

    private void validateFieldSize(TaskFieldDefinition field, long size) {
        Object configured = field.getValidation() == null ? null : field.getValidation().get("maxSize");
        if (configured == null) return;
        try {
            long max = Long.parseLong(String.valueOf(configured));
            if (max > 0 && size > max) throw BusinessException.badRequest("TASK_ATTACHMENT_TOO_LARGE", "附件超过字段允许大小");
        } catch (NumberFormatException exception) {
            throw BusinessException.badRequest("TASK_ATTACHMENT_CONFIG_INVALID", "附件大小配置无效");
        }
    }

    private String contentType(MultipartFile file) {
        return file.getContentType() == null ? "application/octet-stream" : file.getContentType();
    }

    private String safeName(String name) {
        if (name == null || name.isBlank()) return "attachment";
        String normalized = name.replace('\\', '/');
        normalized = normalized.substring(normalized.lastIndexOf('/') + 1).replaceAll("[\\r\\n]", "_");
        return normalized.length() > 500 ? normalized.substring(normalized.length() - 500) : normalized;
    }

    private String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    private TaskDraftAttachmentVO toVO(TaskDraftAttachment attachment) {
        return new TaskDraftAttachmentVO(attachment.getId(), attachment.getFieldKey(), attachment.getFileName(),
            attachment.getFileType(), attachment.getSizeBytes(), attachment.getChecksum(), attachment.getUploadedAt());
    }

    public record SubmissionAttachmentContent(
        String fieldKey,
        String fileName,
        String fileType,
        Long sizeBytes,
        Boolean sensitive,
        InputStream stream
    ) {
    }
}
