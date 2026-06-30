package com.cwgsyw.platform.module.opscalendar.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ops_schedule_task")
public class OpsScheduleTask extends BaseEntity {
    private Long ruleId;
    private String occurrenceKey;
    private String title;
    private String taskType;
    private String sourceType = "manual";
    private String status = "pending_confirm";
    private LocalDateTime plannedStartAt;
    private LocalDateTime dueAt;
    private Long assigneeId;
    private Long groupId;
    private String priority = "normal";
    private String content;
    private String visibility = "private";
    private String publicSummary;
    private Boolean sensitive = false;
    private String resultStatus;
    private String resultSummary;
    private String riskLevel;
    private LocalDateTime confirmedAt;
    private Long confirmedBy;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private Long completedBy;
    private LocalDateTime cancelledAt;
    private Long cancelledBy;
    private String closeReason;
}
