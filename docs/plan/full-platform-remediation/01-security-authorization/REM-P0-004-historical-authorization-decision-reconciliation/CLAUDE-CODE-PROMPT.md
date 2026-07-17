# REM-P0-004 执行入口

在分支 `codex/rem-p0-004-historical-authorization-decision-reconciliation` 处理 8 条 Shadow 历史授权判定差异。完整读取根 `AGENTS.md`、整改总索引、检查点和本事件五件套。

仅实现本事件 SPEC：Bug 反馈空间策略、Wiki 页面与空间 ACL 的 grant 合并、活跃资源差异口径。编辑任何方法前运行 GitNexus upstream impact；`AuthorizationService.resourcePermissions` 为 HIGH 风险，必须回归 Wiki 与 Sharedfile。

不得批量改 ACL、角色或 assignment，不得删除审计观测，不得执行 Rollback/Enforce、清空 Redis/会话或重置数据卷。L3 使用当前分支 Shadow backend 和产品 API；测试对象以 runId 标识并精确清理。
