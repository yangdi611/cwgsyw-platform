package com.cwgsyw.platform.module.task.approval;

import com.cwgsyw.platform.module.approval.entity.ApprovalScheme;
import com.cwgsyw.platform.module.approval.entity.ApprovalSchemeVersion;
import com.cwgsyw.platform.module.approval.mapper.ApprovalSchemeMapper;
import com.cwgsyw.platform.module.approval.mapper.ApprovalSchemeVersionMapper;
import com.cwgsyw.platform.module.approval.service.ApprovalSchemeService;
import com.cwgsyw.platform.module.approval.workflow.ApprovalProcessDeployment;
import com.cwgsyw.platform.module.approval.workflow.ApprovalProcessNode;
import com.cwgsyw.platform.module.approval.workflow.TaskApprovalWorkflowPort;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApprovalSchemeServiceTest {
    @Mock ApprovalSchemeMapper schemeMapper;
    @Mock ApprovalSchemeVersionMapper versionMapper;
    @Mock UserMapper userMapper;
    @Mock TaskApprovalWorkflowPort workflowPort;

    private ApprovalSchemeService service;

    @BeforeEach
    void setUp() {
        service = new ApprovalSchemeService(schemeMapper, versionMapper, userMapper,
            null, null, workflowPort, new ObjectMapper().findAndRegisterModules());
    }

    @Test
    void publishDeploysValidatedNodesAndFreezesDefinitionIdentity() {
        ApprovalScheme scheme = new ApprovalScheme();
        scheme.setId(5L);
        scheme.setTenantId("tenant-a");
        scheme.setName("日报审批");
        scheme.setStatus("draft");
        ApprovalSchemeVersion version = new ApprovalSchemeVersion();
        version.setId(8L);
        version.setTenantId("tenant-a");
        version.setSchemeId(5L);
        version.setVersion(2);
        version.setStatus("draft");
        version.setDefinitionConfig(Map.of(
            "nodes", List.of(Map.of("key", "leader", "name", "组长审批",
                "approverType", "user", "userId", 22L)),
            "allowedActions", List.of("approve", "return_for_changes")));
        User approver = new User();
        approver.setId(22L);
        approver.setTenantId("tenant-a");
        approver.setStatus(1);
        when(versionMapper.selectOne(any())).thenReturn(version);
        when(schemeMapper.selectOne(any())).thenReturn(scheme);
        when(userMapper.selectOne(any())).thenReturn(approver);
        when(workflowPort.publish(eq("tenant-a"), eq("task_approval_5_v2"), eq("日报审批"), any()))
            .thenReturn(new ApprovalProcessDeployment("definition-9", "task_approval_5_v2", 3));

        var result = service.publish("tenant-a", 7L, 8L);

        ArgumentCaptor<List<ApprovalProcessNode>> nodes = ArgumentCaptor.forClass(List.class);
        verify(workflowPort).publish(eq("tenant-a"), eq("task_approval_5_v2"), eq("日报审批"), nodes.capture());
        assertThat(nodes.getValue()).singleElement().satisfies(node -> {
            assertThat(node.key()).isEqualTo("leader");
            assertThat(node.assignee()).isEqualTo("22");
        });
        assertThat(result.status()).isEqualTo("published");
        assertThat(result.processDefinitionId()).isEqualTo("definition-9");
        assertThat(result.processDefinitionKey()).isEqualTo("task_approval_5_v2");
        assertThat(result.processDefinitionVersion()).isEqualTo(3);
        assertThat(version.getPublishedBy()).isEqualTo(7L);
        assertThat(scheme.getStatus()).isEqualTo("published");
        verify(versionMapper).updateById(version);
        verify(schemeMapper).updateById(scheme);
    }
}
