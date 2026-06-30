package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class TaskUpdateRequest {
    private String title;
    private LocalDateTime plannedStartAt;
    private LocalDateTime dueAt;
    private Long assigneeId;
    private Long groupId;
    private String priority;
    private String content;
    private String visibility;
    private String publicSummary;
    private Boolean sensitive;
    private List<Long> participantIds;
    private List<Long> recipientIds;
    private List<Long> escalationUserIds;
}
