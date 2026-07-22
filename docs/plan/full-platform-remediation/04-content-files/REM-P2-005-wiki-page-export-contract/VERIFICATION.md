# REM-P2-005 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | WIKI-017 | L1 | 真实页面点击请求 `/api/wiki/pages/87/export`，下载内容为 Markdown，建议文件名为当前中文标题 | `PASS` |
| `AC-002` |  | L2 | 同一浏览器会话中页面导出与空间导出分别请求 `/pages/87/export`、`/spaces/8/export`，无路由串用 | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | 只读下载验证：无产品 API 写入、DB、MinIO、审计或测试对象；无并发状态可写 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前事件分支重建 frontend 生产容器；页面导出 Markdown/中文文件名，空间导出 ZIP 签名，Console error 为零 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | 前端 API、页面 Reader、Controller、导出服务 impact 均 LOW；`detect-changes --scope all` 为预期三个前端符号、MEDIUM | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据来自 `BUG-FQA-038` 对应章节。PASS 必须同时满足行为、持久化、权限、审计与清理；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理能力为 BLOCKED。新证据不得覆盖旧证据。

## 2026-07-16 复验记录

- L1：`npm run lint -- --no-warn-ignored ./src/lib/wiki-api.ts './src/app/(dashboard)/wiki/[spaceId]/[pageId]/page.tsx'` 与 `npm run typecheck -- --pretty false` 通过。
- L2/L3：基于当前事件分支源码重建 frontend 容器后，以真实登录和点击路径验证。当前页面请求单页导出端点，内容是 Markdown，浏览器建议文件名为 `v0.34.0 — 2026年7月9日.md`；空间入口保持独立 ZIP 下载，ZIP 签名正确。Console error 为零。
- 清理：仅下载既有数据到浏览器临时目录；未创建产品对象、权限或存储对象，因此无 runId 清理项。

## 2026-07-17 L4 回归修复复验

- L4 初次重现：当前基线既有页面 `/wiki/8/54` 含附件引用时，`GET /api/wiki/pages/54/export` 返回 `application/zip`、`image test.zip` 与 ZIP 签名；空间导出仍为 ZIP。该行为不满足 `AC-001/004`，已停止 L4。
- 影响分析：`WikiExportService.exportPage` upstream 仅有 `WikiController.exportPage` 一个直接调用者，风险 `LOW`；空间导出未在本次修改范围内。
- L1：新增 `WikiExportServiceTest.exportPageWithAttachmentReferencesAlwaysDownloadsMarkdown`；全量 Maven test compilation 被四个既有无关测试源码错误阻断，主包 `mvn -Dmaven.test.skip=true package` 通过。
- L2/L3：当前事件分支只重建 backend 容器并健康。真实登录后页面导出为 `text/markdown;charset=UTF-8`、`image test.md`、349 bytes，正文保留附件引用；空间导出为 `application/zip`、`myown.zip`、ZIP 签名 `504b0304`。Console 与 HTTP 4xx/5xx 均为零。
- 清理：仅下载既有对象，未创建或变更产品数据、权限、审计或存储对象；无需 runId 清理。
