# REM-P1-003 执行入口

在 `/Users/byron/AI/cwgsyw-platform` 的 `codex/fqa-056-unassigned-business-group-exclusivity` 分支完成唯一事件 `REM-P1-003`。先读取 `AGENTS.md`、本目录全部文档和 `BUG-FQA-056` 原始证据；保留所有既有工作区改动。

编辑任何符号前执行 GitNexus upstream impact；`GroupMembershipService.add` 已知为 HIGH，必须保持授权写锁与事务边界。只实现双向 membership 互斥：已有未分配组时拒绝新增业务组，不自动迁组、不清理存量、不触及 assignment/session/schema。

依次完成 L1 单测、L2 runId API 双向顺序、L3 主/非主/重复/effective-scope 回归；测试对象必须使用 `REM_P1_003_<时间>_fqa056` 前缀且仅经产品 API 清理。随后运行 `detect_changes`，回写 `README.md`、`VERIFICATION.md`、`IMPLEMENTATION-RECORD.md` 和总索引。未满足 `AC-001..004` 不得关闭；L4 全量验收留待全部事件完成后执行。
