# REM-P1-002 执行入口

你位于 `/Users/byron/AI/cwgsyw-platform`，持续完成唯一事件 `REM-P1-002：成员列表软删除一致性`。从 `IMPLEMENTATION-RECORD.md` 的下一门禁继续，不重做已有 L1 证据，不扩展到 P0 assignment/session 或组生命周期事件。

先完整读取 `AGENTS.md`、本目录 `README.md`、`SPEC.md`、`VERIFICATION.md`、`IMPLEMENTATION-RECORD.md`，再读取 `BUG-FQA-016` 原始证据。保留工作区所有既有改动；只在 `codex/fqa-016-membership-list-soft-delete` 上工作。

强制门禁：编辑符号前执行 GitNexus upstream impact；HIGH/CRITICAL 先停止报告；修改后执行 `detect_changes`；不提交、push、迁移数据、清理全局 session 或修改非测试授权，除非用户另行批准。

已决策合同：软删除 membership 不得出现在成员关系读模型；`findUserIdsByGroup` 已有活动过滤，本事件仅补齐 `GroupMembershipService.list` 及其测试。执行 L2 API 添加/删除/读取回归，再执行 L3 主组、多组、软删除用户与有效 scope 回归；所有测试对象使用 `REM_P1_002_<时间>_fqa016` 前缀并只通过产品 API 清理。

完成后回写本目录四份文档及 `../../INDEX.md`。只有 `AC-001..004` 都有可定位 PASS 证据才可标 `CLOSED`；L4 全量复验始终保留为最终统一门禁。
