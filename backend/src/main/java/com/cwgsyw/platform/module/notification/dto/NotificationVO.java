package com.cwgsyw.platform.module.notification.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class NotificationVO {
    private Long id;
    private String title;
    private String content;
    private String type;
    private String refType;
    private Long refId;
    private Boolean isRead;
    private LocalDateTime createdAt;
}
