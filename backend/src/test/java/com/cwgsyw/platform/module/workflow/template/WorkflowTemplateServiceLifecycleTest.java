package com.cwgsyw.platform.module.workflow.template;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.workflow.binding.ProcessBindingService;
import com.cwgsyw.platform.module.workflow.binding.WorkflowProcessBindingMapper;
import com.cwgsyw.platform.module.workflow.template.model.WorkflowTemplateInstance;
import com.cwgsyw.platform.module.workflow.template.model.WorkflowTemplateInstanceMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flowable.engine.HistoryService;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.repository.ProcessDefinition;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkflowTemplateServiceLifecycleTest {
    @Mock BpmnTemplateGenerator generator;
    @Mock BpmnValidationService validationService;
    @Mock(answer = Answers.RETURNS_DEEP_STUBS) RepositoryService repositoryService;
    @Mock(answer = Answers.RETURNS_DEEP_STUBS) RuntimeService runtimeService;
    @Mock(answer = Answers.RETURNS_DEEP_STUBS) HistoryService historyService;
    @Mock ProcessBindingService bindingService;
    @Mock WorkflowProcessBindingMapper bindingMapper;
    @Mock WorkflowTemplateInstanceMapper instanceMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock ObjectMapper objectMapper;
    @Mock WorkflowTemplateInstance instance;
    @Mock ProcessDefinition definition;

    @InjectMocks WorkflowTemplateService service;

    @Test
    void deleteInstance_softDeletesAndRemovesUnreferencedDeployment() {
        arrangeInstance();
        when(instance.getProcessKey()).thenReturn("rem025_flow");
        when(instance.getName()).thenReturn("REM-P1-025 test instance");
        when(bindingMapper.selectCount(any())).thenReturn(0L);
        when(runtimeService.createProcessInstanceQuery().processDefinitionKey("rem025_flow").count()).thenReturn(0L);
        when(historyService.createHistoricProcessInstanceQuery().processDefinitionKey("rem025_flow").count()).thenReturn(0L);
        when(definition.getDeploymentId()).thenReturn("deployment-1");
        when(repositoryService.createProcessDefinitionQuery().processDefinitionKey("rem025_flow").list())
            .thenReturn(List.of(definition));

        service.deleteInstance("tenant-a", 7L, 9L);

        verify(repositoryService).deleteDeployment("deployment-1", false);
        verify(instance).setStatus("deleted");
        verify(instanceMapper).updateById(instance);
        verify(instanceMapper).deleteById(9L);
        verify(auditLogMapper).insert(any(AuditLog.class));
    }

    @Test
    void deleteInstance_rejectsActiveBindingWithoutDeletingAnything() {
        arrangeInstance();
        when(bindingMapper.selectCount(any())).thenReturn(1L);

        assertThatThrownBy(() -> service.deleteInstance("tenant-a", 7L, 9L))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("模板实例仍被业务流程绑定，无法删除");

        verify(repositoryService, never()).deleteDeployment(anyString(), any(Boolean.class));
        verify(instanceMapper, never()).updateById(instance);
    }

    @Test
    void deleteInstance_rejectsRunningProcessWithoutDeletingAnything() {
        arrangeInstance();
        when(instance.getProcessKey()).thenReturn("rem025_flow");
        when(bindingMapper.selectCount(any())).thenReturn(0L);
        when(runtimeService.createProcessInstanceQuery().processDefinitionKey("rem025_flow").count()).thenReturn(1L);

        assertThatThrownBy(() -> service.deleteInstance("tenant-a", 7L, 9L))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("模板实例存在运行中的流程，无法删除");

        verify(repositoryService, never()).deleteDeployment(anyString(), any(Boolean.class));
        verify(instanceMapper, never()).updateById(instance);
    }

    @Test
    void deleteInstance_rejectsHistoricalProcessWithoutDeletingAnything() {
        arrangeInstance();
        when(instance.getProcessKey()).thenReturn("rem025_flow");
        when(bindingMapper.selectCount(any())).thenReturn(0L);
        when(runtimeService.createProcessInstanceQuery().processDefinitionKey("rem025_flow").count()).thenReturn(0L);
        when(historyService.createHistoricProcessInstanceQuery().processDefinitionKey("rem025_flow").count()).thenReturn(1L);

        assertThatThrownBy(() -> service.deleteInstance("tenant-a", 7L, 9L))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("模板实例存在历史流程记录，无法删除");

        verify(repositoryService, never()).deleteDeployment(anyString(), any(Boolean.class));
        verify(instanceMapper, never()).updateById(instance);
    }

    private void arrangeInstance() {
        when(instanceMapper.selectOne(any())).thenReturn(instance);
    }
}
