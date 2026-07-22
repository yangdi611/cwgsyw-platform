# REM-P0-007：授权切换幂等性

| 属性 | 值 |
|---|---|
| 事件 ID | `REM-P0-007` |
| 优先级 | P0 |
| 状态 | `CLOSED` |
| 来源 | L4 `FQA_20260718_1507_remp2020` / `ST-AUTHZ-020` |
| 分支 | `codex/rem-p0-007-authorization-cutover-idempotency` |
| 基线 | `lint-fix@f513e96a` |
| 下一门禁 | 事件提交、`--no-ff` 合并后完整重置 L4 |

## 问题与范围

租户已经处于 `enforced` 时，重复提交有效 `ENFORCE` 确认会再次更新 rollout、递增 epoch 并写入审计。状态机合同要求 UI/API 拒绝重复切换，且 status、epoch、enforcedAt、rollout 与审计均不变。

本事件仅在 Enforce 写路径前增加行锁保护的当前状态检查，并补充服务/API/UI 回归。不会执行 Rollback、Enforce、backfill、break-glass、restore 或外部服务写入来验证修复。

## 风险

授权切换是 CRITICAL 路径：直接入口为 `AuthorizationMigrationController.enforce`，下游会更新 tenant cutover、account rollout 和审计。L4 初次复现已在已授权窗口造成一次 epoch 单调增加；本事件后续验证只进行重复 Enforce 的拒绝路径，不再改变租户模式。

## 导航

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
