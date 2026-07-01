package com.cwgsyw.platform.module.workflow.event;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 业务流程实例关联，用于状态回写、去重、追溯、后台巡检。
 *
 * <p>唯一约束 tenant_id + business_key + process_instance_id 保证同一业务同一流程实例只落一条。
 * status 生命周期：running -> approved | rejected | cancelled | failed。
 *
 * <p>不继承 BaseEntity —— 有自己的 started_at/ended_at 语义，无软删。
 */
@Data
@TableName("workflow_business_instance")
public class WorkflowBusinessInstance {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String businessType;
    private String businessId;
    private String businessKey;
    private String processInstanceId;
    private String processDefinitionId;
    private String processDefinitionKey;
    private Integer processDefinitionVersion;
    /** running | approved | rejected | cancelled | failed */
    private String status;
    private Long submitterId;
    private LocalDateTime startedAt;
    private LocalDateTime endedAt;
    /** 最终结果：approved | rejected | cancelled | failed（与 status 终态一致，便于查询）。 */
    private String result;
}
