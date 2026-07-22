# REM-P1-019 Claude Code 执行入口

只完成 `REM-P1-019：共享文件上传状态、冲突与可取消生命周期`。按顺序读取仓库规则、质量规则、总 `README/INDEX/FQA-COVERAGE-MATRIX`、本目录五份文档、`defects.md` 中 `BUG-FQA-065`、`BUG-FQA-066`、`BUG-FQA-068`、`BUG-FQA-100` 与原始证据。

批准范围：零字节/名称/大小/MIME 校验；同目录规范名唯一与并发冲突；上传进度与取消状态；存储成功/数据库失败及中断补偿；成功后准确刷新当前目录。非目标：不实现分片大文件上传；不改变现有 ACL 模型；不清理无法证明归属的历史对象。检查 branch/worktree 后先 GitNexus query/context；编辑每个符号前 upstream impact，`HIGH/CRITICAL` 先告警。只做最小根因改动，执行 `AC-001..006` 的 L1-L4 和 `detect_changes`。

测试数据带 remediation runId，只经产品 API 精确清理。禁止秘密落盘、非测试 ACL/授权变更、全租户切换、restore、全局会话清理、提交或 push，除非用户另行批准。回写实施记录、验证、事件卡和总索引；L4 未通过不得 `CLOSED`，不可逆/越界/未解释 5xx 时停止。
