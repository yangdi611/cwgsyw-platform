package com.cwgsyw.platform.module.workflow.binding;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.config.SysConfigService;
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
    @Mock SysConfigService configService;
    @Mock AuditLogMapper auditLogMapper;
    @Mock ProcessDefinition definition;
    @Mock ProcessDefinitionQuery definitionQuery;

    @InjectMocks ProcessBindingServiceImpl service;

    @Test
    void disabledOrDeletedHistoryBlocksLegacyFallback() {
        when(bindingMapper.selectOne(any())).thenReturn(null);
        when(bindingMapper.countIncludingDeleted("tenant-a", "daily_report")).thenReturn(1L);

        assertThat(service.getActiveBinding("tenant-a", "daily_report")).isNull();

        verify(configService, never()).get(any(), any());
    }

    @Test
    void neverMigratedBusinessTypeStillUsesLegacyFallback() {
        when(bindingMapper.selectOne(any())).thenReturn(null);
        when(bindingMapper.countIncludingDeleted("tenant-a", "daily_report")).thenReturn(0L);
        when(configService.get("tenant-a", "daily_report_process_definition_id")).thenReturn("def-1");
        when(repositoryService.createProcessDefinitionQuery()).thenReturn(definitionQuery);
        when(definitionQuery.processDefinitionId("def-1")).thenReturn(definitionQuery);
        when(definitionQuery.singleResult()).thenReturn(definition);
        when(definition.getId()).thenReturn("def-1");
        when(definition.getKey()).thenReturn("daily");
        when(definition.getVersion()).thenReturn(2);

        assertThat(service.getActiveBinding("tenant-a", "daily_report"))
            .extracting(WorkflowProcessBinding::getProcessDefinitionId,
                WorkflowProcessBinding::getProcessDefinitionVersion)
            .containsExactly("def-1", 2);
    }

    @Test
    void disableClearsLegacyKeyAndAudits() {
        WorkflowProcessBinding binding = binding(true);
        when(bindingMapper.selectOne(any())).thenReturn(binding);

        WorkflowProcessBinding result = service.disable("tenant-a", 9L, 7L);

        assertThat(result.getEnabled()).isFalse();
        verify(bindingMapper).updateById(binding);
        verify(configService).set("tenant-a", "daily_report_process_definition_id", "");
        verify(auditLogMapper).insert(any(com.cwgsyw.platform.common.entity.AuditLog.class));
    }

    @Test
    void enableRevalidatesAndRestoresLegacyKey() {
        WorkflowProcessBinding binding = binding(false);
        when(bindingMapper.selectOne(any())).thenReturn(binding);
        when(repositoryService.createProcessDefinitionQuery()).thenReturn(definitionQuery);
        when(definitionQuery.processDefinitionId("def-1")).thenReturn(definitionQuery);
        when(definitionQuery.singleResult()).thenReturn(definition);
        when(definition.isSuspended()).thenReturn(false);
        when(definition.getKey()).thenReturn("daily");

        WorkflowProcessBinding result = service.enable("tenant-a", 9L, 7L);

        assertThat(result.getEnabled()).isTrue();
        verify(configService).set("tenant-a", "daily_report_process_definition_id", "def-1");
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
        verify(configService, never()).set(any(), any(), any());
        verify(auditLogMapper, never()).insert(any(com.cwgsyw.platform.common.entity.AuditLog.class));
    }

    @Test
    void deleteSoftDeletesClearsLegacyAndAudits() {
        WorkflowProcessBinding binding = binding(true);
        when(bindingMapper.selectOne(any())).thenReturn(binding);

        service.delete("tenant-a", 9L, 7L);

        assertThat(binding.getDeletedAt()).isNotNull();
        assertThat(binding.getDeletedBy()).isEqualTo(7L);
        verify(bindingMapper).updateById(binding);
        verify(bindingMapper).deleteById(9L);
        verify(configService).set("tenant-a", "daily_report_process_definition_id", "");
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
        binding.setBusinessType("daily_report");
        binding.setProcessDefinitionId("def-1");
        binding.setProcessDefinitionKey("daily");
        binding.setProcessDefinitionVersion(1);
        binding.setEnabled(enabled);
        return binding;
    }
}
