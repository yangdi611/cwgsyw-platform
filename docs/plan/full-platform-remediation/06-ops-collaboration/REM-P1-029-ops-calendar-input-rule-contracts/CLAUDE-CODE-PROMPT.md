# REM-P1-029 Claude Code 执行入口

只完成 `REM-P1-029：运维日历任务、节假日与周期规则输入合同`。依次读取仓库/质量规则、总 `README/INDEX/FQA-COVERAGE-MATRIX`、本目录五份文档、`defects.md` 中 `BUG-FQA-014`、`BUG-FQA-020`、`BUG-FQA-082` 和原始证据。

批准范围：统一 task priority/type 枚举；HolidayRequest 字段与日期/类型校验；Cron parser、generateDaysAhead、dueConfig 时序校验；保存前 preview 与实际生成一致。非目标：不重做日历调度架构；不自动修复存量非法规则；不执行不可清理任务状态链。检查 branch/worktree；先 GitNexus query/context，对每个拟编辑符号 upstream impact，`HIGH/CRITICAL` 先告警。最小根因改动，执行 `AC-001..006`、L1-L4 和 `detect_changes`。

测试对象带 remediation runId，只经产品 API 清理。禁止秘密落盘、非测试状态/授权变更、全租户切换、restore、全局 session 清理、提交或 push，除非用户另行批准。回写实施记录、验证、事件卡和总索引；L4 未通过不得 `CLOSED`，不可逆/越界/未解释 5xx 时停止。
