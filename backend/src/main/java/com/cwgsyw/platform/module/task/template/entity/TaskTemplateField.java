package com.cwgsyw.platform.module.task.template.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * 任务模板字段定义
 */
@Data
@TableName(value = "task_template_field", autoResultMap = true)
public class TaskTemplateField {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;

    /**
     * 模板版本ID
     */
    private Long templateVersionId;

    /**
     * 父字段ID（表格列/重复区块子字段）
     */
    private Long parentFieldId;

    /**
     * 字段键（版本内唯一）
     */
    private String fieldKey;

    /**
     * 字段标签
     */
    private String label;

    /**
     * 字段类型
     */
    private String fieldType;

    /**
     * 排序顺序
     */
    private Integer sortOrder;

    /**
     * 是否必填
     */
    private Boolean required;

    /**
     * 默认值（类型化）
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Object defaultValue;

    /**
     * 校验配置（范围、长度等）
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> validationConfig;

    /**
     * 显示配置（布局、提示等）
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> displayConfig;

    /**
     * 可见性配置（角色可见性）
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> visibilityConfig;

    /**
     * 条件配置（显示/必填条件 AST）
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> conditionConfig;

    /**
     * 公式配置（计算字段 AST）
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> formulaConfig;

    /**
     * 统计配置（指标/维度语义）
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> analyticsConfig;

    /**
     * 是否敏感字段
     */
    private Boolean sensitive;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
