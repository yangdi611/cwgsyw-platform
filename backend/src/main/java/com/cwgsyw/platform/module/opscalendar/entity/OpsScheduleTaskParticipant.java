package com.cwgsyw.platform.module.opscalendar.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ops_schedule_task_participant")
public class OpsScheduleTaskParticipant {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId = "default";
    private Long taskId;
    private Long userId;
    private String role; // assignee, collaborator, recipient, escalation
    private LocalDateTime createdAt;
}
