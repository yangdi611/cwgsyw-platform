package com.cwgsyw.platform.module.workflow.adapter;

import com.cwgsyw.platform.module.changedoc.ChangeDocService;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDoc;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.workflow.event.WorkflowCompletedEvent;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 变更文档业务流程适配器（可选流程）。
 *
 * <p>变更文档默认仍走内部 {@code ChangeDocService.approve}，只有在管理员为
 * {@code change_doc} 绑定了流程定义后，新提交才可选择进入 Flowable。
 * 流程结束回写委托给 {@link ChangeDocService#handleWorkflowApproval} 复用归档逻辑。
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ChangeDocWorkflowAdapter implements BusinessWorkflowAdapter {

    public static final String BUSINESS_TYPE = "change_doc";

    private final ChangeDocService changeDocService;
    private final UserMapper userMapper;

    @Override
    public String businessType() {
        return BUSINESS_TYPE;
    }

    @Override
    public String buildBusinessKey(String businessId) {
        return BUSINESS_TYPE + ":" + businessId;
    }

    @Override
    public Map<String, Object> buildStartVariables(BusinessWorkflowContext context) {
        // 变更文档审批候选组沿用 change_doc:approve 权限组，具体候选组由模板配置决定。
        return new HashMap<>();
    }

    @Override
    public BusinessWorkflowSummary buildSummary(String tenantId, String businessId, SecurityUser viewer) {
        if (viewer == null || !viewer.getPermissions().contains("change_doc:read")) {
            return BusinessWorkflowSummary.builder()
                .available(false).businessType(BUSINESS_TYPE).businessId(businessId).build();
        }
        ChangeDoc doc = changeDocService.getForWorkflow(tenantId, safeLong(businessId));
        if (doc == null) {
            return BusinessWorkflowSummary.builder()
                .available(false).businessType(BUSINESS_TYPE).businessId(businessId).build();
        }
        String submitterName = null;
        if (doc.getApplicantId() != null) {
            User u = userMapper.selectById(doc.getApplicantId());
            if (u != null) submitterName = u.getRealName() != null ? u.getRealName() : u.getUsername();
        }
        return BusinessWorkflowSummary.builder()
            .available(true)
            .businessType(BUSINESS_TYPE)
            .businessId(businessId)
            .businessTitle(doc.getChangeNo() != null ? doc.getChangeNo() : doc.getTitle())
            .businessSummary(doc.getTitle() != null ? doc.getTitle() : "")
            .businessUrl("/change-docs/" + businessId)
            .submitterName(submitterName)
            .build();
    }

    @Override
    public boolean canApprove(String tenantId, String businessId, SecurityUser user) {
        if (user == null) return false;
        if (!user.getPermissions().contains("change_doc:approve")) return false;
        return changeDocService.getForWorkflow(tenantId, safeLong(businessId)) != null;
    }

    @Override
    public boolean canSubmit(String tenantId, String businessId, SecurityUser user) {
        if (user == null) return false;
        if (!user.getPermissions().contains("change_doc:create")
                && !user.getPermissions().contains("change_doc:update")) {
            return false;
        }
        ChangeDoc doc = changeDocService.getForWorkflow(tenantId, safeLong(businessId));
        return doc != null;
    }

    @Override
    public void onWorkflowCompleted(WorkflowCompletedEvent event) {
        Long id = safeLong(event.getBusinessId());
        if (id == null) {
            log.warn("变更文档流程结束但 businessId 非法: {}", event.getBusinessId());
            return;
        }
        changeDocService.handleWorkflowApproval(id, event.isApproved(), event.getApproverId(), event.getComment());
    }

    private Long safeLong(String s) {
        try {
            return Long.valueOf(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
