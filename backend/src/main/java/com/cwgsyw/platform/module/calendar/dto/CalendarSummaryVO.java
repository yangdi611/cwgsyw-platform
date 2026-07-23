package com.cwgsyw.platform.module.calendar.dto;

public record CalendarSummaryVO(
    long total,
    long pending,
    long overdue,
    long completed
) {
}
