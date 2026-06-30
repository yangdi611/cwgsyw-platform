package com.cwgsyw.platform.module.opscalendar;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.opscalendar.dto.TemplateRequest;
import com.cwgsyw.platform.module.opscalendar.dto.TemplateVO;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarTemplateService;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 运维日历模板管理接口。统一前缀 /api/ops-calendar/templates，权限 ops_calendar:manage。
 */
@RestController
@RequestMapping("/api/ops-calendar/templates")
@RequiredArgsConstructor
public class OpsCalendarTemplateController {

    private final OpsCalendarTemplateService templateService;

    @GetMapping
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<List<TemplateVO>> list(@RequestParam(required = false) String templateType,
                                    @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(templateService.list(cu.getTenantId(), templateType));
    }

    @PostMapping
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<Long> create(@RequestBody TemplateRequest req, @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(templateService.create(cu.getTenantId(), cu.getUserId(), req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<Void> update(@PathVariable Long id, @RequestBody TemplateRequest req,
                          @AuthenticationPrincipal SecurityUser cu) {
        templateService.update(cu.getTenantId(), cu.getUserId(), id, req);
        return R.ok();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasPermission('ops_calendar', 'manage')")
    public R<Void> delete(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        templateService.delete(cu.getTenantId(), cu.getUserId(), id);
        return R.ok();
    }
}
