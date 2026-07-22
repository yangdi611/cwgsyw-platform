# REM-P1-011 Claude Code 执行入口

在 `/Users/byron/AI/cwgsyw-platform` 只完成 `REM-P1-011：CMDB 导航、模型路由与查询合同`。先读 `AGENTS.md`、`CLAUDE.md`、质量规则、总 `README/INDEX/FQA-COVERAGE-MATRIX`、本目录五份文档，以及 `defects.md` 中 `BUG-FQA-039`、`BUG-FQA-087`、`BUG-FQA-095` 和原始证据。

已批准范围：对齐 cmdb_instance:update 门控；modelCode 只编码一次并建立类型合同；补 rack 可见性和 2D/详情导航闭环。非目标：不修改模型 CRUD 核心逻辑；不重新设计 CMDB 首页；不改变 rack U 位计算。不得扩展到其他 REM。

开始前检查 branch/worktree；GitNexus query/context 后，对每个拟编辑符号运行 upstream impact，`HIGH/CRITICAL` 先告警。实施最小根因修复，按 `AC-001..006` 执行 L1-L4；完成后运行 `detect_changes`。测试数据必须带 remediation runId 并只经产品 API 精确清理。禁止秘密落盘、修改非测试授权、全租户切换、restore、全局 session 清理、提交或 push，除非用户另行明确授权。

回写 `IMPLEMENTATION-RECORD.md`、`VERIFICATION.md`、事件 `README.md` 和总索引。L4 未通过不得标记 `CLOSED`；不可逆数据、合同冲突、未解释 5xx 或越界时停止并标记 `BLOCKED/FAIL`。
