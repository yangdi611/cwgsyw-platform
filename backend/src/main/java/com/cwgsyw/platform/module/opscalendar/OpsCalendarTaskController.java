package com.cwgsyw.platform.module.opscalendar;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.opscalendar.dto.*;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarTaskService;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * 运维日历任务接口。统一前缀 /api/ops-calendar/tasks。
 */
@RestController
@RequestMapping("/api/ops-calendar/tasks")
@RequiredArgsConstructor
public class OpsCalendarTaskController {

    private final OpsCalendarTaskService taskService;

    @GetMapping
    @PreAuthorize("hasPermission('ops_calendar', 'read')")
    public R<List<TaskVO>> list(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String scope,
            @RequestParam(required = false) String taskType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long assigneeId,
            @RequestParam(required = false) Long groupId,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(taskService.listTasks(cu, startDate, endDate, scope, taskType, status, assigneeId, groupId));
    }

    @GetMapping("/day")
    @PreAuthorize("hasPermission('ops_calendar', 'read')")
    public R<DayTasksVO> day(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String scope,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(taskService.dayTasks(cu, date, scope));
    }

    @GetMapping("/dashboard")
    @PreAuthorize("hasPermission('ops_calendar', 'read')")
    public R<DashboardCalendarVO> dashboard(@AuthenticationPrincipal SecurityUser cu) {
        return R.ok(taskService.dashboard(cu));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasPermission('ops_calendar', 'read')")
    public R<TaskDetailVO> detail(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(taskService.detail(cu, id));
    }

    @PostMapping
    @PreAuthorize("hasPermission('ops_calendar', 'create')")
    public R<Long> create(@RequestBody TaskCreateRequest req, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(taskService.createManual(cu, req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('ops_calendar', 'update')")
    public R<Void> update(@PathVariable Long id, @RequestBody TaskUpdateRequest req,
                          @AuthenticationPrincipal SecurityUser cu) {
        taskService.update(cu, id, req);
        return R.ok();
    }

    @PostMapping("/{id}/confirm")
    @PreAuthorize("hasPermission('ops_calendar', 'complete')")
    public R<Void> confirm(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        taskService.confirm(cu, id);
        return R.ok();
    }

    @PostMapping("/{id}/start")
    @PreAuthorize("hasPermission('ops_calendar', 'complete')")
    public R<Void> start(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        taskService.start(cu, id);
        return R.ok();
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasPermission('ops_calendar', 'complete')")
    public R<Void> complete(@PathVariable Long id, @RequestBody TaskCompleteRequest req,
                            @AuthenticationPrincipal SecurityUser cu) {
        taskService.complete(cu, id, req);
        return R.ok();
    }

    @PostMapping("/{id}/close-exception")
    @PreAuthorize("hasPermission('ops_calendar', 'complete')")
    public R<Void> closeException(@PathVariable Long id, @RequestBody TaskCloseExceptionRequest req,
                                  @AuthenticationPrincipal SecurityUser cu) {
        taskService.closeException(cu, id, req);
        return R.ok();
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasPermission('ops_calendar', 'update')")
    public R<Void> cancel(@PathVariable Long id, @RequestBody(required = false) TaskCancelRequest req,
                          @AuthenticationPrincipal SecurityUser cu) {
        taskService.cancel(cu, id, req);
        return R.ok();
    }

    @PostMapping("/{id}/remind")
    @PreAuthorize("hasPermission('ops_calendar', 'update')")
    public R<Void> remind(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        taskService.remind(cu, id);
        return R.ok();
    }
}
