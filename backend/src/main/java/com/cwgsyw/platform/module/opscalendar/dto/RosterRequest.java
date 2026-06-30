package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class RosterRequest {
    private LocalDate dutyDate;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private String shiftName;
    private Long assigneeId;
    private Long backupAssigneeId;
    private String phoneOverride;
    private Long groupId;
    private String remark;
}
