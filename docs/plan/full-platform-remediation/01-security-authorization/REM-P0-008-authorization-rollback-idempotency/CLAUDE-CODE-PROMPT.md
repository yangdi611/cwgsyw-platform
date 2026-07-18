# REM-P0-008 执行入口

完成唯一事件 `REM-P0-008`。仅在 `codex/rem-p0-008-authorization-rollback-idempotency` 工作，修复重复 Rollback 的状态机幂等性。

这是 CRITICAL 授权路径。只允许在 `AuthorizationCutoverService.rollback` 写路径前增加锁定状态检查，保留首次回退和首次/回退后 Enforce 行为。完成 L1-L3、文档回写、精确提交并 no-ff 合并后，必须从新 `lint-fix` 全新重置 L4。
