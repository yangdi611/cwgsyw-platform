package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.csv.CsvImportExecuteRequest;
import com.cwgsyw.platform.module.cmdb.dto.csv.CsvImportPreviewVO;
import com.cwgsyw.platform.module.cmdb.dto.csv.CsvImportProgressVO;
import com.cwgsyw.platform.module.cmdb.dto.csv.CsvImportResultVO;
import com.cwgsyw.platform.module.cmdb.service.CsvImportService;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/cmdb/instances/import")
@RequiredArgsConstructor
public class CsvImportController {

    private final CsvImportService csvImportService;

    @GetMapping("/template")
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public ResponseEntity<byte[]> downloadTemplate(@RequestParam String model,
                                                     @AuthenticationPrincipal SecurityUser cu) {
        String csv = csvImportService.generateTemplate(model, cu.getTenantId());
        byte[] bytes = csv.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + model + "_import_template.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(bytes);
    }

    @PostMapping("/preview")
    @PreAuthorize("hasPermission('cmdb_instance', 'create') and hasPermission('cmdb_instance', 'update')")
    public R<CsvImportPreviewVO> preview(@RequestParam("file") MultipartFile file,
                                          @RequestParam("model") String model,
                                          @RequestParam(value = "conflictStrategy", defaultValue = "override") String conflictStrategy,
                                          @RequestParam(value = "uniqueKeyFields", required = false) String uniqueKeyFields,
                                          @RequestParam(value = "encoding", required = false) String encoding,
                                          @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(csvImportService.preview(file, model, conflictStrategy, uniqueKeyFields, encoding, cu.getTenantId()));
    }

    @PostMapping("/execute")
    @PreAuthorize("hasPermission('cmdb_instance', 'create') and hasPermission('cmdb_instance', 'update')")
    public R<CsvImportResultVO> execute(@Valid @RequestBody CsvImportExecuteRequest req,
                                         @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(csvImportService.execute(req.getBatchId(), cu.getTenantId(), cu.getUserId()));
    }

    @GetMapping("/{batchId}/progress")
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public R<CsvImportProgressVO> getProgress(@PathVariable String batchId,
                                                @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(csvImportService.getProgress(batchId));
    }

    @GetMapping("/{batchId}/failed-rows")
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public ResponseEntity<byte[]> downloadFailedRows(@PathVariable String batchId,
                                                       @AuthenticationPrincipal SecurityUser cu) {
        byte[] csv = csvImportService.downloadFailedRows(batchId, cu.getTenantId());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"import_failed_" + batchId + ".csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csv);
    }
}
