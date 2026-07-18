# REM-P1-039 实施合同

## 目标与不变量

`/admin/backup` 必须与 `GET /api/backups` 一样要求 `backup:read`。无该权限的已认证用户必须在 dashboard hydration 完成后回退至 `/`，不得加载备份页面或发起备份列表请求；有权限用户的既有页面和操作入口保持不变。`/backups` 仅是 API 路径，不是前端路由。

## 修改范围

- 不改产品代码；保留既有 `BackupPage` 页面级守卫。

## 非目标

- 不修改 `BackupPage`、后端 Controller/Service、备份文件、数据库或恢复流程。
- 不执行实际 restore，不改非测试角色或租户授权。

## 验收条件

| ID | 条件 |
|---|---|
| AC-001 | 零权限已认证用户直达 `/admin/backup` 后回退 `/`，页面不显示备份内容；`/backups` 不作为页面路由断言。 |
| AC-002 | 相同用户 `GET /api/backups`、创建和恢复请求保持 `403`。 |
| AC-003 | `backup:read` 用户可正常进入 `/admin/backup` 并读取列表。 |
| AC-004 | runId 用户、角色和 assignment 仅通过产品 API 创建并逆序清理，残留为零。 |

## 回滚

回滚该单条路由映射即可恢复先前行为；若需要改变 backend 或权限语义，停止并新建独立事件。
