package com.cwgsyw.platform.module.workflow.runtime;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

/**
 * 完成审批任务命令。
 */
@Data
@Builder
public class WorkflowTaskCompleteCommand {
    private String tenantId;
    private String taskId;
    private Long operatorId;
    private boolean approved;
    private String comment;
    /** 额外流程变量（可空）。 */
    private Map<String, Object> variables;
}
