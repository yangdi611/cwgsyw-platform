package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;
import java.util.ArrayList;
import java.util.List;

@Data
public class RosterConflictVO {
    private List<Conflict> conflicts = new ArrayList<>();
    private List<Conflict> warnings = new ArrayList<>();

    @Data
    public static class Conflict {
        private String type;
        private String message;
        private Long rosterId;

        public Conflict(String type, String message, Long rosterId) {
            this.type = type;
            this.message = message;
            this.rosterId = rosterId;
        }
    }
}
