package com.cwgsyw.platform.module.approval;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.approval.workflow.ApprovalProcessNode;
import com.cwgsyw.platform.module.approval.workflow.ApprovalWorkflowStart;
import com.cwgsyw.platform.module.org.UserGroupMembershipMapper;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.workflow.adapter.TaskApprovalWorkflowAdapter;
import com.cwgsyw.platform.module.workflow.event.WorkflowBusinessInstance;
import com.cwgsyw.platform.module.workflow.event.WorkflowBusinessInstanceMapper;
import com.cwgsyw.platform.security.SecurityUser;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;
import org.flowable.engine.delegate.ExecutionListener;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers
class TaskApprovalWorkflowAdapterIntegrationTest {
    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
        .withDatabaseName("task_approval_flowable")
        .withUsername("flowable")
        .withPassword("flowable");

    private static ProcessEngine processEngine;

    @BeforeAll
    static void startEngine() {
        ExecutionListener completionListener = execution -> { };
        ProcessEngineConfiguration configuration =
            ProcessEngineConfiguration.createStandaloneProcessEngineConfiguration();
        configuration.setJdbcUrl(POSTGRES.getJdbcUrl());
        configuration.setJdbcUsername(POSTGRES.getUsername());
        configuration.setJdbcPassword(POSTGRES.getPassword());
        configuration.setJdbcDriver("org.postgresql.Driver");
        configuration.setDatabaseSchemaUpdate(ProcessEngineConfiguration.DB_SCHEMA_UPDATE_TRUE);
        configuration.setAsyncExecutorActivate(false);
        configuration.setBeans(Map.of("workflowCompletionListener", completionListener));
        processEngine = configuration.buildProcessEngine();
    }

    @AfterAll
    static void stopEngine() {
        if (processEngine != null) processEngine.close();
    }

    @Test
    void specifiedUsersCanApproveReturnToPreviousNodeAndFinish() {
        Fixture fixture = fixture(List.of(), List.of());
        var deployment = fixture.adapter.publish("tenant-a", "task_approval_two_level", "两级审批", List.of(
            new ApprovalProcessNode("first_review", "一级审批", "101", null),
            new ApprovalProcessNode("second_review", "二级审批", "202", null)
        ));
        var mapping = fixture.adapter.start(new ApprovalWorkflowStart(
            "tenant-a", 501L, 601L, deployment.processDefinitionId(), 99L));

        var firstTask = processEngine.getTaskService().createTaskQuery()
            .processInstanceId(mapping.getProcessInstanceId()).singleResult();
        assertThat(firstTask.getTaskDefinitionKey()).isEqualTo("first_review");
        assertThat(firstTask.getAssignee()).isEqualTo("101");
        assertThatThrownBy(() -> fixture.adapter.requirePending(user(202L, null), firstTask.getId()))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                .isEqualTo("APPROVAL_NOT_CANDIDATE"));

        var first = fixture.adapter.requirePending(user(101L, null), firstTask.getId());
        fixture.adapter.complete(user(101L, null), first, true, "一级通过", Map.of());
        var secondTask = processEngine.getTaskService().createTaskQuery()
            .processInstanceId(mapping.getProcessInstanceId()).singleResult();
        assertThat(secondTask.getTaskDefinitionKey()).isEqualTo("second_review");
        assertThat(secondTask.getAssignee()).isEqualTo("202");

        var second = fixture.adapter.requirePending(user(202L, null), secondTask.getId());
        fixture.adapter.returnToNode(user(202L, null), second, "first_review", "请重新审核", Map.of());
        var returned = processEngine.getTaskService().createTaskQuery()
            .processInstanceId(mapping.getProcessInstanceId()).singleResult();
        assertThat(returned.getTaskDefinitionKey()).isEqualTo("first_review");
        assertThat(returned.getAssignee()).isEqualTo("101");

        fixture.adapter.complete(user(101L, null), fixture.adapter.requirePending(user(101L, null), returned.getId()),
            true, "再次通过", Map.of());
        var finalReview = processEngine.getTaskService().createTaskQuery()
            .processInstanceId(mapping.getProcessInstanceId()).singleResult();
        fixture.adapter.complete(user(202L, null), fixture.adapter.requirePending(user(202L, null), finalReview.getId()),
            true, "最终通过", Map.of());

