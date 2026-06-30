package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class DashboardCalendarVO {
    private int todayTotal;
    private int pendingConfirm;
    private int overdue;
    private List<Item> items;
    private List<Hint> nextHints;

    @Data
    public static class Item {
        private Long id;
        private String title;
        private String taskType;
        private String status;
        private LocalDateTime dueAt;
        private String assigneeName;
    }

    @Data
    public static class Hint {
        private String date;
        private String title;
        private String taskType;
    }
}
