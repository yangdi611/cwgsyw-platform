# REM-P0-005 验证矩阵

| AC | 层级 | 验证 | 结果 | 证据 |
|---|---|---|---|---|
| AC-001 | L1-L3 | 受限 Wiki 页 platform super_admin allow 与 Shadow 同口径 | PASS | `AuthorizationServiceTest`；真实 `GET /api/wiki/pages/50` 与 Nginx UI 均为 200 |
| AC-002 | L1-L3 | Wiki/共享文件资源与祖先 ACL 绕过 | PASS | Wiki/共享文件夹定向单测；真实 `GET /api/files` 为 200 |
| AC-003 | L1-L2 | 非 super_admin 平台/tenant 身份继续 ACL deny | PASS | `platformScopedNonSuperAdminRemainsSubjectToResourceAcl` 断言 `RESOURCE_ACCESS_DENIED` |
| AC-004 | L1 | 缺功能 permission 仍拒绝 | PASS | `platformSuperAdminCannotBypassMissingFunctionalPermission` 断言 `FUNCTION_PERMISSION_DENIED` |
| AC-005 | L3 | 当前分支容器、strict preflight、清理与无切换 | PASS | Shadow backend health=UP；strict preflight `eligible=true`、active diff=0；无业务写入 |

L1 命令：Java 21 buildcheck 容器执行 `mvn -q -Dtest=AuthorizationServiceTest test && mvn -q -DskipTests compile`。

L3 运行时：当前事件分支构建 backend，仅以 `AUTHORIZATION_DECISION_MODE=SHADOW` 替换 backend 服务；PostgreSQL、Redis、MinIO、Nginx 未重启。证据：`test-results/FQA_20260717_1245_final_l4/REM-P0-005-platform-superadmin-resource-acl-bypass/result.json`。
