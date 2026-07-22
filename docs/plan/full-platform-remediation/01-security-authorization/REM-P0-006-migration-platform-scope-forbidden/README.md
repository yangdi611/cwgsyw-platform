# REM-P0-006：迁移工作台 platform scope 拒绝合同

| 属性 | 值 |
|---|---|
| 事件 ID | `REM-P0-006` |
| 优先级 | P0 |
| 状态 | `CLOSED` |
| 来源 | L4 `FQA_20260718_0245_remp1037_l4` / `AUTHZ-002` |
| 分支 | `codex/rem-p0-006-migration-platform-scope-forbidden` |
| 下一门禁 | no-ff 合并后完整重置 L4 |

## 问题与范围

拥有迁移读取权限但非 `platform` scope 的已认证会话被 Controller scope guard 错误返回 HTTP `400`；合同要求稳定的 HTTP `403`。本事件仅将该 guard 映射到既有 Spring Security 拒绝路径，覆盖迁移读取端点的 deny 与 platform allow。

不改变 permission、assignment、ACL、cutover、break-glass 或任何授权数据；不执行 Enforce、Rollback、backfill、异常清理或转换。

GitNexus upstream impact 为 `CRITICAL`：10 个直接调用端点、7 条授权流程。改动只限已有 scope guard 的异常类型。

## 导航

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
