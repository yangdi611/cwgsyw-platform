package com.cwgsyw.platform.module.org.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class GroupLifecycleActionRequest {
    private String reason;
    private String confirmationName;
    private LocalDateTime expectedUpdatedAt;
    private LocalDateTime expectedArchivedAt;
}
