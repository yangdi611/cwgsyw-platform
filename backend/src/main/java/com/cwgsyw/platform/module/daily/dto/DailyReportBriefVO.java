package com.cwgsyw.platform.module.daily.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class DailyReportBriefVO {
    private Long id;
    private String reporterName;
    private LocalDate reportDate;
    private String status;
    private String completedItemsBrief;
}
