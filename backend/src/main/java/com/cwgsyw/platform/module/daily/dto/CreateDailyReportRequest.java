package com.cwgsyw.platform.module.daily.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class CreateDailyReportRequest {
    @NotNull  @JsonAlias("report_date")     private LocalDate reportDate;
    @NotBlank @JsonAlias("completed_items")  private String completedItems;
    private String issues;
    @NotBlank @JsonAlias("tomorrow_plan")    private String tomorrowPlan;
    @JsonAlias("work_hours")                 private BigDecimal workHours;
    @JsonAlias("group_id")                   private Long groupId;   // optional override; used when caller has no group (admin/superadmin)
    @JsonAlias("ci_instance_ids")            private List<Long> ciInstanceIds;
}
