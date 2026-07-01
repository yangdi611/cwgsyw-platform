package com.cwgsyw.platform.module.workflow.adapter;

import com.cwgsyw.platform.module.workflow.event.WorkflowCompletedEvent;
import com.cwgsyw.platform.security.SecurityUser;

import java.util.Map;

/**
 * 业务流程适配器协议。
 *
 * <p>每个接入 Flowable 的业务模块（日报、Wiki、变更文档等）实现本接口，负责：
 * 构造启动变量、构造待办摘要、判定提交/审批权限、流程结束后回写业务状态。
 *
 * <p>业务模块不得直接调用 Flowable 原生 API（RuntimeService/TaskService/RepositoryService），
 * 统一通过 {@code WorkflowRuntimeFacade} + 本适配器完成。
 */
public interface BusinessWorkflowAdapter {

    /** 业务类型（下划线格式），如 {@code daily_report}。全局唯一。 */
    String businessType();

    /** 构造 businessKey，统一 {@code {businessType}:{businessId}} 格式。 */
    String buildBusinessKey(String businessId);

    /**
     * 构造流程启动变量。facade 会补充 businessType/businessId/businessKey/tenantId/submitterId
     * 等公共变量，adapter 只需补充业务专属变量（如候选组）。
     */
    Map<String, Object> buildStartVariables(BusinessWorkflowContext context);

    /** 构造待办摘要，供待办中心展示。业务不存在或无权查看时返回 available=false 的摘要。 */
    BusinessWorkflowSummary buildSummary(String tenantId, String businessId, SecurityUser viewer);

    /** 是否具备该业务对象的审批权限（业务权限维度，与 Flowable 候选关系是 AND 关系）。 */
    boolean canApprove(String tenantId, String businessId, SecurityUser user);

    /** 是否具备提交该业务对象进入审批的权限。 */
    boolean canSubmit(String tenantId, String businessId, SecurityUser user);

    /**
     * 流程结束回调，adapter 负责回写业务状态、发通知。
     * 必须按 processInstanceId 幂等，重复回调不得重复回写/重复通知。
     */
    void onWorkflowCompleted(WorkflowCompletedEvent event);
}
