package com.cwgsyw.platform.module.task.metric;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.task.metric.dto.MetricGoalRequest;
import com.cwgsyw.platform.module.task.metric.dto.MetricGoalVO;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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

import java.util.List;

@RestController
@RequestMapping("/api/task-metric-goals")
@RequiredArgsConstructor
public class TaskMetricGoalController {
    private final TaskMetricGoalService service;

    @GetMapping
    @PreAuthorize("hasAuthority('task_analytics:read')")
    public R<List<MetricGoalVO>> list(@AuthenticationPrincipal SecurityUser user) { return R.ok(service.list(user)); }

    @PostMapping
    @PreAuthorize("hasAuthority('task_analytics:create')")
    public R<MetricGoalVO> create(@Valid @RequestBody MetricGoalRequest request,
                                  @AuthenticationPrincipal SecurityUser user) { return R.ok(service.create(user, request)); }

    @PutMapping("/{goalId}")
    @PreAuthorize("hasAuthority('task_analytics:update')")
    public R<MetricGoalVO> update(@PathVariable Long goalId, @Valid @RequestBody MetricGoalRequest request,
                                  @AuthenticationPrincipal SecurityUser user) { return R.ok(service.update(user, goalId, request)); }

    @DeleteMapping("/{goalId}")
    @PreAuthorize("hasAuthority('task_analytics:delete')")
    public R<Void> delete(@PathVariable Long goalId, @AuthenticationPrincipal SecurityUser user) {
        service.delete(user, goalId);
        return R.ok();
    }
}
