package com.cwgsyw.platform.module.workflow.event;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.ExecutionListener;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * 统一流程结束监听器。
 *
 * <p>所有模板生成的 BPMN 结束事件统一配置 {@code delegateExpression="${workflowCompletionListener}"}。
 * 本监听器只从流程变量构造 {@link WorkflowCompletedEvent} 并交给 {@link WorkflowEventDispatcher}，
 * 不直接调用任何业务服务——业务状态回写由各 adapter 负责。
 */
@Component("workflowCompletionListener")
@RequiredArgsConstructor
@Slf4j
public class WorkflowCompletionListener implements ExecutionListener {

    private final transient WorkflowEventDispatcher dispatcher;

    @Override
    public void notify(DelegateExecution execution) {
        String businessKey = strVar(execution, "businessKey");
        String businessType = strVar(execution, "businessType");
        String businessId = strVar(execution, "businessId");
        Boolean approved = (Boolean) execution.getVariable("approved");
        String comment = strVar(execution, "comment");
        Long approverId = longVar(execution, "approverId");

        WorkflowCompletedEvent event = WorkflowCompletedEvent.builder()
            .tenantId(strVar(execution, "tenantId"))
            .businessType(businessType)
            .businessId(businessId)
            .businessKey(businessKey)
            .processInstanceId(execution.getProcessInstanceId())
            .processDefinitionId(execution.getProcessDefinitionId())
            .approved(Boolean.TRUE.equals(approved))
            .comment(comment)
            .approverId(approverId)
            .completedAt(LocalDateTime.now())
            .build();

        log.info("流程结束事件: businessType={} businessKey={} approved={} pi={}",
            businessType, businessKey, event.isApproved(), execution.getProcessInstanceId());
        dispatcher.dispatch(event);
    }

    private String strVar(DelegateExecution execution, String key) {
        Object v = execution.getVariable(key);
        return v != null ? String.valueOf(v) : null;
    }

    private Long longVar(DelegateExecution execution, String key) {
        Object v = execution.getVariable(key);
        if (v == null) return null;
        if (v instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(String.valueOf(v));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
