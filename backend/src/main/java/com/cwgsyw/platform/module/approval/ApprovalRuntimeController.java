package com.cwgsyw.platform.module.approval;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.approval.dto.ApprovalActionRequest;
import com.cwgsyw.platform.module.approval.dto.ApprovalRoundVO;
import com.cwgsyw.platform.module.approval.dto.ApprovalTaskDetailVO;
import com.cwgsyw.platform.module.approval.dto.ApprovalTaskSummaryVO;
import com.cwgsyw.platform.module.approval.service.ApprovalRuntimeService;
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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequiredArgsConstructor
public class ApprovalRuntimeController {
    private final ApprovalRuntimeService approvalService;

    @GetMapping("/api/approvals/tasks")
    @PreAuthorize("hasAuthority('workflow:approve') and hasAuthority('work_item:approve')")
    public R<PageResult<ApprovalTaskSummaryVO>> tasks(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long templateId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) Boolean overdue,
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) java.time.LocalDate from,
            @RequestParam(required = false) java.time.LocalDate to,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(approvalService.pending(user, keyword, templateId, status, priority, overdue,
            groupId, from, to, page, size));
    }

    @GetMapping("/api/approvals/tasks/{approvalTaskId}")
    @PreAuthorize("hasAuthority('workflow:approve') and hasAuthority('work_item:approve')")
    public R<ApprovalTaskDetailVO> task(@PathVariable String approvalTaskId,
                                        @AuthenticationPrincipal SecurityUser user) {
        return R.ok(approvalService.detail(user, approvalTaskId));
    }

    @GetMapping("/api/approvals/tasks/{approvalTaskId}/attachments/{attachmentId}/download")
    @PreAuthorize("hasAuthority('workflow:approve') and hasAuthority('work_item:approve')")
    public ResponseEntity<InputStreamResource> downloadAttachment(
            @PathVariable String approvalTaskId,
            @PathVariable Long attachmentId,
            @AuthenticationPrincipal SecurityUser user) {
        var content = approvalService.downloadAttachment(user, approvalTaskId, attachmentId);
        MediaType mediaType = MediaTypeFactory.getMediaType(content.fileName())
            .orElseGet(() -> mediaType(content.fileType()));
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                .filename(content.fileName(), StandardCharsets.UTF_8).build().toString())
            .contentType(mediaType)
            .contentLength(content.sizeBytes())
            .body(new InputStreamResource(content.stream()));
    }

    @PostMapping("/api/approvals/tasks/{approvalTaskId}/actions")
    @PreAuthorize("hasAuthority('workflow:approve') and hasAuthority('work_item:approve')")
    public R<ApprovalRoundVO> act(@PathVariable String approvalTaskId,
                                  @Valid @RequestBody ApprovalActionRequest request,
                                  @AuthenticationPrincipal SecurityUser user) {
        return R.ok(approvalService.act(user, approvalTaskId, request));
    }

    @GetMapping("/api/tasks/{taskId}/approval-rounds")
    @PreAuthorize("hasAuthority('task:read')")
    public R<List<ApprovalRoundVO>> rounds(@PathVariable Long taskId,
                                           @AuthenticationPrincipal SecurityUser user) {
        return R.ok(approvalService.rounds(user, taskId));
    }

    @GetMapping("/api/approval-rounds/{roundId}")
    @PreAuthorize("hasAuthority('task:read')")
    public R<ApprovalRoundVO> round(@PathVariable Long roundId,
                                    @AuthenticationPrincipal SecurityUser user) {
        return R.ok(approvalService.round(user, roundId));
    }

    private MediaType mediaType(String value) {
        try {
            return value == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(value);
        } catch (IllegalArgumentException exception) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }
}
