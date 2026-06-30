package com.cwgsyw.platform.module.opscalendar.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.opscalendar.dto.ReportMaterialVO;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTask;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTaskLink;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTaskLinkMapper;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTaskMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 季报/半年报素材归集服务（spec 5.12）。第一版返回素材清单，不自动生成正式报告。
 */
@Service
@RequiredArgsConstructor
public class OpsCalendarMaterialService {

    private final OpsScheduleTaskMapper taskMapper;
    private final OpsScheduleTaskLinkMapper linkMapper;
    private final UserMapper userMapper;

    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    public ReportMaterialVO collect(String tenantId, String periodType, LocalDate startDate,
                                    LocalDate endDate, Long groupId) {
        if (startDate == null || endDate == null) throw new IllegalArgumentException("startDate/endDate 必填");

        LambdaQueryWrapper<OpsScheduleTask> qw = new LambdaQueryWrapper<OpsScheduleTask>()
                .eq(OpsScheduleTask::getTenantId, tenantId)
                .ge(OpsScheduleTask::getPlannedStartAt, startDate.atStartOfDay())
                .lt(OpsScheduleTask::getPlannedStartAt, endDate.plusDays(1).atStartOfDay())
                .eq(groupId != null, OpsScheduleTask::getGroupId, groupId)
                .orderByDesc(OpsScheduleTask::getCompletedAt);
        List<OpsScheduleTask> tasks = taskMapper.selectList(qw);

        ReportMaterialVO vo = new ReportMaterialVO();
        vo.setPeriodType(periodType);
        vo.setStartDate(startDate.toString());
        vo.setEndDate(endDate.toString());
        vo.setTotalTasks(tasks.size());
        vo.setCompletedTasks((int) tasks.stream().filter(t -> "completed".equals(t.getStatus())).count());
        vo.setOverdueTasks((int) tasks.stream().filter(t -> "overdue".equals(t.getStatus())).count());
        vo.setExceptionTasks((int) tasks.stream().filter(t -> "exception_closed".equals(t.getStatus())).count());

        Map<String, Integer> breakdown = new LinkedHashMap<>();
        for (OpsScheduleTask t : tasks) {
            breakdown.merge(t.getTaskType() == null ? "other" : t.getTaskType(), 1, Integer::sum);
        }
        vo.setTypeBreakdown(breakdown);

        // user cache
        Map<Long, User> userCache = new HashMap<>();
        Set<Long> uids = tasks.stream().map(OpsScheduleTask::getAssigneeId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        if (!uids.isEmpty()) userMapper.selectBatchIds(uids).forEach(u -> userCache.put(u.getId(), u));

        List<ReportMaterialVO.MaterialItem> items = new ArrayList<>();
        for (OpsScheduleTask t : tasks) {
            ReportMaterialVO.MaterialItem item = new ReportMaterialVO.MaterialItem();
            item.setTaskId(t.getId());
            item.setTitle(t.getTitle());
            item.setTaskType(t.getTaskType());
            item.setStatus(t.getStatus());
            item.setResultStatus(t.getResultStatus());
            item.setResultSummary(t.getResultSummary());
            item.setRiskLevel(t.getRiskLevel());
            item.setCompletedAt(t.getCompletedAt() != null ? t.getCompletedAt().format(DT) : null);
            if (t.getAssigneeId() != null) {
                User u = userCache.get(t.getAssigneeId());
                if (u != null) item.setAssigneeName(notBlank(u.getRealName()) ? u.getRealName() : u.getUsername());
            }
            List<OpsScheduleTaskLink> links = linkMapper.selectList(
                    new LambdaQueryWrapper<OpsScheduleTaskLink>().eq(OpsScheduleTaskLink::getTaskId, t.getId()));
            item.setLinks(links.stream().map(l -> {
                ReportMaterialVO.LinkRef ref = new ReportMaterialVO.LinkRef();
                ref.setLinkType(l.getLinkType());
                ref.setLinkId(l.getLinkId());
                ref.setLinkTitle(l.getLinkTitle());
                return ref;
            }).collect(Collectors.toList()));
            items.add(item);
        }
        vo.setItems(items);
        return vo;
    }

    /** 素材清单导出 Excel（spec 5.12 /report-materials/export）。 */
    public byte[] exportExcel(String tenantId, String periodType, LocalDate startDate,
                              LocalDate endDate, Long groupId) {
        ReportMaterialVO vo = collect(tenantId, periodType, startDate, endDate, groupId);
        try (XSSFWorkbook wb = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            CellStyle header = headerStyle(wb);

            // Sheet 1: 概览
            Sheet overview = wb.createSheet("概览");
            String[] ovHead = {"周期类型", "开始", "结束", "任务总数", "已完成", "已逾期", "异常关闭"};
            Row oh = overview.createRow(0);
            for (int i = 0; i < ovHead.length; i++) { Cell c = oh.createCell(i); c.setCellValue(ovHead[i]); c.setCellStyle(header); }
            Row ov = overview.createRow(1);
            ov.createCell(0).setCellValue(periodType == null ? "-" : periodType);
            ov.createCell(1).setCellValue(vo.getStartDate());
            ov.createCell(2).setCellValue(vo.getEndDate());
            ov.createCell(3).setCellValue(vo.getTotalTasks());
            ov.createCell(4).setCellValue(vo.getCompletedTasks());
            ov.createCell(5).setCellValue(vo.getOverdueTasks());
            ov.createCell(6).setCellValue(vo.getExceptionTasks());
            for (int i = 0; i < ovHead.length; i++) overview.setColumnWidth(i, 14 * 256);

            // Sheet 2: 任务明细
            Sheet detail = wb.createSheet("任务明细");
            String[] dHead = {"任务ID", "标题", "类型", "状态", "结论", "风险", "完成时间", "负责人", "关联对象"};
            Row dh = detail.createRow(0);
            for (int i = 0; i < dHead.length; i++) { Cell c = dh.createCell(i); c.setCellValue(dHead[i]); c.setCellStyle(header); }
            int r = 1;
            for (ReportMaterialVO.MaterialItem item : vo.getItems()) {
                Row row = detail.createRow(r++);
                row.createCell(0).setCellValue(item.getTaskId() == null ? 0 : item.getTaskId());
                row.createCell(1).setCellValue(nz(item.getTitle()));
                row.createCell(2).setCellValue(nz(item.getTaskType()));
                row.createCell(3).setCellValue(nz(item.getStatus()));
                row.createCell(4).setCellValue(nz(item.getResultStatus()));
                row.createCell(5).setCellValue(nz(item.getRiskLevel()));
                row.createCell(6).setCellValue(nz(item.getCompletedAt()));
                row.createCell(7).setCellValue(nz(item.getAssigneeName()));
                String links = item.getLinks() == null ? "" : item.getLinks().stream()
                        .map(l -> l.getLinkType() + "#" + l.getLinkId())
                        .collect(Collectors.joining(", "));
                row.createCell(8).setCellValue(links);
            }
            int[] widths = {10, 30, 10, 12, 10, 8, 18, 14, 30};
            for (int i = 0; i < widths.length; i++) detail.setColumnWidth(i, widths[i] * 256);

            wb.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("生成素材 Excel 失败: " + e.getMessage(), e);
        }
    }

    private CellStyle headerStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setBold(true);
        s.setFont(f);
        s.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return s;
    }

    private String nz(String s) { return s == null ? "" : s; }

    private boolean notBlank(String s) { return s != null && !s.isBlank(); }
}
