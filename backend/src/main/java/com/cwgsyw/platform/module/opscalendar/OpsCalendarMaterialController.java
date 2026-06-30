package com.cwgsyw.platform.module.opscalendar;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.opscalendar.dto.ReportMaterialVO;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarMaterialService;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/**
 * 季报/半年报素材归集接口（spec 5.12）。
 */
@RestController
@RequestMapping("/api/ops-calendar/report-materials")
@RequiredArgsConstructor
public class OpsCalendarMaterialController {

    private final OpsCalendarMaterialService materialService;

    @GetMapping
    @PreAuthorize("hasPermission('ops_calendar', 'export')")
    public R<ReportMaterialVO> collect(
            @RequestParam(required = false) String periodType,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) Long groupId,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(materialService.collect(cu.getTenantId(), periodType, startDate, endDate, groupId));
    }
}
