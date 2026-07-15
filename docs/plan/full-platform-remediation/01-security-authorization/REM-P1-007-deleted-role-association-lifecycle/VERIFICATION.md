# REM-P1-007 验证与证据矩阵

## 验收映射

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | RBAC-009 | L1 定向 | `RbacServiceAuthorizationModeTest`：有效角色读取成功，已删除/跨租户角色不返回关联权限 | `PASS` |
| `AC-002` | RBAC-018 | L2 根因聚类 | `REM_P1_007_20260715013545`：创建角色的 permissions 为 200；软删除后同接口为 400 | `PASS` |
| `AC-003` | 边界 / deny / 无副作用 | L2 | 无效角色不查询 role-permission；UI runId 角色创建后删除并从列表消失；均经产品 API 清理 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 定向 RBAC/Wiki 单测、后端编译、当前分支 backend 容器重建和真实 API/UI 复验 | `PASS` |
| `AC-005` | GitNexus / cleanup / rollback | L3 | upstream impact 与 staged `detect_changes` 已记录；回滚为 event commit 的 no-ff revert | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新发布候选 run | `PENDING` |

## 原始失败证据

历史结论位于 `defects.md` 的 `BUG-FQA-055`、`BUG-FQA-093` 章节及 `test-results/FQA_20260712_0329_lintfix/`。修复后证据必须新建目录，禁止覆盖首次失败截图、trace 或 result。

## 执行规则

- PASS：预期、持久化、副作用、权限、审计和清理全部一致。
- FAIL：任一原始路径仍失败、出现未解释 5xx/Console error 或产生数据残留。
- BLOCKED：缺少明确授权、外部配置、独占窗口或精确清理能力；写明责任方和解除条件。
- L1→L2→L3 顺序执行；L4 是共同发布门禁。
- 清理使用产品 API 逆序执行，只删除本次 runId 对象，核对 active/cleanup_failed 均为 0。

## 已执行证据

- L1：`JAVA_TOOL_OPTIONS='-Dnet.bytebuddy.experimental=true' mvn -q -Dtest=RbacServiceAuthorizationModeTest,RoleManagementServiceTest,WikiSpaceServiceTest test` 与 `mvn -q -DskipTests compile` 均通过。
- L2：`REM_P1_007_20260715013545` 用产品 API 创建带 `cmdb_instance:read` 的自定义角色；有效角色的 permissions 读取为 200，删除后同一读取为 400，清理无剩余角色。Playwright `REM_P1_007_UI_20260715013826` 从角色管理页真实创建并删除角色，角色从列表消失。
- L3：`docker compose -f docker-compose.dev.yml build backend` 和 `up -d --no-deps backend` 基于当前事件分支执行；健康检查为 `UP`。未清理 Redis、数据库卷、对象存储或全体会话。
