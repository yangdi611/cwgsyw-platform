# REM-P1-049 实施合同

## 目标与不变量

关闭 `L4-OPS-006-001`，使运维任务 direct-id 详情访问与列表数据范围一致。

- tenant/platform 或持有 `read_all`：允许租户内详情。
- 负责人、创建者、参与人：允许相关任务详情，包括跨组 assignee。
- 持有 `read_group`：只允许认证用户本组详情。
- `public`：允许跨组详情；其他无关 private/group 任务拒绝。
- 拒绝使用现有“任务不存在”语义，避免确认 id 是否存在。
- 保持 `canViewDetail` 的敏感字段遮罩职责、列表查询、操作门禁、通知解析、数据库和审计合同不变。

## GitNexus 影响

- 刷新索引后的 `OpsCalendarTaskService.detail`：MEDIUM；生产直接调用者为 1 个 Controller，另有 5 个定向测试调用，间接影响 `NotificationTargetResolverService.resolve` 与 `NotificationController.target`，0 个已识别 flow。
- 新增 `OpsCalendarVisibilityService.canAccessDetail`：HIGH；生产直接调用者为 `detail`，其余 8 个直接调用均为定向测试，间接影响 Controller 与通知 resolver。
- 不修改既有 HIGH `canViewDetail` 语义；授权业务风险仍按 HIGH 验证，并将通知 resolver 纳入回归。

## 验收条件

| AC | 条件 |
|---|---|
| `AC-001` | 无关跨组 group/sensitive 任务不在 mine 且 direct detail 返回稳定拒绝。 |
| `AC-002` | public、跨组 assignee、own-group read_group、tenant/read_all 详情仍允许。 |
| `AC-003` | 拒绝发生在 checklist/log/link/user/group 等详情读取前，无副作用。 |
| `AC-004` | 真实 UI direct-id 不泄露跨组任务标题或详情，无未解释 5xx/page error。 |
| `AC-005` | L1-L3、当前 backend、产品 API 精确清理和 detect_changes 全部通过。 |
| `AC-006` | no-ff 合并后同一 L4 run 仅重验 `OPS-006` 并 PASS。 |

## 回滚与停止

回滚只移除详情访问门禁和对应测试，不涉及 schema 或数据恢复。若产品合同要求无关组级身份可通过 id 读取非 public 任务，或需要改变 tenant/platform 语义，停止请求用户决定。
