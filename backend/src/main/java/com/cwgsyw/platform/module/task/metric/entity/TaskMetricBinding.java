package com.cwgsyw.platform.module.task.metric.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.util.Map;

@Data
@TableName(value = "task_metric_binding", autoResultMap = true)
public class TaskMetricBinding {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long metricId;
    private Long templateVersionId;
    private Long fieldId;
    private String fieldKey;
    private String sourceRole;
    private String ratioComponent;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> unitConversion;
    private Boolean enabled;
}
