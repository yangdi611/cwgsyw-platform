# REM-P2-008 Claude Code 执行入口

只完成 `REM-P2-008：Wiki 未知链接友好渲染`。按顺序读取仓库规则、质量规则、总 `README/INDEX/FQA-COVERAGE-MATRIX`、本目录五份文档、`defects.md` 中 `BUG-FQA-046` 与原始证据。

批准范围：定义未知/已删除/无权链接三态；以可访问组件渲染提示；保留普通外链和内部有效链接。非目标：不替换 Markdown 引擎；不自动创建缺失页面；不泄露无权目标信息。检查 branch/worktree 后先 GitNexus query/context；编辑每个符号前 upstream impact，`HIGH/CRITICAL` 先告警。只做最小根因改动，执行 `AC-001..006` 的 L1-L4 和 `detect_changes`。

测试数据带 remediation runId，只经产品 API 精确清理。禁止秘密落盘、非测试 ACL/授权变更、全租户切换、restore、全局会话清理、提交或 push，除非用户另行批准。回写实施记录、验证、事件卡和总索引；L4 未通过不得 `CLOSED`，不可逆/越界/未解释 5xx 时停止。
