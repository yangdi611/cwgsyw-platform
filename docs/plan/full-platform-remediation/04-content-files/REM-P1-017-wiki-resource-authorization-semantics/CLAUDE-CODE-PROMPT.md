# REM-P1-017 Claude Code 执行入口

只完成 `REM-P1-017：Wiki 资源授权、归属组与不存在语义`。按顺序读取仓库规则、质量规则、总 `README/INDEX/FQA-COVERAGE-MATRIX`、本目录五份文档、`defects.md` 中 `BUG-FQA-045`、`BUG-FQA-058`、`BUG-FQA-067`、`BUG-FQA-089` 与原始证据。

批准范围：先确认资源存在性再执行不泄露的授权映射；明确 owner/named-user/matched-group/others effective bits；修复父页 create 与 ACL 继承；对齐 platform 管理员 ownerGroup 选择和后端裁决。非目标：不绕过统一授权；不切换全租户授权模式；不修改非测试 Wiki ACL。检查 branch/worktree 后先 GitNexus query/context；编辑每个符号前 upstream impact，`HIGH/CRITICAL` 先告警。只做最小根因改动，执行 `AC-001..006` 的 L1-L4 和 `detect_changes`。

测试数据带 remediation runId，只经产品 API 精确清理。禁止秘密落盘、非测试 ACL/授权变更、全租户切换、restore、全局会话清理、提交或 push，除非用户另行批准。回写实施记录、验证、事件卡和总索引；L4 未通过不得 `CLOSED`，不可逆/越界/未解释 5xx 时停止。
