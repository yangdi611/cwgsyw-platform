package com.cwgsyw.platform.module.daily.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreateDailyReportRequest {
    @NotNull  private LocalDate reportDate;
    @NotBlank private String completedItems;
    private String issues;
    @NotBlank private String tomorrowPlan;
    private BigDecimal workHours;
}
