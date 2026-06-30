package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;
import java.util.List;

@Data
public class DayTasksVO {
    private String date;
    private String dayOfWeek;
    private String holidayName;
    private Summary summary;
    private List<Group> groups;

    @Data
    public static class Summary {
        private int total;
        private int pending;
        private int overdue;
        private int completed;
    }

    @Data
    public static class Group {
        private String key;
        private String label;
        private List<TaskVO> tasks;

        public Group(String key, String label, List<TaskVO> tasks) {
            this.key = key;
            this.label = label;
            this.tasks = tasks;
        }
    }
}
