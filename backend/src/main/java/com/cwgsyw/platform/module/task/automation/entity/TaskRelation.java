package com.cwgsyw.platform.module.task.automation.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("task_relation")
public class TaskRelation {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long sourceTaskId;
    private Long targetTaskId;
    private String relationType;
    private Long automationExecutionId;
    private LocalDateTime createdAt;
}
