# REM-P2-028 执行入口

在 `/Users/byron/AI/cwgsyw-platform` 继续唯一事件 `REM-P2-028：变更文档终态测试受限清理`。先读根 `AGENTS.md`、整改 README/INDEX/检查点、本目录五件套以及 L4 `CHANGE-005` 记录；不要覆盖原始 FAIL。

仅允许维护 `DELETE /api/change-docs/{id}/remediation-test` 的严格清理合同：要求 `change_doc:delete`、同 tenant、非空且命中文档快照的 runId，拒绝 `approved`；只清理该文档的 CI links/snapshots 并软删除，保留审计。不得改变普通删除、审批归档、模板规则、共享文件资产、权限模型、Redis、会话、数据库卷或历史业务数据。

编辑符号前运行 GitNexus upstream impact；提交前运行 detect_changes。验证必须用产品 API：错误 runId 保留、approved 拒绝、带 runId 的 `plan_pending` 精确删除、读后不存在、审计存在。完成后回写五件套和全局台账，独立提交并 no-ff 合并到 `lint-fix`；从合并头重跑 `CHANGE-005`。不得 push。
