package com.cwgsyw.platform.module.calendar;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.calendar.dto.CalendarDashboardVO;
import com.cwgsyw.platform.module.calendar.dto.CalendarDayVO;
import com.cwgsyw.platform.module.calendar.dto.CalendarWorkItemVO;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/calendar")
@RequiredArgsConstructor
public class CalendarQueryController {
    private final CalendarQueryService calendarQueryService;

    @GetMapping("/work-items")
    @PreAuthorize("hasAuthority('task:read')")
    public R<List<CalendarWorkItemVO>> workItems(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "month") String view,
            @RequestParam(defaultValue = "my") String scope,
            @RequestParam(required = false) Long templateId,
            @RequestParam(required = false) String executionStatus,
            @RequestParam(required = false) String approvalStatus,
            @RequestParam(required = false) Long assigneeId,
            @RequestParam(required = false) Long groupId,
            @RequestParam(defaultValue = "tasks,rosters,holidays") String include,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(calendarQueryService.workItems(user, from, to, view, scope, templateId,
            executionStatus, approvalStatus, assigneeId, groupId, include));
    }

    @GetMapping("/day")
    @PreAuthorize("hasAuthority('task:read')")
    public R<CalendarDayVO> day(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "my") String scope,
            @RequestParam(required = false) Long templateId,
            @RequestParam(required = false) String executionStatus,
            @RequestParam(required = false) String approvalStatus,
            @RequestParam(required = false) Long assigneeId,
            @RequestParam(required = false) Long groupId,
            @RequestParam(defaultValue = "tasks,rosters,holidays") String include,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(calendarQueryService.day(user, date, scope, templateId, executionStatus,
            approvalStatus, assigneeId, groupId, include));
    }

    @GetMapping("/dashboard")
    @PreAuthorize("hasAuthority('task:read')")
    public R<CalendarDashboardVO> dashboard(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(calendarQueryService.dashboard(user, date == null ? LocalDate.now() : date));
    }
}
