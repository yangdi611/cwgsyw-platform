package com.cwgsyw.platform.module.task.analytics;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsDashboardRequest;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsDashboardShareRequest;
import com.cwgsyw.platform.module.task.analytics.entity.TaskAnalyticsDashboard;
import com.cwgsyw.platform.module.task.analytics.entity.TaskAnalyticsWidget;
import com.cwgsyw.platform.module.task.analytics.mapper.TaskAnalyticsDashboardMapper;
import com.cwgsyw.platform.module.task.analytics.mapper.TaskAnalyticsWidgetMapper;
import com.cwgsyw.platform.module.task.analytics.service.TaskAnalyticsDashboardService;
import com.cwgsyw.platform.module.task.runtime.service.TaskVisibilityService;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskAnalyticsDashboardServiceTest {
    @Mock TaskAnalyticsDashboardMapper dashboardMapper;
    @Mock TaskAnalyticsWidgetMapper widgetMapper;
    @Mock TaskVisibilityService visibilityService;
    @Mock AuditLogMapper auditLogMapper;

    private TaskAnalyticsDashboardService service;
    private SecurityUser owner;
    private SecurityUser groupMember;
    private SecurityUser tenantAdmin;

    @BeforeEach
    void setUp() {
        ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        service = new TaskAnalyticsDashboardService(dashboardMapper, widgetMapper, visibilityService,
            auditLogMapper, objectMapper);
        owner = user(10L, 7L, "group");
        groupMember = user(11L, 7L, "group");
        tenantAdmin = user(12L, 99L, "tenant");
        org.mockito.Mockito.lenient().when(visibilityService.groupIds(owner)).thenReturn(Set.of(7L));
        org.mockito.Mockito.lenient().when(visibilityService.groupIds(groupMember)).thenReturn(Set.of(7L));
        org.mockito.Mockito.lenient().when(visibilityService.groupIds(tenantAdmin)).thenReturn(Set.of(99L));
        org.mockito.Mockito.lenient().when(visibilityService.isTenantScope(owner)).thenReturn(false);
        org.mockito.Mockito.lenient().when(visibilityService.isTenantScope(groupMember)).thenReturn(false);
        org.mockito.Mockito.lenient().when(visibilityService.isTenantScope(tenantAdmin)).thenReturn(true);
    }

    @Test
    void listsPrivateGroupAndTenantDashboardsButExcludesOtherTenantAndDeletedRows() {
        TaskAnalyticsDashboard privateDashboard = dashboard(1L, "tenant-a", 10L, null, "private", false);
        TaskAnalyticsDashboard groupDashboard = dashboard(2L, "tenant-a", 20L, 7L, "group", false);
        TaskAnalyticsDashboard tenantDashboard = dashboard(3L, "tenant-a", 30L, null, "tenant", false);
        TaskAnalyticsDashboard deletedDashboard = dashboard(4L, "tenant-a", 10L, null, "private", true);
        TaskAnalyticsDashboard otherTenant = dashboard(5L, "tenant-b", 10L, null, "tenant", false);
        when(dashboardMapper.selectList(any())).thenReturn(List.of(privateDashboard, groupDashboard, tenantDashboard));

        var rows = service.list(groupMember);

        assertThat(rows).extracting(row -> row.id()).containsExactly(1L, 2L, 3L);
        assertThat(rows).noneMatch(row -> row.id().equals(deletedDashboard.getId()));
        assertThat(rows).noneMatch(row -> row.id().equals(otherTenant.getId()));
        verify(dashboardMapper).selectList(any());
    }

    @Test
    void rejectsCrossTenantDashboardEvenWhenIdExists() {
        TaskAnalyticsDashboard otherTenant = dashboard(9L, "tenant-b", 10L, null, "tenant", false);
        when(dashboardMapper.selectOne(any())).thenReturn(null);

        assertThatThrownBy(() -> service.get(owner, otherTenant.getId()))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("ANALYTICS_DASHBOARD_ACCESS_DENIED"));
    }

    @Test
    void onlyOwnerOrTenantAdministratorCanManageSharedDashboard() {
        TaskAnalyticsDashboard dashboard = dashboard(20L, "tenant-a", 10L, 7L, "group", false);
        when(dashboardMapper.selectOne(any())).thenReturn(dashboard);

        assertThatThrownBy(() -> service.share(groupMember, 20L,
            new AnalyticsDashboardShareRequest("tenant", null)))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("ANALYTICS_DASHBOARD_MANAGE_DENIED"));

        service.share(tenantAdmin, 20L, new AnalyticsDashboardShareRequest("tenant", null));

        verify(dashboardMapper).updateById(dashboard);
        assertThat(dashboard.getScopeType()).isEqualTo("tenant");
    }

    @Test
    void validatesGroupShareAgainstCurrentScope() {
        assertThatThrownBy(() -> service.create(groupMember,
            new AnalyticsDashboardRequest("ops", "看板", null, "group", 99L, Map.of())))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("ANALYTICS_GROUP_SHARE_DENIED"));
    }

    @Test
    void deleteAuditsUnmutatedBeforeSnapshotAndRemovesWidgetsInTenant() throws Exception {
        TaskAnalyticsDashboard dashboard = dashboard(30L, "tenant-a", 10L, null, "private", false);
        dashboard.setName("原始看板");
        dashboard.setLayoutConfig(Map.of("columns", 2));
        when(dashboardMapper.selectOne(any())).thenReturn(dashboard);

        service.delete(owner, 30L);

        ArgumentCaptor<AuditLog> audit = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(audit.capture());
        assertThat(audit.getValue().getAction()).isEqualTo("delete");
        assertThat(audit.getValue().getBeforeJson()).contains("原始看板").contains("columns");
        assertThat(audit.getValue().getAfterJson()).isNull();
        assertThat(dashboard.getIsDeleted()).isTrue();
        verify(widgetMapper).delete(any(Wrapper.class));
    }

    @Test
    void missingDashboardIsNotRevealedAsVisible() {
        when(dashboardMapper.selectOne(any())).thenReturn(null);

        assertThatThrownBy(() -> service.get(owner, 404L))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("ANALYTICS_DASHBOARD_ACCESS_DENIED"));
        verify(widgetMapper, never()).selectList(any());
    }

    private SecurityUser user(Long id, Long groupId, String scope) {
        return new SecurityUser(id, "u" + id, "", "tenant-a", groupId, scope,
            Set.of("task_analytics:read", "task_analytics:update"));
    }

    private TaskAnalyticsDashboard dashboard(Long id, String tenantId, Long ownerId, Long groupId,
                                             String scope, boolean deleted) {
        TaskAnalyticsDashboard dashboard = new TaskAnalyticsDashboard();
        dashboard.setId(id);
        dashboard.setTenantId(tenantId);
        dashboard.setCode("dashboard-" + id);
        dashboard.setName("看板 " + id);
        dashboard.setScopeType(scope);
        dashboard.setOwnerId(ownerId);
        dashboard.setOwnerGroupId(groupId);
        dashboard.setLayoutConfig(Map.of());
        dashboard.setCreatedAt(LocalDateTime.of(2026, 7, 1, 10, 0));
        dashboard.setUpdatedAt(LocalDateTime.of(2026, 7, 2, 10, 0));
        dashboard.setIsDeleted(deleted);
        return dashboard;
    }
}
