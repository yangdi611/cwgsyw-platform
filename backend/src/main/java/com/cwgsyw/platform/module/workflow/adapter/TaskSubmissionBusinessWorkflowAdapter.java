package com.cwgsyw.platform.module.workflow.adapter;

import com.cwgsyw.platform.module.approval.service.ApprovalRuntimeService;
import com.cwgsyw.platform.module.workflow.event.WorkflowCompletedEvent;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class TaskSubmissionBusinessWorkflowAdapter implements BusinessWorkflowAdapter {
    public static final String BUSINESS_TYPE = "task_submission";

    private final ApprovalRuntimeService approvalService;

    @Override
    public String businessType() { return BUSINESS_TYPE; }

    @Override
    public String buildBusinessKey(String businessId) { return BUSINESS_TYPE + ':' + businessId; }

    @Override
    public Map<String, Object> buildStartVariables(BusinessWorkflowContext context) { return Map.of(); }

    @Override
    public BusinessWorkflowSummary buildSummary(String tenantId, String businessId, SecurityUser viewer) {
        Long submissionId = safeLong(businessId);
        if (submissionId == null) return unavailable(businessId);
        Map<String, String> summary = approvalService.summary(tenantId, submissionId, viewer);
        if (summary.isEmpty()) return unavailable(businessId);
        return BusinessWorkflowSummary.builder()
            .available(true)
            .businessType(BUSINESS_TYPE)
            .businessId(businessId)
            .businessTitle(summary.get("title"))
            .businessSummary(summary.get("summary"))
            .businessUrl(summary.get("url"))
            .submitterName(summary.get("submitter"))
            .build();
    }

    @Override
    public boolean canApprove(String tenantId, String businessId, SecurityUser user) {
        Long submissionId = safeLong(businessId);
        return submissionId != null && approvalService.canApprove(tenantId, submissionId, user);
    }

    @Override
    public boolean canSubmit(String tenantId, String businessId, SecurityUser user) {
        return user != null && tenantId.equals(user.getTenantId()) && user.getPermissions().contains("task:submit");
    }

    @Override
    public void onWorkflowCompleted(WorkflowCompletedEvent event) {
        approvalService.onWorkflowCompleted(event);
    }

    private BusinessWorkflowSummary unavailable(String businessId) {
        return BusinessWorkflowSummary.builder().available(false).businessType(BUSINESS_TYPE)
            .businessId(businessId).build();
    }

    private Long safeLong(String value) {
        try { return value == null ? null : Long.valueOf(value); }
        catch (NumberFormatException exception) { return null; }
    }
}
