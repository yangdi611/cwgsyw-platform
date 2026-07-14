# REM-P2-003 Claude Code 执行入口

只完成 `REM-P2-003：Wiki 页面标题规范与同级唯一性`。按顺序读取仓库规则、质量规则、总 `README/INDEX/FQA-COVERAGE-MATRIX`、本目录五份文档、`defects.md` 中 `BUG-FQA-057` 与原始证据。

批准范围：DTO 与服务层规范化；同级唯一冲突合同；必要唯一约束与并发处理；前端即时校验。非目标：不改变页面路径策略；不批量重命名历史页面；不修改正文编辑。检查 branch/worktree 后先 GitNexus query/context；编辑每个符号前 upstream impact，`HIGH/CRITICAL` 先告警。只做最小根因改动，执行 `AC-001..006` 的 L1-L4 和 `detect_changes`。

测试数据带 remediation runId，只经产品 API 精确清理。禁止秘密落盘、非测试 ACL/授权变更、全租户切换、restore、全局会话清理、提交或 push，除非用户另行批准。回写实施记录、验证、事件卡和总索引；L4 未通过不得 `CLOSED`，不可逆/越界/未解释 5xx 时停止。
