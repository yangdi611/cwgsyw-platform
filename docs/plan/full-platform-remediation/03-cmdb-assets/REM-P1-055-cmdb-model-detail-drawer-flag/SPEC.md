# REM-P1-055 实施合同

## 目标

- 模型详情中的每个属性完整保留数据库实体的 `isDrawerShow=true/false`。
- 真实实例列表抽屉按模型配置展示动态关键属性及其值。
- 保持属性列表、模型详情、实例列表和现有前端过滤合同一致。

## 范围

- `CiModelService.toAttributeVO`
- 模型详情映射与 VO 序列化定向测试
- `CMDB-008/011/016/017`、`XL-CMDB-001` 组合 Playwright 资产

## Non-goals

- 不修改数据库、属性创建/更新语义、权限、租户、软删除、路由、React Query key 或前端布局。
- 不改变 `isListShow`、字段类型、option、默认值或排序合同。
- 不重跑未受影响的当前 L4 PASS。

## 影响分析

- `CiModelService.toAttributeVO`：LOW；1 个直接调用者、14 个四层依赖、1 个 Service 模块、0 条执行流。

## 验收条件

| AC | 条件 |
|---|---|
| `AC-001` | `getByCode` 模型详情对 true/false 两类属性逐项返回相同 `isDrawerShow`。 |
| `AC-002` | `CiAttributeVO` 以 camelCase 序列化 `isDrawerShow`。 |
| `AC-003` | CMDB 定向/聚类测试与 backend compile/package 通过。 |
| `AC-004` | 当前事件分支 backend 容器健康，真实组合 Playwright 显示十种动态字段 label/value。 |
| `AC-005` | 所有 runId fixture 产品 API 逆序清理，manifest `objects=[]`、`cleanupFailures=0`，Console/5xx 为零。 |

## 回滚

删除新增的 `isDrawerShow` DTO 映射与定向测试。无迁移、历史数据回填或配置恢复。
