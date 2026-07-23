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
     * <p>只读权威的 {@code workflow_process_binding}；无绑定时返回 null。
     */
    WorkflowProcessBinding getActiveBinding(String tenantId, String businessType);

    /** 是否曾为该业务类型建立统一绑定（包括停用和软删除记录）。 */
    boolean hasBindingHistory(String tenantId, String businessType);

    /** 绑定业务类型到指定流程定义版本，覆盖旧绑定并记录审计。 */
    WorkflowProcessBinding bind(String tenantId, String businessType, String processDefinitionId,
                                Long templateInstanceId, Long operatorId, String remark);

    /** 启用绑定；启用前重新校验定义与业务类型。 */
    WorkflowProcessBinding enable(String tenantId, Long bindingId, Long operatorId);

    /** 停用绑定并阻止新业务流程启动。 */
    WorkflowProcessBinding disable(String tenantId, Long bindingId, Long operatorId);

    /** 软删除绑定；不影响已经启动的流程实例。 */
    void delete(String tenantId, Long bindingId, Long operatorId);

    /** 列出租户下全部绑定。 */
    List<WorkflowProcessBinding> listBindings(String tenantId);

    /**
     * 校验流程定义是否可绑定到该业务类型。
     * 失败抛 {@link IllegalArgumentException} / {@link IllegalStateException}，附可读原因。
     */
    void validateBindable(String tenantId, String businessType, String processDefinitionId);
}
