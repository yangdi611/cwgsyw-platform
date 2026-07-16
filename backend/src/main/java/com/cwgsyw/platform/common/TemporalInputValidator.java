package com.cwgsyw.platform.common;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

public final class TemporalInputValidator {
    private static final DateTimeFormatter MONTH_FORMAT = DateTimeFormatter.ofPattern("uuuu-MM");

    private TemporalInputValidator() {
    }

    public static void requireOrderedDateRange(LocalDate startDate, LocalDate endDate,
                                               String startLabel, String endLabel) {
        if (startDate == null || endDate == null) {
            throw new IllegalArgumentException(startLabel + "/" + endLabel + " 必填");
        }
        if (startDate.isAfter(endDate)) {
            throw new IllegalArgumentException(startLabel + "不能晚于" + endLabel);
        }
    }

    public static YearMonth parseMonth(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("月份格式必须为 yyyy-MM");
        }
        try {
            return YearMonth.parse(value, MONTH_FORMAT);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("月份格式必须为 yyyy-MM");
        }
    }
}
