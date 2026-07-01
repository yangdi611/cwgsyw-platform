package com.cwgsyw.platform.module.workflow.template.model;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * 内置模板定义（运行期视图）。
 *
 * <p>与 {@link WorkflowTemplate} 表记录对应，但 supportedBusinessTypes / configSchema
 * 已解析为结构化对象，供 BPMN 生成与配置校验使用。字段与 V62 迁移种子严格对齐。
 */
@Data
@Builder
public class TemplateDefinition {
    /** 模板 code：single_approval / group_any_approval / two_level_approval。 */
    private String code;
    private String name;
    private String description;
    private int version;
    /** 受支持的 businessType 列表；空表示不限制。 */
    private List<String> supportedBusinessTypes;
    /** 配置项 schema（用于前端渲染表单与后端校验）。 */
    private List<TemplateConfigField> configSchema;
    private boolean enabled;

    /**
     * 单个配置项 schema，与 V62 迁移种子的 config_schema.fields 元素一一对应。
     */
    @Data
    @Builder
    public static class TemplateConfigField {
        /** 配置项 key，如 approverSource / approverUserId / taskName。 */
        private String key;
        private String label;
        /** select | user | group | role | string | boolean。 */
        private String type;
        private boolean required;
        /** select 类型的可选值。 */
        private List<String> options;
        /** 默认值（可空）。 */
        private String defaultValue;
    }
}
