package com.cwgsyw.platform.module.task.plan.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.spring.service.impl.ServiceImpl;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.approval.entity.ApprovalSchemeVersion;
import com.cwgsyw.platform.module.approval.mapper.ApprovalSchemeVersionMapper;
import com.cwgsyw.platform.module.task.plan.dto.CiScopeRequest;
import com.cwgsyw.platform.module.task.plan.dto.CiScopeResolution;
import com.cwgsyw.platform.module.task.plan.dto.CiScopeSelection;
import com.cwgsyw.platform.module.task.plan.dto.TaskPlanDetailVO;
import com.cwgsyw.platform.module.task.plan.dto.TaskPlanGenerationVO;
import com.cwgsyw.platform.module.task.plan.dto.TaskPlanOccurrencePreview;
import com.cwgsyw.platform.module.task.plan.dto.TaskPlanPreviewRequest;
import com.cwgsyw.platform.module.task.plan.dto.TaskPlanPreviewVO;
import com.cwgsyw.platform.module.task.plan.dto.TaskPlanSummaryVO;
import com.cwgsyw.platform.module.task.plan.dto.UpsertTaskPlanRequest;
import com.cwgsyw.platform.module.task.plan.entity.TaskPlan;
import com.cwgsyw.platform.module.task.plan.entity.TaskPlanGeneration;
import com.cwgsyw.platform.module.task.plan.mapper.TaskPlanGenerationMapper;
import com.cwgsyw.platform.module.task.plan.mapper.TaskPlanMapper;
import com.cwgsyw.platform.module.task.plan.scheduler.TaskOccurrenceCalculator;
import com.cwgsyw.platform.module.task.plan.service.CiScopeResolver;
import com.cwgsyw.platform.module.task.plan.service.TaskAssignmentResolver;
import com.cwgsyw.platform.module.task.plan.service.TaskPlanService;
import com.cwgsyw.platform.module.task.template.entity.TaskTemplateVersion;
import com.cwgsyw.platform.module.task.template.mapper.TaskTemplateVersionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TaskPlanServiceImpl extends ServiceImpl<TaskPlanMapper, TaskPlan> implements TaskPlanService {
    private static final Set<String> SCHEDULE_TYPES = Set.of("once", "daily", "weekly", "monthly", "quarterly", "semiannual", "yearly", "cron", "holiday_relative");
    private static final Set<String> GENERATION_MODES = Set.of("per_user", "per_group", "shared", "single");

    private final TaskTemplateVersionMapper templateVersionMapper;
    private final ApprovalSchemeVersionMapper approvalSchemeVersionMapper;
    private final TaskPlanGenerationMapper generationMapper;
    private final TaskOccurrenceCalculator occurrenceCalculator;
    private final TaskAssignmentResolver assignmentResolver;
    private final CiScopeResolver ciScopeResolver;

    @Override
    public PageResult<TaskPlanSummaryVO> list(String tenantId, String keyword, String status, int page, int size) {
        int safePage = Math.max(1, page);
        int safeSize = Math.min(200, Math.max(1, size));
        LambdaQueryWrapper<TaskPlan> query = new LambdaQueryWrapper<TaskPlan>()
            .eq(TaskPlan::getTenantId, tenantId)
            .eq(StringUtils.hasText(status), TaskPlan::getStatus, status)
            .and(StringUtils.hasText(keyword), wrapper -> wrapper.like(TaskPlan::getName, keyword).or().like(TaskPlan::getDescription, keyword))
            .orderByDesc(TaskPlan::getUpdatedAt).orderByDesc(TaskPlan::getId);
        Page<TaskPlan> result = page(new Page<>(safePage, safeSize), query);
        PageResult<TaskPlanSummaryVO> response = new PageResult<>();
        response.setRecords(result.getRecords().stream().map(this::toSummary).toList());
        response.setTotal(result.getTotal());
        response.setPage(result.getCurrent());
        response.setSize(result.getSize());
        return response;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TaskPlanDetailVO create(String tenantId, Long userId, UpsertTaskPlanRequest request) {
        validateRequest(tenantId, request);
        TaskPlan plan = new TaskPlan();
        plan.setTenantId(tenantId);
        apply(plan, request);
        plan.setStatus("draft");
        plan.setLockVersion(0);
        plan.setCreatedBy(userId);
        plan.setUpdatedBy(userId);
        plan.setIsDeleted(false);
        save(plan);
        return toDetail(plan);
    }

    @Override
    public TaskPlanDetailVO get(String tenantId, Long planId) {
        return toDetail(requirePlan(tenantId, planId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TaskPlanDetailVO update(String tenantId, Long userId, Long planId, UpsertTaskPlanRequest request) {
        TaskPlan plan = requirePlan(tenantId, planId);
        if (!Set.of("draft", "paused").contains(plan.getStatus())) {
            throw conflict("TASK_PLAN_NOT_EDITABLE", "仅草稿或已暂停计划可编辑");
        }
        validateRequest(tenantId, request);
        apply(plan, request);
        plan.setNextGenerateAt(null);
        plan.setUpdatedBy(userId);
        updateById(plan);
        return toDetail(requirePlan(tenantId, planId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(String tenantId, Long userId, Long planId) {
        TaskPlan plan = requirePlan(tenantId, planId);
        if (!"draft".equals(plan.getStatus())) {
            throw conflict("TASK_PLAN_DELETE_FORBIDDEN", "仅草稿计划可删除；其他计划请归档");
        }
        plan.setDeletedAt(LocalDateTime.now());
        plan.setDeletedBy(userId);
        updateById(plan);
        removeById(planId);
    }

    @Override
    public TaskPlanPreviewVO preview(String tenantId, TaskPlanPreviewRequest request) {
        TaskTemplateVersion template = requireTemplateVersion(tenantId, request.templateVersionId());
        requireApprovalVersion(tenantId, request.approvalSchemeVersionId());
        validateCommon(tenantId, request.scheduleType(), request.scheduleConfig(), request.generationMode(), request.startDate(), request.endDate());
        int count = request.previewCount() == null ? 10 : request.previewCount();
        LocalDate startDate = request.startDate() == null ? LocalDate.now() : request.startDate();
        LocalDate endDate = request.endDate() == null ? startDate.plusYears(2) : request.endDate();
        List<LocalDateTime> occurrences = occurrenceCalculator.calculate(tenantId, request.scheduleType(), request.scheduleConfig(),
            startDate.atStartOfDay(), endDate.plusDays(1).atStartOfDay().minusNanos(1)).stream().limit(count).toList();
        if (occurrences.isEmpty()) throw BusinessException.badRequest("PLAN_HAS_NO_OCCURRENCE", "当前日期范围内没有可生成的任务时间");

        CiScopeResolution ciResolution = resolveCi(tenantId, request.ciScopeConfig(), 20);
        List<TaskPlanOccurrencePreview> previews = new ArrayList<>();
        int total = 0;
        Set<String> warnings = new LinkedHashSet<>();
        if (ciResolution != null) warnings.addAll(ciResolution.warnings());
        for (LocalDateTime occurrence : occurrences) {
            var targets = assignmentResolver.resolve(tenantId, request.generationMode(), request.assignmentRule(), occurrence);
            LocalDateTime dueAt = dueAt(occurrence, request.scheduleConfig());
            previews.add(new TaskPlanOccurrencePreview(occurrence, dueAt, targets.size(), targets,
                ciResolution == null ? 0 : ciResolution.total(), ciResolution == null ? List.of() : ciResolution.warnings()));
            total += targets.size();
        }
        return new TaskPlanPreviewVO(template.getNameSnapshot(), previews, total, List.copyOf(warnings));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TaskPlanDetailVO activate(String tenantId, Long userId, Long planId) {
        TaskPlan plan = requirePlan(tenantId, planId);
        if (!Set.of("draft", "paused").contains(plan.getStatus())) throw conflict("TASK_PLAN_ACTIVATE_FORBIDDEN", "当前状态不可激活");
        requirePublishedTemplateVersion(tenantId, plan.getTemplateVersionId());
        requirePublishedApprovalVersion(tenantId, plan.getApprovalSchemeVersionId());
        preview(tenantId, toPreviewRequest(plan, 1));
        LocalDateTime from = activationCursor(plan);
        LocalDateTime next = occurrenceCalculator.next(tenantId, plan.getScheduleType(), plan.getScheduleConfig(), from.minusNanos(1));
        if (next == null || plan.getEndDate() != null && next.toLocalDate().isAfter(plan.getEndDate())) {
            throw BusinessException.badRequest("PLAN_HAS_NO_FUTURE_OCCURRENCE", "计划没有未来执行时间");
        }
        plan.setStatus("active");
        plan.setNextGenerateAt(next.minusDays(defaultAhead(plan.getGenerateAheadDays())));
        plan.setUpdatedBy(userId);
        updateById(plan);
        return toDetail(requirePlan(tenantId, planId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TaskPlanDetailVO pause(String tenantId, Long userId, Long planId) {
        TaskPlan plan = requirePlan(tenantId, planId);
        if (!"active".equals(plan.getStatus())) throw conflict("TASK_PLAN_PAUSE_FORBIDDEN", "仅生效中的计划可暂停");
        plan.setStatus("paused");
        plan.setNextGenerateAt(null);
        plan.setUpdatedBy(userId);
        updateById(plan);
        return toDetail(requirePlan(tenantId, planId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TaskPlanDetailVO archive(String tenantId, Long userId, Long planId) {
        TaskPlan plan = requirePlan(tenantId, planId);
        if ("archived".equals(plan.getStatus())) return toDetail(plan);
        plan.setStatus("archived");
        plan.setNextGenerateAt(null);
        plan.setUpdatedBy(userId);
        updateById(plan);
        return toDetail(requirePlan(tenantId, planId));
    }

    @Override
    public List<TaskPlanGenerationVO> generations(String tenantId, Long planId) {
        requirePlan(tenantId, planId);
        return generationMapper.selectList(new LambdaQueryWrapper<TaskPlanGeneration>()
            .eq(TaskPlanGeneration::getTenantId, tenantId).eq(TaskPlanGeneration::getPlanId, planId)
            .orderByDesc(TaskPlanGeneration::getOccurrenceAt).orderByDesc(TaskPlanGeneration::getId)).stream()
            .map(this::toGeneration).toList();
    }

    private void validateRequest(String tenantId, UpsertTaskPlanRequest request) {
        requireTemplateVersion(tenantId, request.templateVersionId());
        requireApprovalVersion(tenantId, request.approvalSchemeVersionId());
        validateCommon(tenantId, request.scheduleType(), request.scheduleConfig(), request.generationMode(), request.startDate(), request.endDate());
        TaskPlanPreviewRequest preview = new TaskPlanPreviewRequest(request.templateVersionId(), request.approvalSchemeVersionId(),
            request.scheduleType(), request.scheduleConfig(), request.generationMode(), request.assignmentRule(), request.ciScopeConfig(),
            request.startDate(), request.endDate(), 1);
        preview(tenantId, preview);
    }

    private void validateCommon(String tenantId, String scheduleType, Map<String, Object> scheduleConfig, String generationMode,
                                LocalDate startDate, LocalDate endDate) {
        if (!SCHEDULE_TYPES.contains(scheduleType)) throw BusinessException.badRequest("UNSUPPORTED_SCHEDULE_TYPE", "不支持的周期类型");
        if (!GENERATION_MODES.contains(generationMode)) throw BusinessException.badRequest("INVALID_GENERATION_MODE", "不支持的生成模式");
        if (startDate != null && endDate != null && endDate.isBefore(startDate)) {
            throw BusinessException.badRequest("INVALID_PLAN_DATE_RANGE", "结束日期不能早于开始日期");
        }
        LocalDate probeStart = startDate == null ? LocalDate.now() : startDate;
        LocalDate probeEnd = endDate == null ? probeStart.plusYears(2) : endDate;
        occurrenceCalculator.calculate(tenantId, scheduleType, scheduleConfig,
            probeStart.atStartOfDay(), probeEnd.plusDays(1).atStartOfDay().minusNanos(1));
    }

    private TaskPlan requirePlan(String tenantId, Long planId) {
        TaskPlan plan = getOne(new LambdaQueryWrapper<TaskPlan>().eq(TaskPlan::getTenantId, tenantId).eq(TaskPlan::getId, planId));
        if (plan == null) throw notFound("TASK_PLAN_NOT_FOUND", "任务计划不存在");
        return plan;
    }

    private TaskTemplateVersion requireTemplateVersion(String tenantId, Long versionId) {
        TaskTemplateVersion version = templateVersionMapper.selectOne(new LambdaQueryWrapper<TaskTemplateVersion>()
            .eq(TaskTemplateVersion::getTenantId, tenantId).eq(TaskTemplateVersion::getId, versionId));
        if (version == null) throw notFound("TASK_TEMPLATE_VERSION_NOT_FOUND", "模板版本不存在");
        return version;
    }

    private TaskTemplateVersion requirePublishedTemplateVersion(String tenantId, Long versionId) {
        TaskTemplateVersion version = requireTemplateVersion(tenantId, versionId);
        if (!"published".equals(version.getStatus())) throw conflict("TASK_TEMPLATE_NOT_PUBLISHED", "计划只能激活已发布模板版本");
        return version;
    }

    private ApprovalSchemeVersion requireApprovalVersion(String tenantId, Long versionId) {
        if (versionId == null) return null;
        ApprovalSchemeVersion version = approvalSchemeVersionMapper.selectOne(new LambdaQueryWrapper<ApprovalSchemeVersion>()
            .eq(ApprovalSchemeVersion::getTenantId, tenantId).eq(ApprovalSchemeVersion::getId, versionId));
        if (version == null) throw notFound("APPROVAL_SCHEME_VERSION_NOT_FOUND", "审批方案版本不存在");
        return version;
    }

    private void requirePublishedApprovalVersion(String tenantId, Long versionId) {
        ApprovalSchemeVersion version = requireApprovalVersion(tenantId, versionId);
        if (version != null && !"published".equals(version.getStatus())) {
            throw conflict("APPROVAL_SCHEME_NOT_PUBLISHED", "计划只能激活已发布审批方案版本");
        }
    }

    @SuppressWarnings("unchecked")
    private CiScopeResolution resolveCi(String tenantId, Map<String, Object> config, int limit) {
        if (config == null || config.isEmpty()) return null;
        Object rawSelections = config.get("selections");
        if (!(rawSelections instanceof List<?> list) || list.isEmpty()) return null;
        List<CiScopeSelection> selections = list.stream().map(value -> {
            if (!(value instanceof Map<?, ?> map)) throw BusinessException.badRequest("INVALID_CI_SCOPE", "CI selections 格式无效");
            return new CiScopeSelection(String.valueOf(map.get("level")), String.valueOf(map.get("key")));
        }).toList();
        Map<String, Object> filters = config.get("filters") instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
        return ciScopeResolver.resolve(tenantId, new CiScopeRequest(selections, filters, limit));
    }

    private void apply(TaskPlan plan, UpsertTaskPlanRequest request) {
        plan.setName(request.name());
        plan.setDescription(request.description());
        plan.setTemplateVersionId(request.templateVersionId());
        plan.setApprovalSchemeVersionId(request.approvalSchemeVersionId());
        plan.setScheduleType(request.scheduleType());
        plan.setScheduleConfig(Map.copyOf(request.scheduleConfig()));
        plan.setGenerationMode(request.generationMode());
        plan.setAssignmentRule(Map.copyOf(request.assignmentRule()));
        plan.setCiScopeConfig(copy(request.ciScopeConfig()));
        plan.setReminderConfig(copy(request.reminderConfig()));
        plan.setEscalationConfig(copy(request.escalationConfig()));
        plan.setGenerateAheadDays(request.generateAheadDays() == null ? 7 : request.generateAheadDays());
        plan.setStartDate(request.startDate());
        plan.setEndDate(request.endDate());
    }

    private Map<String, Object> copy(Map<String, Object> value) {
        return value == null ? null : Map.copyOf(value);
    }

    private TaskPlanPreviewRequest toPreviewRequest(TaskPlan plan, int count) {
        return new TaskPlanPreviewRequest(plan.getTemplateVersionId(), plan.getApprovalSchemeVersionId(), plan.getScheduleType(),
            plan.getScheduleConfig(), plan.getGenerationMode(), plan.getAssignmentRule(), plan.getCiScopeConfig(),
            plan.getStartDate(), plan.getEndDate(), count);
    }

    private LocalDateTime activationCursor(TaskPlan plan) {
        LocalDate start = plan.getStartDate();
        LocalDateTime now = LocalDateTime.now();
        return start != null && start.atStartOfDay().isAfter(now) ? start.atStartOfDay() : now;
    }

    private LocalDateTime dueAt(LocalDateTime occurrence, Map<String, Object> scheduleConfig) {
        Object raw = scheduleConfig.get("dueAfterHours");
        long hours = raw instanceof Number number ? number.longValue() : raw == null ? 24 : Long.parseLong(String.valueOf(raw));
        if (hours < 0 || hours > 8760) throw BusinessException.badRequest("INVALID_DUE_OFFSET", "dueAfterHours 必须在 0 到 8760 之间");
        return occurrence.plusHours(hours);
    }

    private int defaultAhead(Integer value) {
        return value == null ? 7 : value;
    }

    private TaskPlanSummaryVO toSummary(TaskPlan plan) {
        TaskTemplateVersion template = templateVersionMapper.selectById(plan.getTemplateVersionId());
        return new TaskPlanSummaryVO(plan.getId(), plan.getName(), plan.getDescription(), plan.getTemplateVersionId(),
            template == null ? null : template.getNameSnapshot(), plan.getScheduleType(), plan.getGenerationMode(), plan.getStatus(),
            plan.getNextGenerateAt(), plan.getLastGeneratedAt(), plan.getCreatedAt(), plan.getUpdatedAt());
    }

    private TaskPlanDetailVO toDetail(TaskPlan plan) {
        TaskTemplateVersion template = templateVersionMapper.selectById(plan.getTemplateVersionId());
        return new TaskPlanDetailVO(plan.getId(), plan.getName(), plan.getDescription(), plan.getTemplateVersionId(),
            template == null ? null : template.getNameSnapshot(), plan.getApprovalSchemeVersionId(), plan.getScheduleType(),
            plan.getScheduleConfig(), plan.getGenerationMode(), plan.getAssignmentRule(), plan.getCiScopeConfig(),
            plan.getReminderConfig(), plan.getEscalationConfig(), plan.getGenerateAheadDays(), plan.getStartDate(), plan.getEndDate(),
            plan.getStatus(), plan.getNextGenerateAt(), plan.getLastGeneratedAt(), plan.getLockVersion(), plan.getCreatedAt(), plan.getUpdatedAt());
    }

    private TaskPlanGenerationVO toGeneration(TaskPlanGeneration generation) {
        return new TaskPlanGenerationVO(generation.getId(), generation.getOccurrenceKey(), generation.getOccurrenceAt(),
            generation.getSubjectType(), generation.getSubjectId(), generation.getStatus(), generation.getTaskId(),
            generation.getErrorCode(), generation.getErrorMessage(), generation.getAttemptCount(), generation.getLastAttemptAt());
    }

    private BusinessException notFound(String code, String message) {
        return new BusinessException(HttpStatus.NOT_FOUND, code, message);
    }

    private BusinessException conflict(String code, String message) {
        return new BusinessException(HttpStatus.CONFLICT, code, message);
    }
}
