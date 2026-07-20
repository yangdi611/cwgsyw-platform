# REM-P1-059 实施合同

## 目标

- CI 详情关联资源使用 `DeviceVO.id` 生成 `/devices/{id}` 链接。
- 设备详情使用关联 CI 的真实 model code 生成 CMDB 返回链接。
- 保持现有 API、权限、设备与 CI 删除保护语义不变。

## Non-goals

- 不改变设备/CI 绑定、解绑、删除和权限合同。
- 不修改 CMDB 模型 code，不迁移或清理非测试数据。
- 不扩展其他关联资源页面。

## 影响分析

- `InstanceResourcesTab`：LOW，1 direct caller，影响 `InstanceDetailPage` 单一 CMDB 流程。
- `DeviceVO`：MEDIUM，5 direct / 14 total affected，涉及 Device 与 Service；仅新增兼容字段。

## 验收条件

| AC | 条件 |
|---|---|
| `AC-001` | CI 详情显示关联设备，并导航到准确 `/devices/{id}`。 |
| `AC-002` | 设备详情显示关联 CI，并使用真实 model code 返回准确实例路由。 |
| `AC-003` | CI/device API 关联与 CI 删除保护保持正确。 |
| `AC-004` | L1-L3、真实 API/UI、日志和精确清理全部通过。 |

## 回滚

撤销前端字段映射与 `ciModelCode` 响应字段；无数据迁移和外部状态恢复。
