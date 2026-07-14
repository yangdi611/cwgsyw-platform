# REM-P2-002 Claude Code 执行入口

在 `/Users/byron/AI/cwgsyw-platform` 只完成 `REM-P2-002：CMDB 变更查询与统计准确性`。先读 `AGENTS.md`、`CLAUDE.md`、质量规则、总 `README/INDEX/FQA-COVERAGE-MATRIX`、本目录五份文档，以及 `defects.md` 中 `BUG-FQA-026`、`BUG-FQA-051`、`BUG-FQA-052` 和原始证据。

已批准范围：修正 Top 10 参数；贯通 keyword 与分页 count；明确显式范围下 today/week/month 标签和查询语义。非目标：不重建变更记录；不增加新的统计指标；不改变默认 30 日口径之外的产品决策。不得扩展到其他 REM。

开始前检查 branch/worktree；GitNexus query/context 后，对每个拟编辑符号运行 upstream impact，`HIGH/CRITICAL` 先告警。实施最小根因修复，按 `AC-001..006` 执行 L1-L4；完成后运行 `detect_changes`。测试数据必须带 remediation runId 并只经产品 API 精确清理。禁止秘密落盘、修改非测试授权、全租户切换、restore、全局 session 清理、提交或 push，除非用户另行明确授权。

回写 `IMPLEMENTATION-RECORD.md`、`VERIFICATION.md`、事件 `README.md` 和总索引。L4 未通过不得标记 `CLOSED`；不可逆数据、合同冲突、未解释 5xx 或越界时停止并标记 `BLOCKED/FAIL`。
