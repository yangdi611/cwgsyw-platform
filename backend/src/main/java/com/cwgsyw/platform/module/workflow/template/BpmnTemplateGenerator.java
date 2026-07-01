package com.cwgsyw.platform.module.workflow.template;

import com.cwgsyw.platform.module.workflow.template.TemplateApproverResolver.ApproverBinding;
import com.cwgsyw.platform.module.workflow.template.model.TemplateInstanceConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * BPMN XML 生成器。
 *
 * <p>根据内置模板 + 配置项生成 BPMN 2.0 XML。生成结果满足 SPEC 7.4：
 * <ul>
 *   <li>只有一个 executable process；process id == process key；</li>
 *   <li>包含 start / end event；</li>
 *   <li>user task 按 {@link TemplateApproverResolver} 配置 assignee 或 candidateGroups；</li>
 *   <li>审批结果统一使用 {@code approved} 变量；</li>
 *   <li>所有 end event 配置统一 completion listener {@code ${workflowCompletionListener}}；</li>
 *   <li>不生成未授权 delegateExpression（仅统一结束监听器）。</li>
 * </ul>
 *
 * <p>提交人组候选场景下，userTask 的 candidateGroups 为 {@code ${submitterGroupToken}} 表达式，
 * 由启动期 {@link TemplateApproverResolver#startVariables} 注入具体组 token。
 */
@Component
@RequiredArgsConstructor
public class BpmnTemplateGenerator {

    private static final String COMPLETION_LISTENER = "${workflowCompletionListener}";

    private final TemplateApproverResolver approverResolver;

    /** 生成 BPMN XML。调用前应已通过 {@link BpmnValidationService} 校验配置。 */
    public String generate(TemplateInstanceConfig config) {
        String code = config.getTemplateCode();
        return switch (code) {
            case BuiltinTemplates.SINGLE_APPROVAL -> singleApproval(config);
            case BuiltinTemplates.GROUP_ANY_APPROVAL -> groupAnyApproval(config);
            case BuiltinTemplates.TWO_LEVEL_APPROVAL -> twoLevel(config);
            default -> throw new IllegalArgumentException("未知模板类型: " + code);
        };
    }

    private String singleApproval(TemplateInstanceConfig config) {
        Map<String, String> v = config.getConfigValues();
        ApproverBinding binding = approverResolver.resolve(
            v.get("approverSource"), v.get("approverUserId"), null);
        String taskName = orDefault(v.get("taskName"), "审批");

        StringBuilder sb = new StringBuilder();
        header(sb);
        openProcess(sb, config);
        sb.append("    <startEvent id=\"start\" name=\"提交\"/>\n");
        sb.append("    <sequenceFlow id=\"f_start\" sourceRef=\"start\" targetRef=\"approval\"/>\n");
        userTask(sb, "approval", taskName, binding);
        sb.append("    <sequenceFlow id=\"f_gw\" sourceRef=\"approval\" targetRef=\"gw\"/>\n");
        resultGateway(sb, "gw", "审批结果", "approvedEnd", "rejectedEnd");
        endEvent(sb, "approvedEnd", "审批通过");
        endEvent(sb, "rejectedEnd", "审批拒绝");
        closeProcess(sb);
        footer(sb);
        return sb.toString();
    }

    private String groupAnyApproval(TemplateInstanceConfig config) {
        Map<String, String> v = config.getConfigValues();
        // 组内任一人审批：候选来源均解析为组候选（提交人组或指定组），无 specific_user
        ApproverBinding binding = approverResolver.resolve(
            v.get("candidateSource"), null, null);
        String taskName = orDefault(v.get("taskName"), "组内审批");

        StringBuilder sb = new StringBuilder();
        header(sb);
        openProcess(sb, config);
        sb.append("    <startEvent id=\"start\" name=\"提交\"/>\n");
        sb.append("    <sequenceFlow id=\"f_start\" sourceRef=\"start\" targetRef=\"approval\"/>\n");
        userTask(sb, "approval", taskName, binding);
        sb.append("    <sequenceFlow id=\"f_gw\" sourceRef=\"approval\" targetRef=\"gw\"/>\n");
        resultGateway(sb, "gw", "审批结果", "approvedEnd", "rejectedEnd");
        endEvent(sb, "approvedEnd", "审批通过");
        endEvent(sb, "rejectedEnd", "审批拒绝");
        closeProcess(sb);
        footer(sb);
        return sb.toString();
    }

    private String twoLevel(TemplateInstanceConfig config) {
        Map<String, String> v = config.getConfigValues();
        // 一级：firstApproverSource（specific_user/role 无对应 id 字段 -> 回退提交人组）
        ApproverBinding first = approverResolver.resolve(
            v.get("firstApproverSource"), null, null);
        // 二级：secondApproverSource，role 时读 secondApproverRole
        ApproverBinding second = approverResolver.resolve(
            v.get("secondApproverSource"), null, v.get("secondApproverRole"));
        String firstTaskName = orDefault(v.get("firstTaskName"), "一级审批");
        String secondTaskName = orDefault(v.get("secondTaskName"), "二级审批");

        StringBuilder sb = new StringBuilder();
        header(sb);
        openProcess(sb, config);
        sb.append("    <startEvent id=\"start\" name=\"提交\"/>\n");
        sb.append("    <sequenceFlow id=\"f_start\" sourceRef=\"start\" targetRef=\"approval1\"/>\n");
        // 一级
        userTask(sb, "approval1", firstTaskName, first);
        sb.append("    <sequenceFlow id=\"f_gw1\" sourceRef=\"approval1\" targetRef=\"gw1\"/>\n");
        sb.append("    <exclusiveGateway id=\"gw1\" name=\"一级结果\"/>\n");
        conditionalFlow(sb, "f1_approved", "gw1", "approval2", true);
        conditionalFlow(sb, "f1_rejected", "gw1", "rejectedEnd", false);
        // 二级
        userTask(sb, "approval2", secondTaskName, second);
        sb.append("    <sequenceFlow id=\"f_gw2\" sourceRef=\"approval2\" targetRef=\"gw2\"/>\n");
        resultGateway(sb, "gw2", "二级结果", "approvedEnd", "rejectedEnd");
        endEvent(sb, "approvedEnd", "审批通过");
        endEvent(sb, "rejectedEnd", "审批拒绝");
        closeProcess(sb);
        footer(sb);
        return sb.toString();
    }

    // ── BPMN 片段构建 ────────────────────────────────────────────────────

    private void userTask(StringBuilder sb, String id, String name, ApproverBinding binding) {
        sb.append("    <userTask id=\"").append(id).append("\" name=\"").append(escape(name)).append("\"");
        if (binding.getAssignee() != null) {
            sb.append(" flowable:assignee=\"").append(escapeAttr(binding.getAssignee())).append("\"");
        } else if (binding.getCandidateGroups() != null) {
            sb.append(" flowable:candidateGroups=\"").append(escapeAttr(binding.getCandidateGroups())).append("\"");
        }
        sb.append("/>\n");
    }

    private void resultGateway(StringBuilder sb, String gwId, String gwName,
                               String approvedTarget, String rejectedTarget) {
        sb.append("    <exclusiveGateway id=\"").append(gwId).append("\" name=\"")
            .append(escape(gwName)).append("\"/>\n");
        conditionalFlow(sb, "f_" + gwId + "_approved", gwId, approvedTarget, true);
        conditionalFlow(sb, "f_" + gwId + "_rejected", gwId, rejectedTarget, false);
    }

    private void conditionalFlow(StringBuilder sb, String id, String from, String to, boolean approved) {
        sb.append("    <sequenceFlow id=\"").append(id).append("\" sourceRef=\"").append(from)
            .append("\" targetRef=\"").append(to).append("\">\n");
        sb.append("      <conditionExpression xsi:type=\"tFormalExpression\">${approved == ")
            .append(approved).append("}</conditionExpression>\n");
        sb.append("    </sequenceFlow>\n");
    }

    private void openProcess(StringBuilder sb, TemplateInstanceConfig config) {
        sb.append("  <process id=\"").append(config.getProcessKey())
            .append("\" name=\"").append(escapeAttr(config.getName()))
            .append("\" isExecutable=\"true\">\n");
    }

    private void closeProcess(StringBuilder sb) {
        sb.append("  </process>\n");
    }

    private void header(StringBuilder sb) {
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<definitions xmlns=\"http://www.omg.org/spec/BPMN/20100524/MODEL\"\n");
        sb.append("             xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n");
        sb.append("             xmlns:flowable=\"http://flowable.org/bpmn\"\n");
        sb.append("             targetNamespace=\"http://cwgsyw.com/processes\">\n");
    }

    private void footer(StringBuilder sb) {
        sb.append("</definitions>\n");
    }

    private void endEvent(StringBuilder sb, String id, String name) {
        sb.append("    <endEvent id=\"").append(id).append("\" name=\"").append(escape(name)).append("\">\n");
        sb.append("      <extensionElements>\n");
        sb.append("        <flowable:executionListener event=\"start\" delegateExpression=\"")
            .append(COMPLETION_LISTENER).append("\"/>\n");
        sb.append("      </extensionElements>\n");
        sb.append("    </endEvent>\n");
    }

    private String orDefault(String v, String def) {
        return (v == null || v.isBlank()) ? def : v;
    }

    /** 元素文本转义。 */
    private String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    /** 属性值转义（保留 ${...} 表达式，仅转义 XML 元字符）。 */
    private String escapeAttr(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace("\"", "&quot;");
    }
}
