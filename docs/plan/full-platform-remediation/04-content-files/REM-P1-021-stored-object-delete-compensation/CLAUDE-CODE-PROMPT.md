# REM-P1-021 Claude Code 执行入口

只完成 `REM-P1-021：共享文件与 Wiki 附件存储回收`。按顺序读取仓库规则、质量规则、总 `README/INDEX/FQA-COVERAGE-MATRIX`、本目录五份文档、`defects.md` 中 `BUG-FQA-053` 与原始证据。

批准范围：定义记录/对象删除顺序和幂等语义；共享文件与 Wiki 附件统一回收；失败补偿任务与可观测状态；只清理可证明归属的 runId 对象。非目标：不执行全桶扫描删除；不删除历史孤儿对象而无报告；不改变下载权限。检查 branch/worktree 后先 GitNexus query/context；编辑每个符号前 upstream impact，`HIGH/CRITICAL` 先告警。只做最小根因改动，执行 `AC-001..006` 的 L1-L4 和 `detect_changes`。

测试数据带 remediation runId，只经产品 API 精确清理。禁止秘密落盘、非测试 ACL/授权变更、全租户切换、restore、全局会话清理、提交或 push，除非用户另行批准。回写实施记录、验证、事件卡和总索引；L4 未通过不得 `CLOSED`，不可逆/越界/未解释 5xx 时停止。
