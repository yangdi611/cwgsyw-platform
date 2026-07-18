# REM-P0-006 实施记录

## 2026-07-18：认领、影响与 L1

- 从 `lint-fix@9f23e49d` 创建事件分支。
- L4 `AUTHZ-002` 复现：有效 group-scope runId fixture 对四个迁移读取端点均收到 HTTP `400`，合同要求 `403`；未调用任何 migration/cutover 写端点。
- GitNexus impact：`AuthorizationMigrationController.requirePlatformAdministrator` 为 `CRITICAL`，10 个直接端点、7 条流程；范围限制为异常类型映射。
- 实现：该 guard 从 `IllegalArgumentException` 改为 `AccessDeniedException`，复用全局标准 `403`。
- L1：`cd backend && mvn -q -DskipTests compile` 通过。

## 2026-07-18：L2/L3 通过

- 仅重建当前分支 backend 容器，health 为 `UP`；未重启数据库、Redis、MinIO 或前端。
- group-scope fixture 对四个读取端点均 HTTP/body `403`；superadmin preflight/cutover 均 `200`，cutover 保持 `enforced@4` 且拒绝前后不变。
- `test/rem-p0-006-migration-platform-scope.spec.js` Playwright API/UI 复验通过（`1/1`）：低权限首页不显示“迁移异常”，直达 `/rbac/migration-exceptions` 回退首页。未调用写端点、未产生待清理对象。
