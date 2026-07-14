# REM-P1-023 Claude Code 执行入口

只完成 `REM-P1-023：Workflow BPMN 输入校验与设计往返完整性`。依次读取仓库/质量规则、总 `README/INDEX/FQA-COVERAGE-MATRIX`、本目录五份文档、`defects.md` 中 `BUG-FQA-021`、`BUG-FQA-084`、`BUG-FQA-104`、`BUG-FQA-105` 和原始证据。

批准范围：key 与 XML preflight 校验并映射 4xx；补完整 BPMN 命名空间和最小开始/结束结构；统一 name/category/description/XML 保存回读；条件流、assignee、candidateGroups 往返测试。非目标：不替换 Flowable；不迁移所有历史 BPMN；不改变流程权限。检查 branch/worktree；先 GitNexus query/context，对每个拟编辑符号 upstream impact，`HIGH/CRITICAL` 先告警。最小根因改动，执行 `AC-001..006`、L1-L4 和 `detect_changes`。

测试对象带 remediation runId，只经产品 API 清理。禁止秘密落盘、非测试状态/授权变更、全租户切换、restore、全局 session 清理、提交或 push，除非用户另行批准。回写实施记录、验证、事件卡和总索引；L4 未通过不得 `CLOSED`，不可逆/越界/未解释 5xx 时停止。
