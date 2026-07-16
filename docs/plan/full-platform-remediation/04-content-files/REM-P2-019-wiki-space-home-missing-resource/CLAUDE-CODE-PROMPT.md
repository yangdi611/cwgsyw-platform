# REM-P2-019 执行入口

在 `/Users/byron/AI/cwgsyw-platform` 完成唯一事件 `REM-P2-019`。先读根规则、事件五件套与 L4 原始 FAIL；保持 Wiki ACL、后端 404、路由和数据不变。

修改 `WikiSpaceHomePage` 前已完成 LOW upstream impact。只让 tree query 在空间确实存在时运行；完成 lint/typecheck、当前分支 frontend 容器、无效/有效空间 Playwright 复验、`detect_changes`，回写台账后独立提交并 `--no-ff` 合并 `lint-fix`。禁止秘密输出、授权/数据库修改、push 与全局切换。
