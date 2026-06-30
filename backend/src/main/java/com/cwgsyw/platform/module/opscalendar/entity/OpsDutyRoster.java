package com.cwgsyw.platform.module.opscalendar.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ops_duty_roster")
public class OpsDutyRoster extends BaseEntity {
    private LocalDate dutyDate;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private String shiftName = "全天";
    private Long assigneeId;
    private Long backupAssigneeId;
    private String phoneOverride;
    private Long groupId;
    private String remark;
}
