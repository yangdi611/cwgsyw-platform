package com.cwgsyw.platform.module.workflow.binding;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.workflow.template.model.WorkflowTemplateInstanceMapper;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.repository.ProcessDefinitionQuery;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProcessBindingServiceLifecycleTest {
    @Mock WorkflowProcessBindingMapper bindingMapper;
    @Mock WorkflowTemplateInstanceMapper templateInstanceMapper;
    @Mock RepositoryService repositoryService;
    @Mock AuditLogMapper auditLogMapper;
    @Mock ProcessDefinition definition;
    @Mock ProcessDefinitionQuery definitionQuery;

    @InjectMocks ProcessBindingServiceImpl service;

    @Test
    void disabledOrDeletedHistoryHasNoActiveBinding() {
        when(bindingMapper.selectOne(any())).thenReturn(null);
        assertThat(service.getActiveBinding("tenant-a", "task_submission")).isNull();
    }

    @Test
    void disableAuditsWithoutWritingCompatibilityConfig() {
        WorkflowProcessBinding binding = binding(true);
        when(bindingMapper.selectOne(any())).thenReturn(binding);

        WorkflowProcessBinding result = service.disable("tenant-a", 9L, 7L);

        assertThat(result.getEnabled()).isFalse();
        verify(bindingMapper).updateById(binding);
        verify(auditLogMapper).insert(any(com.cwgsyw.platform.common.entity.AuditLog.class));
    }

    @Test
    void enableRevalidatesAndAuditsWithoutWritingCompatibilityConfig() {
        WorkflowProcessBinding binding = binding(false);
        when(bindingMapper.selectOne(any())).thenReturn(binding);
        when(repositoryService.createProcessDefinitionQuery()).thenReturn(definitionQuery);
        when(definitionQuery.processDefinitionId("def-1")).thenReturn(definitionQuery);
        when(definitionQuery.singleResult()).thenReturn(definition);
        when(definition.isSuspended()).thenReturn(false);
        when(definition.getKey()).thenReturn("daily");

        WorkflowProcessBinding result = service.enable("tenant-a", 9L, 7L);

        assertThat(result.getEnabled()).isTrue();
        verify(auditLogMapper).insert(any(com.cwgsyw.platform.common.entity.AuditLog.class));
    }

    @Test
    void enableSuspendedDefinitionHasNoPartialWrite() {
        WorkflowProcessBinding binding = binding(false);
        when(bindingMapper.selectOne(any())).thenReturn(binding);
        when(repositoryService.createProcessDefinitionQuery()).thenReturn(definitionQuery);
        when(definitionQuery.processDefinitionId("def-1")).thenReturn(definitionQuery);
        when(definitionQuery.singleResult()).thenReturn(definition);
        when(definition.isSuspended()).thenReturn(true);

        assertThatThrownBy(() -> service.enable("tenant-a", 9L, 7L))
            .isInstanceOf(IllegalStateException.class);

        verify(bindingMapper, never()).updateById(any(WorkflowProcessBinding.class));
        verify(auditLogMapper, never()).insert(any(com.cwgsyw.platform.common.entity.AuditLog.class));
    }

    @Test
    void deleteSoftDeletesAndAuditsWithoutWritingCompatibilityConfig() {
        WorkflowProcessBinding binding = binding(true);
        when(bindingMapper.selectOne(any())).thenReturn(binding);

        service.delete("tenant-a", 9L, 7L);

        assertThat(binding.getDeletedAt()).isNotNull();
        assertThat(binding.getDeletedBy()).isEqualTo(7L);
        verify(bindingMapper).updateById(binding);
        verify(bindingMapper).deleteById(9L);
        verify(auditLogMapper).insert(any(com.cwgsyw.platform.common.entity.AuditLog.class));
    }

    @Test
    void crossTenantBindingIsNotFoundWithoutMutation() {
        when(bindingMapper.selectOne(any())).thenReturn(null);

        assertThatThrownBy(() -> service.disable("tenant-b", 9L, 7L))
            .hasMessage("流程绑定不存在");

        verify(bindingMapper, never()).updateById(any(WorkflowProcessBinding.class));
        verify(auditLogMapper, never()).insert(any(com.cwgsyw.platform.common.entity.AuditLog.class));
    }

    private WorkflowProcessBinding binding(boolean enabled) {
        WorkflowProcessBinding binding = new WorkflowProcessBinding();
        binding.setId(9L);
        binding.setTenantId("tenant-a");
        binding.setBusinessType("change_doc");
        binding.setProcessDefinitionId("def-1");
        binding.setProcessDefinitionKey("daily");
        binding.setProcessDefinitionVersion(1);
        binding.setEnabled(enabled);
        return binding;
    }
}
