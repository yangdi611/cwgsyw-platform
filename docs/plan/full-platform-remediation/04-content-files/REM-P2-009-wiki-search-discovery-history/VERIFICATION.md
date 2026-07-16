# REM-P2-009 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | WIKI-013 | L1 | 首页真实点击搜索入口；400ms debounce 将 `a` 写入 URL；input autofocus；第二页为 `page=2` | `PASS` |
| `AC-002` | 关键词 / 分页历史 | L2 | 第二页 back 恢复 `?keyword=a` 与输入 `a`，forward 恢复 `?keyword=a&page=2` 与输入 `a` | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | 空关键词结果、无命中空态、强制授权下先过滤再分页；不创建 Wiki 数据，runId 草稿空间/页面已产品 API 清理 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前事件分支 frontend/backend 容器重建、gateway 健康；真实登录 Playwright 复验，Console error=0 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | GitNexus impact/detect、`runs/REM_P2_009_20260716/result.json`、实施记录 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据来自 `BUG-FQA-071` 对应章节。PASS 必须同时满足行为、持久化、权限、审计与清理；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理能力为 BLOCKED。新证据不得覆盖旧证据。

## 2026-07-16 L1-L3 运行时证据

- 前端候选符号 `WikiSpacesPage`、`SearchResults`、`WikiSearchPage` 的 GitNexus upstream impact 均为 LOW。运行时发现授权模式会先数据库分页、后资源过滤，导致第二页不可达；`WikiPageService.search`（2 直接调用者）与 `WikiPageMapper.search`（1 直接调用者）impact 均为 LOW，修复后全局搜索仍复用同一正确分页合同。
- `npm run lint` 为既有 39 warnings、0 error；`npm run typecheck`、`npm run build` 通过。`mvn -q -Dmaven.test.skip=true package` 通过。`mvn -q -Dtest=WikiPageServiceTest test` 在既有无关 testCompile 错误前被阻断（OpsCalendarRuleServiceTest、OpsCalendarTaskServiceTest、GroupControllerGroupReferenceTest）；新增定向测试已留在源码中。
- 当前事件分支重建 frontend 与 backend 容器，后端健康后重建无状态 gateway。真实表单登录后从侧栏进入 `/wiki`，点击“搜索知识库”，验证 autofocus、400ms debounce、`?keyword=a&page=2`、back/forward 输入和 URL 同步、无命中空态以及 Console error=0。
- 运行时结果见 `docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/REM_P2_009_20260716/result.json`。验证使用现有已发布内容，不写入产品对象。此前为分页尝试创建的两组 draft runId 空间与 42 页均已经产品 DELETE；只读核对 active runId space/page 均为 0。
