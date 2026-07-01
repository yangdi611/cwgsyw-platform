package com.cwgsyw.platform.module.workflow.adapter;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

/**
 * 业务流程启动上下文，由业务模块构造并传给 adapter/facade。
 */
@Data
@Builder
public class BusinessWorkflowContext {
    private String tenantId;
    private String businessType;
    private String businessId;
    private Long submitterId;
    /** 业务侧希望额外写入流程实例的变量（可空）。 */
    private Map<String, Object> extraVariables;
}
