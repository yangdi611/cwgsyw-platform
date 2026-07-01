package com.cwgsyw.platform.module.daily;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.CiInstanceBriefVO;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.daily.dto.*;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DailyReportService {
    private final DailyReportMapper reportMapper;
    private final com.cwgsyw.platform.module.workflow.runtime.WorkflowRuntimeFacade workflowRuntimeFacade;
    private final UserMapper userMapper;
    private final GroupMapper groupMapper;
    private final AuditLogMapper auditLogMapper;
    private final CiInstanceMapper ciInstanceMapper;
    private final CiModelMapper ciModelMapper;
    private final com.cwgsyw.platform.module.notification.NotificationService notificationService;

    public PageResult<DailyReportVO> listMyReports(Long userId, String month, int page, int size) {
        LambdaQueryWrapper<DailyReport> query = new LambdaQueryWrapper<DailyReport>()
            .eq(DailyReport::getReporterId, userId)
            .eq(DailyReport::getIsDeleted, false)
            .orderByDesc(DailyReport::getReportDate);
        if (month != null && !month.isBlank()) {
            // month format: "2026-05"
            LocalDate start = LocalDate.parse(month + "-01");
            LocalDate end = start.withDayOfMonth(start.lengthOfMonth());
            query.between(DailyReport::getReportDate, start, end);
        }
        Page<DailyReport> p = reportMapper.selectPage(new Page<>(page, size), query);
        return PageResult.of(p.convert(this::toVO));
    }

    public PageResult<DailyReportVO> listGroupReports(Long groupId, String status, String month, int page, int size) {
        LambdaQueryWrapper<DailyReport> query = new LambdaQueryWrapper<DailyReport>()
            .eq(DailyReport::getIsDeleted, false)
            .orderByDesc(DailyReport::getReportDate);
        if (groupId != null) query.eq(DailyReport::getGroupId, groupId);
        if (status != null) query.eq(DailyReport::getStatus, status);
        if (month != null && !month.isBlank()) {
            LocalDate start = LocalDate.parse(month + "-01");
            LocalDate end = start.withDayOfMonth(start.lengthOfMonth());
            query.between(DailyReport::getReportDate, start, end);
        }
        return PageResult.of(reportMapper.selectPage(new Page<>(page, size), query).convert(this::toVO));
    }

    @Transactional
    public DailyReport create(CreateDailyReportRequest req, Long userId, Long groupId, String tenantId) {
        reportMapper.findByReporterAndDate(userId, req.getReportDate()).ifPresent(r -> {
            throw new IllegalArgumentException("该日期已有日报，请编辑现有日报");
        });
        DailyReport report = new DailyReport();
        report.setTenantId(tenantId);
        report.setGroupId(groupId);
        report.setReporterId(userId);
        report.setReportDate(req.getReportDate());
        report.setCompletedItems(req.getCompletedItems());
        report.setIssues(req.getIssues());
        report.setTomorrowPlan(req.getTomorrowPlan());
        report.setWorkHours(req.getWorkHours());
        report.setStatus("DRAFT");
        report.setCiInstanceIds(req.getCiInstanceIds());
        reportMapper.insert(report);
        return report;
    }

    @Transactional
    public void update(Long id, CreateDailyReportRequest req, Long userId) {
        DailyReport report = getAndCheckOwner(id, userId);
        if (!"DRAFT".equals(report.getStatus()) && !"REJECTED".equals(report.getStatus())) {
            throw new IllegalArgumentException("只能修改草稿或被拒绝的日报");
        }
        report.setCompletedItems(req.getCompletedItems());
        report.setIssues(req.getIssues());
        report.setTomorrowPlan(req.getTomorrowPlan());
        report.setWorkHours(req.getWorkHours());
        report.setCiInstanceIds(req.getCiInstanceIds());
        reportMapper.updateById(report);
    }

    @Transactional
    public void submit(Long id, Long userId) {
        DailyReport report = getAndCheckOwner(id, userId);
        if (!"DRAFT".equals(report.getStatus()) && !"REJECTED".equals(report.getStatus())) {
            throw new IllegalArgumentException("只能提交草稿或被拒绝的日报");
        }
        // 通过统一流程门面启动（daily_report 已全量迁移）。绑定缺失时门面抛异常，
        // 事务回滚，日报保持原状态，提交失败可重试。
        var instance = workflowRuntimeFacade.startBusinessProcess(
            com.cwgsyw.platform.module.workflow.runtime.WorkflowStartCommand.builder()
                .tenantId(report.getTenantId())
                .businessType("daily_report")
                .businessId(String.valueOf(id))
                .submitterId(userId)
                .build());
        report.setStatus("SUBMITTED");
        report.setProcessInstId(instance.getProcessInstanceId());
        reportMapper.updateById(report);
        // Notify all other users in the group that a report awaits approval
        var allInGroup = userMapper.selectList(
            new LambdaQueryWrapper<com.cwgsyw.platform.module.user.entity.User>()
                .eq(com.cwgsyw.platform.module.user.entity.User::getGroupId, report.getGroupId())
                .eq(com.cwgsyw.platform.module.user.entity.User::getIsDeleted, false));
        String reporterName = allInGroup.stream()
            .filter(u -> u.getId().equals(userId))
            .findFirst()
            .map(u -> u.getRealName() != null ? u.getRealName() : u.getUsername())
            .orElse("组员");
        allInGroup.stream()
            .filter(u -> !u.getId().equals(userId))
            .forEach(u -> notificationService.notify(
                report.getTenantId(), u.getId(),
                "日报待审批",
                reporterName + " 提交了 " + report.getReportDate() + " 的工作日报，请审批。",
                "daily_report_submit", "daily_report", report.getId()));
    }

    @Transactional
    public DailyReport updateStatusByProcessInstAndReturn(String processInstId, String status) {
        DailyReport report = reportMapper.selectOne(
            new LambdaQueryWrapper<DailyReport>()
                .eq(DailyReport::getProcessInstId, processInstId));
        if (report == null) return null;
        String oldStatus = report.getStatus();
        report.setStatus(status);
        reportMapper.updateById(report);
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(report.getTenantId())
            .module("daily_report")
            .action("APPROVED".equals(status) ? "approve" : "reject")
            .targetId(report.getId())
            .targetType("daily_report")
            .operatorId(0L)
            .remark("processInst=" + processInstId + ", " + oldStatus + " -> " + status)
            .createdAt(LocalDateTime.now())
            .build());
        return report;
    }

    @Transactional
    public void updateStatusByProcessInst(String processInstId, String status) {
        updateStatusByProcessInstAndReturn(processInstId, status);
    }

    public DailyReportVO getById(Long id, String tenantId) {
        DailyReport report = reportMapper.selectById(id);
        if (report == null || report.getIsDeleted()) {
            throw new IllegalArgumentException("日报不存在");
        }
        if (!report.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("日报不存在");
        }
        return toVO(report);
    }

    private DailyReport getAndCheckOwner(Long id, Long userId) {
        DailyReport report = reportMapper.selectById(id);
        if (report == null || report.getIsDeleted()) throw new IllegalArgumentException("日报不存在");
        if (!report.getReporterId().equals(userId)) throw new IllegalArgumentException("无权操作他人日报");
        return report;
    }

    private DailyReportVO toVO(DailyReport r) {
        DailyReportVO vo = new DailyReportVO();
        vo.setId(r.getId());
        vo.setGroupId(r.getGroupId());
        vo.setReporterId(r.getReporterId());
        vo.setReportDate(r.getReportDate());
        vo.setCompletedItems(r.getCompletedItems());
        vo.setIssues(r.getIssues());
        vo.setTomorrowPlan(r.getTomorrowPlan());
        vo.setWorkHours(r.getWorkHours());
        vo.setStatus(r.getStatus());
        vo.setCreatedAt(r.getCreatedAt());
        vo.setUpdatedAt(r.getUpdatedAt());
        var user = userMapper.selectById(r.getReporterId());
        if (user != null) vo.setReporterName(user.getRealName() != null ? user.getRealName() : user.getUsername());
        var group = groupMapper.selectById(r.getGroupId());
        if (group != null) vo.setGroupName(group.getName());
        vo.setCiInstanceIds(r.getCiInstanceIds());
        // Populate CI instance brief info
        if (r.getCiInstanceIds() != null && !r.getCiInstanceIds().isEmpty()) {
            List<CiInstance> instances = ciInstanceMapper.selectBatchIds(r.getCiInstanceIds());
            // Build modelId -> modelName map
            Set<String> modelIds = instances.stream()
                .map(CiInstance::getModelId)
                .collect(Collectors.toSet());
            Map<String, String> modelNames = modelIds.isEmpty()
                ? Map.of()
                : ciModelMapper.selectList(
                    new LambdaQueryWrapper<CiModel>().in(CiModel::getName, modelIds)
                ).stream().collect(Collectors.toMap(CiModel::getName, CiModel::getDisplayName));
            List<CiInstanceBriefVO> cis = instances.stream().map(inst -> {
                CiInstanceBriefVO civ = new CiInstanceBriefVO();
                civ.setId(inst.getId());
                civ.setName(inst.getName());
                civ.setModelId(inst.getModelId());
                civ.setModelName(modelNames.getOrDefault(inst.getModelId(), inst.getModelId()));
                return civ;
            }).collect(Collectors.toList());
            vo.setCiInstances(cis);
        }
        return vo;
    }
}
