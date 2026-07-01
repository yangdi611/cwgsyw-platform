package com.cwgsyw.platform.module.workflow.adapter;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.wiki.WikiPageMapper;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import com.cwgsyw.platform.module.workflow.event.WorkflowCompletedEvent;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Wiki 页面发布审批适配器。
 *
 * <p>businessType = {@code wiki_page}，businessKey = {@code wiki_page:{pageId}}。
 * 直接操作 mapper 完成状态回写，避免与 WorkflowRuntimeFacade 形成 bean 循环。
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WikiWorkflowAdapter implements BusinessWorkflowAdapter {

    public static final String BUSINESS_TYPE = "wiki_page";
    private static final String APPROVE_PERM = "wiki:publish";

    private final WikiPageMapper pageMapper;
    private final UserMapper userMapper;
    private final NotificationService notificationService;
    private final AuditLogMapper auditLogMapper;

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
        Map<String, Object> vars = new HashMap<>();
        vars.put("pageId", context.getBusinessId());
        return vars;
    }

    @Override
    public BusinessWorkflowSummary buildSummary(String tenantId, String businessId, SecurityUser viewer) {
        WikiPage page = pageMapper.selectById(Long.valueOf(businessId));
        if (page == null || Boolean.TRUE.equals(page.getIsDeleted()) || !tenantId.equals(page.getTenantId())) {
            return BusinessWorkflowSummary.builder().available(false).build();
        }
        String submitterName = null;
        if (page.getUpdatedBy() != null) {
            User u = userMapper.selectById(page.getUpdatedBy());
            if (u != null) submitterName = u.getRealName() != null ? u.getRealName() : u.getUsername();
        }
        return BusinessWorkflowSummary.builder()
            .available(true)
            .businessType(BUSINESS_TYPE)
            .businessId(businessId)
            .businessTitle(page.getTitle())
            .businessSummary("Wiki 页面发布审批：" + page.getTitle())
            .businessUrl("/wiki/" + page.getSpaceId() + "/" + page.getId())
            .submitterName(submitterName)
            .build();
    }

    @Override
    public boolean canApprove(String tenantId, String businessId, SecurityUser user) {
        return user != null && user.getPermissions() != null
            && user.getPermissions().contains(APPROVE_PERM);
    }

    @Override
    public boolean canSubmit(String tenantId, String businessId, SecurityUser user) {
        WikiPage page = pageMapper.selectById(Long.valueOf(businessId));
        if (page == null || Boolean.TRUE.equals(page.getIsDeleted())) return false;
        return user != null && user.getPermissions() != null
            && user.getPermissions().contains("wiki:update");
    }

    @Override
    @Transactional
    public void onWorkflowCompleted(WorkflowCompletedEvent event) {
        Long pageId = Long.valueOf(event.getBusinessId());
        WikiPage page = pageMapper.selectById(pageId);
        if (page == null) {
            log.warn("Wiki 审批回调但页面不存在: pageId={}", pageId);
            return;
        }
        boolean approved = event.isApproved();
        page.setStatus(approved ? "published" : "draft");
        page.setProcessInstanceId(null);
        page.setUpdatedAt(LocalDateTime.now());
        pageMapper.updateById(page);

        auditLogMapper.insert(AuditLog.builder()
            .tenantId(page.getTenantId())
            .module("wiki")
            .action(approved ? "approve" : "reject")
            .targetId(pageId)
            .targetType("wiki_page")
            .operatorId(event.getApproverId() != null ? event.getApproverId() : 0L)
            .remark(event.getComment())
            .createdAt(LocalDateTime.now())
            .build());

        String title = approved ? "Wiki 审批通过" : "Wiki 审批被拒绝";
        String body = approved
            ? "《" + page.getTitle() + "》已审批通过并发布。"
            : "《" + page.getTitle() + "》审批被拒绝：" + (event.getComment() != null ? event.getComment() : "");
        notificationService.notify(page.getTenantId(), page.getCreatedBy(),
            title, body, "wiki_publish_approval", "wiki_page", pageId);
    }
}
