# REM-P0-008：授权回退幂等性

| 属性 | 值 |
|---|---|
| 事件 ID | `REM-P0-008` |
| 优先级 | P0 |
| 状态 | `VERIFIED` |
| 来源 | L4 `FQA_20260718_1550_remp0007` / `ST-AUTHZ-021` |
| 分支 | `codex/rem-p0-008-authorization-rollback-idempotency` |
| 基线 | `lint-fix@00eed219` |
| 下一门禁 | 事件提交、`--no-ff` 合并后完整重置 L4 |

## 问题与范围

已处于 `rollback` 的租户再次提交有效 `ROLLBACK` 时，服务仍返回成功并重写 rollout 与审计。状态机合同要求拒绝重复回退，保持状态、epoch、rollout 和审计不变。

本事件只在 `AuthorizationCutoverService.rollback` 的写路径前加入当前状态锁定和拒绝保护，并补充服务/API/UI 回归。

## 风险

这是授权切换核心路径。直接入口为 `AuthorizationMigrationController.rollback`，其下游写入 tenant cutover、账户 rollout 和审计。L4 已在用户授权窗口内复现并立即恢复为 `enforced`。

## 导航

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)
