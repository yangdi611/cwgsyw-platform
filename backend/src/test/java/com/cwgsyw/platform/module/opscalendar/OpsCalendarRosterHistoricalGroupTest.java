package com.cwgsyw.platform.module.opscalendar;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.opscalendar.entity.OpsDutyRoster;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsDutyRosterMapper;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarRosterService;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.time.LocalDateTime;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.never;
import static org.mockito.ArgumentMatchers.anyLong;

@ExtendWith(MockitoExtension.class)
class OpsCalendarRosterHistoricalGroupTest {
    @Mock OpsDutyRosterMapper rosterMapper;
    @Mock UserMapper userMapper;
    @Mock GroupMapper groupMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock ActiveGroupReferenceValidator activeGroupReferenceValidator;

    @InjectMocks OpsCalendarRosterService service;

    @Test
    void list_usesArchivedLookupOnlyForPastRoster() {
        OpsDutyRoster past = roster(1L, LocalDate.now().minusDays(1), 15L);
        OpsDutyRoster future = roster(2L, LocalDate.now().plusDays(1), 16L);
        Group archived = group(15L, "历史值班组", true);
        Group active = group(16L, "当前值班组", false);
        when(rosterMapper.selectList(any())).thenReturn(List.of(past, future));
        when(groupMapper.findIncludingDeletedByIds("default", Set.of(15L))).thenReturn(List.of(archived));
        when(groupMapper.selectBatchIds(Set.of(16L))).thenReturn(List.of(active));

        var result = service.list("default", null, null, null);

        assertThat(result).extracting(vo -> vo.getGroupName())
            .containsExactly("历史值班组", "当前值班组");
        assertThat(result).extracting(vo -> vo.getGroupArchived())
            .containsExactly(true, false);
        verify(groupMapper).findIncludingDeletedByIds("default", Set.of(15L));
        verify(groupMapper).selectBatchIds(Set.of(16L));
    }

    @Test
    void list_rejectsReversedDateRangeBeforeQuery() {
        assertThatIllegalArgumentException().isThrownBy(() -> service.list("default",
                LocalDate.of(2026, 7, 31), LocalDate.of(2026, 7, 1), null))
            .withMessage("from不能晚于to");

        org.mockito.Mockito.verifyNoInteractions(rosterMapper);
    }

    @Test
    void purgeRemediationTest_rejectsInvalidRequestsWithoutWrites() {
        assertThatIllegalArgumentException().isThrownBy(() -> service.purgeRemediationTest(
                user("group"), 3L, "run-1"))
                .withMessage("仅平台管理员可以清理整改测试排班");
        assertThatIllegalArgumentException().isThrownBy(() -> service.purgeRemediationTest(
                user("platform"), 3L, " ")).withMessage("缺少 runId");

        OpsDutyRoster crossTenant = roster(3L, LocalDate.now(), 15L);
        crossTenant.setTenantId("other");
        when(rosterMapper.selectById(3L)).thenReturn(crossTenant);
        assertThatIllegalArgumentException().isThrownBy(() -> service.purgeRemediationTest(
                user("platform"), 3L, "run-1")).withMessage("排班记录不存在");
        verify(rosterMapper, never()).deleteById(anyLong());
        verify(auditLogMapper, never()).insert(any(AuditLog.class));
    }

    @Test
    void purgeRemediationTest_deletesMarkedRosterAndAudits() {
        String runId = "REM-P1-045-run";
        OpsDutyRoster marked = roster(4L, LocalDate.now(), 15L);
        marked.setRemark("remediationRunId=" + runId);
        when(rosterMapper.selectById(4L)).thenReturn(marked);

        service.purgeRemediationTest(user("platform"), 4L, runId);

        verify(rosterMapper).deleteById(4L);
        var audit = org.mockito.ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(audit.capture());
        assertThat(audit.getValue().getAction()).isEqualTo("purge_remediation_test");
        assertThat(audit.getValue().getRemark()).isEqualTo("runId=" + runId);
    }

    @Test
    void purgeRemediationTest_rejectsUnmarkedRosterWithoutWrites() {
        OpsDutyRoster unmarked = roster(5L, LocalDate.now(), 15L);
        unmarked.setRemark("ordinary roster");
        when(rosterMapper.selectById(5L)).thenReturn(unmarked);

        assertThatIllegalArgumentException().isThrownBy(() -> service.purgeRemediationTest(
                user("platform"), 5L, "REM-P1-045-run"))
                .withMessage("仅允许清理备注带 runId 的测试排班");
        verify(rosterMapper, never()).deleteById(anyLong());
        verify(auditLogMapper, never()).insert(any(AuditLog.class));
    }

