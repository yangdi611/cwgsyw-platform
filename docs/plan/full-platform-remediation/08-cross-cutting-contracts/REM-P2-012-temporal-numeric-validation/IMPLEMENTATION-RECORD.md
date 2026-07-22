# REM-P2-012 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-029`、`BUG-FQA-030`、`BUG-FQA-031`、`BUG-FQA-032`、`BUG-FQA-033`、`BUG-FQA-034`、`BUG-FQA-037`、`BUG-FQA-060`；用例：`REPORT-001`、`REPORT-002`、`OPS-002`、`OPS-016`、`OPS-018`、`OPS-019`、`DAILY-001`、`DAILY-003`、`DAILY-004`、`COMMON-012`。
- 根因：日期解析、range 校验和 MethodArgumentTypeMismatchException 映射分散在多模块，前端 query error 分支不完整。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始追加实际 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-16：实现与 L1-L3 复验

- 状态：`VERIFIED`；分支：`codex/rem-p2-012-temporal-numeric-validation`；基线：`lint-fix@335999d`；runId：`REM_P2_012_20260716_181849`。
- GitNexus upstream：`OpsCalendarTaskService.listTasks` LOW（3 个直接调用者：列表、day、dashboard）；`OpsCalendarRosterService.list` LOW（Controller 与历史组测试）；日报 `listMyReports`/`listGroupReports` 各 LOW（各 1 个 Controller）；`collect` LOW（collect/export）；`stats` LOW（stats Controller）；`GlobalExceptionHandler`、`CreateDailyReportRequest`、`StatsPage` 均 LOW。未出现 HIGH/CRITICAL。
- 实现：新增 `TemporalInputValidator`，统一范围顺序与 `yyyy-MM` 月校验；任务、排班、素材、统计复用范围合同；日报列表使用 `YearMonth`；全局处理器把 Spring 参数/JSON 转换异常统一映射为 HTTP/body `400`；日报请求限制日期为今天及以前、工时为 `0..24`；统计页阻止反向日期并提供错误态与重试。合法响应、权限、范围与查询键未改变。
- L1：新增/扩展全局转换、任务/排班范围、日报月份、DTO 日期/工时边界测试。生产 compile 通过；定向 Maven 被三个已知无关 testCompile 源错误阻断，未把其标记为本次回归。
- L2/L3：当前分支 backend/frontend 镜像构建并仅替换相应容器；health 为 `UP`。真实会话 API 逐项验证 11 个日期/月端点及 6 个日报日期/工时边界，所有预期拒绝均 HTTP/body `400`，合法月份为 `200`。隔离 Playwright 从登录页进入统计页，反向输入在客户端阻止、合法范围可再次统计，Console 与 failed requests 为零。
- 数据与清理：全部 API 请求为只读或拒绝路径；未创建任何产品对象、权限或审计测试夹具。`result.json` 记录 `activeObjects=0`、`cleanupFailures=0`。
- 回滚：回退本事件提交即可还原范围/月/转换与 UI 行为；无 schema、流程或历史数据迁移。
