# REM-P1-009 实施合同

## 目标与不变量

关闭 `BUG-FQA-061`、`BUG-FQA-086`、`BUG-FQA-088` 的共同根因：CMDB 关系与实例删除引用完整性。

- 保持租户和 group scope 隔离；不放宽既有权限。
- 失败必须原子且可解释，不产生孤儿、重复或半写入。
- 原始 FQA 证据不覆盖；新测试对象带 remediation runId 并精确清理。
- schema 改动须有存量冲突预检、向后兼容与回滚说明。

## 当前与目标

当前：关系创建允许实例自环，设备可重复关联同一 CI，实例删除又忽略 onDelete=restrict 并留下设备孤儿引用。

目标：拓扑和资产引用可进入不合法状态，删除后产生不可追踪孤儿对象。对应的风险消失；API、服务、数据库、UI、权限和审计遵循同一合同。

## 合同与影响面

- 根因合同：创建/删除事务缺少跨表不变量与数据库约束，onDelete 策略未在命令服务执行。
- 候选文件 / 符号：`backend/src/main/java/com/cwgsyw/platform/module/cmdb/service/CiRelationService.java`、`backend/src/main/java/com/cwgsyw/platform/module/cmdb/service/CiInstanceCommandService.java`、`backend/src/main/java/com/cwgsyw/platform/module/device/DeviceService.java`、`backend/src/main/resources/db/migration/**`
- 权限：allow/deny、列表/详情、直达路由与导航一致。
- 数据：必要唯一/检查/引用约束必须有服务层可理解错误和并发测试。
- 审计：记录 operator/target/必要快照，不包含密码、token、密钥或文件正文。
- 兼容：保留既有成功响应、query key 和路由，除非本事件明确修正。
- GitNexus：规划时索引已刷新；实施前必须对每个拟编辑符号执行 upstream `impact`。

## 实施步骤

1. 逐缺陷复现或只读确认，冻结数据与错误合同。
2. 如需 schema，先扫描存量冲突并设计可回退迁移。
3. 以最小根因改动实施，并为每个缺陷保留独立断言。
4. 执行 L1 定向、L2 聚类、L3 模块回归及 `detect_changes`。
5. 产品 API 逆序清理，记录证据与回滚结果。

## 验收

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-061 原始路径通过。 |
| `AC-002` | BUG-FQA-086、BUG-FQA-088 分别有独立 PASS。 |
| `AC-003` | 正常、边界、deny/不存在、并发及失败零副作用通过。 |
| `AC-004` | 自环/重复/合法关系；并发设备创建；restrict/cascade/none 删除；失败后关系与设备不变。 |
| `AC-005` | `detect_changes`、清理、schema/回滚验证完整。 |
| `AC-006` | 发布候选版 L4 全量 FQA 通过。 |

## 停止与回滚

影响超出候选范围、发现非测试数据需变更、存量冲突无法自动裁决、出现未解释 5xx 或回滚不可验证时停止并标记 `BLOCKED`。回滚以独立提交和配套迁移为单位。
