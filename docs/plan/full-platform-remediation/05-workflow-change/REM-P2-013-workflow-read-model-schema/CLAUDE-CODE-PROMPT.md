# REM-P2-013 Claude Code 执行入口

只完成 `REM-P2-013：Workflow 活动历史与统计读模型 schema`。依次读取仓库/质量规则、总 `README/INDEX/FQA-COVERAGE-MATRIX`、本目录五份文档、`defects.md` 中 `BUG-FQA-028`、`BUG-FQA-036` 和原始证据。

批准范围：引入类型化活动与统计 DTO；统一 camelCase JSON；处理 null/zero duration；同步前端类型。非目标：不改变流程运行状态；不重算历史数据；不修改审批权限。检查 branch/worktree；先 GitNexus query/context，对每个拟编辑符号 upstream impact，`HIGH/CRITICAL` 先告警。最小根因改动，执行 `AC-001..006`、L1-L4 和 `detect_changes`。

测试对象带 remediation runId，只经产品 API 清理。禁止秘密落盘、非测试状态/授权变更、全租户切换、restore、全局 session 清理、提交或 push，除非用户另行批准。回写实施记录、验证、事件卡和总索引；L4 未通过不得 `CLOSED`，不可逆/越界/未解释 5xx 时停止。
