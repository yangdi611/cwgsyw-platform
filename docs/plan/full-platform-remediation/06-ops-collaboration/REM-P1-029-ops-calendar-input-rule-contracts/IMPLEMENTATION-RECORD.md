# REM-P1-029 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-014`、`BUG-FQA-020`、`BUG-FQA-082`；用例：`OPS-003`、`OPS-004`、`OPS-014`、`OPS-HOLIDAY-CRUD`、`COMMON-012`。
- 根因：前端枚举、DTO、Service、OccurrenceCalculator 与 schema 约束各自定义输入合同。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始追加实际 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-18：L4 回归修复

- L4 `FQA_20260718_1616_remp0008` 发现 `OPS-011`：一个周期规则引用模板后，模板删除仍返回 `200`，留下悬空 `templateId`。本次 runId fixture 在失败后由产品 API 精确清理，manifest 为零。
- 分支：`codex/rem-p1-029-ops-template-reference-integrity`，基线：`lint-fix@2615e8ff`。本会话的 GitNexus MCP `impact`/`detect_changes` 接口不可用；刷新索引后以静态调用核验确认 `OpsCalendarTemplateService.delete` 仅由 `OpsCalendarTemplateController.delete` 直接调用，风险评估为 LOW。
- 代码：`OpsCalendarTemplateService.delete` 以 tenant、templateId 和 `isDeleted=false` 统计周期规则引用；存在引用时稳定拒绝，不写模板软删或审计。未迁移历史规则，未改授权、数据库 schema 或外部系统。
- L1：`mvn -f backend/pom.xml -Dtest=OpsCalendarTemplateServiceTest test` 通过（1/1）。L2/L3：当前分支 backend 镜像重建并 healthy，runId Playwright API 回归证明引用删除 `400`，删除规则后模板可删除；低权限真实 Chromium 路由/API 拒绝回归通过。所有 fixture 经产品 API 清理，manifest 为零。
- 回滚：移除删除前的引用计数检查和对应测试即可；无 schema 或数据迁移。

## 2026-07-16：实施与 L1-L3 通过

- 分支：`codex/rem-p1-029-ops-calendar-input-rule-contracts`，基线：`lint-fix@7220046`。
- 高风险告警：事件涉及规则持久化、预览与 scheduler；实施前已确认不迁移历史数据、不修改全局授权、不启动不可逆操作。GitNexus upstream impact：规则 create/preview、任务 create/update、节假日 applyRequest、OccurrenceCalculator.calculate 均为 LOW；calculate 的直接消费者为 preview、generateForRule、next-scan，未改其历史规则计算行为。
- 代码：任务 Service 在入库前统一校验 taskType/priority/visibility 和更新后的时间顺序；节假日 Service 校验名称、日期、类型和调休 JSON 日期数组；规则 Service 校验 taskType、triggerType、Cron、提前天数范围、due 日期/时间及同日时序，create/update/preview 共用该合同。
- L1：后端 compile 通过；已加入最小任务/规则/节假日输入合同单测。完整 Maven test 被无关既有 `GroupControllerGroupReferenceTest` testCompile 类型错误阻断，未执行到目标测试；该错误已记录为历史债务。
- L2：真实 API 对 7 类无效输入全部获得 400，合法节假日、规则和 preview 通过且 due 顺序正确；runId 节假日与禁用规则通过产品 DELETE 精确清理，残留为 0。
- L3：当前分支 backend 重建 healthy；frontend typecheck/lint 与 Playwright 规则、节假日页面加载通过，Console error 为 0。
- 回滚：移除三项 Service 输入校验及相应单测即可；无 schema、既有规则、任务状态或外部系统状态变更。
- 结论：事件级 L1-L3 均 PASS，状态提升为 `VERIFIED`，等待最终 L4。
