# REM-P2-015 实施合同

## 目标与不变量

新增 `GET /api/notifications/{notificationId}/target`。端点仅可读取当前 authenticated user 的未删除通知；不写 notification、业务对象、审计或会话。

响应仅返回 `{available, href}`：

- `available=true` 时 `href` 是既有应用内相对路由；不返回业务对象正文、名称、ACL、权限 reason 或目标 ID 以外的额外详情。
- 不属于当前用户、未知 refType、空/非法引用、已删除或无权目标统一返回 `available=false`；不得用 403/404 区分可枚举目标状态。
- 未认证或无 `notification:read` 仍由 endpoint 边界拒绝，保持现有安全语义。

## 授权合同

通知归属检查先于目标读取。目标解析必须复用或等价执行各现有详情读取的功能权限、租户和资源 ACL/可见性合同；不得因服务内直接调用绕过 Controller 的 `@PreAuthorize`。

当前纳入类型：`change_doc`、`daily_report`、`ci_instance`、`wiki_page`、`ops_task`。任何无法忠实复用授权合同的类型必须返回不可用并记录，不得猜测 allow。

## 实施范围

- 新增稳定 DTO 和专用 `NotificationTargetResolverService`；不得修改 `NotificationService.notify`、`markRead` 或投递 producer。
- Controller 增加只读 endpoint，前端目标页只消费该 endpoint。
- 候选符号必须分别执行 GitNexus upstream impact；HIGH/CRITICAL 先暂停告警。

## 验收

| AC | 条件 |
|---|---|
| `AC-001` | 自己的有效通知返回最小 href，前端真实点击进入既有目标。 |
| `AC-002` | 他人通知、未知/删除/无权目标均不可枚举且不泄露详情。 |
| `AC-003` | notification 已读、投递和目标对象读写均无副作用。 |
| `AC-004` | 五种 refType 的有效/不可用合同、API/UI、Console/failed request 复验通过。 |
| `AC-005` | L1-L3、impact/detect、runId 清理和回滚记录完整。 |
| `AC-006` | 最终 L4 在本事件合并后重新执行。 |

## 回滚与停止

回滚本事件独立提交即可移除端点和前端消费。若任一类型不能等价执行现有授权、出现跨用户目标可见性、需要改现有 ACL 语义或非测试数据影响，停止并请求决定。
