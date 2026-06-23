package com.cwgsyw.platform.module.changedoc;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.changedoc.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/admin/change-doc-templates")
@RequiredArgsConstructor
public class ChangeDocTemplateController {

    private final ChangeDocTemplateService templateService;

    @GetMapping
    @PreAuthorize("hasAuthority('change_doc_template:read')")
    public R<List<TemplateVO>> list(
            @RequestParam(required = false) String docType,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.listTemplates(user.getTenantId(), docType));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('change_doc_template:read')")
    public R<TemplateVO> get(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.getTemplate(user.getTenantId(), id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('change_doc_template:write')")
    public R<TemplateVO> create(
            @RequestParam String name,
            @RequestParam(required = false) String description,
            @RequestParam(required = false, defaultValue = "general") String docType,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.createTemplate(user.getTenantId(), user.getUserId(), name, description, docType));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('change_doc_template:write')")
    public R<TemplateVO> updateMeta(
            @PathVariable Long id,
            @RequestBody UpdateTemplateRequest req,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.updateMeta(user.getTenantId(), id, req));
    }

    @PostMapping(value = "/{id}/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('change_doc_template:write')")
    public R<Void> uploadDocx(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal SecurityUser user) {
        templateService.uploadDocx(user.getTenantId(), id, file);
        return R.ok(null);
    }

    @PostMapping("/{id}/parse-bookmarks")
    @PreAuthorize("hasAuthority('change_doc_template:write')")
    public R<List<String>> parseBookmarks(
            @PathVariable Long id,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.parseBookmarks(user.getTenantId(), id));
    }

    @PutMapping("/{id}/fields")
    @PreAuthorize("hasAuthority('change_doc_template:write')")
    public R<Void> saveFields(
            @PathVariable Long id,
            @RequestBody SaveFieldRequest req,
            @AuthenticationPrincipal SecurityUser user) {
        templateService.saveFields(user.getTenantId(), id, req);
        return R.ok(null);
    }

    @DeleteMapping("/{id}/fields/{fieldId}")
    @PreAuthorize("hasAuthority('change_doc_template:write')")
    public R<Void> deleteField(
            @PathVariable Long id,
            @PathVariable Long fieldId,
            @AuthenticationPrincipal SecurityUser user) {
        templateService.deleteField(fieldId);
        return R.ok(null);
    }

    @PutMapping("/{id}/active")
    @PreAuthorize("hasAuthority('change_doc_template:write')")
    public R<Void> setActive(
            @PathVariable Long id,
            @RequestParam boolean active,
            @AuthenticationPrincipal SecurityUser user) {
        templateService.setActive(user.getTenantId(), id, active);
        return R.ok(null);
    }
}
