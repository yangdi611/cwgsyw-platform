# REM-P2-002 实施合同

## 目标与不变量

关闭 `BUG-FQA-026`、`BUG-FQA-051`、`BUG-FQA-052` 的共同根因：CMDB 变更查询与统计准确性。

- 保持租户和 group scope 隔离；不放宽既有权限。
- 失败必须原子且可解释，不产生孤儿、重复或半写入。
- 原始 FQA 证据不覆盖；新测试对象带 remediation runId 并精确清理。
- schema 改动须有存量冲突预检、向后兼容与回滚说明。

## 当前与目标

当前：Top 10 将 tenantId 错传为 modelId，变更历史忽略关键词，统计卡又不使用用户显式日期范围。

目标：变更热点、筛选结果和时间范围统计不再误导管理员；API、服务、数据库、UI、权限和审计遵循同一合同。

## 合同与影响面

- 根因合同：Controller→Service→Mapper 参数传播和统计 DTO 语义不一致。
- 关键字：匹配实例 ID/名称、模型编码/名称、`fieldChanges` 的字段名与 before/after 值；操作人继续使用独立 `operatorId` 筛选。筛选必须在 SQL 分页与 count 中同时生效。
- 日期范围：未传范围时保留“今日/本周/本月”卡片与最近 30 天趋势/Top10。传入 `from` 或 `to` 时，卡片收敛为单张“所选范围变更”，其计数、趋势和 Top10 使用同一半开区间 `[from,to)`；Top10 必须同时受上下界限制。
- 候选文件 / 符号：`backend/src/main/java/com/cwgsyw/platform/module/cmdb/service/CiChangeService.java`、`backend/src/main/java/com/cwgsyw/platform/module/cmdb/mapper/CiChangeRecordMapper.java`、`frontend/src/app/(dashboard)/cmdb/changes/**`
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
| `AC-001` | BUG-FQA-026 原始路径通过。 |
| `AC-002` | BUG-FQA-051、BUG-FQA-052 分别有独立 PASS。 |
| `AC-003` | 正常、边界、deny/不存在、并发及失败零副作用通过。 |
| `AC-004` | Top10 无/有 modelId；关键词命中/不命中与分页；默认/显式日期范围；UI 数字与数据库聚合一致。 |
| `AC-005` | `detect_changes`、清理、schema/回滚验证完整。 |
| `AC-006` | 发布候选版 L4 全量 FQA 通过。 |

## 停止与回滚

影响超出候选范围、发现非测试数据需变更、存量冲突无法自动裁决、出现未解释 5xx 或回滚不可验证时停止并标记 `BLOCKED`。回滚以独立提交和配套迁移为单位。
