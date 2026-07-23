package com.cwgsyw.platform.module.task.template;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.task.template.dto.CreateTaskTemplateRequest;
import com.cwgsyw.platform.module.task.template.dto.FieldTypeMetadata;
import com.cwgsyw.platform.module.task.template.dto.TaskTemplateDetailVO;
import com.cwgsyw.platform.module.task.template.dto.TaskTemplateSummaryVO;
import com.cwgsyw.platform.module.task.template.dto.TaskTemplateVersionSummaryVO;
import com.cwgsyw.platform.module.task.template.dto.TaskTemplateVersionVO;
import com.cwgsyw.platform.module.task.template.dto.TemplatePreviewRequest;
import com.cwgsyw.platform.module.task.template.dto.TemplatePreviewVO;
import com.cwgsyw.platform.module.task.template.dto.TemplateValidationResult;
import com.cwgsyw.platform.module.task.template.dto.UpdateTaskTemplateRequest;
import com.cwgsyw.platform.module.task.template.dto.UpdateTaskTemplateVersionRequest;
import com.cwgsyw.platform.module.task.template.service.TaskTemplateService;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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

import java.util.List;

@RestController
@RequiredArgsConstructor
public class TaskTemplateController {
    private final TaskTemplateService templateService;

    @GetMapping("/api/task-templates")
    @PreAuthorize("hasAuthority('task_template:read')")
    public R<PageResult<TaskTemplateSummaryVO>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.listTemplates(user.getTenantId(), keyword, status, category, page, size));
    }

    @PostMapping("/api/task-templates")
    @PreAuthorize("hasAuthority('task_template:create')")
    public R<TaskTemplateDetailVO> create(
            @Valid @RequestBody CreateTaskTemplateRequest request,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.createTemplate(user.getTenantId(), user.getUserId(), request));
    }

    @GetMapping("/api/task-templates/{templateId}")
    @PreAuthorize("hasAuthority('task_template:read')")
    public R<TaskTemplateDetailVO> get(
            @PathVariable Long templateId,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.getTemplate(user.getTenantId(), templateId));
    }

    @PutMapping("/api/task-templates/{templateId}")
    @PreAuthorize("hasAuthority('task_template:update')")
    public R<TaskTemplateDetailVO> update(
            @PathVariable Long templateId,
            @Valid @RequestBody UpdateTaskTemplateRequest request,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.updateTemplate(user.getTenantId(), user.getUserId(), templateId, request));
    }

    @DeleteMapping("/api/task-templates/{templateId}")
    @PreAuthorize("hasAuthority('task_template:delete')")
    public R<Void> delete(
            @PathVariable Long templateId,
            @AuthenticationPrincipal SecurityUser user) {
        templateService.deleteTemplate(user.getTenantId(), user.getUserId(), templateId);
        return R.ok();
    }

    @GetMapping("/api/task-templates/{templateId}/versions")
    @PreAuthorize("hasAuthority('task_template:read')")
    public R<List<TaskTemplateVersionSummaryVO>> versions(
            @PathVariable Long templateId,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.listVersions(user.getTenantId(), templateId));
    }

    @PostMapping("/api/task-templates/{templateId}/versions")
    @PreAuthorize("hasAuthority('task_template:update')")
    public R<TaskTemplateVersionVO> createDraftVersion(
            @PathVariable Long templateId,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.createDraftVersion(user.getTenantId(), user.getUserId(), templateId));
    }

    @GetMapping("/api/task-template-versions/{versionId}")
    @PreAuthorize("hasAuthority('task_template:read')")
    public R<TaskTemplateVersionVO> version(
            @PathVariable Long versionId,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.getVersion(user.getTenantId(), versionId));
    }

    @PutMapping("/api/task-template-versions/{versionId}")
    @PreAuthorize("hasAuthority('task_template:update')")
    public R<TaskTemplateVersionVO> updateVersion(
            @PathVariable Long versionId,
            @Valid @RequestBody UpdateTaskTemplateVersionRequest request,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.updateVersion(user.getTenantId(), user.getUserId(), versionId, request));
    }

    @PostMapping("/api/task-template-versions/{versionId}/validate")
    @PreAuthorize("hasAuthority('task_template:update')")
    public R<TemplateValidationResult> validateVersion(
            @PathVariable Long versionId,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.validateVersion(user.getTenantId(), versionId));
    }

    @PostMapping("/api/task-template-versions/{versionId}/publish")
    @PreAuthorize("hasAuthority('task_template:publish')")
    public R<TaskTemplateVersionVO> publishVersion(
            @PathVariable Long versionId,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.publishVersion(user.getTenantId(), user.getUserId(), versionId));
    }

    @PostMapping("/api/task-template-versions/{versionId}/deprecate")
    @PreAuthorize("hasAuthority('task_template:publish')")
    public R<TaskTemplateVersionVO> deprecateVersion(
            @PathVariable Long versionId,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.deprecateVersion(user.getTenantId(), user.getUserId(), versionId));
    }

    @PostMapping("/api/task-template-versions/{versionId}/preview")
    @PreAuthorize("hasAuthority('task_template:read')")
    public R<TemplatePreviewVO> previewVersion(
            @PathVariable Long versionId,
            @RequestBody(required = false) TemplatePreviewRequest request,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.previewVersion(user.getTenantId(), versionId, request));
    }

    @GetMapping("/api/task-field-types")
    @PreAuthorize("hasAuthority('task_template:read')")
    public R<List<FieldTypeMetadata>> fieldTypes() {
        return R.ok(templateService.fieldTypes());
    }
}
