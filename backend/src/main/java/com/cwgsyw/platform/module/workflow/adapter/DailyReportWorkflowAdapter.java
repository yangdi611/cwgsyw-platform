package com.cwgsyw.platform.module.workflow.adapter;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.daily.DailyReportMapper;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
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
 * 日报业务流程适配器。
 *
 * <p>直接通过 mapper 读写日报，避免与 DailyReportService / WorkflowRuntimeFacade 形成 bean 循环依赖。
 * 候选组沿用历史约定 {@code group_{groupId}}。
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DailyReportWorkflowAdapter implements BusinessWorkflowAdapter {

    public static final String BUSINESS_TYPE = "daily_report";

    private final DailyReportMapper reportMapper;
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
        DailyReport report = reportMapper.selectById(Long.valueOf(context.getBusinessId()));
        Map<String, Object> vars = new HashMap<>();
        // 兼容旧流程变量：candidateGroups 取 ${groupId}
        if (report != null && report.getGroupId() != null) {
            vars.put("groupId", "group_" + report.getGroupId());
        }
        // 兼容旧监听器读取的 reportId 变量
        vars.put("reportId", context.getBusinessId());
        return vars;
    }

    @Override
    public BusinessWorkflowSummary buildSummary(String tenantId, String businessId, SecurityUser viewer) {
        DailyReport report = safeGet(businessId);
        if (report == null || Boolean.TRUE.equals(report.getIsDeleted())
                || !tenantId.equals(report.getTenantId())) {
            return BusinessWorkflowSummary.builder()
                .available(false).businessType(BUSINESS_TYPE).businessId(businessId).build();
        }
        String submitterName = null;
        if (report.getReporterId() != null) {
            User u = userMapper.selectById(report.getReporterId());
            if (u != null) submitterName = u.getRealName() != null ? u.getRealName() : u.getUsername();
        }
        return BusinessWorkflowSummary.builder()
            .available(true)
            .businessType(BUSINESS_TYPE)
            .businessId(businessId)
            .businessTitle(report.getReportDate() != null ? report.getReportDate() + " 工作日报" : "工作日报")
            .businessSummary(report.getCompletedItems() != null
                ? truncate(report.getCompletedItems(), 60) : "")
            .businessUrl("/daily-reports/" + businessId)
            .submitterName(submitterName)
            .build();
    }

    @Override
    public boolean canApprove(String tenantId, String businessId, SecurityUser user) {
        if (user == null) return false;
        if (!user.getPermissions().contains("daily_report:approve")) return false;
        DailyReport report = safeGet(businessId);
        if (report == null) return false;
        // 组长只能审批本组日报（平台/租户范围放行）
        if ("group".equals(user.getGroupScope())) {
            return user.getGroupId() != null && user.getGroupId().equals(report.getGroupId());
        }
        return true;
    }

    @Override
    public boolean canSubmit(String tenantId, String businessId, SecurityUser user) {
        if (user == null) return false;
        DailyReport report = safeGet(businessId);
        if (report == null) return false;
        return report.getReporterId() != null && report.getReporterId().equals(user.getUserId());
    }

    @Override
    @Transactional
    public void onWorkflowCompleted(WorkflowCompletedEvent event) {
        DailyReport report = safeGet(event.getBusinessId());
        if (report == null) {
            log.warn("日报流程结束但日报不存在: businessId={}", event.getBusinessId());
            return;
        }
        String newStatus = event.isApproved() ? "APPROVED" : "REJECTED";
        // 幂等：状态已是终态则跳过
        if (newStatus.equals(report.getStatus())) {
            log.info("日报 {} 状态已是 {}，跳过重复回写", report.getId(), newStatus);
            return;
        }
        String oldStatus = report.getStatus();
        report.setStatus(newStatus);
        reportMapper.updateById(report);

        auditLogMapper.insert(AuditLog.builder()
            .tenantId(report.getTenantId())
            .module("daily_report")
            .action(event.isApproved() ? "approve" : "reject")
            .targetId(report.getId())
            .targetType("daily_report")
            .operatorId(event.getApproverId() != null ? event.getApproverId() : 0L)
            .remark("流程结束回写: " + oldStatus + " -> " + newStatus
                + (event.getComment() != null ? " (" + event.getComment() + ")" : ""))
            .createdAt(LocalDateTime.now())
            .build());

        String title = event.isApproved() ? "日报审批通过" : "日报被拒绝";
        String content = event.isApproved()
            ? "您 " + report.getReportDate() + " 的工作日报已审批通过。"
            : "您 " + report.getReportDate() + " 的工作日报已被拒绝，请修改后重新提交。";
        notificationService.notify(report.getTenantId(), report.getReporterId(),
            title, content, "daily_report_approval", "daily_report", report.getId());
    }

    private DailyReport safeGet(String businessId) {
        try {
            return reportMapper.selectById(Long.valueOf(businessId));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }
}
