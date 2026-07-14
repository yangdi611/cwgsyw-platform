# REM-P1-027 Claude Code 执行入口

只完成 `REM-P1-027：变更模板复制、字段配置与引用保护生命周期`。依次读取仓库/质量规则、总 `README/INDEX/FQA-COVERAGE-MATRIX`、本目录五份文档、`defects.md` 中 `BUG-FQA-048`、`BUG-FQA-083`、`BUG-FQA-098` 和原始证据。

批准范围：实现 clone 与 delete/archive；被文档引用时拒绝或使用不可变快照；字段 sort/default/type 合同和 UI；审计、确认及对象/字段清理。非目标：不改变既有文档快照内容；不自动删除被引用模板；不重做 DOCX 解析。检查 branch/worktree；先 GitNexus query/context，对每个拟编辑符号 upstream impact，`HIGH/CRITICAL` 先告警。最小根因改动，执行 `AC-001..006`、L1-L4 和 `detect_changes`。

测试对象带 remediation runId，只经产品 API 清理。禁止秘密落盘、非测试状态/授权变更、全租户切换、restore、全局 session 清理、提交或 push，除非用户另行批准。回写实施记录、验证、事件卡和总索引；L4 未通过不得 `CLOSED`，不可逆/越界/未解释 5xx 时停止。
