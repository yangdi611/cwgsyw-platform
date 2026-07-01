package com.cwgsyw.platform.module.workflow.runtime;

import com.cwgsyw.platform.module.workflow.event.WorkflowBusinessInstance;
import com.cwgsyw.platform.security.SecurityUser;

import java.util.List;

/**
 * 统一流程运行门面。
 *
 * <p>业务模块（日报、Wiki、变更文档等）只通过本门面与流程引擎交互，
 * 不得直接调用 Flowable 的 RuntimeService/TaskService/RepositoryService。
 */
public interface WorkflowRuntimeFacade {

    /**
     * 启动业务流程。
     *
     * <p>流程：查询绑定 -> 校验流程定义 -> adapter 构造变量 -> 按 processDefinitionId 启动
     * -> 写 workflow_business_instance -> 返回关联记录。业务状态回写由调用方在同一事务内完成。
     */
    WorkflowBusinessInstance startBusinessProcess(WorkflowStartCommand command);

    /**
     * 完成审批任务。
     *
     * <p>校验：任务存在、当前用户是 assignee 或候选人、具备业务审批权限、业务对象可审批、流程未挂起。
     */
    void completeTask(WorkflowTaskCompleteCommand command);

    /** 当前用户的待办任务（含业务摘要）。 */
    List<WorkflowTaskSummary> listMyTasks(SecurityUser user);

    /** 当前用户所在组的待办任务（含业务摘要）。 */
    List<WorkflowTaskSummary> listGroupTasks(SecurityUser user);

    /** 取消业务流程（终止运行中实例并回写 cancelled）。 */
    void cancelBusinessProcess(String tenantId, String businessType, String businessId,
                               Long operatorId, String reason);
}
