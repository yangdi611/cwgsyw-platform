package com.cwgsyw.platform.module.workflow.binding;

import java.util.List;

/**
 * 业务流程绑定服务。
 *
 * <p>负责维护「业务类型 -> 具体流程定义版本」的绑定关系，
 * 保证业务流程按明确的 {@code processDefinitionId} 启动，而非依赖 key + 最新版本推断。
 */
public interface ProcessBindingService {

    /**
     * 查询业务类型当前生效绑定。
     *
     * <p>优先读 {@code workflow_process_binding}；无绑定时兼容读取 {@code admin/config}
     * 中的旧配置项（如 {@code daily_report_process_definition_id}）。均无则返回 null。
     */
    WorkflowProcessBinding getActiveBinding(String tenantId, String businessType);

    /** 绑定业务类型到指定流程定义版本，覆盖旧绑定并记录审计。 */
    WorkflowProcessBinding bind(String tenantId, String businessType, String processDefinitionId,
                                Long templateInstanceId, Long operatorId, String remark);

    /** 列出租户下全部绑定。 */
    List<WorkflowProcessBinding> listBindings(String tenantId);

    /**
     * 校验流程定义是否可绑定到该业务类型。
     * 失败抛 {@link IllegalArgumentException} / {@link IllegalStateException}，附可读原因。
     */
    void validateBindable(String tenantId, String businessType, String processDefinitionId);
}
