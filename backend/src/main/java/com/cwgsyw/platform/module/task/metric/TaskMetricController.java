package com.cwgsyw.platform.module.task.metric;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.task.metric.dto.MetricBindingRequest;
import com.cwgsyw.platform.module.task.metric.dto.MetricBindingVO;
import com.cwgsyw.platform.module.task.metric.dto.MetricDefinitionRequest;
import com.cwgsyw.platform.module.task.metric.dto.MetricDefinitionVO;
import com.cwgsyw.platform.module.task.metric.dto.MetricPreviewRequest;
import com.cwgsyw.platform.module.task.metric.dto.MetricPreviewVO;
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
@RequestMapping("/api/task-metrics")
@RequiredArgsConstructor
public class TaskMetricController {
    private final TaskMetricService service;

    @GetMapping
    @PreAuthorize("hasAuthority('task_analytics:read')")
    public R<List<MetricDefinitionVO>> list(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(service.list(user));
    }

    @GetMapping("/{metricId}")
    @PreAuthorize("hasAuthority('task_analytics:read')")
    public R<MetricDefinitionVO> get(@PathVariable Long metricId, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(service.get(user, metricId));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('task_analytics:create')")
    public R<MetricDefinitionVO> create(@Valid @RequestBody MetricDefinitionRequest request,
                                        @AuthenticationPrincipal SecurityUser user) {
        return R.ok(service.create(user, request));
    }

    @PutMapping("/{metricId}")
    @PreAuthorize("hasAuthority('task_analytics:update')")
    public R<MetricDefinitionVO> update(@PathVariable Long metricId,
                                        @Valid @RequestBody MetricDefinitionRequest request,
                                        @AuthenticationPrincipal SecurityUser user) {
        return R.ok(service.update(user, metricId, request));
    }

    @DeleteMapping("/{metricId}")
    @PreAuthorize("hasAuthority('task_analytics:delete')")
    public R<Void> delete(@PathVariable Long metricId, @AuthenticationPrincipal SecurityUser user) {
        service.delete(user, metricId);
        return R.ok();
    }

    @PostMapping("/{metricId}/bindings")
    @PreAuthorize("hasAuthority('task_analytics:update')")
    public R<MetricBindingVO> addBinding(@PathVariable Long metricId,
                                         @Valid @RequestBody MetricBindingRequest request,
                                         @AuthenticationPrincipal SecurityUser user) {
        return R.ok(service.addBinding(user, metricId, request));
    }

    @PutMapping("/bindings/{bindingId}")
    @PreAuthorize("hasAuthority('task_analytics:update')")
    public R<MetricBindingVO> updateBinding(@PathVariable Long bindingId,
                                            @Valid @RequestBody MetricBindingRequest request,
                                            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(service.updateBinding(user, bindingId, request));
    }

    @DeleteMapping("/bindings/{bindingId}")
    @PreAuthorize("hasAuthority('task_analytics:update')")
    public R<Void> deleteBinding(@PathVariable Long bindingId, @AuthenticationPrincipal SecurityUser user) {
        service.deleteBinding(user, bindingId);
        return R.ok();
    }

    @PostMapping("/{metricId}/preview")
    @PreAuthorize("hasAuthority('task_analytics:read')")
    public R<MetricPreviewVO> preview(@PathVariable Long metricId,
                                      @Valid @RequestBody MetricPreviewRequest request,
                                      @AuthenticationPrincipal SecurityUser user) {
        return R.ok(service.preview(user, metricId, request));
    }
}
