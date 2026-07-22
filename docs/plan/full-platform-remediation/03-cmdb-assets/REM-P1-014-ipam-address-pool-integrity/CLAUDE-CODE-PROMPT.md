# REM-P1-014 Claude Code 执行入口

在 `/Users/byron/AI/cwgsyw-platform` 只完成 `REM-P1-014：IPAM 地址池、分配与范围完整性`。先读 `AGENTS.md`、`CLAUDE.md`、质量规则、总 `README/INDEX/FQA-COVERAGE-MATRIX`、本目录五份文档，以及 `defects.md` 中 `BUG-FQA-041`、`BUG-FQA-064`、`BUG-FQA-072`、`BUG-FQA-073`、`BUG-FQA-075` 和原始证据。

已批准范围：建立地址池 group ownership 与范围裁决；规范化 CIDR 并检测重复/重叠；验证 gateway/DNS/host 地址；复用 released allocation；服务端冲突与前端提交幂等。非目标：不自动重分配现有地址；不直接修复存量冲突而无迁移报告；不改变 IPv6 支持范围。不得扩展到其他 REM。

开始前检查 branch/worktree；GitNexus query/context 后，对每个拟编辑符号运行 upstream impact，`HIGH/CRITICAL` 先告警。实施最小根因修复，按 `AC-001..006` 执行 L1-L4；完成后运行 `detect_changes`。测试数据必须带 remediation runId 并只经产品 API 精确清理。禁止秘密落盘、修改非测试授权、全租户切换、restore、全局 session 清理、提交或 push，除非用户另行明确授权。

回写 `IMPLEMENTATION-RECORD.md`、`VERIFICATION.md`、事件 `README.md` 和总索引。L4 未通过不得标记 `CLOSED`；不可逆数据、合同冲突、未解释 5xx 或越界时停止并标记 `BLOCKED/FAIL`。
