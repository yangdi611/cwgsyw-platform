# REM-P2-013 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-028`、`BUG-FQA-036`；用例：`FLOW-004`、`FLOW-013`。
- 根因：Service 直接返回 Map，没有稳定 DTO/JSON 命名合同。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始追加实际 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-16：认领与影响分析

- 状态：`IN_PROGRESS`；分支：`codex/rem-p2-013-workflow-read-model-schema`；基线：`lint-fix@af04a36`。
- GitNexus upstream：`WorkflowService.getProcessStats` LOW（`processStats` 与 `getAllProcessStats` 两个直接调用者，后者经 `allStats` 暴露）；`getAllProcessStats` LOW（`allStats`）；`getHistoricActivities` LOW（`activities`）。两个 Controller 入口均为 LOW、无上游调用者或执行流程。
- 根因确认：两个服务方法直接构造 snake_case `Map`，而前端 `ProcessStat`、`ActivityVO` 已按 camelCase 读取，导致活动结束时间丢失、流程统计 key/数值为空或 `NaN`。
- 预计最小改动：新增类型化只读 DTO，保持端点、权限、流程状态和历史对象不变；下一步在编辑符号前已完成 impact，实施 DTO 与 Controller 泛型同步。

## 2026-07-16：实现与 L1-L3 复验

- 状态：`VERIFIED`；runId：`REM_P2_013_20260716_183640`。
- 实现：新增 `ProcessStatsVO` 与 `HistoricActivityVO`，`WorkflowService` 和 `/workflow/stats`、`/workflow/instances/{id}/activities` Controller 使用类型化 DTO 替代 snake_case `Map`。JSON 输出为 camelCase；零/缺失 duration 保持 `0`，由页面显示稳定占位。未改端点、query key、权限、流程状态或历史记录。
- L1/L2：新增 Controller 兼容测试覆盖 DTO 字段；生产 compile 通过。Maven 定向测试被既有无关 testCompile 错误阻断。真实 API 读取到 3 个统计对象，字段均完整 camelCase；4 个已完成实例中抽样活动均含 `endTime`。
- L3：当前分支 backend 镜像构建并仅替换 backend；health `UP`。隔离 Playwright 从 `/login` 进入 `/workflow/stats` 与完成实例详情，统计卡无空 key/`NaN`、完成活动显示“已完成”，Console 和 failed request 都为零。
- 数据与清理：所有验证均为认证态只读；未创建产品对象、临时身份、流程实例或审计夹具。`result.json` 的 `activeObjects=0`、`cleanupFailures=0`。
- 回滚：回退本事件提交即可恢复原 Map 输出；无 schema、流程或历史数据变更。
