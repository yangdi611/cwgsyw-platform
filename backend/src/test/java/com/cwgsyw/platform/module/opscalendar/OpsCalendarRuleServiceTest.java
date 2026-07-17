package com.cwgsyw.platform.module.opscalendar;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.AuditSnapshotSerializer;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleRule;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTask;
import com.cwgsyw.platform.module.opscalendar.dto.RuleCreateRequest;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsDutyRosterMapper;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleChecklistItemMapper;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleRuleMapper;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTaskLogMapper;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTaskMapper;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTaskParticipantMapper;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTemplateMapper;
import com.cwgsyw.platform.module.opscalendar.service.OccurrenceCalculator;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarNotificationService;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarRuleService;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
class OpsCalendarRuleServiceTest {
    @Mock OpsScheduleRuleMapper ruleMapper;
    @Mock OpsScheduleTaskMapper taskMapper;
    @Mock OpsScheduleTaskParticipantMapper participantMapper;
    @Mock OpsScheduleChecklistItemMapper checklistMapper;
    @Mock OpsScheduleTaskLogMapper logMapper;
    @Mock OpsScheduleTemplateMapper templateMapper;
    @Mock OpsDutyRosterMapper rosterMapper;
    @Mock OccurrenceCalculator occurrenceCalculator;
    @Mock OpsCalendarNotificationService notificationService;
    @Mock UserMapper userMapper;
    @Mock com.cwgsyw.platform.module.org.GroupMapper groupMapper;
    @Mock ActiveGroupReferenceValidator activeGroupReferenceValidator;
    @Mock RbacService rbacService;
    @Mock AuditLogMapper auditLogMapper;
    @Spy ObjectMapper objectMapper = new ObjectMapper();
    @Spy AuditSnapshotSerializer auditSnapshotSerializer = new AuditSnapshotSerializer(objectMapper);

    @InjectMocks OpsCalendarRuleService service;

    @Test
    void generateForRule_validatesResolvedGroupBeforeTaskInsert() {
        LocalDateTime now = LocalDateTime.of(2026, 7, 14, 10, 0);
        OpsScheduleRule rule = new OpsScheduleRule();
        rule.setId(20L);
        rule.setTenantId("default");
        rule.setName("group lifecycle rule");
        rule.setTaskType("inspection");
        rule.setTriggerType("once");
        rule.setGenerateDaysAhead(7);
        rule.setAssigneeRule("{\"type\":\"group_leader\",\"groupId\":15}");
        rule.setRecipientRule("{}");
        rule.setDueConfig("{}");
        rule.setVisibility("group");

        when(occurrenceCalculator.calculate(rule, now, now.plusDays(7))).thenReturn(List.of(now.plusDays(1)));
        when(taskMapper.selectCount(any())).thenReturn(0L);
        when(taskMapper.insert(any(OpsScheduleTask.class))).thenAnswer(invocation -> {
            OpsScheduleTask task = invocation.getArgument(0);
            task.setId(99L);
            return 1;
        });

        service.generateForRule(rule, now);

        InOrder order = inOrder(activeGroupReferenceValidator, taskMapper);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 15L);
        order.verify(taskMapper).insert(any(OpsScheduleTask.class));
        verify(ruleMapper).updateById(rule);
    }

    @Test
    void createValidatesAllNestedGroupReferencesInAscendingOrderBeforeInsert() {
        RuleCreateRequest request = new RuleCreateRequest();
        request.setName("nested group rule");
        request.setTaskType("inspection");
        request.setTriggerType("once");
        request.setEnabled(false);
        request.setAssigneeRule(Map.of("groupId", "7"));
        request.setRecipientRule(Map.of("nested", List.of(Map.of("groupId", 3))));
        request.setEscalationRule(Map.of("groupId", 5));
        com.cwgsyw.platform.security.SecurityUser user = new com.cwgsyw.platform.security.SecurityUser(
            9L, "operator", "", "default", 1L, "tenant", java.util.Set.of());

        service.create(user, request);

        InOrder order = inOrder(activeGroupReferenceValidator, ruleMapper);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 3L);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 5L);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 7L);
        order.verify(ruleMapper).insert(any(OpsScheduleRule.class));
    }

    @Test
    void createRejectsInvalidCronAdvanceAndSameDayPastDueBeforeInsert() {
        SecurityUser user = new SecurityUser(9L, "operator", "", "default", 1L, "tenant", java.util.Set.of());

        RuleCreateRequest invalidCron = request("cron");
        invalidCron.setTriggerConfig(Map.of("expression", "not-a-spring-cron"));
        assertThatThrownBy(() -> service.create(user, invalidCron))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("Cron 表达式无效");

        RuleCreateRequest negativeAdvance = request("daily");
        negativeAdvance.setGenerateDaysAhead(-1);
        assertThatThrownBy(() -> service.create(user, negativeAdvance))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("提前生成天数");

        RuleCreateRequest pastDue = request("daily");
        pastDue.setTriggerConfig(Map.of("time", "23:59"));
        pastDue.setDueConfig(Map.of("offsetDays", 0, "time", "18:00"));
        assertThatThrownBy(() -> service.create(user, pastDue))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("截止时间不能早于计划开始时间");

        verify(ruleMapper, org.mockito.Mockito.never()).insert(any(OpsScheduleRule.class));
    }

    private RuleCreateRequest request(String triggerType) {
        RuleCreateRequest request = new RuleCreateRequest();
        request.setName("validation rule");
        request.setTaskType("inspection");
        request.setTriggerType(triggerType);
        request.setGenerateDaysAhead(7);
        request.setTriggerConfig(Map.of("time", "09:00"));
        request.setDueConfig(Map.of("offsetDays", 1, "time", "18:00"));
        request.setEnabled(false);
        return request;
    }
}
