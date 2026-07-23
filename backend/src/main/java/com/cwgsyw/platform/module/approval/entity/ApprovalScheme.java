package com.cwgsyw.platform.module.approval.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 审批方案实体
 */
@Data
@TableName("approval_scheme")
public class ApprovalScheme {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;

    /**
     * 方案编码（租户内唯一）
     */
    private String code;

    /**
     * 方案名称
     */
    private String name;

    /**
     * 描述
     */
    private String description;

    /**
     * 状态：draft/published/deprecated/archived
     */
    private String status;

    /**
     * 最新版本ID
     */
    private Long latestVersionId;

    /**
     * 范围类型：tenant/group/private
     */
    private String scopeType;

    /**
     * 所属组ID（scope_type=group时）
     */
    private Long ownerGroupId;

    private Long createdBy;

    private Long updatedBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableLogic
    private Boolean isDeleted;

    private LocalDateTime deletedAt;

    private Long deletedBy;
}
