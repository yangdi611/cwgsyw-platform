# REM-P1-052 实施合同

## Scope

- 在 `CiInstanceCommandService.delete` 的实例行锁后检查：活动 CI 关系、活动设备、活动变更文档链接、活动日报引用。
- 任一引用存在时返回现有 HTTP 400 业务拒绝，并保留实例、引用、审计和变更历史不变。
- 引用通过正式产品 API 解除后，实例删除保持原有成功、审计和变更历史合同。

## Non-goals

- 不增加级联删除、自动解除引用、历史数据回填或 schema 迁移。
- 不修改设备、变更文档、日报的创建/更新/删除语义。
- 不处理 restore、purge、非测试数据或外部系统。

## 验收条件

| AC | 条件 |
|---|---|
| `AC-001` | 活动关系引用拒绝删除且无副作用。 |
| `AC-002` | 活动设备引用拒绝删除且无副作用。 |
| `AC-003` | 活动变更文档链接拒绝删除且无副作用。 |
| `AC-004` | 活动日报 `ciInstanceIds` 引用拒绝删除且无副作用。 |
| `AC-005` | 无引用或产品 API 解除引用后，实例正常软删除并写一次审计/变更历史。 |
| `AC-006` | 当前事件分支 backend 构建、容器健康、真实 API/UI 与精确清理通过。 |
| `AC-007` | 独立提交、no-ff 合并及同一 L4 run `CMDB-040` affected-only 重验通过。 |

## Validation

- L1：`CiInstanceCommandServiceTest` 四类拒绝及无引用成功聚类。
- L2：CMDB 实例/关系、设备、变更文档 CI 链、日报 CI 链相关测试。
- L3：当前分支 backend 构建并仅替换 backend；真实 API 同夹具验证变更文档和日报阻断、解除、删除与清理；浏览器验证可见业务提示且无 5xx/Console error。

## Rollback

删除两个 mapper 计数方法和删除命令中的两段新增前置检查即可；无 schema、迁移、数据 restore 或不可逆动作。
