# REM-P1-050 实施合同

## 目标与不变量

- 运维任务 create/update/manage 身份通过专用候选端点读取同租户启用用户的最小字段：`id/username/realName/groupId`。
- 跨组启用用户可作为负责人；无任务写权限身份不得读取候选。
- create/update 对 assignee、participant、recipient、escalation 统一验证存在、同租户、启用；失败发生在任何任务/参与人/日志/审计写入前。
- 不放宽通用 `/api/users`，不暴露邮箱、电话、状态、角色、assignment 或其他授权信息。
- 保持任务列表/详情/操作权限、通知、路由和数据库合同不变。

## 验收条件

| AC | 条件 |
|---|---|
| `AC-001` | create 身份可在 API/UI 候选中看到同租户跨组启用用户并创建任务。 |
| `AC-002` | read-only 身份候选端点 403，候选响应只含四个批准字段。 |
| `AC-003` | 不存在、跨租户、禁用人员 ID 稳定拒绝且任何任务侧写入为零。 |
| `AC-004` | 无负责人及既有同组流程不回归，真实 UI 无 page error/5xx。 |
| `AC-005` | L1-L3、当前 backend/frontend、精确产品清理和 detect 全部通过。 |
| `AC-006` | no-ff 合并后同一 L4 run affected-only `OPS-007` PASS。 |

## 风险与回滚

业务授权风险按 HIGH：专用接口允许有任务写权限的组级身份枚举租户内可指派用户的最小字段；该范围由 `OPS-007` 跨组人员合同与既有跨组 assignee 合法语义覆盖。回滚删除专用端点、资格校验和前端切换，不涉及 schema 或数据恢复。
