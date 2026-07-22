package com.cwgsyw.platform.module.daily.dto;

import jakarta.validation.Validation;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CreateDailyReportRequestValidationTest {
    @Test
    void rejectsFutureDateAndOutOfRangeWorkHours() {
        CreateDailyReportRequest request = validRequest();
        request.setReportDate(LocalDate.now().plusDays(1));
        request.setWorkHours(new BigDecimal("24.1"));

        var violations = Validation.buildDefaultValidatorFactory().getValidator().validate(request);

        assertThat(violations).extracting(violation -> violation.getPropertyPath().toString())
            .contains("reportDate", "workHours");
    }

    @Test
    void acceptsZeroAndTwentyFourHoursForToday() {
        var validator = Validation.buildDefaultValidatorFactory().getValidator();
        CreateDailyReportRequest zero = validRequest();
        zero.setWorkHours(BigDecimal.ZERO);
        CreateDailyReportRequest maximum = validRequest();
        maximum.setWorkHours(new BigDecimal("24.0"));

        assertThat(validator.validate(zero)).isEmpty();
        assertThat(validator.validate(maximum)).isEmpty();
    }

    private CreateDailyReportRequest validRequest() {
        CreateDailyReportRequest request = new CreateDailyReportRequest();
        request.setReportDate(LocalDate.now());
        request.setCompletedItems("完成巡检");
        request.setTomorrowPlan("继续跟进");
        return request;
    }
}
