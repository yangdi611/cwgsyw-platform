# 实施记录

## 2026-07-17：认领与根因确认

- 基线：`lint-fix@148ebe16f`；事件分支：`codex/rem-p0-003-shadow-create-observation`。
- L4 strict preflight 唯一 blocker 为 `SHADOW_COVERAGE_INCOMPLETE=5`，均为既有 `byron` 的 Wiki/共享文件 legacy grant。
- 用户授权：重置既有 `byron` 密码、Shadow 观测、后续 `Rollback -> preflight -> Enforce`，并明确授权新建本 REM。
- 已通过产品 API 重置并完成 byron 首次改密；临时密码未写入仓库、日志或证据。
- GitNexus impact：`decideCreateWithCompatibility(BooleanSupplier)` 结果 LOW、图中 direct/process 为 0；静态调用点为 Wiki 空间创建、共享目录创建/移动、根目录上传，按授权核心路径以中等风险实施。
- 根因：Shadow 的 `decideCreateWithCompatibility` 仅计算新旧判定并返回 legacy 结果，未向 `authorization_decision_diff` 插入观测；strict preflight 因此永远无法覆盖创建权限。

## 2026-07-17：实现与运行时复验

- 代码：Shadow 分支写入 `authorization_decision_diff`，创建型记录使用 `resource_type=create`、`resource_id=0`。初版使用 NULL，运行时发现数据库非空约束导致上传事务回滚；已改为 `0` 哨兵，且不影响 strict preflight 的 user/module/permission 覆盖口径。
- L1：本机 Maven 在 Java 26 上均因 Mockito/ByteBuddy 仅支持到 Java 24 而无法初始化 mock；`MAVEN_OPTS=-Dnet.bytebuddy.experimental=true` 无效。不是断言失败。Docker Java 21 当前事件分支构建成功。
- L3：current-branch backend 以 `AUTHORIZATION_DECISION_MODE=SHADOW` 运行且 health=UP。byron 经授权重置、首次改密、重登录后，根目录共享文件上传 200、读取 200、产品 DELETE 200；strict preflight 的 `unobservedPermissionGrants` 从 5 降至 0。
- 停止：strict preflight 仍有 `latestDecisionDiffs=6`。只读定位表明它们来自既有 Wiki 页面/空间的 legacy 与统一 ACL 判定不一致；本事件不修改非测试 ACL、角色或 assignment。需新建独立 REM 后再结算 AC-004/L4。

## 2026-07-17：Java 21 L1 补验与事件结算

- 使用与后端 Dockerfile 一致的 Java 21 容器运行 `mvn -q -Dtest=AuthorizationServiceTest test`，定向测试通过；此前宿主 Java 26 的 Mockito/ByteBuddy 初始化限制不再构成 L1 门禁。
- AC-001 至 AC-005 均有 PASS 证据，且本次 runId 对象已通过产品 API 精确清理，事件结算为 `VERIFIED`。
- 严格预检的 6 条历史 Wiki/ACL 差异已明确与本事件根因独立：不改非测试 ACL、角色或 assignment，不执行 Rollback/Enforce；待用户确认新事件范围后单独处置。
