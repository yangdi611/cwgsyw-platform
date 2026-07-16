package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.config.SysConfigService;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.workflow.dto.StartProcessRequest;
import com.cwgsyw.platform.module.workflow.dto.ProcessStatsVO;
import org.flowable.engine.HistoryService;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.engine.history.HistoricProcessInstance;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkflowServiceLifecycleTest {
    @Mock(answer = Answers.RETURNS_DEEP_STUBS) RuntimeService runtimeService;
    @Mock(answer = Answers.RETURNS_DEEP_STUBS) RepositoryService repositoryService;
    @Mock TaskService taskService;
    @Mock HistoryService historyService;
    @Mock JdbcTemplate jdbcTemplate;
    @Mock ActiveGroupReferenceValidator activeGroupReferenceValidator;
    @Mock SysConfigService configService;
    @Mock ProcessDefinition definition;
    @Mock ProcessDefinition otherVersion;
    @Mock ProcessInstance instance;

    @InjectMocks WorkflowService service;

    @Test
    void deleteDefinition_removesEveryVersionWithoutCascadingHistory() {
        when(repositoryService.createProcessDefinitionQuery().processDefinitionId("flow:2:abc").singleResult())
            .thenReturn(definition);
        when(definition.getKey()).thenReturn("rem024_flow");
        when(definition.getId()).thenReturn("flow:2:abc");
        when(definition.getDeploymentId()).thenReturn("deployment-2");
        when(otherVersion.getId()).thenReturn("flow:1:abc");
        when(otherVersion.getDeploymentId()).thenReturn("deployment-1");
        when(repositoryService.createProcessDefinitionQuery().processDefinitionKey("rem024_flow").list())
            .thenReturn(List.of(definition, otherVersion));
        when(configService.getAll("tenant-a")).thenReturn(Map.of());
        when(runtimeService.createProcessInstanceQuery().processDefinitionKey("rem024_flow").count()).thenReturn(0L);

        service.deleteDefinition("flow:2:abc", "tenant-a");

        verify(repositoryService).deleteDeployment("deployment-1", false);
        verify(repositoryService).deleteDeployment("deployment-2", false);
        verify(repositoryService, never()).deleteDeployment(anyString(), org.mockito.ArgumentMatchers.eq(true));
    }

    @Test
    void deleteDefinition_rejectsRunningInstancesWithoutDeletingAnything() {
        when(repositoryService.createProcessDefinitionQuery().processDefinitionId("flow:2:abc").singleResult())
            .thenReturn(definition);
        when(definition.getKey()).thenReturn("rem024_flow");
        when(definition.getId()).thenReturn("flow:2:abc");
        when(repositoryService.createProcessDefinitionQuery().processDefinitionKey("rem024_flow").list())
            .thenReturn(List.of(definition));
        when(configService.getAll("tenant-a")).thenReturn(Map.of());
        when(runtimeService.createProcessInstanceQuery().processDefinitionKey("rem024_flow").count()).thenReturn(1L);

        assertThatThrownBy(() -> service.deleteDefinition("flow:2:abc", "tenant-a"))
            .isInstanceOf(BusinessException.class)
            .extracting("errorCode")
            .isEqualTo("WORKFLOW_DEFINITION_RUNNING_INSTANCES");

        verify(repositoryService, never()).deleteDeployment(anyString(), org.mockito.ArgumentMatchers.anyBoolean());
    }

    @Test
    void startProcess_rejectsSuspendedDefinitionBeforeFlowableStart() {
        StartProcessRequest request = new StartProcessRequest();
        request.setProcessDefinitionId("flow:2:abc");
        when(repositoryService.createProcessDefinitionQuery().processDefinitionId("flow:2:abc").singleResult())
            .thenReturn(definition);
        when(definition.isSuspended()).thenReturn(true);

        assertThatThrownBy(() -> service.startProcess(request, 1L, "tenant-a"))
            .isInstanceOf(BusinessException.class)
            .extracting("errorCode")
            .isEqualTo("WORKFLOW_DEFINITION_SUSPENDED");

        verify(runtimeService, never()).startProcessInstanceById(anyString(), anyString(), org.mockito.ArgumentMatchers.anyMap());
    }

    @Test
    void deleteInstance_rejectsUnknownInstanceBeforeFlowableDelete() {
        when(runtimeService.createProcessInstanceQuery().processInstanceId("missing").singleResult()).thenReturn(null);

        assertThatThrownBy(() -> service.deleteInstance("missing", "test"))
            .isInstanceOf(BusinessException.class)
            .extracting("errorCode")
            .isEqualTo("WORKFLOW_INSTANCE_NOT_FOUND");

        verify(runtimeService, never()).deleteProcessInstance(anyString(), anyString());
    }

    @Test
    void allStatsIncludesHistoricalInstancesWhoseDefinitionsWereDeleted() {
        HistoricProcessInstance historical = org.mockito.Mockito.mock(HistoricProcessInstance.class);
        when(definition.getKey()).thenReturn("active");
        when(definition.getName()).thenReturn("Active definition");
        when(definition.getVersion()).thenReturn(2);
        when(definition.getId()).thenReturn("active:2:1");
        when(repositoryService.createProcessDefinitionQuery().latestVersion().list()).thenReturn(List.of(definition));
        when(historyService.createHistoricProcessInstanceQuery().list()).thenReturn(List.of(historical));
        when(historical.getProcessDefinitionKey()).thenReturn(null);
        when(historical.getDurationInMillis()).thenReturn(1_000L);
        when(runtimeService.createProcessInstanceQuery().list()).thenReturn(List.of());
        when(runtimeService.createProcessInstanceQuery().processDefinitionKey("active").count()).thenReturn(0L);
        when(historyService.createHistoricProcessInstanceQuery().processDefinitionKey("active").finished().count()).thenReturn(0L);

        List<ProcessStatsVO> stats = service.getAllProcessStats();

        assertThat(stats).extracting(ProcessStatsVO::getProcessDefinitionKey)
            .containsExactly("active", "historical-deleted-definition");
        ProcessStatsVO deleted = stats.stream()
            .filter(stat -> stat.getProcessDefinitionKey().equals("historical-deleted-definition"))
            .findFirst().orElseThrow();
        assertThat(deleted.getFinishedCount()).isEqualTo(1);
        assertThat(deleted.getTotalStarted()).isEqualTo(1);
        assertThat(deleted.getName()).isEqualTo("历史已删除流程定义");
    }
}
