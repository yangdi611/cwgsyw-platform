# REM-P2-032 执行入口

在 `codex/rem-p2-032-dashboard-change-doc-list-contract` 上仅完成本事件：工作台必须把 `/change-docs` 分页响应归一化成 records 数组，避免登录后首页运行时崩溃。

先读取根 `AGENTS.md`、本事件五件套、最终 L4 `AUTH-001` 证据和检查点。编辑 `DashboardPage` 前必须执行并记录 GitNexus upstream impact；仅允许最小前端读取修复。禁止改后端 API、权限、数据、会话、外部集成或非测试对象。密码只在运行时读取环境变量，不能写入证据。

完成 L1 typecheck/lint、L2 响应归一化、L3 当前分支前端容器与 Playwright 登录-首页-登出-回跳复验。回写本事件记录、全局索引/矩阵/检查点；提交前运行 GitNexus detect_changes。仅所有 AC PASS 后提交并 `--no-ff` 合并到 lint-fix；随后从新的集成基线恢复最终 L4。
