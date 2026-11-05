package com.cwgsyw.platform.module.sosreport;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.sosreport.cmdb.SosCmdbApprovalService;
import com.cwgsyw.platform.module.sosreport.cmdb.SosCmdbRequestService;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.CmdbDraftRequest;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.CmdbPreviewVO;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.CmdbRequestVO;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.DecisionRequest;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.PendingApprovalVO;
import com.cwgsyw.platform.module.sosreport.dto.SosMappingDtos.FactCatalogVO;
import com.cwgsyw.platform.module.sosreport.dto.SosMappingDtos.FieldMappingVO;
import com.cwgsyw.platform.module.sosreport.dto.SosMappingDtos.MappingOverviewVO;
import com.cwgsyw.platform.module.sosreport.dto.SosMappingDtos.SaveMappingRequest;
import com.cwgsyw.platform.module.sosreport.dto.SosMappingDtos.SuggestRequest;
import com.cwgsyw.platform.module.sosreport.dto.SosMappingDtos.SuggestResultVO;
import com.cwgsyw.platform.module.sosreport.dto.SosReportVO;
import com.cwgsyw.platform.module.sosreport.dto.SosUploadDtos.StartUploadRequest;
import com.cwgsyw.platform.module.sosreport.dto.SosUploadDtos.UploadSessionVO;
import com.cwgsyw.platform.module.sosreport.mapping.SosFieldMappingService;
import com.cwgsyw.platform.module.sosreport.mapping.SosMappingSuggestionService;
import com.cwgsyw.platform.security.SecurityUser;
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
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/sos-reports")
@RequiredArgsConstructor
public class SosReportController {

    private final SosReportService reportService;
    private final SosReportUploadService uploadService;
    private final SosCmdbRequestService cmdbRequestService;
    private final SosCmdbApprovalService approvalService;
    private final SosFieldMappingService mappingService;
    private final SosMappingSuggestionService suggestionService;

    @PostMapping("/upload")
    @PreAuthorize("hasAuthority('sos_report:upload')")
    public R<SosReportVO> upload(@RequestParam("file") MultipartFile file,
                                 @AuthenticationPrincipal SecurityUser user) {
        return R.ok(reportService.upload(user, file));
    }

    @PostMapping("/uploads")
    @PreAuthorize("hasAuthority('sos_report:upload')")
    public R<UploadSessionVO> startUpload(@RequestBody StartUploadRequest request,
                                          @AuthenticationPrincipal SecurityUser user) {
        return R.ok(uploadService.start(user, request));
    }

    @PostMapping("/uploads/{uploadId}/chunks/{index}")
    @PreAuthorize("hasAuthority('sos_report:upload')")
    public R<Void> uploadChunk(@PathVariable String uploadId,
                               @PathVariable int index,
                               @RequestParam("chunk") MultipartFile chunk,
                               @AuthenticationPrincipal SecurityUser user) {
        uploadService.saveChunk(user, uploadId, index, chunk);
        return R.ok(null);
    }

    @PostMapping("/uploads/{uploadId}/complete")
    @PreAuthorize("hasAuthority('sos_report:upload')")
    public R<SosReportVO> completeUpload(@PathVariable String uploadId,
                                         @AuthenticationPrincipal SecurityUser user) {
        return R.ok(uploadService.complete(user, uploadId));
    }

    @DeleteMapping("/uploads/{uploadId}")
    @PreAuthorize("hasAuthority('sos_report:upload')")
    public R<Void> cancelUpload(@PathVariable String uploadId, @AuthenticationPrincipal SecurityUser user) {
        uploadService.cancel(user, uploadId);
        return R.ok(null);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('sos_report:read')")
    public R<PageResult<SosReportVO>> list(@RequestParam(required = false) String keyword,
                                           @RequestParam(required = false) String status,
                                           @RequestParam(defaultValue = "1") int page,
                                           @RequestParam(defaultValue = "20") int size,
                                           @AuthenticationPrincipal SecurityUser user) {
        return R.ok(reportService.list(user, keyword, status, page, size));
    }

    @GetMapping("/fact-catalog")
    @PreAuthorize("hasAuthority('sos_report:read')")
    public R<FactCatalogVO> factCatalog() {
        return R.ok(mappingService.catalog());
    }

    @GetMapping("/mappings")
    @PreAuthorize("hasAuthority('sos_report:read')")
    public R<MappingOverviewVO> mappings(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(mappingService.overview(user.getTenantId()));
    }

    @PutMapping("/mappings/{fieldKey}")
    @PreAuthorize("hasAuthority('sos_report:manage_mapping')")
    public R<FieldMappingVO> saveMapping(@PathVariable String fieldKey,
                                         @RequestBody SaveMappingRequest request,
                                         @AuthenticationPrincipal SecurityUser user) {
        return R.ok(mappingService.save(user, fieldKey, request));
    }

    @DeleteMapping("/mappings/{fieldKey}")
    @PreAuthorize("hasAuthority('sos_report:manage_mapping')")
    public R<Void> removeMapping(@PathVariable String fieldKey, @AuthenticationPrincipal SecurityUser user) {
        mappingService.remove(user, fieldKey);
        return R.ok(null);
    }

    @PostMapping("/mappings/suggestions")
    @PreAuthorize("hasAuthority('sos_report:manage_mapping')")
    public R<SuggestResultVO> suggest(@RequestBody(required = false) SuggestRequest request,
                                      @AuthenticationPrincipal SecurityUser user) {
        return R.ok(suggestionService.suggest(user, request == null ? null : request.getFieldKeys()));
    }

    @GetMapping("/approvals")
    @PreAuthorize("hasAuthority('sos_report:approve')")
    public R<List<PendingApprovalVO>> approvals(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(approvalService.pending(user));
    }

    @PostMapping("/cmdb-requests/{requestId}/decision")
    @PreAuthorize("hasAuthority('sos_report:approve')")
    public R<Void> decide(@PathVariable Long requestId,
                          @RequestBody DecisionRequest request,
                          @AuthenticationPrincipal SecurityUser user) {
        approvalService.decide(user, requestId, request.getApproved(), request.getComment());
        return R.ok(null);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('sos_report:read')")
    public R<SosReportVO> detail(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(reportService.detail(user, id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('sos_report:delete')")
    public R<Void> delete(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        reportService.delete(user, id);
        return R.ok(null);
    }

    @PostMapping("/{id}/cmdb-preview")
    @PreAuthorize("hasAuthority('sos_report:read')")
    public R<CmdbPreviewVO> preview(@PathVariable Long id,
                                    @RequestBody(required = false) CmdbDraftRequest request,
                                    @AuthenticationPrincipal SecurityUser user) {
        return R.ok(cmdbRequestService.preview(user, id, request));
    }

    @PostMapping("/{id}/cmdb-requests")
    @PreAuthorize("hasAuthority('sos_report:submit')")
    public R<CmdbRequestVO> submit(@PathVariable Long id,
                                   @RequestBody(required = false) CmdbDraftRequest request,
                                   @AuthenticationPrincipal SecurityUser user) {
        return R.ok(cmdbRequestService.submit(user, id, request));
    }

    @GetMapping("/{id}/cmdb-requests")
    @PreAuthorize("hasAuthority('sos_report:read')")
    public R<List<CmdbRequestVO>> requests(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(cmdbRequestService.list(user, id));
    }
}
