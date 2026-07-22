package com.cwgsyw.platform.module.notification.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class NotificationTargetVO {
    private boolean available;
    private String href;

    public static NotificationTargetVO unavailable() {
        return new NotificationTargetVO(false, null);
    }

    public static NotificationTargetVO available(String href) {
        return new NotificationTargetVO(true, href);
    }
}
