package com.cwgsyw.platform.module.daily;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.daily.dto.*;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.workflow.WorkflowService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class DailyReportService {
    private final DailyReportMapper reportMapper;
    private final WorkflowService workflowService;
    private final UserMapper userMapper;
    private final GroupMapper groupMapper;

    public PageResult<DailyReportVO> listMyReports(Long userId, int page, int size) {
        Page<DailyReport> p = reportMapper.selectPage(new Page<>(page, size),
            new LambdaQueryWrapper<DailyReport>()
                .eq(DailyReport::getReporterId, userId)
                .eq(DailyReport::getIsDeleted, false)
                .orderByDesc(DailyReport::getReportDate));
        return PageResult.of(p.convert(this::toVO));
    }

    public PageResult<DailyReportVO> listGroupReports(Long groupId, String status, int page, int size) {
        LambdaQueryWrapper<DailyReport> query = new LambdaQueryWrapper<DailyReport>()
            .eq(DailyReport::getGroupId, groupId)
            .eq(DailyReport::getIsDeleted, false)
            .orderByDesc(DailyReport::getReportDate);
        if (status != null) query.eq(DailyReport::getStatus, status);
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
        reportMapper.updateById(report);
    }

    @Transactional
    public void submit(Long id, Long userId) {
        DailyReport report = getAndCheckOwner(id, userId);
        if (!"DRAFT".equals(report.getStatus()) && !"REJECTED".equals(report.getStatus())) {
            throw new IllegalArgumentException("只能提交草稿或被拒绝的日报");
        }
        String processInstId = workflowService.startDailyReportApproval(id, report.getGroupId());
        report.setStatus("SUBMITTED");
        report.setProcessInstId(processInstId);
        reportMapper.updateById(report);
    }

    public void updateStatusByProcessInst(String processInstId, String status) {
        DailyReport report = reportMapper.selectOne(
            new LambdaQueryWrapper<DailyReport>()
                .eq(DailyReport::getProcessInstId, processInstId));
        if (report != null) {
            report.setStatus(status);
            reportMapper.updateById(report);
        }
    }

    public DailyReportVO getById(Long id) {
        DailyReport report = reportMapper.selectById(id);
        if (report == null || report.getIsDeleted()) {
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
        return vo;
    }
}
