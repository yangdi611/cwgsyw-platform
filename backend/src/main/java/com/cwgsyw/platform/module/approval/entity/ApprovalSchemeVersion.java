package com.cwgsyw.platform.module.approval.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * 审批方案版本实体（不可变）
 */
@Data
@TableName(value = "approval_scheme_version", autoResultMap = true)
public class ApprovalSchemeVersion {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;

    /**
     * 方案ID
     */
    private Long schemeId;

    /**
     * 版本号
     */
    private Integer version;

    /**
     * 状态：draft/published/deprecated
     */
    private String status;

    /**
     * 定义配置（节点、路由、候选人规则）
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> definitionConfig;

    /**
     * Flowable 流程定义ID
     */
    private String processDefinitionId;

    /**
     * Flowable 流程定义Key
     */
    private String processDefinitionKey;

    /**
     * Flowable 流程定义版本
     */
    private Integer processDefinitionVersion;

    /**
     * 发布人
     */
    private Long publishedBy;

    /**
     * 发布时间
     */
    private LocalDateTime publishedAt;

    private Long createdBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
