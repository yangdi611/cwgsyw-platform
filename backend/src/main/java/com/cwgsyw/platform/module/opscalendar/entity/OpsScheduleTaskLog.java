package com.cwgsyw.platform.module.opscalendar.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ops_schedule_task_log")
public class OpsScheduleTaskLog {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId = "default";
    private Long taskId;
    private String action; // create, notify, confirm, start, complete, overdue, escalate, cancel, close_exception
    private Long operatorId;
    private String content;
    private LocalDateTime createdAt;
}
