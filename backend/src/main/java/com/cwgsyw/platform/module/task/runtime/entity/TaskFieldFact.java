package com.cwgsyw.platform.module.task.runtime.entity;

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
@TableName(value = "task_field_fact", autoResultMap = true)
public class TaskFieldFact {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long submissionId;
    private Long taskId;
    private Long templateVersionId;
    private Long fieldId;
    private String fieldKey;
    private String fieldType;
    private String subFieldKey;
    private String rowKey;
    private String valueText;
    private BigDecimal valueNumber;
    private Boolean valueBoolean;
    private LocalDate valueDate;
    private LocalDateTime valueDatetime;
    private String referenceType;
    private String referenceKey;
    private String referenceLabel;
    private LocalDate businessDate;
    private Long ownerUserId;
    private String ownerUserName;
    private Long ownerGroupId;
    private String ownerGroupName;
    private Long attachmentId;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Object valueJson;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> dimensionSnapshot;
    private Boolean isActive;
    private LocalDateTime activatedAt;
    private LocalDateTime deactivatedAt;
}
