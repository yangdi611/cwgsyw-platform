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
import org.springframework.stereotype.Service;

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

    private boolean notBlank(String s) { return s != null && !s.isBlank(); }
}
