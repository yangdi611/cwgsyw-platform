# REM-P1-022 Claude Code 执行入口

只完成 `REM-P1-022：共享文件 write 权限运行时消费者`。按顺序读取仓库规则、质量规则、总 `README/INDEX/FQA-COVERAGE-MATRIX`、本目录五份文档、`defects.md` 中 `BUG-FQA-077` 与原始证据。

批准范围：先作保留/下架 action 的产品决策；若保留，实现受 update/write ACL 保护的元数据 mutation；同步 UI、权限矩阵、审计和冲突合同。非目标：不把 folder manage 当成 file update；不默认允许覆盖文件内容；不改变 read/delete 权限。检查 branch/worktree 后先 GitNexus query/context；编辑每个符号前 upstream impact，`HIGH/CRITICAL` 先告警。只做最小根因改动，执行 `AC-001..006` 的 L1-L4 和 `detect_changes`。

测试数据带 remediation runId，只经产品 API 精确清理。禁止秘密落盘、非测试 ACL/授权变更、全租户切换、restore、全局会话清理、提交或 push，除非用户另行批准。回写实施记录、验证、事件卡和总索引；L4 未通过不得 `CLOSED`，不可逆/越界/未解释 5xx 时停止。
