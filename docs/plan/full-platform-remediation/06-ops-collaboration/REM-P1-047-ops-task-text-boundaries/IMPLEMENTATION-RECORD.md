# REM-P1-047 实施记录

## 2026-07-19：认领与影响分析

- 状态：`IN_PROGRESS`；分支：`codex/rem-p1-047-ops-task-text-boundaries`；基线：`lint-fix@1cfccf0e`。
- 来源：L4 `FQA_20260718_2050_remp1038` 的 `L4-OPS-004-001`；失败快照 `cff458729`。255 字符创建/回读成功，256 字符因数据库列约束返回 409；失败夹具已由产品 API 清理，活动对象和 cleanup failure 均为 0。
- 合同检索：`ops_schedule_task.title` 为 `VARCHAR(255)`；`content` 为 PostgreSQL `TEXT`。验收目录、历史事件、schema、源码与测试均未定义任务正文最大值，因此只修复明确的标题 255 合同，不新增正文限制。
- GitNexus 索引刷新至当前工作区。upstream impact：`OpsCalendarTaskService` 类 LOW；`createManual` MEDIUM（7 个直接 Controller/测试调用，限 OpsCalendar）；`update` LOW（Controller 直接调用）；`TaskCreateRequest` LOW；`TaskUpdateRequest` LOW；`TaskFormDialog` LOW（`OpsCalendarInner`，1 条 UI 流程）。无 HIGH/CRITICAL 风险。
- 预计修改：服务共用标题校验、服务边界测试、表单 Unicode 计数/提交阻止；不改 DTO/schema/权限/状态机/正文语义。
- runId：`REM_P1_047_20260719`。下一门禁：实现后执行 L1 定向测试。

## 2026-07-19：实现与 L1-L3 通过

- 实现：`OpsCalendarTaskService` 在创建任何写入前、更新权限门禁后但持久化前共用 Unicode code point 标题校验；创建必填，更新显式空白拒绝，最大 255。`TaskFormDialog` 使用 `Array.from` 显示准确计数并阻止超长 POST。正文合同未变。
- L1：Java 21 容器中 `OpsCalendarTaskServiceTest` 19/19 PASS，覆盖创建/更新 255、256、空白和写副作用。前端 typecheck、目标 ESLint PASS。
- L2/L3：当前分支 backend/frontend 生产镜像并行 build PASS，仅替换两应用容器；backend healthy、网关 UP。事件 Playwright 2/2 PASS：API 标题边界/审计不变、UI emoji 计数/零 POST/pageerror=0。
- 模块测试：OpsCalendar 聚类 34 项中 33 PASS；唯一无关错误为 `OpsCalendarMaterialExportTest:45` 的既有冗余 Mockito stub。事件目标测试和其余模板/节假日/排班/规则测试通过。
- 测试数据：短超时中止的首次 Playwright 留下 #36，经产品 remediation cleanup 软删；最终活动任务与五类依赖均为 0，保留预期软删行和 purge 审计。未直接修改数据库、Redis、对象存储或会话。
- detect：事件局部 LOW、0 affected processes。回滚仅移除服务校验、UI 计数及事件测试；无 schema/data migration。
- 状态：L1-L3 全部通过，提升为 `VERIFIED`；下一步精确暂存、staged/compare detect、提交和 no-ff 合并。

## 2026-07-19：事件提交与集成

- staged detect：13 files、17 symbols、0 affected processes、LOW。compare-to-master 的 1519 files/300 flows/CRITICAL 是 `lint-fix` 长期累计差异，不是本事件局部风险。
- event commit：`9f15ba6891fdff7a6558e5082be892cbdc8b3b27`。
- 从未漂移的 `lint-fix@1cfccf0e` 执行 `--no-ff --no-commit`，无冲突；合并提交创建后回写最终 hash并验证祖先关系。
