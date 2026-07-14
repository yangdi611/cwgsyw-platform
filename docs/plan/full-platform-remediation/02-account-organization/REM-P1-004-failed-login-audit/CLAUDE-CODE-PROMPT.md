# REM-P1-004 执行入口

在 `/Users/byron/AI/cwgsyw-platform/.worktree/fqa-006-failed-login-audit` 的 `codex/fqa-006-failed-login-audit` 分支完成唯一事件 `REM-P1-004`。先读取 `AGENTS.md`、本目录文档和主工作区 `BUG-FQA-006` 原始证据；不得修改主工作区或其他 agent 的文件。

编辑认证或审计符号前运行 GitNexus upstream impact；HIGH/CRITICAL 先报告。仅实现登录失败审计，不记录密码、token 或详细认证原因，不修改密码策略、账户锁定、session、权限或 schema。使用 runId API 复验并通过产品 API 清理；完成后运行 `detect_changes`，回写本目录和总索引。`AC-001..004` 未通过不得关闭，L4 全量验收留待最终统一执行。
