package com.cwgsyw.platform.module.workflow.adapter;

import lombok.Builder;
import lombok.Data;

/**
 * 业务摘要，用于待办中心展示业务上下文与跳转入口。
 *
 * <p>当业务对象已被删除或查看者无权查看时，adapter 应返回 {@code available=false}，
 * 调用方据此降级为仅展示 businessKey。
 */
@Data
@Builder
public class BusinessWorkflowSummary {
    /** 是否成功构造摘要；false 时其余字段可为空，调用方降级展示。 */
    private boolean available;
    private String businessType;
    private String businessId;
    /** 业务标题，如日报日期、Wiki 页面标题、变更单号。 */
    private String businessTitle;
    /** 一句话业务摘要。 */
    private String businessSummary;
    /** 前端跳转业务详情的相对路径。 */
    private String businessUrl;
    /** 提交人显示名。 */
    private String submitterName;
}
