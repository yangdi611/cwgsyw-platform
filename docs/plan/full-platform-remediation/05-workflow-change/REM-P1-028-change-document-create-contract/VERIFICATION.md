# REM-P1-028 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | CHANGE-002 | L1 | `npm run typecheck` 与新建页/共享 TemplateVO ESLint 通过 | `PASS` |
| `AC-002` | CHANGE-005 / CHANGE-007 | L2 | 产品 API 单模板、双模板创建均返回有效 ID，详情回读一致 | `PASS` |
| `AC-003` | 边界 / deny / 零副作用 | L2 | UI 对缺失/非法 ID 受控失败；四个 runId 草稿均由产品 DELETE 精确清理，残留为 0 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前分支前端 production build 通过；Playwright 完成单/双模板动态字段、数字 ID 导航、详情加载与零 Console error | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | NewChangeDocPage、handleSubmit、ChangeDocController.create、ChangeDocService.create、TemplateVO 均完成 upstream impact（LOW）；提交前执行 `detect_changes` | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据为 `BUG-FQA-059`、`BUG-FQA-102` 对应章节。PASS 要求行为、持久化、权限、审计、清理全部一致；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理为 BLOCKED。禁止覆盖历史证据。

## 2026-07-16 L1-L3 复验记录

- L1：前端 typecheck、`change-docs/new` 和共享 TemplateVO ESLint 通过。
- L2：真实 superadmin 会话读取 4 个模板；单模板与双模板各创建一份 runId 草稿，创建响应 ID 有效且详情回读匹配；随后通过产品 DELETE 清理，API 复验残留为 0。
- L3：当前事件分支构建并替换 frontend（构建同时验证 backend），Playwright 完成页面登录、单/双模板字段呈现、创建后 `/change-docs/<数字 ID>` 导航和详情加载，Console error 为 0；产生的两份 UI 草稿已由产品 DELETE 精确清理，残留为 0。
