package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.security.SecurityUser;
import org.flowable.engine.HistoryService;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.runtime.ProcessInstance;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkflowServiceGroupReferenceTest {
    @Mock RuntimeService runtimeService;
    @Mock TaskService taskService;
    @Mock RepositoryService repositoryService;
    @Mock HistoryService historyService;
    @Mock JdbcTemplate jdbcTemplate;
    @Mock ActiveGroupReferenceValidator activeGroupReferenceValidator;
    @Mock ProcessInstance processInstance;

    @InjectMocks WorkflowService service;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void legacyDailyStart_requiresTenantContextInsteadOfAssumingDefaultTenant() {
        assertThatThrownBy(() -> service.startDailyReportApproval(1L, 15L))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("旧版日报审批启动入口缺少租户上下文");
        verify(activeGroupReferenceValidator, never()).lockAndRequire(anyString(), any());
        verify(runtimeService, never()).startProcessInstanceByKey(anyString(), anyString(), any());
    }

    @Test
    void legacyDailyStart_locksTenantGroupBeforeStartingFlowable() {
        SecurityUser user = new SecurityUser(9L, "tester", "", "tenant-a", 15L, "tenant", Set.of());
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
        when(runtimeService.startProcessInstanceByKey(anyString(), anyString(), any())).thenReturn(processInstance);
        when(processInstance.getId()).thenReturn("pi-legacy");

        service.startDailyReportApproval(1L, 15L);

        var order = inOrder(activeGroupReferenceValidator, runtimeService);
        order.verify(activeGroupReferenceValidator).lockAndRequire("tenant-a", 15L);
        order.verify(runtimeService).startProcessInstanceByKey(anyString(), anyString(), any());
    }
}
