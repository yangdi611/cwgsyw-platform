# REM-P0-006 实施 SPEC

## 目标与不变量

`AuthorizationMigrationController` 的非 platform scope 必须返回标准授权拒绝（HTTP/body `403`），不得被表示为输入错误 `400`。所有迁移/cutover 端点仍仅允许 platform scope。

## 根因与实施

`requirePlatformAdministrator(SecurityUser)` 抛出 `IllegalArgumentException`，全局处理器映射为 `400`。改为 `AccessDeniedException`，复用 `GlobalExceptionHandler` 的标准 `403` 映射。

## 影响分析

2026-07-18 GitNexus upstream impact：`AuthorizationMigrationController.requirePlatformAdministrator` 为 `CRITICAL`，10 个直接调用者，涉及 preflight、cutover、enforce、rollback、pending-users 和 exceptions 流程。不得改动服务或数据写路径。

## 验收

| ID | 条件 |
|---|---|
| AC-001 | group-scope 已认证会话对四个迁移读取端点均 HTTP/body `403` |
| AC-002 | 拒绝前后没有 migration/cutover/ACL 写入 |
| AC-003 | platform superadmin 的 preflight/cutover 保持 `200` 与状态/epoch 不变 |
| AC-004 | Maven 编译、当前分支后端容器及定向 Playwright/API L1-L3 通过 |

## 回滚

回滚本 Controller 的异常类型变更；无数据回滚需求。
