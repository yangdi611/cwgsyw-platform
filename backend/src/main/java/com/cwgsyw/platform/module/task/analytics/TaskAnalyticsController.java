package com.cwgsyw.platform.module.task.analytics;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsDashboardRequest;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsDashboardShareRequest;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsDashboardVO;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsDrilldownRequest;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsDrilldownResponse;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsExportRequest;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsFieldMetadata;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsQueryRequest;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsQueryResponse;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsWidgetRequest;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsWidgetVO;
import com.cwgsyw.platform.module.task.analytics.service.TaskAnalyticsDashboardService;
import com.cwgsyw.platform.module.task.analytics.service.TaskAnalyticsExportService;
import com.cwgsyw.platform.module.task.analytics.service.TaskAnalyticsQueryService;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/task-analytics")
@RequiredArgsConstructor
public class TaskAnalyticsController {
    private final TaskAnalyticsQueryService queryService;
    private final TaskAnalyticsDashboardService dashboardService;
    private final TaskAnalyticsExportService exportService;
    private final AuditLogMapper auditLogMapper;

    @GetMapping("/templates/{templateVersionId}/fields")
    @PreAuthorize("hasAuthority('task_analytics:read')")
    public R<List<AnalyticsFieldMetadata>> fields(@PathVariable Long templateVersionId,
                                                   @AuthenticationPrincipal SecurityUser user) {
        return R.ok(queryService.fields(user, templateVersionId));
    }

    @GetMapping("/dimensions")
    @PreAuthorize("hasAuthority('task_analytics:read')")
    public R<List<Map<String, Object>>> dimensions() {
        return R.ok(queryService.dimensions());
    }

    @PostMapping("/query")
    @PreAuthorize("hasAuthority('task_analytics:read')")
    public R<AnalyticsQueryResponse> query(@Valid @RequestBody AnalyticsQueryRequest request,
                                            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(queryService.query(user, request));
    }

    @PostMapping("/drilldown")
    @PreAuthorize("hasAuthority('task_analytics:read')")
    public R<AnalyticsDrilldownResponse> drilldown(@Valid @RequestBody AnalyticsDrilldownRequest request,
                                                    @AuthenticationPrincipal SecurityUser user) {
        return R.ok(queryService.drilldown(user, request));
    }

    @PostMapping("/export")
    @PreAuthorize("hasAuthority('task_analytics:export')")
    public ResponseEntity<byte[]> export(@Valid @RequestBody AnalyticsExportRequest request,
                                         @AuthenticationPrincipal SecurityUser user) {
        var file = exportService.export(user, request.query(), request.format(), request.fileName());
        auditLogMapper.insert(AuditLog.builder().tenantId(user.getTenantId()).module("task_analytics")
            .action("export").targetType("task_analytics_query").operatorId(user.getUserId())
            .remark("导出任务统计: " + file.fileName()).createdAt(LocalDateTime.now()).build());
        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(ContentDisposition.attachment().filename(file.fileName(), StandardCharsets.UTF_8).build());
        headers.setContentType(MediaType.parseMediaType(file.contentType()));
        return ResponseEntity.ok().headers(headers).body(file.bytes());
    }

    @GetMapping("/dashboards")
    @PreAuthorize("hasAuthority('task_analytics:read')")
    public R<List<AnalyticsDashboardVO>> dashboards(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(dashboardService.list(user));
    }

    @PostMapping("/dashboards")
    @PreAuthorize("hasAuthority('task_analytics:create')")
    public R<AnalyticsDashboardVO> createDashboard(@Valid @RequestBody AnalyticsDashboardRequest request,
                                                    @AuthenticationPrincipal SecurityUser user) {
        return R.ok(dashboardService.create(user, request));
    }

    @GetMapping("/dashboards/{dashboardId}")
    @PreAuthorize("hasAuthority('task_analytics:read')")
    public R<AnalyticsDashboardVO> dashboard(@PathVariable Long dashboardId,
                                              @AuthenticationPrincipal SecurityUser user) {
        return R.ok(dashboardService.get(user, dashboardId));
    }

    @PutMapping("/dashboards/{dashboardId}")
    @PreAuthorize("hasAuthority('task_analytics:update')")
    public R<AnalyticsDashboardVO> updateDashboard(@PathVariable Long dashboardId,
                                                    @Valid @RequestBody AnalyticsDashboardRequest request,
                                                    @AuthenticationPrincipal SecurityUser user) {
        return R.ok(dashboardService.update(user, dashboardId, request));
    }

    @DeleteMapping("/dashboards/{dashboardId}")
    @PreAuthorize("hasAuthority('task_analytics:delete')")
    public R<Void> deleteDashboard(@PathVariable Long dashboardId, @AuthenticationPrincipal SecurityUser user) {
        dashboardService.delete(user, dashboardId);
        return R.ok();
    }

    @PostMapping("/dashboards/{dashboardId}/share")
    @PreAuthorize("hasAuthority('task_analytics:share')")
    public R<AnalyticsDashboardVO> shareDashboard(@PathVariable Long dashboardId,
                                                   @Valid @RequestBody AnalyticsDashboardShareRequest request,
                                                   @AuthenticationPrincipal SecurityUser user) {
        return R.ok(dashboardService.share(user, dashboardId, request));
    }

    @PostMapping("/dashboards/{dashboardId}/widgets")
    @PreAuthorize("hasAuthority('task_analytics:update')")
    public R<AnalyticsWidgetVO> addWidget(@PathVariable Long dashboardId,
                                          @Valid @RequestBody AnalyticsWidgetRequest request,
                                          @AuthenticationPrincipal SecurityUser user) {
        return R.ok(dashboardService.addWidget(user, dashboardId, request));
    }

    @PutMapping("/widgets/{widgetId}")
    @PreAuthorize("hasAuthority('task_analytics:update')")
    public R<AnalyticsWidgetVO> updateWidget(@PathVariable Long widgetId,
                                             @Valid @RequestBody AnalyticsWidgetRequest request,
                                             @AuthenticationPrincipal SecurityUser user) {
        return R.ok(dashboardService.updateWidget(user, widgetId, request));
    }

    @DeleteMapping("/widgets/{widgetId}")
    @PreAuthorize("hasAuthority('task_analytics:update')")
    public R<Void> deleteWidget(@PathVariable Long widgetId, @AuthenticationPrincipal SecurityUser user) {
        dashboardService.deleteWidget(user, widgetId);
        return R.ok();
    }
}
