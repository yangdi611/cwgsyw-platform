# REM-P1-058 实施合同

## 目标

- 同租户活动用户组名称按 API 既有 `trim()` 语义唯一。
- create/update 的应用层冲突与数据库并发竞态均返回稳定 HTTP 400。
- restore 名称冲突在预检与写入竞态均返回稳定生命周期 409，且无状态或审计副作用。

## 范围

- `GroupController.create/update` 活动名称预检。
- `GroupMapper` 单一活动名称冲突查询。
- `GroupLifecycleService` restore 名称 blocker 和竞态映射。
- PostgreSQL 活动行 partial expression unique index。
- Controller、生命周期、异常映射、迁移并发与真实 RBAC-007 回归。

## Non-goals

- 不改变大小写敏感语义，不把名称转小写。
- 不禁止跨租户同名，不禁止归档名称复用。
- 不恢复、清除、重命名或回填历史组；迁移发现历史冲突时明确失败。
- 不修改授权模式、membership、角色、ACL、前端表单或非测试对象。

## 影响分析

- `GroupController.create`：LOW，0 direct / 0 process。
- `GroupController.update`：LOW，1 direct test caller / 0 process。
- `GroupMapper`：HIGH，24 direct / 40 total affected / 0 indexed process；只新增独立查询，不改变现有方法。
- `GroupLifecycleService.lifecycleGateBlockers`：MEDIUM，1 direct / 31 total affected；仅 restore 新增名称 blocker。
- `GlobalExceptionHandler.handleDataIntegrity`：LOW，4 direct tests / 0 process；只识别新约束 marker。

## 验收条件

| AC | 条件 |
|---|---|
| `AC-001` | 同租户创建 trim 后同名活动组返回 400，第二行不产生。 |
| `AC-002` | 改名为同租户其他活动组名称返回 400，原组字段不变。 |
| `AC-003` | 跨租户同名和归档名称复用允许；大小写语义不变。 |
| `AC-004` | 两个并发同名写入恰有一个成功，失败稳定映射为组名称冲突。 |
| `AC-005` | restore 名称冲突预检/执行拒绝，组状态和审计不变。 |
| `AC-006` | L1-L3、当前分支 backend 容器、真实 API/UI、日志与精确清理全部通过。 |

## 回滚

撤销 Controller/生命周期/异常映射代码并删除 `uq_sys_group_tenant_name_active` 索引。无数据回填、授权切换、restore 或外部系统动作。
