package com.cwgsyw.platform.module.workflow.template.model;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

/**
 * 模板实例配置（BPMN 生成输入）。
 *
 * <p>由前端提交的 config JSON 解析而来，configValues 的 key 与
 * {@link TemplateDefinition.TemplateConfigField#getKey()} 对应。
 */
@Data
@Builder
public class TemplateInstanceConfig {
    private String templateCode;
    private String name;
    /** 流程 key，等于生成 BPMN 的 process id。 */
    private String processKey;
    private String businessType;
    private String description;
    /** 配置项键值：候选组/候选人/文本等。 */
    private Map<String, String> configValues;
}
