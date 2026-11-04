package com.cwgsyw.platform.module.sosreport.cmdb;

/** 入库申请的审批任务可能发生了变化：刚提交，或某一级刚处理完。 */
public record SosApprovalTasksChangedEvent(String tenantId, Long requestId) {
}
