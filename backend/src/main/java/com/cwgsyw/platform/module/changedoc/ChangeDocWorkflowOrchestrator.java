package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.changedoc.dto.ChangeDocVO;
import com.cwgsyw.platform.module.notification.NotificationMapper;
import com.cwgsyw.platform.module.notification.entity.NotificationMessage;
import com.cwgsyw.platform.module.workflow.adapter.ChangeDocWorkflowAdapter;
import com.cwgsyw.platform.module.workflow.binding.ProcessBindingService;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowRuntimeFacade;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowStartCommand;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ChangeDocWorkflowOrchestrator {

    private final ChangeDocService changeDocService;
    private final ProcessBindingService bindingService;
    private final WorkflowRuntimeFacade workflowRuntimeFacade;
    private final NotificationMapper notificationMapper;

    @Transactional
    public ChangeDocVO submit(SecurityUser user, Long id) {
        ChangeDocVO doc = changeDocService.submit(user, id);
        if ("pending".equals(doc.getStatus())) {
            startIfConfigured(user, id);
        }
        return doc;
    }

    @Transactional
    public ChangeDocVO submitPlan(SecurityUser user, Long id) {
        ChangeDocVO doc = changeDocService.submitPlan(user, id);
        startIfConfigured(user, id);
        return doc;
    }

    @Transactional
    public ChangeDocVO approve(SecurityUser user, Long id, String comment, boolean approved) {
        changeDocService.lockPendingForWorkflowDecision(user, id);
        if (workflowRuntimeFacade.hasRunningBusinessProcess(user.getTenantId(),
                ChangeDocWorkflowAdapter.BUSINESS_TYPE, String.valueOf(id))) {
            throw new IllegalStateException("该变更文档已进入统一流程，请在待办中心审批");
        }
        return changeDocService.approve(user, id, comment, approved);
    }

    @Transactional
    public void purgeRemediationTest(SecurityUser user, Long id, String remediationRunId) {
        changeDocService.validateRemediationTest(user, id, remediationRunId);
        workflowRuntimeFacade.purgeBusinessProcessForRemediation(user.getTenantId(),
            ChangeDocWorkflowAdapter.BUSINESS_TYPE, String.valueOf(id));
        notificationMapper.selectList(new LambdaQueryWrapper<NotificationMessage>()
                .eq(NotificationMessage::getTenantId, user.getTenantId())
                .eq(NotificationMessage::getRefType, ChangeDocWorkflowAdapter.BUSINESS_TYPE)
                .eq(NotificationMessage::getRefId, id))
            .forEach(notification -> notificationMapper.deleteById(notification.getId()));
        changeDocService.purgeRemediationTest(user, id, remediationRunId);
    }

    private void startIfConfigured(SecurityUser user, Long id) {
        String tenantId = user.getTenantId();
        String businessType = ChangeDocWorkflowAdapter.BUSINESS_TYPE;
        if (bindingService.getActiveBinding(tenantId, businessType) == null) {
            if (bindingService.hasBindingHistory(tenantId, businessType)) {
                throw new IllegalStateException("变更文档未配置启用的流程绑定");
            }
            return;
        }
        workflowRuntimeFacade.startBusinessProcess(WorkflowStartCommand.builder()
            .tenantId(tenantId)
            .businessType(businessType)
            .businessId(String.valueOf(id))
            .submitterId(user.getUserId())
            .build());
    }
}
