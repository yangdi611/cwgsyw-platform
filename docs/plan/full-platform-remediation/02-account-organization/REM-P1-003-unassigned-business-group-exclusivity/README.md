# REM-P1-003：未分配组与业务组双向互斥

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-003` |
| 优先级 | P1 |
| 领域 | `02-account-organization` |
| 状态 | `CLOSED`（前序整改覆盖复验） |
| 分支 | `codex/fqa-056-unassigned-business-group-exclusivity` |
| 来源 | `FQA_20260712_0329_lintfix` / `BUG-FQA-056` / `RBAC-008` |

历史缺陷的起始状态已由 `REM-P1-001` 的 business-only 活动组引用门禁消除：当前产品 API 不允许创建未分配组 membership，因此无法再形成“未分配组 + 业务组”混合状态。本事件未引入新的生产代码。

## 范围与边界

- 复验用户 membership API 对未分配组的拒绝合同。
- 复验 `ActiveGroupReferenceValidator` 的 non-business 拒绝合同。
- 核验 runId 复现夹具清理为零。

不修改 assignment 撤销、会话、组生命周期、数据迁移或存量混合状态的自动修复。

详见 `SPEC.md`、`VERIFICATION.md`、`IMPLEMENTATION-RECORD.md` 与 `CLAUDE-CODE-PROMPT.md`。
