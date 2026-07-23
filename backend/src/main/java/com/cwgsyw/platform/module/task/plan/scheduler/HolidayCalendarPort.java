package com.cwgsyw.platform.module.task.plan.scheduler;

import java.time.LocalDate;
import java.util.List;

public interface HolidayCalendarPort {
    List<HolidayPeriod> findPeriods(String tenantId, LocalDate from, LocalDate to, String holidayType);

    LocalDate moveWorkdays(String tenantId, LocalDate anchor, int offset);

    record HolidayPeriod(String name, LocalDate startDate, LocalDate endDate, String holidayType) {
    }
}
