package com.cwgsyw.platform.module.report;

import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportExportService reportExportService;

    @GetMapping("/export")
    @PreAuthorize("hasAuthority('daily_report:export')")
    public ResponseEntity<byte[]> export(
            @RequestParam String startDate,
            @RequestParam String endDate,
            @RequestParam(required = false) Long groupId,
            @AuthenticationPrincipal SecurityUser user) {

        byte[] bytes = reportExportService.exportExcel(
                user.getTenantId(), startDate, endDate, groupId);

        String filename = "日报汇总_" + startDate + "_" + endDate + ".xlsx";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        return ResponseEntity.ok().headers(headers).body(bytes);
    }
}
