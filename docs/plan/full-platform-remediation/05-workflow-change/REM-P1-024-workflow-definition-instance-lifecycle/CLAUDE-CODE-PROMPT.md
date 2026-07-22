# REM-P1-024 Claude Code 执行入口

只完成 `REM-P1-024：Workflow 定义版本与实例状态生命周期`。依次读取仓库/质量规则、总 `README/INDEX/FQA-COVERAGE-MATRIX`、本目录五份文档、`defects.md` 中 `BUG-FQA-081`、`BUG-FQA-099` 和原始证据。

批准范围：明确并实现单版本/全版本删除语义；保护 binding 与运行实例；挂起定义发起前置校验；实例终止、审计和稳定 4xx 合同。非目标：不批量删除历史流程；不绕过业务回调；不改变 BPMN 内容。检查 branch/worktree；先 GitNexus query/context，对每个拟编辑符号 upstream impact，`HIGH/CRITICAL` 先告警。最小根因改动，执行 `AC-001..006`、L1-L4 和 `detect_changes`。

测试对象带 remediation runId，只经产品 API 清理。禁止秘密落盘、非测试状态/授权变更、全租户切换、restore、全局 session 清理、提交或 push，除非用户另行批准。回写实施记录、验证、事件卡和总索引；L4 未通过不得 `CLOSED`，不可逆/越界/未解释 5xx 时停止。
