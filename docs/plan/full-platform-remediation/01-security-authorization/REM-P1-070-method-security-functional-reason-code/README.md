# REM-P1-070：方法级功能权限拒绝 reason code

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-070` |
| 优先级 / 领域 | P1 / 核心授权与统一错误合同 |
| 状态 | `VERIFIED` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `RBAC-025`、`XL-RBAC-006` |
| 分支 | `codex/rem-p1-070-method-security-functional-reason-code` |
| 基线 | `lint-fix@407f1abe` |
| 事件运行 | `REM_P1_070_20260721` |
| 首次失败证据 | `/tmp/fqa-2050-rbac-remaining-after-rem-p1-069-r3`；快照 `79c1ffec` |

移除用户最后一条功能权限 assignment 后，`@PreAuthorize` 在控制器前返回 HTTP 403，但响应只有通用错误体，缺少授权合同要求的 `FUNCTION_PERMISSION_DENIED`。根因是方法级 `AccessDeniedException` 进入 MVC `GlobalExceptionHandler`，而不是 Security filter 的 `AccessDeniedHandler`。

GitNexus 对 `filterChain` 与 `GlobalExceptionHandler.handleAccessDenied` 的 upstream impact 均为 LOW、无图谱直接调用者或已登记流程；由于两者属于全局安全基础设施，事件仍按全局权限响应边界完成 Authorization、通知 Controller 与真实 Wiki API 回归。

L1-L3 已通过：Java 21 定向安全簇退出码 0，生产 backend 构建、健康与 Flyway V79 通过，真实会话撤销最后功能授权 Playwright `1/1`；所有临时用户、角色、assignment、Wiki 页面与空间均通过产品 API 精确清理，backend 无 ERROR/未处理 5xx。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
