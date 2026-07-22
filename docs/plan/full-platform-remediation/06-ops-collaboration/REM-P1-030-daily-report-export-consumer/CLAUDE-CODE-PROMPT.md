# REM-P1-030 Claude Code 执行入口

只完成 `REM-P1-030：日报导出权限运行时消费者`。依次读取仓库/质量规则、总 `README/INDEX/FQA-COVERAGE-MATRIX`、本目录五份文档、`defects.md` 中 `BUG-FQA-094` 和原始证据。

批准范围：决定实现或下架 export action；若实现，提供日期范围下载 API/UI；应用数据范围、文件合同与审计；同步 permission consumer 分类。非目标：不复用语义不同的综合报表冒充日报导出；不扩大日报 read 权限；不改变审批流程。检查 branch/worktree；先 GitNexus query/context，对每个拟编辑符号 upstream impact，`HIGH/CRITICAL` 先告警。最小根因改动，执行 `AC-001..006`、L1-L4 和 `detect_changes`。

测试对象带 remediation runId，只经产品 API 清理。禁止秘密落盘、非测试状态/授权变更、全租户切换、restore、全局 session 清理、提交或 push，除非用户另行批准。回写实施记录、验证、事件卡和总索引；L4 未通过不得 `CLOSED`，不可逆/越界/未解释 5xx 时停止。
