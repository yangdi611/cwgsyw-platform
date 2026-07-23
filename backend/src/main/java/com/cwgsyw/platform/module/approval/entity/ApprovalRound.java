package com.cwgsyw.platform.module.approval.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 审批轮次实体
 */
@Data
@TableName("approval_round")
public class ApprovalRound {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;

    /**
     * 任务ID
     */
    private Long taskId;

    /**
     * 提交ID
     */
    private Long submissionId;

    private Long schemeVersionId;

    /**
     * 轮次号（从1开始）
     */
    private Integer roundNumber;

    /**
     * Flowable 流程实例ID
     */
    private String processInstanceId;

    private String processDefinitionId;

    /**
     * 状态：pending/in_review/approved/changes_requested/terminated/failed
     */
    private String status;

    private Long startedBy;

    private String result;

    /**
     * 开始时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime startedAt;

    /**
     * 完成时间
     */
    private LocalDateTime endedAt;
}
