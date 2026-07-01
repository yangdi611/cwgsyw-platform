package com.cwgsyw.platform.module.workflow.runtime;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 待办任务摘要，融合 Flowable 任务信息与业务摘要，供待办中心展示。
 */
@Data
@Builder
public class WorkflowTaskSummary {
    private String taskId;
    private String processInstanceId;
    private String taskName;
    private String assignee;
    private LocalDateTime createTime;

    private String businessKey;
    private String businessType;
    private String businessId;

    /** 业务标题，如日报日期、Wiki 标题、变更单号。业务摘要不可用时为空。 */
    private String businessTitle;
    /** 一句话业务摘要。 */
    private String businessSummary;
    /** 前端跳转业务详情的相对路径。 */
    private String businessUrl;
    /** 提交人显示名。 */
    private String submitterName;
    /** 当前用户是否可审批该任务（Flowable 候选关系 AND 业务权限）。 */
    private boolean canApprove;
    /** businessKey 是否可识别；false 时前端降级展示 rawBusinessKey。 */
    private boolean recognized;
}
