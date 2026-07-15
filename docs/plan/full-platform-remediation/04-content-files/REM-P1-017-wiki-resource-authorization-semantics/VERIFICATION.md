# REM-P1-017 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | WIKI-002 | L1 | `AuthorizationServiceTest`、`WikiPageServiceTest`、`WikiControllerTest`、`WikiSpaceServiceTest` 定向 Maven 测试通过 | `PASS` |
| `AC-002` | WIKI-006 / WIKI-022 / WIKI-023 / P-045 / P-046 / P-047 | L2 | runId `REM_P1_017_20260715_161119`：缺失页面/空间 404；管理员未选组 400；显式组创建、根页/子页创建与精确清理通过 | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | Playwright 验证必选归属组、组级固定组、缺失编辑页无保存入口；测试对象通过产品 API 删除，无残留 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 后端全量 Maven 测试、`npx tsc --noEmit`、`npm run lint` 通过；lint 为 0 error / 41 既有 warning | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | upstream impact 为 LOW/MEDIUM；暂存后 `detect-changes` 标记 CRITICAL（29 条 Wiki/授权流程）且仅覆盖预期范围，已完成全量与运行时复验；回滚为还原本事件提交 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据来自 `BUG-FQA-045`、`BUG-FQA-058`、`BUG-FQA-067`、`BUG-FQA-089` 对应章节。PASS 必须同时满足行为、持久化、权限、审计与清理；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理能力为 BLOCKED。新证据不得覆盖旧证据。L4 仍待全部事件完成后的独立全平台复验。
