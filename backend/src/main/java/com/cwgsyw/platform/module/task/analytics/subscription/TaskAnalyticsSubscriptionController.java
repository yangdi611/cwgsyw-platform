package com.cwgsyw.platform.module.task.analytics.subscription;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.task.analytics.subscription.dto.SubscriptionRequest;
import com.cwgsyw.platform.module.task.analytics.subscription.dto.SubscriptionVO;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/task-analytics")
@RequiredArgsConstructor
public class TaskAnalyticsSubscriptionController {
    private final TaskAnalyticsSubscriptionService service;

    @GetMapping("/dashboards/{dashboardId}/subscriptions")
    @PreAuthorize("hasAuthority('task_analytics:read')")
    public R<List<SubscriptionVO>> list(@PathVariable Long dashboardId, @AuthenticationPrincipal SecurityUser user) { return R.ok(service.list(user, dashboardId)); }
    @PostMapping("/dashboards/{dashboardId}/subscriptions")
    @PreAuthorize("hasAuthority('task_analytics:update')")
    public R<SubscriptionVO> create(@PathVariable Long dashboardId, @Valid @RequestBody SubscriptionRequest request, @AuthenticationPrincipal SecurityUser user) { return R.ok(service.create(user, dashboardId, request)); }
    @PutMapping("/subscriptions/{subscriptionId}")
    @PreAuthorize("hasAuthority('task_analytics:update')")
    public R<SubscriptionVO> update(@PathVariable Long subscriptionId, @Valid @RequestBody SubscriptionRequest request, @AuthenticationPrincipal SecurityUser user) { return R.ok(service.update(user, subscriptionId, request)); }
    @DeleteMapping("/subscriptions/{subscriptionId}")
    @PreAuthorize("hasAuthority('task_analytics:update')")
    public R<Void> delete(@PathVariable Long subscriptionId, @AuthenticationPrincipal SecurityUser user) { service.delete(user, subscriptionId); return R.ok(); }
    @PostMapping("/subscriptions/{subscriptionId}/test")
    @PreAuthorize("hasAuthority('task_analytics:update')")
    public R<Void> test(@PathVariable Long subscriptionId, @AuthenticationPrincipal SecurityUser user) { service.test(user, subscriptionId); return R.ok(); }
}
