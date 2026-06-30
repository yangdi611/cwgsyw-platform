package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class ReportMaterialVO {
    private String periodType;
    private String startDate;
    private String endDate;
    private int totalTasks;
    private int completedTasks;
    private int overdueTasks;
    private int exceptionTasks;
    private Map<String, Integer> typeBreakdown;
    private List<MaterialItem> items;

    @Data
    public static class MaterialItem {
        private Long taskId;
        private String title;
        private String taskType;
        private String status;
        private String resultStatus;
        private String resultSummary;
        private String riskLevel;
        private String completedAt;
        private String assigneeName;
        private List<LinkRef> links;
    }

    @Data
    public static class LinkRef {
        private String linkType;
        private Long linkId;
        private String linkTitle;
    }
}
