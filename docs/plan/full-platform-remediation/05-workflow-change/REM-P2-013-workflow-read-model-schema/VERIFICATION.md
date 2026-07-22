# REM-P2-013 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | FLOW-004 | L1 | `WorkflowControllerCompatibilityTest` 覆盖 typed activity/stats Controller 合同；生产 compile 通过 | `PASS` |
| `AC-002` | FLOW-013 | L2 | `REM_P2_013_20260716_183640/stats.json`：全部统计字段均为 camelCase；`ui-result.json`：统计无空 key/`NaN` | `PASS` |
| `AC-003` | 边界 / deny / 零副作用 | L2 | `activities.json` 既有完成实例活动均含 `endTime`；零 duration 显示为稳定占位；所有请求只读、`activeObjects=0` | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前分支仅重建 backend 容器、health `UP`；真实登录 UI 验证统计和已完成实例活动，Console/failed requests 为零 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | 实施记录、`result.json`、提交前 `detect_changes`；未创建测试对象 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据为 `BUG-FQA-028`、`BUG-FQA-036` 对应章节。PASS 要求行为、持久化、权限、审计、清理全部一致；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理为 BLOCKED。禁止覆盖历史证据。

## L1-L3 执行记录

- 后端：`mvn -q -DskipTests compile` 通过；定向 Maven 测试仍在 testCompile 被三个既有无关测试源错误阻断（OpsCalendarRuleServiceTest、OpsCalendarTaskServiceTest、GroupControllerGroupReferenceTest）。
- 前端：`npm run lint` 通过（既有 39 warnings、无 errors）、`npx tsc --noEmit` 和 `npm run build` 通过。
- 运行时：`docker compose -f docker-compose.dev.yml build backend` 后仅替换 backend，并重启 Nginx 重新解析上游；health 为 `UP`。
- 证据：`docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/REM_P2_013_20260716_183640/`。真实认证 API/UI 均只读，无业务、权限或流程数据写入，`activeObjects=0`、`cleanupFailures=0`。
