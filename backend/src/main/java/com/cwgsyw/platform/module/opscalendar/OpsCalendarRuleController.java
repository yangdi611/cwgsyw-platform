package com.cwgsyw.platform.module.opscalendar;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.opscalendar.dto.RuleCreateRequest;
import com.cwgsyw.platform.module.opscalendar.dto.RulePreviewVO;
import com.cwgsyw.platform.module.opscalendar.dto.RuleVO;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarRuleService;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 周期规则接口。统一前缀 /api/ops-calendar/rules，权限 ops_calendar:manage。
 */
@RestController
@RequestMapping("/api/ops-calendar/rules")
@RequiredArgsConstructor
public class OpsCalendarRuleController {

    private final OpsCalendarRuleService ruleService;

    @GetMapping
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<List<RuleVO>> list(@AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ruleService.list(cu.getTenantId()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<RuleVO> get(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ruleService.get(cu.getTenantId(), id));
    }

    @PostMapping
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<Long> create(@RequestBody RuleCreateRequest req, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ruleService.create(cu, req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<Void> update(@PathVariable Long id, @RequestBody RuleCreateRequest req,
                          @AuthenticationPrincipal SecurityUser cu) {
        ruleService.update(cu, id, req);
        return R.ok();
    }

    @PostMapping("/{id}/enable")
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<Void> enable(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        ruleService.setEnabled(cu, id, true);
        return R.ok();
    }

    @PostMapping("/{id}/disable")
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<Void> disable(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        ruleService.setEnabled(cu, id, false);
        return R.ok();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<Void> delete(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        ruleService.delete(cu, id);
        return R.ok();
    }

    @PostMapping("/preview")
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<List<RulePreviewVO>> preview(@RequestBody RuleCreateRequest req,
                                          @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ruleService.preview(cu, req));
    }
}
