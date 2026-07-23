package com.cwgsyw.platform.module.task.metric.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@TableName(value = "task_metric_fact", autoResultMap = true)
public class TaskMetricFact {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long metricId;
    private Long bindingId;
    private Long submissionId;
    private Long taskId;
    private Long fieldFactId;
    private Long denominatorFieldFactId;
    private BigDecimal value;
    private BigDecimal numerator;
    private BigDecimal denominator;
    private LocalDate businessDate;
    private Long ownerUserId;
    private String ownerUserName;
    private Long ownerGroupId;
    private String ownerGroupName;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> dimensions;
    private String sourceType;
    private Boolean effective;
    private LocalDateTime invalidatedAt;
    private LocalDateTime createdAt;
}
