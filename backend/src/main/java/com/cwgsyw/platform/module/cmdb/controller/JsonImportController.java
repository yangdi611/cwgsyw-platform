package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.csv.CsvImportExecuteRequest;
import com.cwgsyw.platform.module.cmdb.dto.csv.CsvImportPreviewVO;
import com.cwgsyw.platform.module.cmdb.dto.csv.CsvImportResultVO;
import com.cwgsyw.platform.module.cmdb.service.JsonImportService;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * JSON / NDJSON 批量导入接口（spec §7，P2）。接收文件或 raw body，走 CiInstanceCommandService。
 */
@RestController
@RequestMapping("/api/cmdb/instances/import/json")
@RequiredArgsConstructor
public class JsonImportController {

    private final JsonImportService jsonImportService;

    /** multipart 文件预览。 */
    @PostMapping("/preview")
    @PreAuthorize("hasPermission('cmdb_instance', 'create') and hasPermission('cmdb_instance', 'update')")
    public R<CsvImportPreviewVO> preview(@RequestParam("file") MultipartFile file,
                                          @RequestParam("model") String model,
                                          @RequestParam(value = "mode", defaultValue = "merge") String mode,
                                          @RequestParam(value = "uniqueKeyFields", required = false) String uniqueKeyFields,
                                          @AuthenticationPrincipal SecurityUser cu) throws IOException {
        String content = new String(file.getBytes(), StandardCharsets.UTF_8);
        return R.ok(jsonImportService.preview(content, model, mode, uniqueKeyFields, cu.getTenantId()));
    }

    /** raw body 预览（Content-Type: application/x-ndjson 或 application/json）。 */
    @PostMapping(value = "/preview-raw")
    @PreAuthorize("hasPermission('cmdb_instance', 'create') and hasPermission('cmdb_instance', 'update')")
    public R<CsvImportPreviewVO> previewRaw(@RequestBody String content,
                                             @RequestParam("model") String model,
                                             @RequestParam(value = "mode", defaultValue = "merge") String mode,
                                             @RequestParam(value = "uniqueKeyFields", required = false) String uniqueKeyFields,
                                             @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(jsonImportService.preview(content, model, mode, uniqueKeyFields, cu.getTenantId()));
    }

    @PostMapping("/execute")
    @PreAuthorize("hasPermission('cmdb_instance', 'create') and hasPermission('cmdb_instance', 'update')")
    public R<CsvImportResultVO> execute(@Valid @RequestBody CsvImportExecuteRequest req,
                                         @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(jsonImportService.execute(req.getBatchId(), cu.getTenantId(), cu.getUserId()));
    }
}
