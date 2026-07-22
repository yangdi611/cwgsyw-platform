# REM-P1-028 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-059`、`BUG-FQA-102`；用例：`CHANGE-002`、`CHANGE-005`、`CHANGE-007`。
- 根因：前后端 TypeScript/DTO 合同和创建响应类型被错误断言，缺少运行时 ID 校验。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始追加实际 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-16：实施与 L1-L3 通过

- 分支：`codex/rem-p1-028-change-document-create-contract`，基线：`lint-fix@64514db`。
- GitNexus upstream impact：NewChangeDocPage、handleSubmit、ChangeDocController.create 均为 LOW 且无直接调用方；ChangeDocService.create 有 Controller 这一个直接调用方、LOW；共享 TemplateVO 有 4 个直接 import、7 个总受影响符号，仍为 LOW。无 HIGH/CRITICAL 授权边界。
- 代码：TemplateVO 显式声明 API 的 `fields`；新建页不再读取不存在的 `fieldConfig`；创建响应收窄为含 `id` 的对象，只有正安全整数才导航，缺失/非法 ID 留在当前页提示失败。
- L1：`npm run typecheck` 和相关 ESLint 通过；生产前端 build 通过。
- L2：真实 API 验证可用模板字段、单/双模板创建 numeric ID 和详情回读；创建的两份 runId 草稿经产品 DELETE 清理，残留为 0。
- L3：当前分支 frontend 容器 production build 后，Playwright 真实登录并验证单/双模板动态字段、数字详情路由和零 Console error；UI 产生的两份草稿经产品 DELETE 清理，残留为 0。
- 回滚：还原共享 TemplateVO 的 `fields` 声明及新建页的字段访问/创建响应守卫即可；无 schema、工作流或外部状态改动。
- 结论：事件级 L1-L3 均 PASS，状态提升为 `VERIFIED`，等待最终 L4。
