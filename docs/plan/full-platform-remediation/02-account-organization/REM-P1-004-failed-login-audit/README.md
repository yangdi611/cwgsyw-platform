# REM-P1-004：失败登录审计

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-004` |
| 优先级 | P1 |
| 领域 | `02-account-organization` |
| 状态 | `CLOSED` |
| 分支 | `codex/fqa-006-failed-login-audit` |
| 工作树 | `.worktree/fqa-006-failed-login-audit` |
| 来源 | `FQA_20260712_0329_lintfix` / `BUG-FQA-006` / `AUTH-003` |

无论凭据错误还是登录输入校验失败，系统必须在不泄露账号信息的前提下写入可追溯的失败登录审计。定向测试、工作树构建的 API 复验和审计核对均已通过；`AC-005` 的全量 FQA 仍作为发布前统一门禁。

范围：认证入口的失败审计、审计字段脱敏和定向 API 回归。非目标：不更改密码策略、账户锁定、JWT/Redis session、全局审计筛选或其他认证缺陷。

本目录包含 `SPEC.md`、`VERIFICATION.md`、`IMPLEMENTATION-RECORD.md` 和 `CLAUDE-CODE-PROMPT.md`。

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
