package com.cwgsyw.platform.module.sosreport.cmdb;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.config.EmailService;
import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.sosreport.entity.SosCmdbRequest;
import com.cwgsyw.platform.module.sosreport.entity.SosFieldMapping;
import com.cwgsyw.platform.module.sosreport.mapper.SosCmdbRequestMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.workflow.adapter.SosCmdbWorkflowAdapter;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowRuntimeFacade;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.stream.Collectors;

/**
 * 通知入库申请当前任务的全部候选审批人：站内通知和邮件。
 *
 * <p>事务提交后才发，避免回滚时发出指向无效申请的通知。放到独立线程，既不让 SMTP 拖慢请求，
 * 也不在已提交事务的连接上继续写数据。通知失败不影响提交和审批。
 *
 * <p>收件人判定和审批时相同：{@link WorkflowRuntimeFacade#isTaskCandidate} 加适配器的业务权限，
 * 所以收到通知的人一定能审批。
 */
@Component
@Slf4j
public class SosApproverNotifier {

    static final String TYPE = "sos_cmdb_approval";
    private static final String REF_TYPE = "sos_report";
    private static final String APPROVE_PERMISSION = "sos_report:approve";
    private static final int ACTIVE_STATUS = 1;
    private static final int MAX_AI_FIELDS_LISTED = 10;
    private static final int MAX_NAME = 100;

    private final SosCmdbRequestMapper requestMapper;
    private final SosCmdbWorkflowAdapter workflowAdapter;
    private final WorkflowRuntimeFacade workflowRuntimeFacade;
    private final UserMapper userMapper;
    private final RbacService rbacService;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final String publicUrl;

