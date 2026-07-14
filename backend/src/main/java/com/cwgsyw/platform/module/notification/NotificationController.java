package com.cwgsyw.platform.module.notification;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.notification.dto.NotificationVO;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;

    @GetMapping
    @PreAuthorize("hasAuthority('notification:read')")
    public R<PageResult<NotificationVO>> list(
            @AuthenticationPrincipal SecurityUser user,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return R.ok(notificationService.listByUser(user.getUserId(), page, size));
    }

    @GetMapping("/unread-count")
    @PreAuthorize("hasAuthority('notification:read')")
    public R<Integer> unreadCount(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(notificationService.countUnread(user.getUserId()));
    }

    @PostMapping("/{id}/read")
    @PreAuthorize("hasAuthority('notification:read')")
    public R<Void> markRead(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        notificationService.markRead(id, user.getUserId());
        return R.ok(null);
    }

    @PostMapping("/read-all")
    @PreAuthorize("hasAuthority('notification:read')")
    public R<Void> markAllRead(@AuthenticationPrincipal SecurityUser user) {
        notificationService.markAllRead(user.getUserId());
        return R.ok(null);
    }
}
