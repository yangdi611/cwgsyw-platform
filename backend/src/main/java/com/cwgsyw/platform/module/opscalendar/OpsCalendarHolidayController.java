package com.cwgsyw.platform.module.opscalendar;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.opscalendar.dto.HolidayRequest;
import com.cwgsyw.platform.module.opscalendar.dto.HolidayVO;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarHolidayService;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 节假日历接口。读取 ops_calendar:read；写入 ops_calendar:manage。
 */
@RestController
@RequestMapping("/api/ops-calendar/holidays")
@RequiredArgsConstructor
public class OpsCalendarHolidayController {

    private final OpsCalendarHolidayService holidayService;

    @GetMapping
    @PreAuthorize("hasPermission('ops_calendar', 'read')")
    public R<List<HolidayVO>> list(@AuthenticationPrincipal SecurityUser cu) {
        return R.ok(holidayService.list(cu.getTenantId()));
    }

    @PostMapping
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<HolidayVO> create(@RequestBody HolidayRequest req, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(holidayService.create(req, cu.getTenantId(), cu.getUserId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<HolidayVO> update(@PathVariable Long id, @RequestBody HolidayRequest req,
                               @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(holidayService.update(id, req, cu.getTenantId(), cu.getUserId()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<Void> delete(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        holidayService.delete(id, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }

    @PostMapping("/import-cn")
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<Integer> importCn(@RequestParam int year, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(holidayService.importChinaHolidays(year, cu.getTenantId(), cu.getUserId()));
    }
}
