package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;
import java.util.List;

@Data
public class TaskCompleteRequest {
    private String resultStatus;   // normal / abnormal / partial / not_required
    private String resultSummary;
    private String riskLevel;
    private List<ChecklistValueDTO> checklistValues;
    private List<Long> linkedDailyReportIds;
    private List<Long> linkedCiInstanceIds;
    private List<Long> linkedAlertIds;
    private List<Long> linkedChangeDocIds;
}
