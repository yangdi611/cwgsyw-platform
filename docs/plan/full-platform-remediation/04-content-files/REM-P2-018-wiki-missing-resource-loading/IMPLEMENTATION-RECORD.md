# REM-P2-018 实施记录

## 2026-07-17：认领与根因定位

- 分支：`codex/rem-p2-018-wiki-missing-resource-loading`，基线：`lint-fix@e0468770c`。
- L4 复现：`/wiki/999999/999999` 显示“加载中…”，产生 3 条 404 Console error。
- GitNexus upstream impact：`WikiPageReader` 0 个直接调用者、0 个受影响流程/模块，风险 `LOW`。
- 根因：页面未消费 `useQuery` 的 error 状态；请求失败后的无数据状态未被渲染为中性错误态。
- 实施：为页面 query 增加 `isError`，在 error 或无 page 时渲染既有“页面不存在或已删除”文案；不触及 ACL、后端、数据或授权。
- 首次只处理阅读页后，L3 仍观察到 `/api/wiki/spaces/999999/tree` 的 404 Console error；根因是全局 `WikiTreeSidebar` 对无效路由 spaceId 无条件发 tree 请求。
- 对 `WikiTreeSidebar` 执行 GitNexus upstream impact：1 个直接调用者 `WikiSpaceLayout`、0 个流程、1 个 Wiki 模块，风险 `LOW`。为 tree query 增加 `enabled: Boolean(currentSpace)`，保持有效空间行为不变。
- L1/L2：`npm run lint` 0 error、39 条既有 warning；`npx tsc --noEmit` 通过。
- L3：以当前事件分支运行 `docker compose -f docker-compose.dev.yml up -d --build frontend`；backend 健康、frontend 已替换。Playwright 无效 `/wiki/999999/999999` 显示“页面不存在或已删除”、无“加载中…”，Console=0、HTTP 4xx response=0；有效 `/wiki/8/54` 可读、没有不存在态、Console/4xx=0。
- 数据与清理：仅只读路由，未创建任何业务/授权对象，active objects=0。
- 当前状态：`VERIFIED`，待提交并 `--no-ff` 合并 `lint-fix`，随后恢复 L4 重跑 `WIKI-022`。
