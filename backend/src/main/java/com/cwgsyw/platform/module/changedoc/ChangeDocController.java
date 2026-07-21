package com.cwgsyw.platform.module.changedoc;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.changedoc.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/change-docs")
@RequiredArgsConstructor
@Validated
public class ChangeDocController {
    private final ChangeDocService changeDocService;
    private final ChangeDocWorkflowOrchestrator workflowOrchestrator;
    private final ExportService exportService;
    private final EmailTemplateService emailTemplateService;

    @GetMapping
    @PreAuthorize("hasAuthority('change_doc:read')")
    public R<PageResult<ChangeDocVO>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.list(user, status, keyword, page, size));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('change_doc:read')")
    public R<ChangeDocVO> get(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.get(user, id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('change_doc:create')")
    public R<ChangeDocVO> create(@RequestBody CreateChangeDocRequest req,
                                  @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.create(user.getTenantId(), user.getUserId(), req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('change_doc:update')")
    public R<ChangeDocVO> update(@PathVariable Long id,
                                  @RequestBody UpdateChangeDocRequest req,
                                  @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.update(user, id, req));
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasAuthority('change_doc:update')")
    public R<ChangeDocVO> submit(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(workflowOrchestrator.submit(user, id));
    }

    @PostMapping("/{id}/submit-plan")
    @PreAuthorize("hasAuthority('change_doc:update')")
    public R<ChangeDocVO> submitPlan(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(workflowOrchestrator.submitPlan(user, id));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('change_doc:approve')")
    public R<ChangeDocVO> approve(@PathVariable Long id,
                                   @RequestBody ApproveRequest req,
                                   @AuthenticationPrincipal SecurityUser user) {
        return R.ok(workflowOrchestrator.approve(user, id,
                req.getComment(), Boolean.TRUE.equals(req.getApproved())));
    }

    @PostMapping("/{id}/ai-generate")
    @PreAuthorize("hasAuthority('change_doc:update')")
    public R<String> aiGenerate(@PathVariable Long id,
                                 @RequestBody AiGenerateRequest req,
                                 @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.generateAiContent(user, id, req));
    }

    @GetMapping("/{id}/snapshots")
    @PreAuthorize("hasAuthority('change_doc:read')")
    public R<List<?>> snapshots(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.listSnapshots(user, id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('change_doc:delete')")
    public R<Void> delete(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        changeDocService.delete(user, id);
        return R.ok(null);
    }

    @DeleteMapping("/{id}/remediation-test")
    @PreAuthorize("hasAuthority('change_doc:delete')")
    public R<Void> purgeRemediationTest(@PathVariable Long id,
                                        @RequestParam String remediationRunId,
                                        @AuthenticationPrincipal SecurityUser user) {
        workflowOrchestrator.purgeRemediationTest(user, id, remediationRunId);
        return R.ok(null);
    }

    @GetMapping("/{id}/export")
    @PreAuthorize("hasAuthority('change_doc:export')")
    public ResponseEntity<byte[]> export(
            @PathVariable Long id,
            @RequestParam(defaultValue = "pdf") String format,
            @RequestParam(required = false) String which,
            @AuthenticationPrincipal SecurityUser user) {
        ChangeDocVO doc = changeDocService.get(user, id);

        // which = "application" | "plan" | null（兼容旧调用，默认走 application 优先回退 plan）
        Long templateId;
        String partLabel;
        if ("plan".equals(which)) {
            templateId = doc.getPlanTemplateId();
            partLabel = "方案";
        } else if ("application".equals(which)) {
            templateId = doc.getApplicationTemplateId();
            partLabel = "申请单";
        } else {
            templateId = doc.getApplicationTemplateId() != null ? doc.getApplicationTemplateId() : doc.getPlanTemplateId();
            partLabel = doc.getApplicationTemplateId() != null ? "申请单" : "方案";
        }

        String filename = doc.getChangeNo() + "_" + partLabel + (format.equals("docx") ? ".docx" : ".pdf");
        byte[] bytes;
        MediaType mediaType;
        if ("docx".equals(format)) {
            bytes = exportService.exportDocxFor(doc, user.getTenantId(), templateId);
            mediaType = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        } else {
            bytes = exportService.exportPdfDirect(doc, user.getTenantId());
            mediaType = MediaType.APPLICATION_PDF;
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        headers.setContentType(mediaType);
        return ResponseEntity.ok().headers(headers).body(bytes);
    }

    @GetMapping("/{id}/email-template")
    @PreAuthorize("hasAuthority('change_doc:read')")
    public R<String> emailTemplate(@PathVariable Long id,
                                    @AuthenticationPrincipal SecurityUser user) {
        ChangeDocVO doc = changeDocService.get(user, id);
        return R.ok(emailTemplateService.buildEmailBody(EmailTemplateService.EmailType.CHANGE_DOC_EXPORTED, doc, null));
    }

    @GetMapping("/{id}/ci-links")
    @PreAuthorize("hasAuthority('change_doc:read')")
    public R<List<LinkedCiInstanceVO>> listCiLinks(@PathVariable Long id,
                                                    @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.listCiLinks(user, id));
    }

    @PostMapping("/{id}/ci-links")
    @PreAuthorize("hasAuthority('change_doc:update')")
    public R<Void> addCiLinks(@PathVariable Long id,
                              @RequestBody AddCiLinkRequest req,
                              @AuthenticationPrincipal SecurityUser user) {
        changeDocService.addCiLinks(user, id, req.getLinks());
        return R.ok(null);
    }

    @DeleteMapping("/{id}/ci-links/{instanceId}")
    @PreAuthorize("hasAuthority('change_doc:update')")
    public R<Void> removeCiLink(@PathVariable Long id,
                                @PathVariable Long instanceId,
                                @AuthenticationPrincipal SecurityUser user) {
        changeDocService.removeCiLink(user, id, instanceId);
        return R.ok(null);
    }
}
