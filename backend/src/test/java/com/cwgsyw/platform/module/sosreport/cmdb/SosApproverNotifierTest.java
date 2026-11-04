package com.cwgsyw.platform.module.sosreport.cmdb;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.cwgsyw.platform.config.EmailService;
import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.sosreport.SosTestSupport;
import com.cwgsyw.platform.module.sosreport.entity.SosCmdbRequest;
import com.cwgsyw.platform.module.sosreport.mapper.SosCmdbRequestMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.workflow.adapter.SosCmdbWorkflowAdapter;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowRuntimeFacade;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SosApproverNotifierTest {

    private static final SosApprovalTasksChangedEvent EVENT = new SosApprovalTasksChangedEvent("tenant-a", 9L);
    private static final Set<String> APPROVER = Set.of("sos_report:approve", "cmdb_instance:create");

    @Mock SosCmdbRequestMapper requestMapper;
    @Mock SosCmdbWorkflowAdapter adapter;
    @Mock WorkflowRuntimeFacade facade;
    @Mock UserMapper userMapper;
    @Mock RbacService rbacService;
    @Mock NotificationService notificationService;
    @Mock EmailService emailService;

    private SosCmdbRequest request;
    private final List<User> users = new ArrayList<>();

    private SosApproverNotifier notifier(String publicUrl) {
        return new SosApproverNotifier(requestMapper, adapter, facade, userMapper, rbacService,
            notificationService, emailService, publicUrl);
    }

    private User user(long id, String email, Set<String> permissions) {
        User user = new User();
        user.setId(id);
        user.setTenantId("tenant-a");
        user.setUsername("user" + id);
        user.setEmail(email);
        user.setStatus(1);
        users.add(user);
        when(rbacService.getUserPermissions(id)).thenReturn(permissions);
        when(rbacService.getHighestScope(id)).thenReturn("tenant");
        return user;
    }

    @BeforeEach
    void setUp() {
        SosTestSupport.initTables();
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), "sosNotifierTest"), User.class);
        request = new SosCmdbRequest();
        request.setId(9L);
        request.setTenantId("tenant-a");
        request.setReportId(5L);
        request.setAction(SosCmdbRequest.ACTION_CREATE);
        request.setInstanceName("web-01");
        request.setProposedFields(Map.of("sn", "SECRET-SN", "inner_ip", "10.9.8.7"));
        request.setStatus(SosCmdbRequest.STATUS_PENDING);
        request.setProcessInstanceId("pi-1");
        request.setSubmitterId(3L);
        when(requestMapper.selectOne(any())).thenReturn(request);
        when(facade.listActiveTaskIds("pi-1")).thenReturn(List.of("task-1"));
        when(userMapper.selectList(any())).thenReturn(users);
        when(adapter.canApprove(eq("tenant-a"), eq("9"), any())).thenReturn(true);
        when(facade.isTaskCandidate(eq("task-1"), any())).thenReturn(true);
        when(notificationService.notifyIdempotent(any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(true);
    }

    @Test
    void notifiesEveryCandidateWithLinkAndEmail() {
        user(1L, "a@example.com", APPROVER);
        user(2L, "b@example.com", APPROVER);

        notifier("https://ops.example.com/").notifyApprovers(EVENT);

        verify(notificationService).notifyIdempotent(eq("tenant-a"), eq(1L), anyString(), anyString(),
            eq(SosApproverNotifier.TYPE), eq("sos_report"), eq(5L), eq("sos-cmdb-approval:task-1:1"));
        verify(notificationService).notifyIdempotent(eq("tenant-a"), eq(2L), anyString(), anyString(),
            any(), any(), any(), eq("sos-cmdb-approval:task-1:2"));

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("tenant-a"), eq("a@example.com"), anyString(), body.capture());
        assertTrue(body.getValue().contains("https://ops.example.com/sos-reports/5"), body.getValue());
    }

    @Test
    void skipsUsersWhoCannotApprove() {
        user(1L, "noperm@example.com", Set.of("sos_report:read"));
        user(2L, "nowrite@example.com", Set.of("sos_report:approve"));
        user(3L, "notcandidate@example.com", APPROVER);
        when(adapter.canApprove(eq("tenant-a"), eq("9"), org.mockito.ArgumentMatchers.argThat(u -> u != null && u.getUserId() == 2L))).thenReturn(false);
        when(facade.isTaskCandidate(eq("task-1"), org.mockito.ArgumentMatchers.argThat(u -> u != null && u.getUserId() == 3L))).thenReturn(false);

        notifier("https://ops.example.com").notifyApprovers(EVENT);

        verify(notificationService, never()).notifyIdempotent(any(), any(), any(), any(), any(), any(), any(), any());
        verify(emailService, never()).send(any(), any(), any(), any());
    }

    @Test
    void repeatedEventDoesNotResendEmail() {
        user(1L, "a@example.com", APPROVER);
        when(notificationService.notifyIdempotent(any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(false);

        notifier("https://ops.example.com").notifyApprovers(EVENT);

        verify(emailService, never()).send(any(), any(), any(), any());
    }

    @Test
    void secondLevelTaskIsANewNotification() {
        user(1L, "a@example.com", APPROVER);
        when(facade.listActiveTaskIds("pi-1")).thenReturn(List.of("task-2"));
        when(facade.isTaskCandidate(eq("task-2"), any())).thenReturn(true);

        notifier("").notifyApprovers(EVENT);

        verify(notificationService).notifyIdempotent(any(), eq(1L), any(), any(), any(), any(), any(), eq("sos-cmdb-approval:task-2:1"));
    }

    @Test
    void finishedRequestNotifiesNobody() {
        user(1L, "a@example.com", APPROVER);
        request.setStatus(SosCmdbRequest.STATUS_APPLIED);

        notifier("").notifyApprovers(EVENT);

        verify(facade, never()).listActiveTaskIds(any());
    }

    @Test
    void oneFailingUserDoesNotStopOthers() {
        user(1L, "a@example.com", APPROVER);
        user(2L, "b@example.com", APPROVER);
        when(rbacService.getUserPermissions(1L)).thenThrow(new IllegalStateException("db"));

        notifier("").notifyApprovers(EVENT);

        verify(notificationService).notifyIdempotent(any(), eq(2L), any(), any(), any(), any(), any(), any());
    }

    @Test
    void failuresNeverEscape() {
        when(requestMapper.selectOne(any())).thenThrow(new IllegalStateException("db down"));

        notifier("").notifyApprovers(EVENT);
    }

    @Test
    void contentNeverContainsFieldValues() {
        String content = SosApproverNotifier.content(request, "张三");

        assertFalse(content.contains("SECRET-SN"));
        assertFalse(content.contains("10.9.8.7"));
        assertTrue(content.contains("web-01"));
        assertTrue(content.contains("张三"));
        assertTrue(content.contains("新增"));
    }

    @Test
    void contentStatesWhenNoAiWasUsed() {
        assertTrue(SosApproverNotifier.content(request, "张三").contains("没有使用 AI"));
    }

    @Test
    void contentNamesFieldsSuggestedByAi() {
        request.setFieldDetails(List.of(
            Map.of("fieldKey", "sn", "name", "序列号", "origin", "preset"),
            Map.of("fieldKey", "logical_cores", "name", "逻辑核", "origin", "confirmed", "ruleSource", "ai"),
            Map.of("fieldKey", "rack", "name", "机柜", "origin", "confirmed", "ruleSource", "manual")));

        String content = SosApproverNotifier.content(request, "张三");

        assertTrue(content.contains("1 个字段的映射规则来自 AI 建议"), content);
        assertTrue(content.contains("逻辑核"));
        assertFalse(content.contains("机柜"), "人工规则不算 AI");
        assertFalse(content.contains("序列号"));
    }

    @Test
    void stripsControlCharactersFromInstanceName() {
        request.setInstanceName("web\r\nBcc: evil@example.com");

        assertFalse(SosApproverNotifier.title(request).contains("\n"));
        assertFalse(SosApproverNotifier.content(request, "张\n三").contains("\n"));
    }

    @Test
    void omitsLinkWhenPublicUrlIsMissingOrInvalid() {
        assertEquals("", SosApproverNotifier.normalizePublicUrl(null));
        assertEquals("", SosApproverNotifier.normalizePublicUrl("  "));
        assertEquals("", SosApproverNotifier.normalizePublicUrl("ftp://ops.example.com"));
        assertEquals("", SosApproverNotifier.normalizePublicUrl("javascript:alert(1)"));
        assertEquals("", SosApproverNotifier.normalizePublicUrl("not a url"));
        assertEquals("https://ops.example.com", SosApproverNotifier.normalizePublicUrl("https://ops.example.com//"));

        user(1L, "a@example.com", APPROVER);
        notifier("").notifyApprovers(EVENT);

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(any(), any(), any(), body.capture());
        assertFalse(body.getValue().contains("http"));
        assertTrue(body.getValue().contains("待我审批"));
    }
}
