package com.cwgsyw.platform.module.daily;

import com.cwgsyw.platform.common.*;
import com.cwgsyw.platform.module.daily.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/daily-reports")
@RequiredArgsConstructor
public class DailyReportController {
    private final DailyReportService reportService;

    @GetMapping("/my")
    @PreAuthorize("hasPermission('daily_report', 'read')")
    public R<PageResult<DailyReportVO>> myReports(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(reportService.listMyReports(cu.getUserId(), page, size));
    }

    @GetMapping("/group")
    @PreAuthorize("hasPermission('daily_report', 'approve')")
    public R<PageResult<DailyReportVO>> groupReports(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(reportService.listGroupReports(cu.getGroupId(), status, page, size));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasPermission('daily_report', 'read')")
    public R<DailyReportVO> getById(@PathVariable Long id) {
        return R.ok(reportService.getById(id));
    }

    @PostMapping
    @PreAuthorize("hasPermission('daily_report', 'create')")
    public R<DailyReportVO> create(@Valid @RequestBody CreateDailyReportRequest req,
                                   @AuthenticationPrincipal SecurityUser cu) {
        var report = reportService.create(req, cu.getUserId(), cu.getGroupId(), cu.getTenantId());
        return R.ok(reportService.getById(report.getId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('daily_report', 'update')")
    public R<Void> update(@PathVariable Long id,
                          @Valid @RequestBody CreateDailyReportRequest req,
                          @AuthenticationPrincipal SecurityUser cu) {
        reportService.update(id, req, cu.getUserId());
        return R.ok();
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasPermission('daily_report', 'submit')")
    public R<Void> submit(@PathVariable Long id,
                          @AuthenticationPrincipal SecurityUser cu) {
        reportService.submit(id, cu.getUserId());
        return R.ok();
    }
}