        assertThat(processEngine.getRuntimeService().createProcessInstanceQuery()
            .processInstanceId(mapping.getProcessInstanceId()).count()).isZero();
        assertThat(mapping.getBusinessKey()).isEqualTo("task_submission:501");
    }

    @Test
    void realGroupMemberCanHandleCandidateGroupTask() {
        Fixture fixture = fixture(List.of(9L), List.of());
        var deployment = fixture.adapter.publish("tenant-a", "task_approval_group", "组审批", List.of(
            new ApprovalProcessNode("group_review", "组内审批", null, "group_9")
        ));
        var mapping = fixture.adapter.start(new ApprovalWorkflowStart(
            "tenant-a", 502L, 602L, deployment.processDefinitionId(), 99L));
        var task = processEngine.getTaskService().createTaskQuery()
            .processInstanceId(mapping.getProcessInstanceId()).singleResult();

        var candidate = user(303L, 9L);
        assertThat(fixture.adapter.requirePending(candidate, task.getId()).nodeKey()).isEqualTo("group_review");
        fixture.adapter.complete(candidate, fixture.adapter.requirePending(candidate, task.getId()),
            true, "组审批通过", Map.of());
        assertThat(processEngine.getRuntimeService().createProcessInstanceQuery()
            .processInstanceId(mapping.getProcessInstanceId()).count()).isZero();
    }

    private static Fixture fixture(List<Long> memberships, List<Long> roleIds) {
        AtomicReference<WorkflowBusinessInstance> stored = new AtomicReference<>();
        WorkflowBusinessInstanceMapper businessMapper = proxy(WorkflowBusinessInstanceMapper.class, (method, args) -> {
            if ("insert".equals(method)) {
                stored.set((WorkflowBusinessInstance) args[0]);
                return 1;
            }
            if ("selectOne".equals(method)) return stored.get();
            return defaultValue(methodReturnType(method, WorkflowBusinessInstanceMapper.class));
        });
        UserGroupMembershipMapper membershipMapper = proxy(UserGroupMembershipMapper.class, (method, args) -> {
            if ("findEffectiveActiveBusinessGroupIds".equals(method)) return memberships;
            return defaultValue(methodReturnType(method, UserGroupMembershipMapper.class));
        });
        UserMapper userMapper = proxy(UserMapper.class,
            (method, args) -> defaultValue(methodReturnType(method, UserMapper.class)));
        RbacService rbacService = new RbacService(null, null, null, null, null, userMapper);
        TaskApprovalWorkflowAdapter adapter = new TaskApprovalWorkflowAdapter(
            processEngine.getRepositoryService(), processEngine.getRuntimeService(), processEngine.getTaskService(),
            businessMapper, membershipMapper, null, rbacService, null);
        return new Fixture(adapter);
    }

    private static SecurityUser user(Long userId, Long groupId) {
        return new SecurityUser(userId, "user-" + userId, "", "tenant-a", groupId, "group",
            Set.of("workflow:approve", "work_item:approve", "work_item:read"));
    }

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, Invocation invocation) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type},
            (proxy, method, args) -> {
                if (method.getDeclaringClass() == Object.class) {
                    return switch (method.getName()) {
                        case "toString" -> type.getSimpleName() + "Proxy";
                        case "hashCode" -> System.identityHashCode(proxy);
                        case "equals" -> proxy == args[0];
                        default -> null;
                    };
                }
                return invocation.invoke(method.getName(), args == null ? new Object[0] : args);
            });
    }

    private static Class<?> methodReturnType(String methodName, Class<?> type) {
        for (var method : type.getMethods()) if (method.getName().equals(methodName)) return method.getReturnType();
        return Object.class;
    }

    private static Object defaultValue(Class<?> type) {
        if (!type.isPrimitive()) return null;
        if (type == boolean.class) return false;
        if (type == int.class) return 0;
        if (type == long.class) return 0L;
        return 0;
    }

    private record Fixture(TaskApprovalWorkflowAdapter adapter) { }

    @FunctionalInterface
    private interface Invocation {
        Object invoke(String method, Object[] args);
    }
}
