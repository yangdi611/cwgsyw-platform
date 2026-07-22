# REM-P2-032 实施记录

## 2026-07-17：事件创建与失败确认

- 基线：`lint-fix@de196e8275a8a8891e119e9fa64c75c9cd49d5e3`；分支 `codex/rem-p2-032-dashboard-change-doc-list-contract`。
- L4 Playwright 从真实 `/login` 登录后进入 `/`。约一秒后页面进入错误边界，错误为 `_.filter is not a function`；没有业务写入。
- 源码与浏览器 chunk 对照确认：`DashboardPage` 将 `/change-docs` 分页响应赋给 `docs`，随后以数组调用 `.filter`。
- GitNexus：`impact(DashboardPage, upstream)` 为 0 个直接调用者、1 个流程、`LOW`；`context` 显示工作台依赖权限、日历卡和 v2 组件。只修改该工作台读取点。
- 原始 L4 关闭已按合同停止；本事件完成 L1-L3、合并后才恢复最终 L4。

## 2026-07-17：实现与 L1-L3 完成

- 仅修改 `DashboardPage`：新增分页响应类型并让 `change-docs-dashboard` query 返回 `records`，使下游 `docsList` 始终为数组或空数组。
- L1：`frontend/npm run typecheck` 与 `npm run lint -- --quiet` 均通过。
- L2：类型归一化将 API 分页形状固定在 query 边界，保留原 query key、endpoint、权限 gate 和失败返回 `undefined`。
- L3：从本事件工作区构建并替换 `frontend` 容器；健康启动后以独立 Playwright 完成真实登录、等待回填、打开用户菜单、登出、访问受保护首页回登录。`result.json` 为 pass，page/console error 与失败请求均为零。
- 未创建测试对象；无数据、权限、会话全局状态或外部集成变更；无清理项。
