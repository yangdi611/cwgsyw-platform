# REM-P1-056 实施合同

## 目标

- 属性 list/create/update/delete 分别消费 `cmdb_attribute:read/create/update/delete`。
- 模型属性页按 canonical action 分别控制读取、新建、编辑和删除控件。
- canonical-only 正向成功；只有 `cmdb_model:read/update` 的 legacy-only 身份不得获得属性能力。

## 范围

- `CiAttributeController` 的四个 `@PreAuthorize` guard。
- `ModelDetailPage` 与 `AttributeList` 的属性 action 显隐。
- annotation contract、frontend type/lint、真实 API/UI 正反权限与精确清理。

## Non-goals

- 不修改 `cmdb_model:*`、`cmdb_relation:*`、import/impact/topology guard。
- 不修改角色权限目录、assignment scope、授权模式、资源 ACL、数据库或 seed 数据。
- 不把 `CMDB-014` 的其他未执行矩阵提前标 PASS。

## 影响分析

- `CiAttributeController`：LOW，0 direct caller、0 affected process/module。
- `ModelDetailPage`：LOW，0 upstream dependency。
- `AttributeList`：LOW，1 direct upstream `ModelDetailPage`、0 process。

## 验收条件

| AC | 条件 |
|---|---|
| `AC-001` | 四个 Controller method 的 guard 精确对应 `cmdb_attribute:read/create/update/delete`。 |
| `AC-002` | canonical-only role 的四个动作分别成功，缺失动作返回 403 且无副作用。 |
| `AC-003` | 只有 `cmdb_model:read/update` 的身份不能读取或写属性。 |
| `AC-004` | 真实模型属性页按 read/create/update/delete 独立呈现或隐藏控件，API 与 UI 一致。 |
| `AC-005` | L1-L3、当前分支 backend/frontend 容器、Console/5xx、精确清理全部通过。 |

## 回滚

恢复 `CiAttributeController` 原 guard 和属性页原统一 `cmdb_model:update` 显隐。无迁移、配置恢复或历史数据回滚。
