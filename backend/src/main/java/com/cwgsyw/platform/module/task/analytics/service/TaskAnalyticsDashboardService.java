package com.cwgsyw.platform.module.task.analytics.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsDashboardRequest;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsDashboardShareRequest;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsDashboardVO;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsWidgetRequest;
import com.cwgsyw.platform.module.task.analytics.dto.AnalyticsWidgetVO;
import com.cwgsyw.platform.module.task.analytics.entity.TaskAnalyticsDashboard;
import com.cwgsyw.platform.module.task.analytics.entity.TaskAnalyticsWidget;
import com.cwgsyw.platform.module.task.analytics.mapper.TaskAnalyticsDashboardMapper;
import com.cwgsyw.platform.module.task.analytics.mapper.TaskAnalyticsWidgetMapper;
import com.cwgsyw.platform.module.task.runtime.service.TaskVisibilityService;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TaskAnalyticsDashboardService {
    private static final Set<String> SCOPES = Set.of("private", "group", "tenant");
    private static final Set<String> WIDGET_TYPES = Set.of(
        "kpi", "line_chart", "bar_chart", "pie_chart", "table", "text_list", "attachment_list", "image_gallery");

    private final TaskAnalyticsDashboardMapper dashboardMapper;
    private final TaskAnalyticsWidgetMapper widgetMapper;
    private final TaskVisibilityService visibilityService;
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;

    public List<AnalyticsDashboardVO> list(SecurityUser user) {
        List<TaskAnalyticsDashboard> values = dashboardMapper.selectList(new LambdaQueryWrapper<TaskAnalyticsDashboard>()
            .eq(TaskAnalyticsDashboard::getTenantId, user.getTenantId())
            .eq(TaskAnalyticsDashboard::getIsDeleted, false)
            .and(wrapper -> {
                wrapper.eq(TaskAnalyticsDashboard::getOwnerId, user.getUserId())
                    .or().eq(TaskAnalyticsDashboard::getScopeType, "tenant");
                Set<Long> groups = visibilityService.groupIds(user);
                if (!groups.isEmpty()) wrapper.or(nested -> nested.eq(TaskAnalyticsDashboard::getScopeType, "group")
                    .in(TaskAnalyticsDashboard::getOwnerGroupId, groups));
            })
            .orderByDesc(TaskAnalyticsDashboard::getUpdatedAt).orderByDesc(TaskAnalyticsDashboard::getId));
        return values.stream().map(value -> toVO(value, user, false)).toList();
    }

    public AnalyticsDashboardVO get(SecurityUser user, Long dashboardId) {
        TaskAnalyticsDashboard dashboard = requireVisible(user, dashboardId);
        return toVO(dashboard, user, true);
    }

    @Transactional(rollbackFor = Exception.class)
    public AnalyticsDashboardVO create(SecurityUser user, AnalyticsDashboardRequest request) {
        String scope = scope(request.scopeType());
        validateScope(user, scope, request.ownerGroupId());
        TaskAnalyticsDashboard dashboard = new TaskAnalyticsDashboard();
        dashboard.setTenantId(user.getTenantId());
        dashboard.setCode(StringUtils.hasText(request.code()) ? request.code().trim() : "dashboard_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        dashboard.setName(request.name().trim());
        dashboard.setDescription(request.description());
        dashboard.setScopeType(scope);
        dashboard.setOwnerId(user.getUserId());
        dashboard.setOwnerGroupId("group".equals(scope) ? request.ownerGroupId() : null);
        dashboard.setLayoutConfig(copy(request.layoutConfig()));
        dashboard.setCreatedBy(user.getUserId());
        dashboard.setUpdatedBy(user.getUserId());
        dashboard.setCreatedAt(LocalDateTime.now());
        dashboard.setUpdatedAt(dashboard.getCreatedAt());
        dashboard.setIsDeleted(false);
        dashboardMapper.insert(dashboard);
        audit(user, "create", dashboard.getId(), null, dashboard, "创建任务统计看板");
        return toVO(dashboard, user, true);
    }

    @Transactional(rollbackFor = Exception.class)
    public AnalyticsDashboardVO update(SecurityUser user, Long dashboardId, AnalyticsDashboardRequest request) {
        TaskAnalyticsDashboard dashboard = requireManage(user, dashboardId);
        TaskAnalyticsDashboard before = snapshot(dashboard);
        String scope = scope(request.scopeType());
        validateScope(user, scope, request.ownerGroupId());
        dashboard.setName(request.name().trim());
        dashboard.setDescription(request.description());
        dashboard.setScopeType(scope);
        dashboard.setOwnerGroupId("group".equals(scope) ? request.ownerGroupId() : null);
        dashboard.setLayoutConfig(copy(request.layoutConfig()));
        dashboard.setUpdatedBy(user.getUserId());
        dashboard.setUpdatedAt(LocalDateTime.now());
        dashboardMapper.updateById(dashboard);
        audit(user, "update", dashboard.getId(), before, dashboard, "更新任务统计看板");
        return toVO(dashboard, user, true);
    }

    @Transactional(rollbackFor = Exception.class)
    public AnalyticsDashboardVO share(SecurityUser user, Long dashboardId, AnalyticsDashboardShareRequest request) {
        TaskAnalyticsDashboard dashboard = requireManage(user, dashboardId);
        TaskAnalyticsDashboard before = snapshot(dashboard);
        String scope = scope(request.scopeType());
        validateScope(user, scope, request.ownerGroupId());
        dashboard.setScopeType(scope);
        dashboard.setOwnerGroupId("group".equals(scope) ? request.ownerGroupId() : null);
        dashboard.setUpdatedBy(user.getUserId());
        dashboard.setUpdatedAt(LocalDateTime.now());
        dashboardMapper.updateById(dashboard);
        audit(user, "share", dashboard.getId(), before, dashboard, "调整任务统计看板共享范围");
        return toVO(dashboard, user, true);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(SecurityUser user, Long dashboardId) {
        TaskAnalyticsDashboard dashboard = requireManage(user, dashboardId);
        TaskAnalyticsDashboard before = snapshot(dashboard);
        widgetMapper.delete(new LambdaQueryWrapper<TaskAnalyticsWidget>()
            .eq(TaskAnalyticsWidget::getTenantId, user.getTenantId()).eq(TaskAnalyticsWidget::getDashboardId, dashboardId));
        dashboard.setIsDeleted(true);
        dashboard.setDeletedAt(LocalDateTime.now());
        dashboard.setDeletedBy(user.getUserId());
        dashboard.setUpdatedBy(user.getUserId());
        dashboard.setUpdatedAt(dashboard.getDeletedAt());
        dashboardMapper.updateById(dashboard);
        audit(user, "delete", dashboard.getId(), before, null, "删除任务统计看板");
    }

    @Transactional(rollbackFor = Exception.class)
    public AnalyticsWidgetVO addWidget(SecurityUser user, Long dashboardId, AnalyticsWidgetRequest request) {
        requireManage(user, dashboardId);
        validateWidget(request);
        TaskAnalyticsWidget widget = new TaskAnalyticsWidget();
        widget.setTenantId(user.getTenantId());
        widget.setDashboardId(dashboardId);
        apply(widget, request);
        widget.setUpdatedAt(LocalDateTime.now());
        widgetMapper.insert(widget);
        touch(dashboardId, user.getUserId());
        audit(user, "create_widget", widget.getId(), null, widget, "添加任务统计组件");
        return toVO(widget);
    }

    @Transactional(rollbackFor = Exception.class)
    public AnalyticsWidgetVO updateWidget(SecurityUser user, Long widgetId, AnalyticsWidgetRequest request) {
        TaskAnalyticsWidget widget = requireWidget(user, widgetId);
        requireManage(user, widget.getDashboardId());
        validateWidget(request);
        TaskAnalyticsWidget before = widgetSnapshot(widget);
        apply(widget, request);
        widget.setUpdatedAt(LocalDateTime.now());
        widgetMapper.updateById(widget);
        touch(widget.getDashboardId(), user.getUserId());
        audit(user, "update_widget", widget.getId(), before, widget, "更新任务统计组件");
        return toVO(widget);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteWidget(SecurityUser user, Long widgetId) {
        TaskAnalyticsWidget widget = requireWidget(user, widgetId);
        requireManage(user, widget.getDashboardId());
        widgetMapper.deleteById(widgetId);
        touch(widget.getDashboardId(), user.getUserId());
        audit(user, "delete_widget", widget.getId(), widget, null, "删除任务统计组件");
    }

    private TaskAnalyticsDashboard requireVisible(SecurityUser user, Long id) {
        TaskAnalyticsDashboard dashboard = dashboardMapper.selectOne(new LambdaQueryWrapper<TaskAnalyticsDashboard>()
            .eq(TaskAnalyticsDashboard::getTenantId, user.getTenantId())
            .eq(TaskAnalyticsDashboard::getId, id)
            .eq(TaskAnalyticsDashboard::getIsDeleted, false));
        if (dashboard == null || (!canView(dashboard, user) && !visibilityService.isTenantScope(user))) {
            throw BusinessException.forbidden("ANALYTICS_DASHBOARD_ACCESS_DENIED", "无权访问该统计看板");
        }
        return dashboard;
    }

    private TaskAnalyticsDashboard requireManage(SecurityUser user, Long id) {
        TaskAnalyticsDashboard dashboard = requireVisible(user, id);
        if (!canManage(dashboard, user)) throw BusinessException.forbidden("ANALYTICS_DASHBOARD_MANAGE_DENIED", "无权管理该统计看板");
        return dashboard;
    }

    private TaskAnalyticsWidget requireWidget(SecurityUser user, Long id) {
        TaskAnalyticsWidget widget = widgetMapper.selectOne(new LambdaQueryWrapper<TaskAnalyticsWidget>()
            .eq(TaskAnalyticsWidget::getTenantId, user.getTenantId()).eq(TaskAnalyticsWidget::getId, id));
        if (widget == null) throw BusinessException.badRequest("ANALYTICS_WIDGET_NOT_FOUND", "统计组件不存在");
        return widget;
    }

    private boolean canView(TaskAnalyticsDashboard dashboard, SecurityUser user) {
        if (dashboard.getOwnerId().equals(user.getUserId())) return true;
        if ("tenant".equals(dashboard.getScopeType())) return true;
        return "group".equals(dashboard.getScopeType()) && dashboard.getOwnerGroupId() != null
            && visibilityService.groupIds(user).contains(dashboard.getOwnerGroupId());
    }

    private boolean canManage(TaskAnalyticsDashboard dashboard, SecurityUser user) {
        return dashboard.getOwnerId().equals(user.getUserId()) || visibilityService.isTenantScope(user);
    }

    private AnalyticsDashboardVO toVO(TaskAnalyticsDashboard value, SecurityUser user, boolean includeWidgets) {
        List<AnalyticsWidgetVO> widgets = includeWidgets ? widgetMapper.selectList(new LambdaQueryWrapper<TaskAnalyticsWidget>()
            .eq(TaskAnalyticsWidget::getTenantId, value.getTenantId()).eq(TaskAnalyticsWidget::getDashboardId, value.getId())
            .orderByAsc(TaskAnalyticsWidget::getSortOrder).orderByAsc(TaskAnalyticsWidget::getId)).stream().map(this::toVO).toList() : List.of();
        return new AnalyticsDashboardVO(value.getId(), value.getCode(), value.getName(), value.getDescription(),
            value.getScopeType(), value.getOwnerId(), value.getOwnerGroupId(), copy(value.getLayoutConfig()), widgets,
            canManage(value, user), value.getCreatedAt(), value.getUpdatedAt());
    }

    private AnalyticsWidgetVO toVO(TaskAnalyticsWidget value) {
        return new AnalyticsWidgetVO(value.getId(), value.getDashboardId(), value.getWidgetType(), value.getTitle(),
            copy(value.getDataSourceConfig()), copy(value.getDisplayConfig()), value.getSortOrder(), value.getUpdatedAt());
    }

    private void validateScope(SecurityUser user, String scope, Long groupId) {
        if ("tenant".equals(scope) && !visibilityService.isTenantScope(user)) {
            throw BusinessException.forbidden("ANALYTICS_TENANT_SHARE_DENIED", "只有租户范围管理员可以共享到全租户");
        }
        if ("group".equals(scope) && (groupId == null || !visibilityService.groupIds(user).contains(groupId)
                && !visibilityService.isTenantScope(user))) {
            throw BusinessException.forbidden("ANALYTICS_GROUP_SHARE_DENIED", "只能共享到当前用户有权管理的组");
        }
    }

    private String scope(String value) {
        String result = StringUtils.hasText(value) ? value : "private";
        if (!SCOPES.contains(result)) throw BusinessException.badRequest("ANALYTICS_SCOPE_INVALID", "看板共享范围无效");
        return result;
    }

    private void validateWidget(AnalyticsWidgetRequest request) {
        if (!WIDGET_TYPES.contains(request.widgetType())) {
            throw BusinessException.badRequest("ANALYTICS_WIDGET_TYPE_INVALID", "不支持的统计组件类型");
        }
        if (request.dataSourceConfig().size() > 30) {
            throw BusinessException.badRequest("ANALYTICS_WIDGET_CONFIG_INVALID", "统计组件数据源配置过于复杂");
        }
    }

    private void apply(TaskAnalyticsWidget widget, AnalyticsWidgetRequest request) {
        widget.setWidgetType(request.widgetType());
        widget.setTitle(request.title().trim());
        widget.setDataSourceConfig(copy(request.dataSourceConfig()));
        widget.setDisplayConfig(copy(request.displayConfig()));
        widget.setSortOrder(request.sortOrder() == null ? 0 : request.sortOrder());
    }

    private void touch(Long dashboardId, Long userId) {
        TaskAnalyticsDashboard dashboard = dashboardMapper.selectById(dashboardId);
        dashboard.setUpdatedBy(userId);
        dashboard.setUpdatedAt(LocalDateTime.now());
        dashboardMapper.updateById(dashboard);
    }

    private TaskAnalyticsDashboard snapshot(TaskAnalyticsDashboard value) {
        return objectMapper.convertValue(value, TaskAnalyticsDashboard.class);
    }

    private TaskAnalyticsWidget widgetSnapshot(TaskAnalyticsWidget value) {
        return objectMapper.convertValue(value, TaskAnalyticsWidget.class);
    }

    private Map<String, Object> copy(Map<String, Object> value) {
        return value == null ? new LinkedHashMap<>() : new LinkedHashMap<>(value);
    }

    private void audit(SecurityUser user, String action, Long targetId, Object before, Object after, String remark) {
        auditLogMapper.insert(AuditLog.builder().tenantId(user.getTenantId()).module("task_analytics")
            .action(action).targetId(targetId).targetType("task_analytics_dashboard")
            .operatorId(user.getUserId()).beforeJson(json(before)).afterJson(json(after))
            .remark(remark).createdAt(LocalDateTime.now()).build());
    }

    private String json(Object value) {
        if (value == null) return null;
        try { return objectMapper.writeValueAsString(value); }
        catch (JsonProcessingException exception) { throw new IllegalStateException("统计看板审计序列化失败", exception); }
    }
}
