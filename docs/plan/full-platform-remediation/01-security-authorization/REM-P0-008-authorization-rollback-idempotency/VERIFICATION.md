# REM-P0-008 验证矩阵

| AC | 层级 | 验证 | 状态 |
|---|---|---|---|
| AC-001 | L2/L3 | `test/l4-authz-duplicate-rollback.spec.js`：重复 Rollback 返回 `409`，状态不变 | PASS |
| AC-002 | L1 | `AuthorizationCutoverServiceTest.duplicateRollbackRejectsBeforeChangingAuthorizationState`：拒绝前没有 JDBC update | PASS |
| AC-003 | L2/L3 | rollback -> duplicate reject -> eligible preflight -> enforce；最终 `enforced`、epoch `12` | PASS |
| AC-004 | L1/L3 | Maven test/package、当前分支 backend 容器健康、Playwright | PASS |

## 命令与运行时证据

- `JAVA_TOOL_OPTIONS='-Dnet.bytebuddy.experimental=true' mvn -q -Dtest=AuthorizationCutoverServiceTest test` — PASS。
- `mvn -q -DskipTests package` — PASS。
- `docker compose -f docker-compose.dev.yml up -d --build --no-deps backend` — current event branch backend rebuilt and healthy。
- `npx playwright test test/l4-authz-duplicate-rollback.spec.js --workers=1 --output=/tmp/rem-p0-008-authz-rollback --reporter=line` — PASS (`1 passed`, 684ms)。
