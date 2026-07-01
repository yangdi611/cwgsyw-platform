package com.cwgsyw.platform.module.workflow.template.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 流程模板定义（内置，代码/迁移 seed）。
 *
 * <p>不继承 BaseEntity —— 模板是全局共享的系统资源，没有租户/软删语义，
 * 字段与 {@code workflow_template} 表严格对应。
 */
@Data
@TableName("workflow_template")
public class WorkflowTemplate {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String code;
    private String name;
    private String description;
    private Integer templateVersion;
    /** JSON 数组文本：受支持的 businessType 列表。 */
    private String supportedBusinessTypes;
    /** JSON 文本：配置项 schema，用于前端渲染表单与后端校验。 */
    private String configSchema;
    private Boolean enabled;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
