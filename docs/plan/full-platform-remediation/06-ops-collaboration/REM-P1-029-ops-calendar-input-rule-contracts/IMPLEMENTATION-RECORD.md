# REM-P1-029 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-014`、`BUG-FQA-020`、`BUG-FQA-082`；用例：`OPS-003`、`OPS-004`、`OPS-014`、`OPS-HOLIDAY-CRUD`、`COMMON-012`。
- 根因：前端枚举、DTO、Service、OccurrenceCalculator 与 schema 约束各自定义输入合同。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始追加实际 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-16：实施与 L1-L3 通过

- 分支：`codex/rem-p1-029-ops-calendar-input-rule-contracts`，基线：`lint-fix@7220046`。
- 高风险告警：事件涉及规则持久化、预览与 scheduler；实施前已确认不迁移历史数据、不修改全局授权、不启动不可逆操作。GitNexus upstream impact：规则 create/preview、任务 create/update、节假日 applyRequest、OccurrenceCalculator.calculate 均为 LOW；calculate 的直接消费者为 preview、generateForRule、next-scan，未改其历史规则计算行为。
- 代码：任务 Service 在入库前统一校验 taskType/priority/visibility 和更新后的时间顺序；节假日 Service 校验名称、日期、类型和调休 JSON 日期数组；规则 Service 校验 taskType、triggerType、Cron、提前天数范围、due 日期/时间及同日时序，create/update/preview 共用该合同。
- L1：后端 compile 通过；已加入最小任务/规则/节假日输入合同单测。完整 Maven test 被无关既有 `GroupControllerGroupReferenceTest` testCompile 类型错误阻断，未执行到目标测试；该错误已记录为历史债务。
- L2：真实 API 对 7 类无效输入全部获得 400，合法节假日、规则和 preview 通过且 due 顺序正确；runId 节假日与禁用规则通过产品 DELETE 精确清理，残留为 0。
- L3：当前分支 backend 重建 healthy；frontend typecheck/lint 与 Playwright 规则、节假日页面加载通过，Console error 为 0。
- 回滚：移除三项 Service 输入校验及相应单测即可；无 schema、既有规则、任务状态或外部系统状态变更。
- 结论：事件级 L1-L3 均 PASS，状态提升为 `VERIFIED`，等待最终 L4。
