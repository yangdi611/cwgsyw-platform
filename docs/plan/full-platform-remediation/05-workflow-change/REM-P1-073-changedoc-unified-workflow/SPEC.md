# REM-P1-073 实施合同

## 目标

- 当租户存在启用的 `change_doc` binding 时，变更文档首次真正进入 `pending` 必须恰好启动一个统一流程实例。
- 直接提交完整申请单+方案和 `plan_pending -> submit-plan -> pending` 两条路径行为一致。
- 统一待办返回 `businessType=change_doc`、准确业务 ID、摘要和 `/change-docs/{id}` 跳转。
- 统一任务完成后复用现有 ChangeDoc 审批、归档、通知、快照和审计语义。
- 有运行中统一流程时，旧 `/change-docs/{id}/approve` 不得旁路；无 binding 的租户继续使用原内部审批合同。
- binding 停用/删除后禁止新统一流程启动且不回退旧配置；已有实例继续，遵循用户已批准合同。
- remediation 清理只针对精确 runId 文档，清除其 Flowable runtime/history 与 `workflow_business_instance` 映射，再清理业务对象；不影响其他实例。

## 非目标

- 不修改 binding 的查找、软删除、启停或 legacy fallback 实现。
- 不迁移历史变更文档，不为无 binding 租户强制启用流程。
- 不重构旧 `/workflow/tasks` 页面；统一合同以 `/workflow/todo` 和 `/workflow/center/*` 为准。
- 不直接 SQL 写入，不清 Redis/会话，不 restore，不覆盖正式 binding。

## 验收

| ID | 合同 |
|---|---|
| AC-001 | 完整双模板提交进入 `pending` 并创建唯一 `change_doc:{id}` 流程映射和待办。 |
| AC-002 | 先申请后补方案仅在 `submit-plan` 进入 `pending` 时启动一次；重复提交拒绝且无重复实例。 |
| AC-003 | 无 binding 时不启动 Flowable，原直接审批继续；停用/删除 binding 后新启动按批准语义处理。 |
| AC-004 | 统一待办摘要、业务 URL、候选关系和 `change_doc:approve` 权限正确；低权限用户拒绝且无副作用。 |
| AC-005 | 运行中统一流程拒绝旧审批旁路；统一完成回写 approved/rejected、快照、审计、通知和归档一致且幂等。 |
| AC-006 | 启动失败回滚文档状态、快照、审计和映射；并发/重复操作至多一个实例。 |
| AC-007 | remediation 清理精确删除本 run 的 runtime/history/mapping/业务夹具，manifest 0/0，其他流程不受影响。 |

## 回滚

- 回滚事件提交即可恢复原内部审批行为；无数据库结构变更。
- 事件测试使用当前无正式 `change_doc` binding 的租户窗口，创建唯一 runId 模板实例和 binding，按文档、流程、binding、模板实例逆序通过产品 API 清理。
