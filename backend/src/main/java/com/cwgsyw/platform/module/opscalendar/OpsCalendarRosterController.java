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

/** 日历设置中的排班管理接口。 */
@RestController
@RequestMapping("/api/calendar-settings/rosters")
@RequiredArgsConstructor
public class OpsCalendarRosterController {

    private final OpsCalendarRosterService rosterService;

    @GetMapping
    @PreAuthorize("hasAuthority('calendar_settings:read')")
    public R<List<RosterVO>> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long groupId,
            @AuthenticationPrincipal SecurityUser cu) {
        Long gid = "group".equals(cu.getGroupScope()) ? cu.getGroupId() : groupId;
        return R.ok(rosterService.list(cu.getTenantId(), from, to, gid));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('calendar_settings:manage')")
    public R<RosterVO> create(@RequestBody RosterRequest req, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(rosterService.create(req, cu.getTenantId(), cu.getUserId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('calendar_settings:manage')")
    public R<RosterVO> update(@PathVariable Long id, @RequestBody RosterRequest req,
                              @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(rosterService.update(id, req, cu.getTenantId(), cu.getUserId()));
    }

    @PostMapping("/check-conflicts")
    @PreAuthorize("hasAuthority('calendar_settings:manage')")
    public R<RosterConflictVO> checkConflicts(@RequestBody RosterRequest req,
                                              @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(rosterService.checkConflicts(cu.getTenantId(), req));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('calendar_settings:manage')")
    public R<Void> delete(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        rosterService.delete(id, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }

    @DeleteMapping("/{id}/remediation-test")
    @PreAuthorize("hasAuthority('calendar_settings:manage')")
    public R<Void> purgeRemediationTest(@PathVariable Long id,
                                        @RequestParam String runId,
                                        @AuthenticationPrincipal SecurityUser cu) {
        rosterService.purgeRemediationTest(cu, id, runId);
        return R.ok();
    }
}
