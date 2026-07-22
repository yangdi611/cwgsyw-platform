# REM-P1-053 实施合同

## 目标

长审批意见不得因 `audit_log.remark VARCHAR(512)` 使 Workflow 完成事务返回 500；审计记录必须保留状态转换和可识别的意见摘要。

## 当前行为

- 统一 Workflow 完成端点允许可选审批意见。
- `DailyReportWorkflowAdapter.onWorkflowCompleted` 把完整意见拼入审计 remark。
- 4096 字符 Unicode 意见触发 PostgreSQL `value too long for type character varying(512)`，审批事务回滚。
- `WikiWorkflowAdapter` 也把完整意见直接写入审计 remark，属于同一根因聚类。

## 目标行为

- 空、短、512 边界及超长 Unicode 意见均不产生 5xx。
- 完整意见继续进入既有流程变量和业务持久化字段，不在入口静默截断。
- 审计 remark 使用确定性、有界、Unicode 安全的摘要，长度不超过 512；状态/动作前缀必须保留。
- 日报批准/驳回、Wiki 发布/驳回、权限、候选人、通知和事务原子性不变。

## 范围

- `DailyReportWorkflowAdapter.onWorkflowCompleted`
- `WikiWorkflowAdapter.onWorkflowCompleted`
- 可复用的局部审计 remark 有界 helper，若现有代码已有合适实现则复用。
- 定向单元测试及 `test/l4-workflow-approval-contract-current-run.spec.js`。

## Non-goals

- 不修改 `audit_log` schema 或执行迁移。
- 不新增审批意见产品上限，不改变 API DTO、路由或 HTTP 成功合同。
- 不修改 Workflow binding、候选人、权限、通知内容或正式 Wiki 审批策略。
- 不恢复、purge、清卷、清 Redis 或直接写数据库。

## 影响分析

- `WorkflowController.approve`：LOW，0 产品上游、0 流程。
- `WorkflowCenterController.complete`：LOW，0 产品上游、0 流程。
- `WorkflowRuntimeFacadeImpl.completeTask`：LOW，2 个直接入口、0 流程、Workflow 单模块。
- `DailyReportWorkflowAdapter.onWorkflowCompleted`：LOW，0 图上游；实现 `BusinessWorkflowAdapter`。
- `WikiPageService.handleApprovalResult`：LOW，1 个直接调用者、0 流程、1 模块。

## 验收条件

- `AC-001`：日报长 Unicode 批准/驳回完成，业务状态正确，审计 remark ≤512 且保留转换前缀。
- `AC-002`：Wiki 长 Unicode 批准/驳回完成，页面状态正确，审计 remark ≤512。
- `AC-003`：空/短/边界意见行为保持兼容；完整业务意见不因审计摘要被覆盖。
- `AC-004`：无审批权限仍为 403/稳定拒绝，任务与业务状态不变。
- `AC-005`：当前分支 backend 构建、真实 API/UI、Console/5xx 与精确产品清理全部通过。

## 回滚

还原有界审计摘要 helper 与两个 adapter 调用点；无 schema、配置、数据迁移或正式绑定需要恢复。

## 停止条件

若真实修复要求改变审批意见产品上限、数据库 schema、正式 binding 或非测试数据，暂停请求用户决定。
