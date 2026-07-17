# REM-P1-036：登录失败反馈保留

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-036` |
| 优先级 | P1 |
| 领域 | `02-account-organization` |
| 状态 | `VERIFIED` |
| 分支 | `codex/rem-p1-036-login-error-feedback` |
| 基线 | `lint-fix@cccd0ef6` |
| 来源 | `FQA_20260717_2359_remp1035_l4` / `L4-AUTH-003-LOGIN-ERROR-RESET` / `AUTH-003` |

错误密码或不存在用户名保持登录页并显示统一错误提示。真实已认证会话失效时的统一登出行为保持不变。L1-L3 已通过；下一门禁是从合并后的 `lint-fix` 启动新的完整 L4。

范围仅限前端 API 响应拦截器对登录请求 `401` 的处理及定向回归。非目标：变更后端登录码、失败审计、密码策略、锁定策略、JWT 或 Redis session。
