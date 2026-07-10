package com.cwgsyw.platform.module.workflow.template;

import com.cwgsyw.platform.module.workflow.template.model.TemplateInstanceConfig;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class BpmnTemplateGeneratorTest {

    private final BpmnTemplateGenerator generator = new BpmnTemplateGenerator(new TemplateApproverResolver());

    private TemplateInstanceConfig config(String code, String processKey, Map<String, String> values) {
        return TemplateInstanceConfig.builder()
            .templateCode(code)
            .name("测试流程")
            .processKey(processKey)
            .businessType("change_doc")
            .configValues(values)
            .build();
    }

    @Test
    void singleApprovalBakesAssigneeWhenUserProvided() {
        String xml = generator.generate(config(BuiltinTemplates.SINGLE_APPROVAL, "myProc", Map.of(
            "approverSource", "specific_user",
            "approverUserId", "42",
            "taskName", "经理审批")));

        assertThat(xml).contains("<process id=\"myProc\"");
        assertThat(xml).contains("isExecutable=\"true\"");
        assertThat(xml).contains("flowable:assignee=\"42\"");
        assertThat(xml).contains("name=\"经理审批\"");
        // 统一结束监听器
        assertThat(xml).contains("delegateExpression=\"${workflowCompletionListener}\"");
        // 统一审批结果变量
        assertThat(xml).contains("${approved == true}");
        assertThat(xml).contains("${approved == false}");
        // start/end 事件齐全
        assertThat(xml).contains("<startEvent");
        assertThat(xml).contains("<endEvent");
    }

    @Test
    void singleApprovalFallsBackToSubmitterGroupWhenNoUser() {
        String xml = generator.generate(config(BuiltinTemplates.SINGLE_APPROVAL, "p1", Map.of(
            "approverSource", "specific_user")));
        assertThat(xml).contains("flowable:candidateGroups=\"${submitterGroupToken}\"");
        assertThat(xml).doesNotContain("flowable:assignee");
    }

    @Test
    void groupAnyApprovalUsesSubmitterGroupCandidate() {
        String xml = generator.generate(config(BuiltinTemplates.GROUP_ANY_APPROVAL, "grp", Map.of(
            "candidateSource", "submitter_group_leaders",
            "taskName", "组内审批")));
        assertThat(xml).contains("flowable:candidateGroups=\"${submitterGroupToken}\"");
    }

    @Test
    void twoLevelWiresRoleCandidateForSecondLevel() {
        String xml = generator.generate(config(BuiltinTemplates.TWO_LEVEL_APPROVAL, "two", Map.of(
            "firstApproverSource", "submitter_group_leaders",
            "firstTaskName", "组长审批",
            "secondApproverSource", "role",
            "secondApproverRole", "admin",
            "secondTaskName", "管理员审批")));
        // 一级：提交人组
        assertThat(xml).contains("id=\"approval1\"");
        assertThat(xml).contains("flowable:candidateGroups=\"${submitterGroupToken}\"");
        // 二级：角色候选组
        assertThat(xml).contains("id=\"approval2\"");
        assertThat(xml).contains("flowable:candidateGroups=\"role_admin\"");
        // 两级链路：一级通过才进入二级
        assertThat(xml).contains("targetRef=\"approval2\"");
    }

    @Test
    void escapesXmlMetacharactersInTaskName() {
        String xml = generator.generate(config(BuiltinTemplates.SINGLE_APPROVAL, "esc", Map.of(
            "approverSource", "specific_user",
            "approverUserId", "1",
            "taskName", "A<B>&C")));
        assertThat(xml).contains("A&lt;B&gt;&amp;C");
    }

    @Test
    void unknownTemplateThrows() {
        try {
            generator.generate(config("no_such_template", "x", Map.of()));
            assertThat(false).as("expected IllegalArgumentException").isTrue();
        } catch (IllegalArgumentException e) {
            assertThat(e.getMessage()).contains("未知模板类型");
        }
    }
}
