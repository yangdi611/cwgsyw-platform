package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class RulePreviewVO {
    private LocalDateTime plannedStartAt;
    private LocalDateTime dueAt;
    private String title;
    private String occurrenceKey;

    public RulePreviewVO() {}

    public RulePreviewVO(LocalDateTime plannedStartAt, LocalDateTime dueAt, String title, String occurrenceKey) {
        this.plannedStartAt = plannedStartAt;
        this.dueAt = dueAt;
        this.title = title;
        this.occurrenceKey = occurrenceKey;
    }
}
