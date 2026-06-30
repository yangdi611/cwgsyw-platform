package com.cwgsyw.platform.module.opscalendar;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.opscalendar.dto.RosterConflictVO;
import com.cwgsyw.platform.module.opscalendar.dto.RosterRequest;
import com.cwgsyw.platform.module.opscalendar.dto.RosterVO;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarRosterService;
import com.cwgsyw.platform.security.SecurityUser;
import org.springframework.format.annotation.DateTimeFormat;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * 排班接口。权限 ops_calendar:manage。
 */
@RestController
@RequestMapping("/api/ops-calendar/rosters")
@RequiredArgsConstructor
public class OpsCalendarRosterController {

    private final OpsCalendarRosterService rosterService;

    @GetMapping
    @PreAuthorize("hasPermission('ops_calendar', 'read')")
    public R<List<RosterVO>> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long groupId,
            @AuthenticationPrincipal SecurityUser cu) {
        Long gid = "group".equals(cu.getGroupScope()) ? cu.getGroupId() : groupId;
        return R.ok(rosterService.list(cu.getTenantId(), from, to, gid));
    }

    @PostMapping
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<RosterVO> create(@RequestBody RosterRequest req, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(rosterService.create(req, cu.getTenantId(), cu.getUserId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<RosterVO> update(@PathVariable Long id, @RequestBody RosterRequest req,
                              @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(rosterService.update(id, req, cu.getTenantId(), cu.getUserId()));
    }

    @PostMapping("/check-conflicts")
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<RosterConflictVO> checkConflicts(@RequestBody RosterRequest req,
                                              @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(rosterService.checkConflicts(cu.getTenantId(), req));
    }
}
