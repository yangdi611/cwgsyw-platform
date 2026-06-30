package com.cwgsyw.platform.module.opscalendar.handler;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.daily.DailyReportMapper;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarRuleService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 日报提醒迁移（spec 9.2）：把「当天未提交日报的用户」解析逻辑注入 RuleService，
 * 让 daily_report 汇总任务在 created 阶段向这些用户扇出通知（每人每天每阶段一次，幂等）。
 * 该汇总任务由调度生成、无单一负责人；这里只负责提供「扇出名单」。
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DailyReportReminderHandler {

    private final OpsCalendarRuleService ruleService;
    private final UserMapper userMapper;
    private final DailyReportMapper dailyReportMapper;

    @PostConstruct
    public void register() {
        ruleService.setUnsubmittedResolver(this::resolveUnsubmitted);
        log.info("ops-calendar: registered unsubmitted-daily-report resolver");
    }

    private Collection<Long> resolveUnsubmitted(String tenantId, LocalDate date) {
        List<User> allUsers = userMapper.selectList(new LambdaQueryWrapper<User>()
                .eq(User::getTenantId, tenantId)
                .eq(User::getIsDeleted, false));

        Set<Long> filed = dailyReportMapper.selectList(new LambdaQueryWrapper<DailyReport>()
                        .eq(DailyReport::getReportDate, date)
                        .eq(DailyReport::getIsDeleted, false))
                .stream().map(DailyReport::getReporterId).collect(Collectors.toSet());

        return allUsers.stream()
                .map(User::getId)
                .filter(id -> !filed.contains(id))
                .collect(Collectors.toList());
    }
}
