package com.cwgsyw.platform.module.workflow.template.model;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 流程模板实例 —— 业务管理员基于模板创建的具体流程。
 * status: draft | active | deprecated | deleted
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("workflow_template_instance")
public class WorkflowTemplateInstance extends BaseEntity {
    private String templateCode;
    private String name;
    private String processKey;
    private String businessType;
    private String description;
    /** JSON 文本：本实例的模板配置值。 */
    private String config;
    private String latestProcessDefinitionId;
    private Integer latestVersion;
    private String status;
}
