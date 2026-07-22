# REM-P2-005 Claude Code 执行入口

只完成 `REM-P2-005：Wiki 当前页面导出合同`。按顺序读取仓库规则、质量规则、总 `README/INDEX/FQA-COVERAGE-MATRIX`、本目录五份文档、`defects.md` 中 `BUG-FQA-038` 与原始证据。

批准范围：固定页面导出 endpoint 与参数类型；验证下载范围、文件名和 MIME；避免缓存/构建版本路由漂移。非目标：不修改空间导出；不新增导出格式；不处理附件存储回收。检查 branch/worktree 后先 GitNexus query/context；编辑每个符号前 upstream impact，`HIGH/CRITICAL` 先告警。只做最小根因改动，执行 `AC-001..006` 的 L1-L4 和 `detect_changes`。

测试数据带 remediation runId，只经产品 API 精确清理。禁止秘密落盘、非测试 ACL/授权变更、全租户切换、restore、全局会话清理、提交或 push，除非用户另行批准。回写实施记录、验证、事件卡和总索引；L4 未通过不得 `CLOSED`，不可逆/越界/未解释 5xx 时停止。
