# REM-P0-007 验证矩阵

| AC | 层级 | 验证 | 状态 |
|---|---|---|---|
| AC-001 | L2/L3 | `test/l4-authz-duplicate-enforce.spec.js`：重复 Enforce 返回 `409`，前后 cutover 响应相等 | PASS |
| AC-002 | L1 | `AuthorizationCutoverServiceTest.duplicateEnforceRejectsBeforeChangingAuthorizationState` 验证写锁与 JDBC update 均未调用 | PASS |
| AC-003 | L3 | 真实浏览器进入迁移工作台，确认 Enforce 入口为零、`紧急回退` 可见 | PASS |
| AC-004 | L1 | `JAVA_TOOL_OPTIONS='-Dnet.bytebuddy.experimental=true' mvn -q -Dtest=AuthorizationCutoverServiceTest test` | PASS |
| AC-004 | L1 | `mvn -q -DskipTests package` | PASS |
| AC-004 | L3 | `docker compose -f docker-compose.dev.yml up -d --build --no-deps backend`；backend healthy；Playwright `1/1` | PASS |

初次 L4 复现的 `200`/epoch 增量为原始失败事实；修复后验证只走拒绝路径，未执行新的授权模式切换。
