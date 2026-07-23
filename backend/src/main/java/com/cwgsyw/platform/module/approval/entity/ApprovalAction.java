package com.cwgsyw.platform.module.approval.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 审批动作实体
 */
@Data
@TableName(value = "approval_action", autoResultMap = true)
public class ApprovalAction {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;

    /**
     * 轮次ID
     */
    private Long roundId;

    private Long submissionId;

    /**
     * Flowable 用户任务 ID
     */
    private String flowableTaskId;

    private String nodeKey;

    private String nodeName;

    /**
     * 动作：approve/return_for_changes/return_previous_node/terminate
     */
    private String action;

    /**
     * 审批人ID
     */
    private Long approverId;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> approverSnapshot;

    /**
     * 审批意见
     */
    private String comment;

    /**
     * 字段级意见
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> fieldComments;

    /**
     * 附件级意见
     */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> attachmentComments;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
