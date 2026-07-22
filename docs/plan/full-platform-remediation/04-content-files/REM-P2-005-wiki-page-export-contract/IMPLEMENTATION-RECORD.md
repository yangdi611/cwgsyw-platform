# REM-P2-005 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-038`；用例：`WIKI-017`。
- 根因：exportPage 客户端路由、构建产物或后端 Mapping 与页面按钮绑定不一致。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始，追加 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-17：L4 回归修复

- 分支：`codex/rem-p2-005-wiki-page-export-contract-l4-regression`；基线：`lint-fix@292c1475`。
- L4 用既有含附件引用页面重现：单页 endpoint 与前端按钮路径正确，但服务会按附件引用改为 ZIP；这与页面导出固定为 Markdown 的事件合同冲突。
- GitNexus upstream impact：`WikiExportService.exportPage` 仅有 `WikiController.exportPage` 一个直接调用者，`LOW`；未触及空间导出、ACL、存储写入或权限语义。
- 实现：`exportPage` 始终以当前页面 Markdown 正文、`.md` 文件名和 Markdown MIME 返回；附件打包仍只属于 `exportSpace`。
- 验证：主包构建、当前分支 backend 容器健康和真实浏览器页面/空间导出均通过。全量测试编译受四项既有无关测试源码错误阻断，已记录，未掩盖为通过。
- 数据与回滚：只读下载，无测试数据；回滚仅恢复 `exportPage` 的附件 ZIP 分支，但会重新引入本次 L4 缺陷。

## 2026-07-16：事件认领与影响分析

- 状态：`IN_PROGRESS`；分支：`codex/rem-p2-005-wiki-page-export-contract`；基线：`lint-fix@c0852d3`。
- 源码确认：页面头部调用 `wikiApi.exportPage(pid)`，空间侧栏独立调用 `wikiApi.exportSpace(sid)`；前端单页 URL 为 `/wiki/pages/{id}/export`，后端 Mapping 与服务实现均存在。
- GitNexus upstream impact：前端 `exportPage` 与 `WikiController.exportPage` 均为 LOW（零索引直接调用者）；`WikiExportService.exportPage` 为 LOW（唯一直接调用者为 WikiController.exportPage）。无 HIGH/CRITICAL 或跨模块流程。
- 结论：历史缺陷很可能是旧前端构建产物/容器版本漂移；不在未复现前制造冗余代码改动。下一步是从本分支源码重建 frontend，执行真实 API/UI 下载范围、文件名、MIME、权限与无副作用复验。

## 2026-07-16：实现与 L1-L3 复验完成

- 实际根因补充：当前页面端点正确但开发网关未向浏览器暴露 `Content-Disposition`，导致 Axios 下载使用通用 `wiki-page-{id}.md` 后备名，无法满足当前页面中文标题文件名合同。
- 影响分析：实施前对 `WikiPageReader` 执行 upstream impact，结果 LOW、零直接调用者，参与三个页面标签流程；此前 `exportPage` 前端 API、Controller、服务均为 LOW，无 HIGH/CRITICAL。
- 实现：`wikiApi.exportPage` 接收可选后备文件名；页面阅读器传入当前已加载 `page.title + '.md'`。响应头可用时仍优先使用后端文件名；版本面板及其他调用保持既有通用回退名。
- L1：定向 lint、typecheck 通过；前端生产镜像构建通过。
- L2/L3：当前源码构建的 frontend 容器中，真实登录后页面“导出”仅请求 `/api/wiki/pages/87/export`，下载当前中文标题 Markdown；空间“导出空间”仅请求 `/api/wiki/spaces/8/export`，下载 ZIP 且签名正确；无 Console error。
- 数据与清理：只读下载既有页面和空间，未创建或变更产品 API、数据库、MinIO、Redis、审计或测试对象，不适用 runId 清理。
- 变更检测：`detect-changes --scope all` 为 WikiPageReader、exportPage、wikiApi 三个预期符号和三个 Reader 流程，MEDIUM。相对历史 `master` 的检测为既有集成分支累积差异（1,237 文件、CRITICAL），与本事件无关；本事件相对 `lint-fix@c0852d3` 的 diff 仅两个前端文件。
- 回滚：移除 optional filename 参数和页面调用传入的标题即可恢复先前后备名；等待最终 L4。
