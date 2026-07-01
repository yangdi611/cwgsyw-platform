package com.cwgsyw.platform.module.workflow.event;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 流程结束事件。由 {@code WorkflowCompletionListener} 从流程变量构造并派发，
 * 再由 {@code WorkflowEventDispatcher} 路由到对应业务 adapter 回写状态。
 */
@Data
@Builder
public class WorkflowCompletedEvent {
    private String tenantId;
    private String businessType;
    private String businessId;
    private String businessKey;
    private String processInstanceId;
    private String processDefinitionId;
    private boolean approved;
    private String comment;
    private Long approverId;
    private LocalDateTime completedAt;
}
