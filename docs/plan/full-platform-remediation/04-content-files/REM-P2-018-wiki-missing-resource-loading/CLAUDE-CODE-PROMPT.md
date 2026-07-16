# REM-P2-018 执行入口

在 `/Users/byron/AI/cwgsyw-platform` 完成唯一事件 `REM-P2-018`。先读根 `AGENTS.md`、`CLAUDE.md`、本目录五件套、L4 run 记录；不得修改其他事件。

目标：将不存在 Wiki 资源的前端 query error 渲染为友好空态，保留 API 404、ACL、路由和 query key。编辑 `WikiPageReader` 前已完成 upstream impact（LOW）；提交前仍运行 `detect_changes`。

必须在当前事件分支完成 lint/typecheck、frontend 容器构建、真实 Playwright 的不存在与合法页面复验、Console/Network 检查，回写全部事件与全局台账，精确暂存提交并 `--no-ff` 合并 `lint-fix`。不得输出秘密、改动授权/数据库/非测试对象、push 或执行全局授权切换。
