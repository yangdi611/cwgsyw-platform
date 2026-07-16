# REM-P2-012 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | REPORT-001 | L1 | `REM_P2_012_20260716_181849/api-results.tsv`：反向报表日期 HTTP/body `400` | `PASS` |
| `AC-002` | REPORT-002 / OPS-002 / OPS-016 / OPS-018 / OPS-019 / DAILY-001 / DAILY-003 / DAILY-004 / COMMON-012 | L2 | `REM_P2_012_20260716_181849/api-results.tsv`：任务、排班、统计、素材、日报月份及 DTO 日期/工时逐项 `400`；合法月份 `200` | `PASS` |
| `AC-003` | 边界 / deny / 零副作用 | L2 | 反向、非法格式、未来日期、负数、超限、`0/24` 边界均验证；全部请求只读或在组校验前拒绝，`result.json` 记录 `activeObjects=0` | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前事件分支重建 backend/frontend 容器并健康；`ui-result.json`：真实登录、统计页反向范围本地阻止、合法范围重试、Console/failed request 均为空 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | 实施记录、`result.json`、提交前 `detect_changes`；测试数据未创建 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据为 `BUG-FQA-029`、`BUG-FQA-030`、`BUG-FQA-031`、`BUG-FQA-032`、`BUG-FQA-033`、`BUG-FQA-034`、`BUG-FQA-037`、`BUG-FQA-060` 对应章节。PASS 要求行为、持久化、权限、审计、清理全部一致；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理为 BLOCKED。禁止覆盖历史证据。

## L1-L3 执行记录

- 后端：`mvn -q -DskipTests compile` 通过；定向 Maven 测试在 testCompile 被既有无关测试源错误阻断（`OpsCalendarRuleServiceTest` 缺 `SecurityUser`、既有 `OpsCalendarTaskServiceTest` insert 重载歧义、`GroupControllerGroupReferenceTest` 类型不符）。
- 前端：`npm run lint` 通过（仓库既有 39 warning，无新增 error）、`npx tsc --noEmit` 与 `npm run build` 通过。
- 容器：`docker compose -f docker-compose.dev.yml build backend frontend`，仅重建 backend/frontend；backend health `UP`。替换后 Nginx 首次上游解析出现短暂 `502`，重启 Nginx 后健康恢复；不是应用 5xx。
- API/UI 证据：`docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/REM_P2_012_20260716_181849/`。该 run 使用真实会话；不记录密码、token 或 Cookie；无创建测试对象，`activeObjects=0`、`cleanupFailures=0`。
