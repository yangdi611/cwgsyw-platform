# REM-P1-039：备份页面路由授权一致性

| 项目 | 值 |
|---|---|
| 状态 | `CLOSED` |
| 优先级 | P1 |
| 领域 | 平台与集成 / 备份 |
| 分支 | `codex/rem-p1-039-backup-route-authorization-parity` |
| 基线 | `lint-fix@4d7b3e1bf9432d6c7fcf4f8237f671ac046d0b28` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `L4-BACKUP-003-001` |

## 问题与影响

初始 L4 测试将 API 路径 `/backups` 错当作前端页面路径，因而错误报告了路由越权。真实备份页面为 `/admin/backup`，其既有页面级 `backup:read` 守卫已正确回退无权限用户。

## 范围

- 不修改产品代码；以真实路径验证既有页面守卫、API 拒绝和允许路径。

不改后端 API、备份记录、恢复行为、角色模型或非测试授权。

## 风险与下一门禁

GitNexus：`BackupPage` upstream 为 0 个直接调用者、`LOW`；`requiredRoutePermission` 有 1 个直接调用者（`DashboardLayout`）和 6 个相关布局流程，`LOW`。真实路径 L1-L3 复验和精确清理通过；无需代码修改。

文件：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [执行 Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
