# REM-P0-007 执行入口

完成唯一事件 `REM-P0-007`。先读取根 `AGENTS.md`、整改 README/INDEX、事件五件套和 L4 `ST-AUTHZ-020` 失败证据。只从 `codex/rem-p0-007-authorization-cutover-idempotency` 分支工作。

这是 CRITICAL 授权状态机。只允许在 `AuthorizationCutoverService.enforce` 写路径前实现重复 Enforce 拒绝，保留首次和 rollback 后 Enforce 行为。编辑前执行可用影响分析；禁止执行额外 Rollback/Enforce、break-glass、backfill、restore、外部写入或 SQL 修复历史 epoch。

完成服务 L1、API/UI L2、当前分支 backend 容器 L3；写回五件套和全局台账，运行变更影响检查后精确提交并 `--no-ff` 合并。合并后必须从新 `lint-fix` 完整重置 275+78 L4，旧 PASS 不继承。
