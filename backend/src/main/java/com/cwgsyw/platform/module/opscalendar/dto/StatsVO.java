package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

/**
 * 运维日历统计指标（PRD §13）。完成率/逾期率/确认及时率/类型分布/负责人负载/逾期排行/异常数。
 */
@Data
public class StatsVO {
    private String startDate;
    private String endDate;
    private int total;
    private int completed;
    private int overdue;
    private int exceptionClosed;
    private int cancelled;
    private double completionRate;   // 已完成 / 应完成（不含取消）
    private double overdueRate;      // 已逾期 / 应完成
    private Map<String, Integer> typeBreakdown;    // taskType -> count
    private Map<String, Integer> statusBreakdown;  // status -> count
    private List<DailyTrend> dailyTrend;           // 每日新增/完成
    private List<AssigneeLoad> assigneeLoad;       // 负责人负载（按任务数降序，Top N）
    private List<AssigneeLoad> overdueRanking;     // 逾期排行（按逾期数降序，Top N）

    @Data
    public static class DailyTrend {
        private String date;
        private int created;
        private int completed;
        private int overdue;
    }

    @Data
    public static class AssigneeLoad {
        private Long assigneeId;
        private String assigneeName;
        private int total;
        private int overdue;
        private int completed;
    }
}
