package com.cwgsyw.platform.module.workflow.template;

import com.cwgsyw.platform.module.workflow.template.model.TemplateDefinition;
import com.cwgsyw.platform.module.workflow.template.model.TemplateDefinition.TemplateConfigField;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 内置流程模板定义（代码 seed，与 V62 迁移的 workflow_template 种子严格对齐）。
 *
 * <p>MVP 3 个模板：
 * <ol>
 *   <li>{@code single_approval} 单人审批：指定审批人（specific_user）审批通过或拒绝；</li>
 *   <li>{@code group_any_approval} 组内任一人审批：候选组内任一成员审批即可（或签）；</li>
 *   <li>{@code two_level_approval} 两级审批：一级组长审批 -> 二级角色/管理员审批。</li>
 * </ol>
 *
 * <p>审批人来源（*Source）解析策略见 {@link TemplateApproverResolver}。
 * 无论解析到哪个候选，最终能否完成审批仍受业务 {@code *:approve} 权限门控（AND 关系），
 * 因此欠定义来源回退到提交人组不会造成越权。
 */
public final class BuiltinTemplates {

    public static final String SINGLE_APPROVAL = "single_approval";
    public static final String GROUP_ANY_APPROVAL = "group_any_approval";
    public static final String TWO_LEVEL_APPROVAL = "two_level_approval";

    private BuiltinTemplates() {}

    private static TemplateConfigField f(String key, String label, String type, boolean required,
                                         List<String> options, String def) {
        return TemplateConfigField.builder()
            .key(key).label(label).type(type).required(required)
            .options(options).defaultValue(def).build();
    }

    private static final List<TemplateDefinition> TEMPLATES = List.of(
        TemplateDefinition.builder()
            .code(SINGLE_APPROVAL)
            .name("单人审批")
            .description("单个指定审批人审批通过或拒绝，适用于 Wiki 发布、简单设备权限申请、小型变更申请。")
            .version(1)
            .enabled(true)
            .supportedBusinessTypes(List.of("wiki_page", "device_access", "change_doc"))
            .configSchema(List.of(
                f("approverSource", "审批人来源", "select", true, List.of("specific_user"), "specific_user"),
                f("approverUserId", "指定审批人", "user", true, null, null),
                f("taskName", "任务名称", "string", true, null, "审批"),
                f("allowReject", "允许拒绝", "boolean", false, null, "true")
            ))
            .build(),
        TemplateDefinition.builder()
            .code(GROUP_ANY_APPROVAL)
            .name("组内任一人审批")
            .description("组内任意一名候选人审批即可通过（或签），适用于日报审批、Wiki 空间管理员审批、普通组内申请。")
            .version(1)
            .enabled(true)
            .supportedBusinessTypes(List.of("daily_report", "wiki_page", "change_doc"))
            .configSchema(List.of(
                f("candidateSource", "候选组来源", "select", true,
                    List.of("submitter_group_leaders", "submitter_group", "specific_group"), "submitter_group_leaders"),
                f("taskName", "任务名称", "string", true, null, "组内审批"),
                f("completionPolicy", "完成策略", "select", true, List.of("any_one"), "any_one"),
                f("rejectTo", "拒绝后状态", "string", false, null, "draft")
            ))
            .build(),
        TemplateDefinition.builder()
            .code(TWO_LEVEL_APPROVAL)
            .name("两级审批")
            .description("一级审批通过后进入二级审批，两级均通过才最终通过，适用于变更文档审批、设备权限申请、高影响操作申请。")
            .version(1)
            .enabled(true)
            .supportedBusinessTypes(List.of("change_doc", "device_access"))
            .configSchema(List.of(
                f("firstApproverSource", "一级审批人来源", "select", true,
                    List.of("submitter_group_leaders", "specific_user", "role"), "submitter_group_leaders"),
                f("firstTaskName", "一级任务名称", "string", true, null, "组长审批"),
                f("secondApproverSource", "二级审批人来源", "select", true,
                    List.of("role", "specific_user"), "role"),
                f("secondApproverRole", "二级审批角色", "string", false, null, "admin"),
                f("secondTaskName", "二级任务名称", "string", true, null, "管理员审批")
            ))
            .build()
    );

    private static final Map<String, TemplateDefinition> BY_CODE = TEMPLATES.stream()
        .collect(java.util.stream.Collectors.toMap(TemplateDefinition::getCode, t -> t));

    public static List<TemplateDefinition> all() {
        return TEMPLATES;
    }

    public static Optional<TemplateDefinition> find(String code) {
        return Optional.ofNullable(BY_CODE.get(code));
    }
}
