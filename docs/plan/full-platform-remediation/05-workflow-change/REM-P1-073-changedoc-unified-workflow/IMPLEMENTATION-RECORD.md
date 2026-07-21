# 实施记录

## 2026-07-21：认领、首败与风险门禁

- 从 `lint-fix@a82119cd` 创建独立分支 `codex/rem-p1-073-changedoc-unified-workflow`。
- 来源 L4 continuation 失败提交 `231bc59b`；同 run 真实 Playwright 完整双模板提交进入 `pending`，但统一待办没有 `change_doc` 任务。
- 清理通过产品 API 完成：ChangeDoc、两个模板、binding 软删除、模板实例均为 0；运行/历史流程不存在，manifest 0/0。

## GitNexus upstream impact

- `ChangeDocService.submit`：LOW，1 个直接 Controller 调用，0 流程。
- `submitPlan`：LOW，1 个直接 Controller 调用，0 流程。
- `approve`：LOW，1 个直接 Controller 调用，0 流程。
- `handleWorkflowApproval`：LOW，1 个 Adapter 调用。
- Controller `submit/submitPlan/approve`：LOW，0 上游符号。
- `WorkflowRuntimeFacade`：LOW，4 个直接依赖；实现类为 LOW。
- 统一任务 `toSummaries`：LOW，2 个直接入口，影响 my/group task 流程。
- `getActiveBinding`：HIGH，2 个直接调用、6 个受影响符号，涉及 Daily、Wiki 与 Adapter。本事件只调用现有方法，不修改其实现。

## 实现决策

- 现有 `ChangeDocWorkflowAdapter` 已覆盖摘要、业务 URL、权限和完成回写，但依赖 `ChangeDocService`。Service 反向依赖 facade 会形成 Bean 环，因此新增独立 ChangeDoc/Workflow 编排层，由 Controller 调用。
- 编排层在同一事务中复用现有状态机，只在文档真正进入 `pending` 且 binding 启用时启动流程；无 binding 保持旧内部审批。
- 统一待办的 Controller 权限改为通用 `workflow:read`，最终审批权限仍由候选关系与 adapter `canApprove` 双重判定，避免 `daily_report:approve` 阻断 ChangeDoc 审批。

## 2026-07-21：实现与 L1-L3 结算

- 新增 `ChangeDocWorkflowOrchestrator`，让完整 submit 与 submit-plan 在同一事务内按启用 binding 启动统一流程；无 binding 历史保留 direct approve，停用/删除历史拒绝新 pending 提交。
- 旧 approve 在同事务内先锁定 tenant-scoped pending 文档，再查询 running business mapping，关闭提交与旧审批之间的检查竞态；有运行实例时返回 409。
- ChangeDoc adapter 摘要要求 `change_doc:read`，审批同时要求 `change_doc:approve` 和同租户业务对象可见；统一 Controller 使用 `workflow:read`，业务审批权限仍由 adapter 复核。
- remediation cleanup 精确汇总 `change_doc:{id}` runtime/history/mapping，清理关联通知后再调用既有 runId 受限业务清理；没有数据库迁移。
- Java 21 L1 37/37、Changedoc + Workflow L2 124/124、Daily/Wiki/binding 共享回归 43/43、package 和 Docker backend build 均通过。
- 当前分支 backend 重建后 healthy，PostgreSQL healthy，HTTP 200，Flyway V79，Redis 会话保留，启动及事件日志无未解释 ERROR/Exception。
- 最终 Playwright 证据 `/tmp/rem-p1-073-change020-final/result.json`：文档 #298 进入唯一统一待办，真实 `/workflow/todo` 跳转详情，旧旁路 409，UI 拒绝后状态 `rejected`、snapshot=3、审计/通知存在，Console/5xx/cleanupErrors 均为 0。
- 只读数据库核验：#298 runtime=0、history=0、mapping=0、active notification=0、active document=0、snapshot=0；事件 manifest objects=0、cleanupFailures=0。软删除业务/通知审计行按已批准生命周期保留，不属于活动残留。
- 回滚：回滚本事件提交即可恢复原 direct approval 接线；无 schema 变化。L4 历史 `CHANGE-020 FAIL` 保持不变，待 no-ff 合并后在同一 run affected-only 重验。
