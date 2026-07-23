package com.cwgsyw.platform.module.task.plan.service;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.task.plan.dto.AssignmentTarget;
import com.cwgsyw.platform.module.task.plan.dto.CiScopeRequest;
import com.cwgsyw.platform.module.task.plan.dto.CiScopeResolution;
import com.cwgsyw.platform.module.task.plan.dto.CiScopeSelection;
import com.cwgsyw.platform.module.task.plan.entity.TaskPlan;
import com.cwgsyw.platform.module.task.plan.entity.TaskPlanGeneration;
import com.cwgsyw.platform.module.task.plan.mapper.TaskPlanGenerationMapper;
import com.cwgsyw.platform.module.task.plan.mapper.TaskPlanMapper;
import com.cwgsyw.platform.module.task.plan.scheduler.TaskOccurrenceCalculator;
import com.cwgsyw.platform.module.task.template.entity.TaskTemplateVersion;
import com.cwgsyw.platform.module.task.template.mapper.TaskTemplateVersionMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class TaskPlanGenerator {
    private static final DateTimeFormatter KEY_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private final TaskPlanMapper planMapper;
    private final TaskPlanGenerationMapper generationMapper;
    private final TaskTemplateVersionMapper templateVersionMapper;
    private final TaskOccurrenceCalculator occurrenceCalculator;
    private final TaskAssignmentResolver assignmentResolver;
    private final CiScopeResolver ciScopeResolver;
    private final TaskGenerationExecutor executor;
    private final TransactionTemplate transactionTemplate;

    public int generateDuePlans(LocalDateTime now, int planLimit) {
        return planMapper.findDuePlans(now, planLimit).stream().mapToInt(plan -> {
            try {
                return generatePlan(plan, now);
            } catch (BusinessException exception) {
                if (!"ASSIGNMENT_TARGET_EMPTY".equals(exception.getErrorCode())) throw exception;
                log.info("Task plan {} has no active assignment targets; leaving its generation cursor unchanged", plan.getId());
                return 0;
            }
        }).sum();
    }

    public int generatePlan(TaskPlan plan, LocalDateTime now) {
        int aheadDays = plan.getGenerateAheadDays() == null ? 7 : plan.getGenerateAheadDays();
        LocalDateTime windowStart = plan.getLastGeneratedAt() == null
            ? now.toLocalDate().atStartOfDay()
            : plan.getLastGeneratedAt().plusNanos(1);
        if (plan.getStartDate() != null && plan.getStartDate().atStartOfDay().isAfter(windowStart)) {
            windowStart = plan.getStartDate().atStartOfDay();
        }
        LocalDateTime windowEnd = now.plusDays(aheadDays).withNano(0);
        if (plan.getEndDate() != null && plan.getEndDate().plusDays(1).atStartOfDay().minusNanos(1).isBefore(windowEnd)) {
            windowEnd = plan.getEndDate().plusDays(1).atStartOfDay().minusNanos(1);
        }
        List<LocalDateTime> occurrences = occurrenceCalculator.calculate(plan.getTenantId(), plan.getScheduleType(),
            plan.getScheduleConfig(), windowStart, windowEnd);
        TaskTemplateVersion template = templateVersionMapper.selectById(plan.getTemplateVersionId());
        if (template == null || !plan.getTenantId().equals(template.getTenantId())) {
            markPlanError(plan, now);
            return 0;
        }

        int generated = 0;
        for (LocalDateTime occurrence : occurrences) {
            List<AssignmentTarget> targets = assignmentResolver.resolve(plan.getTenantId(), plan.getGenerationMode(), plan.getAssignmentRule(), occurrence);
            CiScopeResolution ciScope = resolveCi(plan);
            for (AssignmentTarget target : targets) {
                String key = occurrenceKey(occurrence, target);
                TaskPlanGeneration generation = claim(plan, occurrence, target, key, now);
                if (generation == null) continue;
                try {
                    executor.createTask(plan, template, generation, target, ciScope, dueAt(plan, occurrence));
                    generated++;
                } catch (Exception exception) {
                    recordFailure(generation, exception);
                    log.error("Task generation failed for plan {} occurrence {}", plan.getId(), key, exception);
                }
            }
        }
        advancePlan(plan, now, windowEnd);
        return generated;
    }

    private TaskPlanGeneration claim(TaskPlan plan, LocalDateTime occurrence, AssignmentTarget target,
                                     String key, LocalDateTime now) {
        Integer claimed = transactionTemplate.execute(status -> generationMapper.claim(plan.getTenantId(), plan.getId(), key,
            occurrence, target.subjectType(), target.subjectId(), now));
        if (claimed != null && claimed == 0) {
            claimed = transactionTemplate.execute(status -> generationMapper.reclaim(plan.getTenantId(), plan.getId(), key,
                now, now.minusMinutes(10)));
        }
        if (claimed == null || claimed == 0) return null;
        return generationMapper.findByOccurrenceKey(plan.getTenantId(), plan.getId(), key);
    }

    private void recordFailure(TaskPlanGeneration generation, Exception exception) {
        transactionTemplate.executeWithoutResult(status -> {
            TaskPlanGeneration current = generationMapper.selectById(generation.getId());
            if (current == null) return;
            current.setStatus("failed");
            current.setErrorCode("TASK_GENERATION_FAILED");
            String message = exception.getMessage() == null ? exception.getClass().getSimpleName() : exception.getMessage();
            current.setErrorMessage(message.substring(0, Math.min(1000, message.length())));
            generationMapper.updateById(current);
        });
    }

    private void advancePlan(TaskPlan plan, LocalDateTime now, LocalDateTime windowEnd) {
        LocalDateTime next = occurrenceCalculator.next(plan.getTenantId(), plan.getScheduleType(), plan.getScheduleConfig(), windowEnd);
        transactionTemplate.executeWithoutResult(status -> {
            TaskPlan current = planMapper.selectById(plan.getId());
            if (current == null || !"active".equals(current.getStatus())) return;
            current.setLastGeneratedAt(now);
            if (next == null || current.getEndDate() != null && next.toLocalDate().isAfter(current.getEndDate())) {
                current.setStatus("finished");
                current.setNextGenerateAt(null);
            } else {
                current.setNextGenerateAt(next.minusDays(current.getGenerateAheadDays() == null ? 7 : current.getGenerateAheadDays()));
            }
            planMapper.updateById(current);
        });
    }

    private void markPlanError(TaskPlan plan, LocalDateTime now) {
        transactionTemplate.executeWithoutResult(status -> {
            plan.setStatus("paused");
            plan.setNextGenerateAt(null);
            plan.setLastGeneratedAt(now);
            planMapper.updateById(plan);
        });
    }

    @SuppressWarnings("unchecked")
    private CiScopeResolution resolveCi(TaskPlan plan) {
        Map<String, Object> config = plan.getCiScopeConfig();
        if (config == null || !(config.get("selections") instanceof List<?> raw) || raw.isEmpty()) return null;
        List<CiScopeSelection> selections = raw.stream().map(value -> {
            Map<String, Object> entry = (Map<String, Object>) value;
            return new CiScopeSelection(String.valueOf(entry.get("level")), String.valueOf(entry.get("key")));
        }).toList();
        Map<String, Object> filters = config.get("filters") instanceof Map<?, ?> values ? (Map<String, Object>) values : Map.of();
        return ciScopeResolver.resolve(plan.getTenantId(), new CiScopeRequest(selections, filters, CiScopeResolver.MAX_RESOLUTION_SIZE));
    }

    private LocalDateTime dueAt(TaskPlan plan, LocalDateTime occurrence) {
        Object raw = plan.getScheduleConfig().get("dueAfterHours");
        long hours = raw instanceof Number number ? number.longValue() : raw == null ? 24 : Long.parseLong(String.valueOf(raw));
        return occurrence.plusHours(hours);
    }

    private String occurrenceKey(LocalDateTime occurrence, AssignmentTarget target) {
        return KEY_TIME.format(occurrence) + ':' + target.subjectType() + ':' + (target.subjectId() == null ? "shared" : target.subjectId());
    }
}
