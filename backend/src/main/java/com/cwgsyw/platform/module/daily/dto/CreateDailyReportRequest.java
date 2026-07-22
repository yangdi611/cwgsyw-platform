package com.cwgsyw.platform.module.daily.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.PastOrPresent;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class CreateDailyReportRequest {
    @NotNull @PastOrPresent(message = "日报日期不能晚于今天") @JsonAlias("report_date") private LocalDate reportDate;
    @NotBlank @JsonAlias("completed_items")  private String completedItems;
    private String issues;
    @NotBlank @JsonAlias("tomorrow_plan")    private String tomorrowPlan;
    @DecimalMin(value = "0.0", message = "工时不能小于 0")
    @DecimalMax(value = "24.0", message = "工时不能大于 24")
    @JsonAlias("work_hours")                 private BigDecimal workHours;
    @JsonAlias("group_id")                   private Long groupId;   // optional override; used when caller has no group (admin/superadmin)
    @JsonAlias("ci_instance_ids")            private List<Long> ciInstanceIds;
}
