# REM-P1-005 实施合同

## 目标

将通知功能的运行时授权与已存在的 `notification:read` 权限合同统一，阻止仅通过认证的用户绕过导航直接访问通知页面或 API。

## 已知证据

`BUG-FQA-008` 表明零权限及仅 `group:read` 夹具访问 `GET /api/notifications`、`GET /api/notifications/unread-count` 与已读写操作均返回 `200`。Controller 的四个端点均仅声明 `isAuthenticated()`。

## 实施边界

先对 `NotificationController` 及拟改路由 guard 执行 GitNexus upstream impact。四个通知 API 应统一要求 `hasAuthority('notification:read')`；前端通知页须采用同一权限合同拒绝直达。不得把读取权限扩展为通知管理权限，不修改用户通知归属查询，也不得为测试创建不可精确回收的通知夹具。

## 验收

| AC | 合同 |
|---|---|
| `AC-001` | 无 `notification:read` 的有效会话访问列表、未读数、单条已读、全部已读均为 `403`，且不产生状态变化。 |
| `AC-002` | 具备 `notification:read` 的有效会话仍可读取列表和未读数。 |
| `AC-003` | 无权限用户直达 `/notifications` 不可加载通知中心；导航、路由、API 合同一致。 |
| `AC-004` | 定向测试覆盖四个 API guard；`detect_changes` 仅影响预期通知授权链路。 |
| `AC-005` | 发布候选版全量 FQA 仍是最终门禁。 |

## 回滚

回滚仅撤回本事件提交；不修改角色分配、现有通知数据或通知状态。
