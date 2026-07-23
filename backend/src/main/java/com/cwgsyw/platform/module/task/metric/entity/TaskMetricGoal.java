package com.cwgsyw.platform.module.task.metric.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

@Data
@TableName(value = "task_metric_goal", autoResultMap = true)
public class TaskMetricGoal {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long metricId;
    private String scopeType;
    private String scopeKey;
    private String periodType;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> periodConfig;
    private BigDecimal targetValue;
    private BigDecimal warningThreshold;
    private BigDecimal criticalThreshold;
    private String comparison;
    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;
}
