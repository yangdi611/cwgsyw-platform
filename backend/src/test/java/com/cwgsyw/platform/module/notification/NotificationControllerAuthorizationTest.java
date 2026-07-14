package com.cwgsyw.platform.module.notification;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;

class NotificationControllerAuthorizationTest {
    @Test
    void everyNotificationEndpointRequiresReadPermission() throws NoSuchMethodException {
        assertReadGuard(NotificationController.class.getMethod("list", com.cwgsyw.platform.security.SecurityUser.class,
            int.class, int.class));
        assertReadGuard(NotificationController.class.getMethod("unreadCount", com.cwgsyw.platform.security.SecurityUser.class));
        assertReadGuard(NotificationController.class.getMethod("markRead", Long.class,
            com.cwgsyw.platform.security.SecurityUser.class));
        assertReadGuard(NotificationController.class.getMethod("markAllRead", com.cwgsyw.platform.security.SecurityUser.class));
    }

    private void assertReadGuard(Method method) {
        PreAuthorize guard = method.getAnnotation(PreAuthorize.class);
        assertEquals("hasAuthority('notification:read')", guard.value());
    }
}
