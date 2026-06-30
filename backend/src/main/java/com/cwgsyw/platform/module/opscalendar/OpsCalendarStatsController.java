package com.cwgsyw.platform.module.opscalendar;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.opscalendar.dto.StatsVO;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarStatsService;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/**
 * 运维日历统计接口（PRD §13）。权限 ops_calendar:export（与素材归集同属"复盘/导出"维度）。
 */
@RestController
@RequestMapping("/api/ops-calendar/stats")
@RequiredArgsConstructor
public class OpsCalendarStatsController {

    private final OpsCalendarStatsService statsService;

    @GetMapping
    @PreAuthorize("hasPermission('ops_calendar', 'export')")
    public R<StatsVO> stats(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long groupId,
            @AuthenticationPrincipal SecurityUser cu) {
        Long effectiveGroupId = "group".equals(cu.getGroupScope()) ? cu.getGroupId() : groupId;
        return R.ok(statsService.stats(cu.getTenantId(), startDate, endDate, effectiveGroupId));
    }
}
