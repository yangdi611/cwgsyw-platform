# REM-P2-002 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-026`、`BUG-FQA-051`、`BUG-FQA-052`；用例：`REPORT-003`、`CMDB-035`、`CMDB-036`。
- 根因：Controller→Service→Mapper 参数传播和统计 DTO 语义不一致。
- GitNexus 已刷新并完成领域 query；未编辑业务符号，逐符号 impact 留给实施门禁。
- 未修改代码、数据库或容器，未创建测试对象。
- 下一步：独立分支认领后，从 `AC-001` 开始并追加实际 impact、diff、测试、证据、清理和回滚。

后续记录只追加，不覆盖历史。

## 2026-07-16：认领、合同确认、实现与运行时复验

- 基线：`lint-fix@cd56a67d`；分支：`codex/rem-p2-002-cmdb-change-query-statistics`；状态：`IN_PROGRESS`。
- 只读复现：Top10 因将 `tenantId` 误传为 `modelId` 返回空；`keyword` 参数被 Controller 静默忽略；未来显式范围下趋势为空但三张当前周期卡片仍有数据。
- 用户确认合同：关键字匹配实例、模型、字段名和字段 before/after 值；显式范围时用单张“所选范围变更”与趋势、Top10 共享同一半开窗口。
- GitNexus upstream impact：`getStats` 1 个直接 Controller 调用、1 条 stats 流程、LOW；`getGlobalChanges` 2 个直接调用者、1 条流程、LOW；`queryChanges` 2 个直接调用者、LOW；`queryTopChangedInstances` 1 个直接调用者、LOW；`queryDailyBreakdown` 2 个直接调用者、LOW；两个前端页面与 Controller 均为 0 个静态上游、LOW。未触及 HIGH/CRITICAL 符号。
- 实现：keyword 被贯通至 Controller/Service/Mapper，SQL 与分页 count 使用相同条件；Top10 使用正确的 modelId 与 `toDate` 上界；显式范围的卡片、趋势、Top10 统一窗口；统计缓存键增加 tenantId，避免跨租户缓存串读；变更历史与统计页面新增关键字和日期范围控件。
- L1 静态：`backend/mvn -q -DskipTests compile`、前端定向 `eslint`、`npx tsc --noEmit` 通过。新增 `CiChangeServiceTest` Mockito 合同断言，但 `mvn -Dtest=CiChangeServiceTest test` 被既有的 OpsCalendar 缺少 `SecurityUser`、OpsCalendar `insert` 重载歧义、GroupController DTO 类型错误阻断，未混入非本事件修复。
- L3：以当前分支构建并仅替换 backend/frontend 容器，健康通过，未清 Redis、会话或数据卷。真实 API：不存在 keyword 为 `200 records=0 total=0`；默认 Top10 返回 10 条且次数降序；未来范围的单卡/趋势/Top10 均为 0。Playwright 经 `http://localhost` 验证关键字页面空态、统计范围控件和“所选范围变更”可见，无 Console error。未创建测试对象，因此无清理对象。
- 提交前 GitNexus：增量 analyze 后 `detect-changes --scope all` 为 14 个文件、35 个符号、5 条预期统计/页面流程、MEDIUM；相对陈旧 `master` 的 CRITICAL/299 条流程是历史集成差异，不作为本事件回归结论。
