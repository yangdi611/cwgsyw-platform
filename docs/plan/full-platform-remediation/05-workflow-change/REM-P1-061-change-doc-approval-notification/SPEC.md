# REM-P1-061 实施合同

## 目标

变更文档每次有效审批通过或拒绝后，申请人收到且只收到一条可导航通知；直接审批与 workflow 完成路径合同一致。

## 范围

- `ChangeDocService.approve` 在成功终态转换事务中发送申请人通知。
- `ChangeDocService.handleWorkflowApproval` 复用相同投递逻辑。
- `ChangeDocWorkflowAdapter` 不再重复发送通知。
- 增加直接审批、workflow、通过/拒绝、长/空意见、引用字段和幂等回归。

## 非目标

不改变审批权限、状态、模板、归档、邮件配置、通知列表权限、数据库结构、全租户授权配置或历史通知。

## 验收

| ID | 合同 |
|---|---|
| AC-001 | 直接通过和拒绝各向申请人生成一条通知，`refType=change_doc`、`refId=文档 ID`。 |
| AC-002 | workflow 完成使用相同标题、正文、类型和引用，不产生 adapter 重复通知。 |
| AC-003 | 1024 字符 Unicode 和空意见不阻断审批；正文保持有界且不产生 5xx。 |
| AC-004 | 重复终态调用不新增通知，状态、快照、审计和归档既有合同保持。 |
| AC-005 | 所有事件夹具通过产品 API 清理，manifest 零对象、零失败。 |

## GitNexus 影响

- `ChangeDocService.approve`：LOW，1 个直接 Controller 调用者，Changedoc 模块，无已索引流程。
- `handleWorkflowApproval`：LOW，1 个 adapter 调用者，无已索引流程。
- `ChangeDocWorkflowAdapter.onWorkflowCompleted`：LOW，无上游符号或已索引流程。
- `ChangeDocService` 构造依赖变化：LOW，2 个直接依赖点。

## 回滚

回滚本事件提交即可恢复原投递位置；无迁移、配置、授权切换或历史数据改写。
