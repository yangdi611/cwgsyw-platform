# REM-P1-051：运维任务确认幂等

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-051` |
| 优先级 | P1 |
| 领域 | `06-ops-collaboration` |
| 状态 | `CLOSED` |
| 风险 | `MEDIUM` |
| 分支 | `codex/rem-p1-051-ops-confirm-idempotency` |
| 基线 | `lint-fix@7af9f24a` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `L4-OPS-010-001` |

## 问题

两个并发“确认收到”请求都可读取 `pending_confirm` 并各自产生状态、任务日志和审计副作用。当前事件以事务行锁串行确认状态转换，保持首个请求成功、重复请求 HTTP 400 的现有合同。

L1-L3 已通过：Java 21 受影响聚类 36/36、生产 backend build、当前分支 backend healthy、真实 API 并发与 UI 双击 1/1 PASS；每个任务只有一条 confirm 日志与审计，manifest 和测试对象均为零。事件提交 `305d527e` 已创建，当前 no-ff 合并后同 run affected-only 重验 `OPS-010`。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
