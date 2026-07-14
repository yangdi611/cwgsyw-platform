# REM-P1-029 实施合同

## 目标与不变量

关闭 `BUG-FQA-014`、`BUG-FQA-020`、`BUG-FQA-082` 的共同根因，交付“运维日历任务、节假日与周期规则输入合同”。

- 保持既有成功路径、租户/范围隔离、权限和会话语义。
- 非法输入或状态必须稳定 4xx，失败不得半写入。
- 原证据只读；测试对象带 remediation runId 并经产品入口清理。
- 不用直接 SQL、流程表或对象存储操作伪造业务状态。

## 当前与目标

当前：任务 priority 枚举与数据库不一致，节假日缺必填/枚举校验，周期规则又缺 Cron、提前日和 due 时序校验。

目标：合法 UI 值可能触发 500，非法配置可进入数据库或静默生成空计划。对应风险消失，API、服务、DTO、UI、审计和生命周期一致。

## 合同与预计影响

- 根因：前端枚举、DTO、Service、OccurrenceCalculator 与 schema 约束各自定义输入合同。
- 候选文件 / 符号：`backend/src/main/java/com/cwgsyw/platform/module/opscalendar/**`、`frontend/src/app/(dashboard)/ops-calendar/**`、`backend/src/main/resources/db/migration/**`
- 范围：统一 task priority/type 枚举；HolidayRequest 字段与日期/类型校验；Cron parser、generateDaysAhead、dueConfig 时序校验；保存前 preview 与实际生成一致。
- 兼容：保留现有成功响应、路由、query key 和历史业务对象。
- GitNexus：规划索引已刷新；编辑每个符号前 upstream `impact`。

## 实施与验收

步骤：复现/确认 → 固定合同 → 最小改动 → L1/L2/L3 → `detect_changes` → 清理/回滚。

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-014 原始路径通过。 |
| `AC-002` | BUG-FQA-020、BUG-FQA-082 各有独立 PASS。 |
| `AC-003` | 正常、边界、deny/不存在、并发和失败零副作用通过。 |
| `AC-004` | 所有枚举合法/非法；节假日空白/日期范围；Cron 有效/无效；due 时序与 preview/生成一致。 |
| `AC-005` | impact/detect、清理、审计与回滚记录完整。 |
| `AC-006` | L4 全量 FQA 通过；此前最多 `VERIFYING`。 |

## 停止与回滚

需要改非测试终态、全租户配置、不可逆流程历史，或出现未解释 5xx/影响超界时停止并 `BLOCKED`。回滚以独立提交为单位；schema/流程数据必须说明兼容恢复。
