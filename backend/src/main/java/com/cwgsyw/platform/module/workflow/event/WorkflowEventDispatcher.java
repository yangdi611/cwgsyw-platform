package com.cwgsyw.platform.module.workflow.event;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.workflow.adapter.BusinessWorkflowAdapter;
import com.cwgsyw.platform.module.workflow.adapter.BusinessWorkflowAdapterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * 流程结束事件分发器。
 *
 * <p>由 {@code WorkflowCompletionListener} 调用，负责：
 * <ol>
 *   <li>按 processInstanceId 幂等更新 {@code workflow_business_instance} 状态；</li>
 *   <li>路由到对应 {@link BusinessWorkflowAdapter} 回写业务状态、发通知；</li>
 *   <li>回写失败记 failed，不吞掉异常语义，便于后台巡检。</li>
 * </ol>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WorkflowEventDispatcher {

    private final BusinessWorkflowAdapterRegistry adapterRegistry;
    private final WorkflowBusinessInstanceMapper businessInstanceMapper;

    @Transactional
    public void dispatch(WorkflowCompletedEvent event) {
        String piId = event.getProcessInstanceId();

        // 幂等：已终态的关联记录直接跳过，避免重复回写/重复通知
        WorkflowBusinessInstance instance = businessInstanceMapper.selectOne(
            new LambdaQueryWrapper<WorkflowBusinessInstance>()
                .eq(WorkflowBusinessInstance::getProcessInstanceId, piId)
                .last("LIMIT 1"));
        if (instance != null && instance.getEndedAt() != null) {
            log.info("流程 {} 已处理过结束事件，跳过重复回调", piId);
            return;
        }

        String result = event.isApproved() ? "approved" : "rejected";
        LocalDateTime now = event.getCompletedAt() != null ? event.getCompletedAt() : LocalDateTime.now();

        Optional<BusinessWorkflowAdapter> adapter = adapterRegistry.find(event.getBusinessType());
        if (adapter.isEmpty()) {
            log.error("流程结束但业务类型未注册 adapter: businessType={} businessKey={} pi={}",
                event.getBusinessType(), event.getBusinessKey(), piId);
            markInstance(instance, "failed", "failed", now);
            return;
        }

        try {
            adapter.get().onWorkflowCompleted(event);
            markInstance(instance, result, result, now);
        } catch (Exception e) {
            log.error("业务状态回写失败 businessType={} businessKey={} pi={}: {}",
                event.getBusinessType(), event.getBusinessKey(), piId, e.getMessage(), e);
            markInstance(instance, "failed", "failed", now);
            throw new IllegalStateException("业务状态回写失败: " + e.getMessage(), e);
        }
    }

    private void markInstance(WorkflowBusinessInstance instance, String status, String result, LocalDateTime endedAt) {
        if (instance == null) return;
        instance.setStatus(status);
        instance.setResult(result);
        instance.setEndedAt(endedAt);
        businessInstanceMapper.updateById(instance);
    }
}
