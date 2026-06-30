package com.cwgsyw.platform.module.opscalendar.dto;

import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class RosterVO {
    private Long id;
    private LocalDate dutyDate;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private String shiftName;
    private Long assigneeId;
    private String assigneeName;
    private String assigneePhone;
    private Long backupAssigneeId;
    private String backupAssigneeName;
    private String phoneOverride;
    private Long groupId;
    private String groupName;
    private String remark;
}
