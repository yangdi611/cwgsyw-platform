# REM-P2-014 Claude Code 执行入口

只完成 `REM-P2-014：周期规则删除与确认入口`。依次读取仓库/质量规则、总 `README/INDEX/FQA-COVERAGE-MATRIX`、本目录五份文档、`defects.md` 中 `BUG-FQA-097` 和原始证据。

批准范围：增加 manage 权限删除按钮；确认/取消与成功刷新；受引用/删除失败提示；核对审计。非目标：不修改删除 API 语义；不批量删除规则；不改变启停流程。检查 branch/worktree；先 GitNexus query/context，对每个拟编辑符号 upstream impact，`HIGH/CRITICAL` 先告警。最小根因改动，执行 `AC-001..006`、L1-L4 和 `detect_changes`。

测试对象带 remediation runId，只经产品 API 清理。禁止秘密落盘、非测试状态/授权变更、全租户切换、restore、全局 session 清理、提交或 push，除非用户另行批准。回写实施记录、验证、事件卡和总索引；L4 未通过不得 `CLOSED`，不可逆/越界/未解释 5xx 时停止。
