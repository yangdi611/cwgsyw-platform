package com.cwgsyw.platform.module.calendar.dto;

import java.time.LocalDate;
import java.util.List;

public record CalendarDashboardVO(
    LocalDate date,
    CalendarSummaryVO summary,
    List<CalendarWorkItemVO> items,
    CalendarWorkItemVO featuredTask
) {
}
