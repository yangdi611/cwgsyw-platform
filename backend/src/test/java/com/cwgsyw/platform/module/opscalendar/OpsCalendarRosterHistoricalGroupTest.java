package com.cwgsyw.platform.module.opscalendar;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.opscalendar.entity.OpsDutyRoster;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsDutyRosterMapper;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarRosterService;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.user.UserMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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

    private OpsDutyRoster roster(Long id, LocalDate dutyDate, Long groupId) {
        OpsDutyRoster roster = new OpsDutyRoster();
        roster.setId(id);
        roster.setTenantId("default");
        roster.setDutyDate(dutyDate);
        roster.setGroupId(groupId);
        return roster;
    }

    private Group group(Long id, String name, boolean deleted) {
        Group group = new Group();
        group.setId(id);
        group.setName(name);
        group.setIsDeleted(deleted);
        return group;
    }
}
