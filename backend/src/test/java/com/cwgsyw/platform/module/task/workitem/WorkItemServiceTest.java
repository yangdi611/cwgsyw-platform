package com.cwgsyw.platform.module.task.workitem;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.approval.dto.ApprovalTaskSummaryVO;
import com.cwgsyw.platform.module.approval.service.ApprovalTaskQueryPort;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.runtime.entity.TaskParticipant;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskInstanceMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskParticipantMapper;
import com.cwgsyw.platform.module.task.template.entity.TaskTemplateVersion;
import com.cwgsyw.platform.module.task.template.mapper.TaskTemplateVersionMapper;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class WorkItemServiceTest {
    @Mock TaskInstanceMapper taskMapper;
    @Mock TaskParticipantMapper participantMapper;
    @Mock TaskTemplateVersionMapper templateVersionMapper;
    @Mock ApprovalTaskQueryPort approvalTasks;

    private WorkItemService service;
    private SecurityUser user;

    @BeforeEach
    void setUp() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), "workItemServiceTest"),
            TaskInstance.class);
        service = new WorkItemService(taskMapper, participantMapper, templateVersionMapper, approvalTasks);
        user = new SecurityUser(9L, "operator", "", "tenant-a", 3L, "group",
            Set.of("work_item:read", "work_item:approve", "workflow:approve"));
    }

    @Test
    void approveTabUsesUnifiedApprovalReadModel() {
        PageResult<ApprovalTaskSummaryVO> approvals = new PageResult<>();
        approvals.setRecords(List.of(new ApprovalTaskSummaryVO("flow-task-1", 10L, 20L, 30L,
            "数据库巡检", "leader_approval", "组长审批", "high", LocalDate.of(2026, 7, 23),
            LocalDateTime.of(2026, 7, 23, 18, 0), false,
            LocalDateTime.of(2026, 7, 23, 10, 0))));
        approvals.setTotal(1);
        approvals.setPage(1);
        approvals.setSize(20);
        when(approvalTasks.pending(eq(user), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(),
            isNull(), isNull(), eq(1), eq(20))).thenReturn(approvals);

        var result = service.list(user, "approve", null, null, null, null, null,
            null, null, null, 1, 20);

        assertThat(result.getRecords()).singleElement().satisfies(item -> {
            assertThat(item.itemType()).isEqualTo("approval");
            assertThat(item.approvalTaskId()).isEqualTo("flow-task-1");
            assertThat(item.nodeName()).isEqualTo("组长审批");
            assertThat(item.href()).isEqualTo("/tasks/10");
        });
    }

    @Test
    void executeTabOnlyQueriesStatesThatStillNeedExecution() {
        when(participantMapper.selectList(any())).thenReturn(List.of());
        when(taskMapper.selectPage(any(), any())).thenReturn(page(task(11L, "changes_requested")));

        var result = service.list(user, "execute", null, null, null, null, null,
            null, null, null, 1, 20);

        assertThat(result.getRecords()).singleElement().satisfies(item -> {
            assertThat(item.status()).isEqualTo("changes_requested");
            assertThat(item.actionRequired()).isTrue();
        });
        assertThat(taskQuerySql()).contains("tenant_id", "execution_status", "assignee_id", "IN")
            .doesNotContain("NOT IN");
    }

    @Test
    void initiatedCopiedAndCompletedUseTheirOwnMembershipRules() {
        when(participantMapper.selectList(any())).thenReturn(List.of(participant(21L, "copied")));
        when(taskMapper.selectPage(any(), any())).thenReturn(page(task(21L, "in_progress")));

        service.list(user, "initiated", null, null, null, null, null,
            null, null, null, 1, 20);
        assertThat(taskQuerySql()).contains("tenant_id", "created_by");

        service.list(user, "copied", null, null, null, null, null,
            null, null, null, 1, 20);
        assertThat(taskQuerySql()).contains("tenant_id", "id", "IN");

        service.list(user, "completed", null, null, null, null, null,
            null, null, null, 1, 20);
        assertThat(taskQuerySql()).contains("tenant_id", "execution_status", "assignee_id", "created_by", "IN");
    }

    @Test
    void templateFilterResolvesEveryVersionOfTheTemplate() {
        TaskTemplateVersion first = version(101L, 7L);
        TaskTemplateVersion second = version(102L, 7L);
        when(templateVersionMapper.selectList(any())).thenReturn(List.of(first, second));
        when(participantMapper.selectList(any())).thenReturn(List.of());
        when(taskMapper.selectPage(any(), any())).thenReturn(page(task(11L, "not_started")));

        service.list(user, "execute", null, 7L, null, null, null,
            null, null, null, 1, 20);

        verify(templateVersionMapper).selectList(any());
        assertThat(taskQuerySql()).contains("template_version_id", "IN");
    }

    @Test
    void countsUseTheSameFiveCollectionsAsUnfilteredLists() {
        when(participantMapper.selectList(any())).thenReturn(List.of());
        when(taskMapper.selectCount(any())).thenReturn(2L, 3L, 4L, 5L);
        PageResult<ApprovalTaskSummaryVO> approvals = new PageResult<>();
        approvals.setRecords(List.of());
        approvals.setTotal(6);
        approvals.setPage(1);
        approvals.setSize(1);
        when(approvalTasks.pending(user, null, 1, 1)).thenReturn(approvals);

        var counts = service.counts(user);

        assertThat(counts.execute()).isEqualTo(2);
        assertThat(counts.approve()).isEqualTo(6);
        assertThat(counts.initiated()).isEqualTo(3);
        assertThat(counts.copied()).isEqualTo(4);
        assertThat(counts.completed()).isEqualTo(5);
    }

    @Test
    void invalidTabIsRejectedBeforeQuery() {
        assertThatThrownBy(() -> service.list(user, "legacy_workflow", null, null, null,
            null, null, null, null, null, 1, 20))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("WORK_ITEM_TAB_INVALID"));
    }

    private String taskQuerySql() {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Wrapper<TaskInstance>> captor = ArgumentCaptor.forClass(Wrapper.class);
        org.mockito.Mockito.verify(taskMapper, org.mockito.Mockito.atLeastOnce()).selectPage(any(), captor.capture());
        return captor.getValue().getSqlSegment();
    }

    private Page<TaskInstance> page(TaskInstance task) {
        Page<TaskInstance> page = new Page<>(1, 20);
        page.setRecords(List.of(task));
        page.setTotal(1);
        return page;
    }

    private TaskInstance task(Long id, String status) {
        TaskInstance task = new TaskInstance();
        task.setId(id);
        task.setTenantId("tenant-a");
        task.setTitle("工作日报");
        task.setExecutionStatus(status);
        task.setPriority("normal");
        task.setBusinessDate(LocalDate.of(2026, 7, 23));
        task.setDueAt(LocalDateTime.now().plusHours(2));
        return task;
    }

    private TaskParticipant participant(Long taskId, String role) {
        TaskParticipant participant = new TaskParticipant();
        participant.setTenantId("tenant-a");
        participant.setTaskId(taskId);
        participant.setUserId(user.getUserId());
        participant.setRole(role);
        return participant;
    }

    private TaskTemplateVersion version(Long id, Long templateId) {
        TaskTemplateVersion version = new TaskTemplateVersion();
        version.setId(id);
        version.setTenantId("tenant-a");
        version.setTemplateId(templateId);
        return version;
    }
}
