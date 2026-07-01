package com.cwgsyw.platform.module.workflow.template.dto;

import lombok.Data;

import java.util.Map;

/**
 * 创建模板实例请求。
 */
@Data
public class CreateTemplateInstanceRequest {
    /** 内置模板 code：single_approval / group_any_approval / two_level_approval。 */
    private String templateCode;
    /** 流程名称。 */
    private String name;
    /** 流程 key（== 生成 BPMN 的 process id），字母开头、3-64 位。 */
    private String processKey;
    /** 目标业务类型：daily_report / wiki_page / change_doc 等。 */
    private String businessType;
    private String description;
    /** 配置项键值（候选组等）。 */
    private Map<String, String> configValues;
    /** 创建后是否立即绑定到 businessType。 */
    private boolean bindNow;
}
