package com.cwgsyw.platform.module.workflow.runtime;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

/**
 * 启动业务流程命令。
 *
 * <p>业务模块构造该命令并交给 {@link WorkflowRuntimeFacade#startBusinessProcess}，
 * facade 负责查询绑定、构造变量、启动 Flowable、写 workflow_business_instance。
 */
@Data
@Builder
public class WorkflowStartCommand {
    private String tenantId;
    private String businessType;
    private String businessId;
    private Long submitterId;
    /** 业务侧希望额外写入流程实例的变量（可空）。 */
    private Map<String, Object> variables;
}
