package com.cwgsyw.platform.module.workflow.runtime;

import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.workflow.adapter.BusinessWorkflowAdapter;
import com.cwgsyw.platform.module.workflow.adapter.BusinessWorkflowAdapterRegistry;
import com.cwgsyw.platform.module.workflow.binding.ProcessBindingService;
import com.cwgsyw.platform.module.workflow.binding.WorkflowProcessBinding;
import com.cwgsyw.platform.module.workflow.event.WorkflowBusinessInstanceMapper;
import com.cwgsyw.platform.module.workflow.event.WorkflowBusinessInstance;
import com.cwgsyw.platform.module.workflow.template.TemplateApproverResolver;
import org.flowable.engine.HistoryService;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.runtime.ProcessInstance;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkflowRuntimeFacadeGroupReferenceTest {
    @Mock RuntimeService runtimeService;
    @Mock TaskService taskService;
    @Mock RepositoryService repositoryService;
    @Mock HistoryService historyService;
    @Mock ProcessBindingService bindingService;
    @Mock BusinessWorkflowAdapterRegistry adapterRegistry;
    @Mock WorkflowBusinessInstanceMapper businessInstanceMapper;
    @Mock UserMapper userMapper;
    @Mock TemplateApproverResolver approverResolver;
    @Mock com.cwgsyw.platform.module.rbac.RbacService rbacService;
    @Mock com.cwgsyw.platform.module.rbac.SysRoleMapper roleMapper;
    @Mock ActiveGroupReferenceValidator activeGroupReferenceValidator;
    @Mock BusinessWorkflowAdapter adapter;
    @Mock ProcessInstance processInstance;

    @InjectMocks WorkflowRuntimeFacadeImpl facade;

    @Test
    void startBusinessProcess_validatesFinalAdapterAndCommandGroupVariablesOnceInOrder() {
        WorkflowProcessBinding binding = new WorkflowProcessBinding();
        binding.setProcessDefinitionId("def-1");
        binding.setProcessDefinitionKey("daily");
        binding.setProcessDefinitionVersion(1);
        when(adapterRegistry.require("daily_report")).thenReturn(adapter);
        when(bindingService.getActiveBinding("default", "daily_report")).thenReturn(binding);
        when(adapter.buildBusinessKey("9")).thenReturn("daily_report:9");
        when(adapter.buildStartVariables(any())).thenReturn(Map.of(
            "groupId", "group_5", "nested", Map.of("candidateGroups", List.of("group_3", "group_5"))));
        when(runtimeService.startProcessInstanceById(anyString(), anyString(), any())).thenReturn(processInstance);
        when(processInstance.getId()).thenReturn("pi-1");

        WorkflowBusinessInstance result = facade.startBusinessProcess(WorkflowStartCommand.builder()
            .tenantId("default").businessType("daily_report").businessId("9")
            .variables(Map.of("candidateGroup", "group_4", "unrelated", "group_99"))
            .build());

        InOrder order = inOrder(activeGroupReferenceValidator, runtimeService);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 3L);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 4L);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 5L);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 99L);
        order.verify(runtimeService).startProcessInstanceById(anyString(), anyString(), any());
        assertThat(result.getProcessInstanceId()).isEqualTo("pi-1");
    }
}
