package com.cwgsyw.platform.module.workflow.binding;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 业务模块 -> 流程定义版本绑定。
 *
 * <p>一个租户下一个 businessType 只保留一条当前绑定（唯一约束 tenant_id + business_type）。
 * 切换绑定只影响新启动的流程实例，不追溯已运行实例。
 *
 * <p>不继承 BaseEntity —— 无软删语义，绑定切换用覆盖更新表达。
 */
@Data
@TableName("workflow_process_binding")
public class WorkflowProcessBinding {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String businessType;
    private String processDefinitionId;
    private String processDefinitionKey;
    private Integer processDefinitionVersion;
    private Long templateInstanceId;
    private Boolean enabled;
    private Long createdBy;
    private LocalDateTime createdAt;
    private Long updatedBy;
    private LocalDateTime updatedAt;
}
