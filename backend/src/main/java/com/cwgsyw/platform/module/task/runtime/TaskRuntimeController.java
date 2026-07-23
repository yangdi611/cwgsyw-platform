package com.cwgsyw.platform.module.task.runtime;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.task.runtime.dto.CancelTaskRequest;
import com.cwgsyw.platform.module.task.runtime.dto.AggregateReferencePreviewVO;
import com.cwgsyw.platform.module.task.runtime.dto.CloseExceptionRequest;
import com.cwgsyw.platform.module.task.runtime.dto.CreateOneOffTaskRequest;
import com.cwgsyw.platform.module.task.runtime.dto.CreateTaskSubmissionRequest;
import com.cwgsyw.platform.module.task.runtime.dto.ReassignTaskRequest;
import com.cwgsyw.platform.module.task.runtime.dto.SaveTaskDraftRequest;
import com.cwgsyw.platform.module.task.runtime.dto.TaskDetailVO;
import com.cwgsyw.platform.module.task.runtime.dto.TaskDraftAttachmentVO;
import com.cwgsyw.platform.module.task.runtime.dto.TaskDraftVO;
import com.cwgsyw.platform.module.task.runtime.dto.TaskEventVO;
import com.cwgsyw.platform.module.task.runtime.dto.TaskSubmissionResultVO;
import com.cwgsyw.platform.module.task.runtime.dto.TaskSubmissionVO;
import com.cwgsyw.platform.module.task.runtime.dto.TaskSummaryVO;
import com.cwgsyw.platform.module.task.runtime.service.TaskRuntimeService;
import com.cwgsyw.platform.module.task.template.dto.TemplateValidationResult;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskRuntimeController {
    private final TaskRuntimeService runtimeService;

    @GetMapping
    @PreAuthorize("hasAuthority('task:read')")
    public R<PageResult<TaskSummaryVO>> list(
            @RequestParam(defaultValue = "my") String scope,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long templateVersionId,
            @RequestParam(required = false) Long planId,
            @RequestParam(required = false) String executionStatus,
            @RequestParam(required = false) String approvalStatus,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) Boolean overdue,
            @RequestParam(required = false) Long assigneeId,
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) LocalDate businessDateFrom,
            @RequestParam(required = false) LocalDate businessDateTo,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(runtimeService.list(user, scope, keyword, templateVersionId, planId, executionStatus,
            approvalStatus, priority, overdue, assigneeId, groupId, businessDateFrom, businessDateTo, page, size));
    }

    @GetMapping("/{taskId}")
    @PreAuthorize("hasAuthority('task:read')")
    public R<TaskDetailVO> get(@PathVariable Long taskId, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(runtimeService.get(user, taskId));
    }

    @GetMapping("/{taskId}/timeline")
    @PreAuthorize("hasAuthority('task:read')")
    public R<List<TaskEventVO>> timeline(@PathVariable Long taskId, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(runtimeService.timeline(user, taskId));
    }

    @PostMapping("/one-off")
    @PreAuthorize("hasAuthority('task:create')")
    public R<TaskSummaryVO> createOneOff(@Valid @RequestBody CreateOneOffTaskRequest request,
                                         @AuthenticationPrincipal SecurityUser user) {
        return R.ok(runtimeService.createOneOff(user, request));
    }

    @PostMapping("/{taskId}/start")
    @PreAuthorize("hasAuthority('task:update')")
    public R<TaskSummaryVO> start(@PathVariable Long taskId, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(runtimeService.start(user, taskId));
    }

    @PostMapping("/{taskId}/cancel")
    @PreAuthorize("hasAuthority('task:cancel')")
    public R<TaskSummaryVO> cancel(@PathVariable Long taskId, @Valid @RequestBody CancelTaskRequest request,
                                   @AuthenticationPrincipal SecurityUser user) {
        return R.ok(runtimeService.cancel(user, taskId, request));
    }

    @PostMapping("/{taskId}/close-exception")
    @PreAuthorize("hasAuthority('task:update')")
    public R<TaskSummaryVO> closeException(@PathVariable Long taskId,
                                           @Valid @RequestBody CloseExceptionRequest request,
                                           @AuthenticationPrincipal SecurityUser user) {
        return R.ok(runtimeService.closeException(user, taskId, request));
    }

    @PostMapping("/{taskId}/reassign")
    @PreAuthorize("hasAuthority('task:reassign')")
    public R<TaskSummaryVO> reassign(@PathVariable Long taskId, @Valid @RequestBody ReassignTaskRequest request,
                                     @AuthenticationPrincipal SecurityUser user) {
        return R.ok(runtimeService.reassign(user, taskId, request));
    }

    @PostMapping("/{taskId}/remind")
    @PreAuthorize("hasAuthority('task:update')")
    public R<Void> remind(@PathVariable Long taskId, @AuthenticationPrincipal SecurityUser user) {
        runtimeService.remind(user, taskId);
        return R.ok();
    }

    @GetMapping("/{taskId}/draft")
    @PreAuthorize("hasAuthority('task:read')")
    public R<TaskDraftVO> draft(@PathVariable Long taskId, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(runtimeService.get(user, taskId).draft());
    }

    @PutMapping("/{taskId}/draft")
    @PreAuthorize("hasAuthority('task:update')")
    public R<TaskDraftVO> saveDraft(@PathVariable Long taskId, @Valid @RequestBody SaveTaskDraftRequest request,
                                    @AuthenticationPrincipal SecurityUser user) {
        return R.ok(runtimeService.saveDraft(user, taskId, request));
    }

    @PostMapping("/{taskId}/draft/attachments")
    @PreAuthorize("hasAuthority('task:update')")
    public R<TaskDraftAttachmentVO> uploadAttachment(
            @PathVariable Long taskId,
            @RequestParam Integer revision,
            @RequestParam String fieldKey,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(runtimeService.uploadAttachment(user, taskId, revision, fieldKey, file));
    }

    @DeleteMapping("/{taskId}/draft/attachments/{attachmentId}")
    @PreAuthorize("hasAuthority('task:update')")
    public R<Void> deleteAttachment(@PathVariable Long taskId, @PathVariable Long attachmentId,
                                    @RequestParam Integer revision,
                                    @AuthenticationPrincipal SecurityUser user) {
        runtimeService.deleteAttachment(user, taskId, revision, attachmentId);
        return R.ok();
    }

    @PostMapping("/{taskId}/validate")
    @PreAuthorize("hasAuthority('task:read')")
    public R<TemplateValidationResult> validate(@PathVariable Long taskId,
                                                @AuthenticationPrincipal SecurityUser user) {
        return R.ok(runtimeService.validate(user, taskId));
    }

    @PostMapping("/{taskId}/aggregate-references/preview")
    @PreAuthorize("hasAuthority('task:read')")
    public R<List<AggregateReferencePreviewVO>> aggregateReferencePreview(@PathVariable Long taskId,
                                                                            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(runtimeService.aggregateReferencePreview(user, taskId));
    }

    @PostMapping("/{taskId}/submissions")
    @PreAuthorize("hasAuthority('task:submit')")
    public R<TaskSubmissionResultVO> submit(@PathVariable Long taskId,
                                            @Valid @RequestBody CreateTaskSubmissionRequest request,
                                            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(runtimeService.submit(user, taskId, request));
    }

    @GetMapping("/{taskId}/submissions")
    @PreAuthorize("hasAuthority('task:read')")
    public R<List<TaskSubmissionVO>> submissions(@PathVariable Long taskId,
                                                  @AuthenticationPrincipal SecurityUser user) {
        return R.ok(runtimeService.submissions(user, taskId));
    }

    @GetMapping("/{taskId}/submissions/{submissionId}")
    @PreAuthorize("hasAuthority('task:read')")
    public R<TaskSubmissionVO> submission(@PathVariable Long taskId, @PathVariable Long submissionId,
                                           @AuthenticationPrincipal SecurityUser user) {
        return R.ok(runtimeService.submission(user, taskId, submissionId));
    }

    @GetMapping("/{taskId}/submissions/{submissionId}/attachments/{attachmentId}/download")
    @PreAuthorize("hasAuthority('task:read')")
    public ResponseEntity<InputStreamResource> downloadSubmissionAttachment(
            @PathVariable Long taskId,
            @PathVariable Long submissionId,
            @PathVariable Long attachmentId,
            @AuthenticationPrincipal SecurityUser user) {
        var content = runtimeService.downloadSubmissionAttachment(user, taskId, submissionId, attachmentId);
        ContentDisposition disposition = ContentDisposition.attachment()
            .filename(content.fileName(), StandardCharsets.UTF_8).build();
        MediaType mediaType = MediaTypeFactory.getMediaType(content.fileName())
            .orElseGet(() -> mediaType(content.fileType()));
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
            .contentType(mediaType)
            .contentLength(content.sizeBytes())
            .body(new InputStreamResource(content.stream()));
    }

    @GetMapping("/{taskId}/submissions/{submissionId}/diff")
    @PreAuthorize("hasAuthority('task:read')")
    public R<Map<String, Object>> diff(@PathVariable Long taskId, @PathVariable Long submissionId,
                                       @RequestParam Long against,
                                       @AuthenticationPrincipal SecurityUser user) {
        return R.ok(runtimeService.diff(user, taskId, submissionId, against));
    }

    private MediaType mediaType(String value) {
        try {
            return value == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(value);
        } catch (IllegalArgumentException exception) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }
}
