package com.cwgsyw.platform.module.calendar.dto;

import java.time.LocalDateTime;
import java.util.Map;

public record CalendarWorkItemVO(
    String itemType,
    String id,
    String title,
    LocalDateTime startAt,
    LocalDateTime endAt,
    String status,
    boolean overdue,
    String href,
    Map<String, Object> meta
) {
}
