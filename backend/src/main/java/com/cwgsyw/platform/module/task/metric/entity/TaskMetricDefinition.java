package com.cwgsyw.platform.module.task.metric.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@TableName(value = "task_metric_definition", autoResultMap = true)
public class TaskMetricDefinition {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String code;
    private String name;
    private String description;
    private String valueType;
    private String unit;
    private Integer scale;
    private String aggregation;
    private String additivity;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> formulaConfig;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> authorityPolicy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
