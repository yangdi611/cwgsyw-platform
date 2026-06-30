package com.cwgsyw.platform.module.opscalendar.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.opscalendar.dto.StatsVO;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTask;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTaskMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 运维日历统计服务（PRD §13）。MVP 体量小，直接 selectList 后在 Java 聚合，避免 JSONB @Select 陷阱。
 */
@Service
@RequiredArgsConstructor
public class OpsCalendarStatsService {

    private final OpsScheduleTaskMapper taskMapper;
    private final UserMapper userMapper;

    private static final int TOP_N = 10;

    public StatsVO stats(String tenantId, LocalDate startDate, LocalDate endDate, Long groupId) {
        if (startDate == null || endDate == null) throw new IllegalArgumentException("startDate/endDate 必填");
        if (startDate.isAfter(endDate)) throw new IllegalArgumentException("startDate 不能晚于 endDate");

        List<OpsScheduleTask> tasks = taskMapper.selectList(new LambdaQueryWrapper<OpsScheduleTask>()
                .eq(OpsScheduleTask::getTenantId, tenantId)
                .ge(OpsScheduleTask::getPlannedStartAt, startDate.atStartOfDay())
                .lt(OpsScheduleTask::getPlannedStartAt, endDate.plusDays(1).atStartOfDay())
                .eq(groupId != null, OpsScheduleTask::getGroupId, groupId));

        StatsVO vo = new StatsVO();
        vo.setStartDate(startDate.toString());
        vo.setEndDate(endDate.toString());
        vo.setTotal(tasks.size());

        int completed = 0, overdue = 0, exceptionClosed = 0, cancelled = 0;
        Map<String, Integer> typeBreakdown = new LinkedHashMap<>();
        Map<String, Integer> statusBreakdown = new LinkedHashMap<>();
        Map<String, int[]> daily = new TreeMap<>(); // date -> [created, completed, overdue]

        for (OpsScheduleTask t : tasks) {
            String status = t.getStatus();
            switch (status) {
                case "completed" -> completed++;
                case "overdue" -> overdue++;
                case "exception_closed" -> exceptionClosed++;
                case "cancelled" -> cancelled++;
                default -> {}
            }
            typeBreakdown.merge(t.getTaskType() == null ? "other" : t.getTaskType(), 1, Integer::sum);
            statusBreakdown.merge(status, 1, Integer::sum);

            if (t.getPlannedStartAt() != null) {
                String d = t.getPlannedStartAt().toLocalDate().toString();
                int[] cell = daily.computeIfAbsent(d, k -> new int[3]);
                cell[0]++;
                if ("completed".equals(status)) cell[1]++;
                if ("overdue".equals(status)) cell[2]++;
            }
        }

        vo.setCompleted(completed);
        vo.setOverdue(overdue);
        vo.setExceptionClosed(exceptionClosed);
        vo.setCancelled(cancelled);

        // 应完成 = 总数 - 已取消
        int expected = Math.max(0, tasks.size() - cancelled);
        vo.setCompletionRate(expected == 0 ? 0.0 : round(completed * 100.0 / expected));
        vo.setOverdueRate(expected == 0 ? 0.0 : round(overdue * 100.0 / expected));
        vo.setTypeBreakdown(typeBreakdown);
        vo.setStatusBreakdown(statusBreakdown);

        // 每日趋势
        List<StatsVO.DailyTrend> trend = new ArrayList<>();
        for (Map.Entry<String, int[]> e : daily.entrySet()) {
            StatsVO.DailyTrend dt = new StatsVO.DailyTrend();
            dt.setDate(e.getKey());
            dt.setCreated(e.getValue()[0]);
            dt.setCompleted(e.getValue()[1]);
            dt.setOverdue(e.getValue()[2]);
            trend.add(dt);
        }
        vo.setDailyTrend(trend);

        // 负责人负载 + 逾期排行
        Map<Long, int[]> byAssignee = new HashMap<>(); // uid -> [total, overdue, completed]
        for (OpsScheduleTask t : tasks) {
            if (t.getAssigneeId() == null) continue;
            int[] cell = byAssignee.computeIfAbsent(t.getAssigneeId(), k -> new int[3]);
            cell[0]++;
            if ("overdue".equals(t.getStatus())) cell[1]++;
            if ("completed".equals(t.getStatus())) cell[2]++;
        }
        Map<Long, String> nameCache = new HashMap<>();
        if (!byAssignee.isEmpty()) {
            userMapper.selectBatchIds(byAssignee.keySet()).forEach(u ->
                    nameCache.put(u.getId(), notBlank(u.getRealName()) ? u.getRealName() : u.getUsername()));
        }

        List<StatsVO.AssigneeLoad> loads = byAssignee.entrySet().stream().map(e -> {
            StatsVO.AssigneeLoad l = new StatsVO.AssigneeLoad();
            l.setAssigneeId(e.getKey());
            l.setAssigneeName(nameCache.getOrDefault(e.getKey(), "用户" + e.getKey()));
            l.setTotal(e.getValue()[0]);
            l.setOverdue(e.getValue()[1]);
            l.setCompleted(e.getValue()[2]);
            return l;
        }).collect(Collectors.toList());

        vo.setAssigneeLoad(loads.stream()
                .sorted(Comparator.comparingInt(StatsVO.AssigneeLoad::getTotal).reversed())
                .limit(TOP_N).collect(Collectors.toList()));
        vo.setOverdueRanking(loads.stream()
                .filter(l -> l.getOverdue() > 0)
                .sorted(Comparator.comparingInt(StatsVO.AssigneeLoad::getOverdue).reversed())
                .limit(TOP_N).collect(Collectors.toList()));
        return vo;
    }

    private double round(double v) { return Math.round(v * 10.0) / 10.0; }
    private boolean notBlank(String s) { return s != null && !s.isBlank(); }
}