    @Test
    void purgeRemediationTest_duplicateCallDoesNotWrite() {
        String runId = "REM-P1-045-run";
        OpsDutyRoster marked = roster(6L, LocalDate.now(), 15L);
        marked.setRemark("remediationRunId=" + runId);
        when(rosterMapper.selectById(6L)).thenReturn(marked, null);

        service.purgeRemediationTest(user("platform"), 6L, runId);
        assertThatIllegalArgumentException().isThrownBy(() -> service.purgeRemediationTest(
                user("platform"), 6L, runId)).withMessage("排班记录不存在");

        verify(rosterMapper).deleteById(6L);
        verify(auditLogMapper).insert(any(AuditLog.class));
        verify(auditLogMapper, org.mockito.Mockito.times(1)).insert(any(AuditLog.class));
    }

    @Test
    void createAndUpdate_rejectNonIncreasingTimeBeforeWrites() {
        var reverse = request(LocalDateTime.of(2098, 12, 30, 18, 0),
                LocalDateTime.of(2098, 12, 30, 9, 0));
        var equal = request(LocalDateTime.of(2098, 12, 30, 9, 0),
                LocalDateTime.of(2098, 12, 30, 9, 0));

        assertThatIllegalArgumentException().isThrownBy(() -> service.create(reverse, "default", 1L))
                .withMessage("结束时间必须晚于开始时间");
        assertThatIllegalArgumentException().isThrownBy(() -> service.update(1L, equal, "default", 1L))
                .withMessage("结束时间必须晚于开始时间");

        org.mockito.Mockito.verifyNoInteractions(rosterMapper, activeGroupReferenceValidator, auditLogMapper);
    }

    @Test
    void deleteRejectsCrossTenantRosterWithoutWrites() {
        OpsDutyRoster roster = roster(7L, LocalDate.now(), 15L);
        roster.setTenantId("other-tenant");
        when(rosterMapper.selectById(7L)).thenReturn(roster);

        assertThatIllegalArgumentException().isThrownBy(() -> service.delete(7L, "default", 42L))
            .withMessage("排班记录不存在");

        verify(rosterMapper, never()).updateById(any(OpsDutyRoster.class));
        verify(rosterMapper, never()).deleteById(anyLong());
        verify(auditLogMapper, never()).insert(any(AuditLog.class));
    }

    @Test
    void deleteRecordsUpdaterAndAudit() {
        OpsDutyRoster roster = roster(8L, LocalDate.now(), 15L);
        when(rosterMapper.selectById(8L)).thenReturn(roster);

        service.delete(8L, "default", 42L);

        var updated = org.mockito.ArgumentCaptor.forClass(OpsDutyRoster.class);
        verify(rosterMapper).updateById(updated.capture());
        assertThat(updated.getValue().getUpdatedBy()).isEqualTo(42L);
        verify(rosterMapper).deleteById(8L);
        var audit = org.mockito.ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(audit.capture());
        assertThat(audit.getValue().getTenantId()).isEqualTo("default");
        assertThat(audit.getValue().getAction()).isEqualTo("delete");
        assertThat(audit.getValue().getTargetType()).isEqualTo("ops_duty_roster");
        assertThat(audit.getValue().getTargetId()).isEqualTo(8L);
        assertThat(audit.getValue().getOperatorId()).isEqualTo(42L);
    }

    private com.cwgsyw.platform.module.opscalendar.dto.RosterRequest request(
            LocalDateTime startAt, LocalDateTime endAt) {
        var request = new com.cwgsyw.platform.module.opscalendar.dto.RosterRequest();
        request.setStartAt(startAt);
        request.setEndAt(endAt);
        request.setGroupId(15L);
        return request;
    }

    private OpsDutyRoster roster(Long id, LocalDate dutyDate, Long groupId) {
        OpsDutyRoster roster = new OpsDutyRoster();
        roster.setId(id);
        roster.setTenantId("default");
        roster.setDutyDate(dutyDate);
        roster.setGroupId(groupId);
        return roster;
    }

    private SecurityUser user(String groupScope) {
        return new SecurityUser(1L, "superadmin", "", "default", null, groupScope, Set.of());
    }

    private Group group(Long id, String name, boolean deleted) {
        Group group = new Group();
        group.setId(id);
        group.setName(name);
        group.setIsDeleted(deleted);
        return group;
    }
}