    private final ExecutorService executor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "sos-approver-notifier");
        thread.setDaemon(true);
        return thread;
    });

    public SosApproverNotifier(SosCmdbRequestMapper requestMapper, SosCmdbWorkflowAdapter workflowAdapter,
                               WorkflowRuntimeFacade workflowRuntimeFacade, UserMapper userMapper,
                               RbacService rbacService, NotificationService notificationService,
                               EmailService emailService, @Value("${app.public-url:}") String publicUrl) {
        this.requestMapper = requestMapper;
        this.workflowAdapter = workflowAdapter;
        this.workflowRuntimeFacade = workflowRuntimeFacade;
        this.userMapper = userMapper;
        this.rbacService = rbacService;
        this.notificationService = notificationService;
        this.emailService = emailService;
        this.publicUrl = normalizePublicUrl(publicUrl);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onTasksChanged(SosApprovalTasksChangedEvent event) {
        try {
            executor.execute(() -> notifyApprovers(event));
        } catch (RejectedExecutionException e) {
            log.warn("SOS 审批通知未发送，应用正在关闭: requestId={}", event.requestId());
        }
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }

    void notifyApprovers(SosApprovalTasksChangedEvent event) {
        try {
            SosCmdbRequest request = requestMapper.selectOne(new LambdaQueryWrapper<SosCmdbRequest>()
                .eq(SosCmdbRequest::getTenantId, event.tenantId())
                .eq(SosCmdbRequest::getId, event.requestId()));
            if (request == null || !SosCmdbRequest.STATUS_PENDING.equals(request.getStatus())
                    || request.getProcessInstanceId() == null) {
                return;
            }
            List<String> taskIds = workflowRuntimeFacade.listActiveTaskIds(request.getProcessInstanceId());
            if (taskIds.isEmpty()) return;

            String submitter = displayName(userMapper.selectById(request.getSubmitterId()));
            for (User user : activeUsers(event.tenantId())) {
                try {
                    notifyIfApprover(user, request, taskIds, submitter);
                } catch (RuntimeException e) {
                    // 一个用户失败不影响其他审批人。
                    log.warn("SOS 审批通知失败: requestId={} userId={} error={}",
                        request.getId(), user.getId(), e.getClass().getSimpleName());
                }
            }
        } catch (RuntimeException e) {
            log.warn("SOS 审批通知失败: requestId={} error={}", event.requestId(), e.getClass().getSimpleName());
        }
    }

    private void notifyIfApprover(User user, SosCmdbRequest request, List<String> taskIds, String submitter) {
        // 先用权限过滤，绝大多数用户到这里就结束，不必再查 Flowable。
        Set<String> permissions = rbacService.getUserPermissions(user.getId());
        if (!permissions.contains(APPROVE_PERMISSION)) return;
        SecurityUser candidate = new SecurityUser(user.getId(), user.getUsername(), "", user.getTenantId(),
            user.getGroupId(), rbacService.getHighestScope(user.getId()), permissions);
        if (!workflowAdapter.canApprove(request.getTenantId(), String.valueOf(request.getId()), candidate)) return;

        for (String taskId : taskIds) {
            if (workflowRuntimeFacade.isTaskCandidate(taskId, candidate)) {
                send(user, request, taskId, submitter);
            }
        }
    }

    private void send(User user, SosCmdbRequest request, String taskId, String submitter) {
        String title = title(request);
        String content = content(request, submitter);
        boolean created = notificationService.notifyIdempotent(request.getTenantId(), user.getId(), title, content,
            TYPE, REF_TYPE, request.getReportId(), "sos-cmdb-approval:" + taskId + ":" + user.getId());
        // notifyIdempotent 不发邮件；只有第一次创建通知时才发，重复事件不重复发信。
        if (created && user.getEmail() != null && !user.getEmail().isBlank()) {
            emailService.send(request.getTenantId(), user.getEmail(), title, content + "\n\n" + linkLine(request));
        }
    }

    private List<User> activeUsers(String tenantId) {
        return userMapper.selectList(new LambdaQueryWrapper<User>()
            .eq(User::getTenantId, tenantId)
            .eq(User::getStatus, ACTIVE_STATUS));
    }

    static String title(SosCmdbRequest request) {
        return "待审批：主机入库 " + clean(request.getInstanceName());
    }

    /** 不写字段的值：邮件会发到系统外。AI 参与的字段必须写明，审批人才知道重点核对哪里。 */
    static String content(SosCmdbRequest request, String submitter) {
        boolean create = SosCmdbRequest.ACTION_CREATE.equals(request.getAction());
        int fieldCount = request.getProposedFields() == null ? 0 : request.getProposedFields().size();
        StringBuilder text = new StringBuilder()
            .append(submitter == null ? "有人" : clean(submitter))
            .append("提交了 CMDB 主机").append(create ? "新增" : "更新").append("申请，实例“")
            .append(clean(request.getInstanceName())).append("”，共 ").append(fieldCount).append(" 个字段。");
        List<String> aiFields = aiFieldNames(request);
        if (aiFields.isEmpty()) {
            text.append("没有使用 AI 建议的映射规则。");
        } else {
            text.append("其中 ").append(aiFields.size()).append(" 个字段的映射规则来自 AI 建议（已由管理员确认）：")
                .append(aiFields.stream().limit(MAX_AI_FIELDS_LISTED).map(SosApproverNotifier::clean)
                    .collect(Collectors.joining("、")))
                .append(aiFields.size() > MAX_AI_FIELDS_LISTED ? " 等" : "")
                .append("，请重点核对。");
        }
        return text.toString();
    }

    static List<String> aiFieldNames(SosCmdbRequest request) {
        List<Map<String, Object>> details = request.getFieldDetails();
        if (details == null) return List.of();
        return details.stream()
            .filter(row -> SosFieldMapping.SOURCE_AI.equals(row.get("ruleSource")))
            .map(row -> String.valueOf(row.getOrDefault("name", row.get("fieldKey"))))
            .toList();
    }

    private String linkLine(SosCmdbRequest request) {
        if (publicUrl.isEmpty()) {
            return "请登录系统，在“SOS 报告”页面的“待我审批”中处理。";
        }
        return "打开报告并审批：" + publicUrl + "/sos-reports/" + request.getReportId();
    }

    /** 只接受 http(s) 地址。配置错误时不发链接，不能把错误的地址发给审批人。 */
    static String normalizePublicUrl(String value) {
        if (value == null || value.isBlank()) return "";
        String trimmed = value.trim().replaceAll("/+$", "");
        try {
            URI uri = URI.create(trimmed);
            boolean valid = ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                && uri.getHost() != null && !uri.getHost().isBlank();
            if (valid) return trimmed;
        } catch (IllegalArgumentException e) {
            // 走到下面的告警。
        }
        log.warn("APP_PUBLIC_URL 不是有效的 HTTP(S) 地址，通知邮件将不带链接");
        return "";
    }

    private static String displayName(User user) {
        if (user == null) return null;
        return user.getRealName() != null ? user.getRealName() : user.getUsername();
    }

    /** 实例名可能来自报告或人工输入，去掉控制字符，避免影响邮件标题和正文。 */
    private static String clean(String value) {
        if (value == null) return "";
        String cleaned = value.replaceAll("\\p{Cntrl}", " ").trim();
        return cleaned.length() > MAX_NAME ? cleaned.substring(0, MAX_NAME) : cleaned;
    }
}
