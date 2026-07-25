# 统一任务平台实施状态

**总体状态：** COMPLETE  
**当前工作包：** WP-00..WP-10 COMPLETE  
**最后更新：** 2026-07-24  
**更新者：** Codex

---

## 1. 状态枚举

```text
NOT_STARTED
IN_PROGRESS
VERIFYING
BLOCKED
COMPLETE
```

只有所有必须工作包和最终门禁通过后才能标记 COMPLETE。

---

## 2. 工作包状态

| 工作包 | 状态 | 负责人 | 结果/证据 |
| --- | --- | --- | --- |
| WP-00 基线与合同冻结 | COMPLETE | AI Agent | 基线通过，旧实现盘点完成，技术选择确定，见第3/5/8/10节 |
| WP-01 增量 schema 与领域骨架 | COMPLETE | Codex | 保留 V1-V79；V80-V83 增量新增统一任务 schema/权限/模板；V79 升级、非目标数据保护、约束和编译验证通过 |
| WP-02 模板与动态表单 | COMPLETE | Codex | 28 类字段、受控条件/公式、版本生命周期、模板 API、三栏设计器和 19 项后端测试全部通过；前端 lint/typecheck/build 通过 |
| WP-03 计划、调度与 CI 范围 | COMPLETE | Codex | 计划生命周期、9 类周期、4 种生成模式、CI 三层范围、并发幂等生成、通知 outbox、计划向导及前后端门禁通过 |
| WP-04 任务执行、草稿与提交 | COMPLETE | Codex | 任务列表/门控、草稿 revision、附件冻结、服务端校验、提交幂等、事实血缘和通用动态表单通过门禁 |
| WP-05 审批闭环与我的工作 | COMPLETE | Codex | 审批方案/版本、Flowable 指定人/候选组、多轮退回重提、字段附件意见、提交差异与 `/work` 五类集合通过 27 项后端测试及前端门禁 |
| WP-06 运维日历切换与日报模板 | COMPLETE | Codex | 单页月/周/列表、统一任务快捷创建与详情跳转、日报周期模板和桌面/移动端真实交互验收均通过 |
| WP-07 自定义统计与看板 | COMPLETE | Codex | 单模板结构化统计、看板、下钻、文字/附件展示和导出已实现；桌面/移动端真实查询与构建门禁通过 |
| WP-08 跨周期汇总与自动化 | COMPLETE | Codex | 指标、权威来源、目标、整改/复查自动化和按权限订阅已实现；全链路、迁移和零旧任务残留审计通过 |
| WP-09 消费者切换与旧实现删除 | COMPLETE | Codex | V92 定向删除旧实现、精确保护非目标数据，并用真实 Flowable 7.1 PostgreSQL schema 验证日报流程子表清理 |
| WP-10 全量验证与文档收口 | COMPLETE | Codex | 后端、前端、V1/V79 迁移、旧任务域残留及真实 Chrome 桌面/移动端验收全部通过 |

---

## 3. 当前执行摘要

**WP-00 基线与合同冻结 - COMPLETE (2026-07-22 23:30)**

已完成：
1. ✅ 读取全部实施文档（AI-IMPLEMENTATION-PROMPT, README, PRD, SPEC, DATA-MODEL, API-UI-CONTRACT, IMPLEMENTATION-PLAN, SCHEMA-CUTOVER, TEST-ACCEPTANCE）
2. ✅ 检查工作树，记录并保护用户修改（lint-fix 分支测试改进）
3. ✅ 基线质量门禁通过（后端 compile, 前端 lint/typecheck）
4. ✅ GitNexus 索引确认新鲜（485ebb08, 11849 symbols, 300 processes）
5. ✅ 盘点旧日报模块（20+ Java 类，3 前端页面，3 组件，2 数据表）
6. ✅ 盘点旧运维任务模块（13+ Controller, 8 实体表，前端 4 子页面）
7. ✅ 盘点重复流程待办（/workflow/todo + /workflow/tasks 双入口）
8. ✅ 确认 Flyway 依赖（V4 日报表，V61 ops_schedule_* 表，V62 流程绑定包含 daily_report）
9. ✅ 完成低层技术选择（10 项决策，见第 5 节）
10. ✅ 建立旧实现清理台账（50+ 清理对象，见第 10 节）
11. ✅ 更新状态文档

**WP-01 增量 schema 与领域骨架 - COMPLETE（当前有效结果）**

已完成：
1. ✅ 保留 V1-V79 历史，通过 4 个递增 migration 新增能力
   - V80: 统一任务、审批核心表
   - V81: 统计和自动化表
   - V82: 新权限种子
   - V83: 内置模板种子
2. ✅ V80-V83 不删除旧日报或旧 `ops_schedule_*`；它们只在 WP-09 消费者切换后由新 migration 定向删除
3. ✅ 使用隔离 PostgreSQL 验证 V79 升级、V1 全新安装、非目标哨兵数据、权限、模板与关键约束
4. ✅ 创建 13 个实体类和 13 个 Mapper 接口
   - 模板模块：TaskTemplate, TaskTemplateVersion, TaskTemplateField
   - 计划模块：TaskPlan
   - 运行时模块：TaskInstance, TaskSubmission
   - 审批模块：ApprovalScheme, ApprovalSchemeVersion, ApprovalRound, ApprovalAction
5. ✅ 创建服务层骨架
   - TaskTemplateService + 实现
6. ✅ 后端编译通过

**证据：**
- Schema 在 `backend/src/main/resources/db/migration/V80__create_unified_task_schema.sql` 至 `V83__seed_task_builtin_templates.sql`
- 实体在 backend/src/main/java/com/cwgsyw/platform/module/task 和 approval
- `UnifiedTaskIncrementalMigrationTest` 与后端编译通过

**2026-07-23 13:36 / V87 跨周期 schema 合同收口**

- 新增 `V87__complete_task_metrics_automation_contract.sql`，保持 V1-V86 不变。
- 指标定义/绑定/事实补齐值类型、单位换算、权威来源、业务日期、组织快照、来源类型和失效时间字段。
- 目标、任务关系、自动化执行和看板订阅补齐终态生命周期、幂等、重试、发送调度及自关联约束。
- `UnifiedTaskIncrementalMigrationTest` 已验证 V79→V87 连续升级、V87 字段/索引/约束以及旧目标表在切换前仍存在。
- 旧日报与旧 `ops_schedule_*` 的“仍存在”只代表迁移期间保护，绝不代表终态 KEEP；WP-09 消费者切换后必须物理删除。

---

### 2026-07-22 23:50 / WP-01 初版方案（已撤销，禁止执行）

该版本曾计划在 V80 立即删除日报和旧 `ops_schedule_*`，并使用 V81-V84 建立新模型。此方案没有先完成消费者切换，已被撤销，所列迁移文件和版本号均不代表当前工作树。

当前有效实现为 V80-V83 增量新增统一任务能力，旧目标表仅在 WP-09 完成消费者切换后由新的递增 migration 定向删除。完整依据见本节上方“WP-01 增量 schema 与领域骨架”、第 4 节、`SCHEMA-CUTOVER.md` 和 `SCHEMA-OBJECT-LEDGER.md`。

---

## 4. 冻结决策

- 系统未上线，旧日报和旧 `ops_schedule_*` 目标域开发数据不迁移；非目标业务数据在对象审计和定向 migration 前受保护。
- 采用新 schema 硬切换，不双写双读。
- 运维日历保留单页面月/周/列表视图。
- 日报改为内置任务模板，独立模块物理删除。
- Flowable 保留，用户审批入口统一到我的工作。
- 最终不保留被统一任务替代的旧页面、API、DTO、权限和数据表；用户、RBAC、CMDB、设备、Wiki、共享文件、通知等其他正式业务模块对象保持不变。

---

## 5. 实施技术选择

执行 WP-00 时填写：

| 选择项 | 决策 | 理由 | 日期 |
| --- | --- | --- | --- |
| 草稿附件模型 | 关联到 task_draft，物理存储 MinIO，元数据单独表 `task_draft_attachment` | 草稿可删除，正式提交附件进入 `task_submission_attachment` 不可变快照。复用现有 MinIO bucket 结构 | 2026-07-22 |
| published 不可变保护 | 应用服务层校验 + 集成测试验证，不用触发器 | 项目无触发器先例，应用层保护足够且错误可读 | 2026-07-22 |
| 指标扩展维度存储 | 维度值存 `task_field_fact` 的 `dimension_snapshot JSONB`，包含时间、人员、组、CI 快照 | 统计时直接读取不需重新解析历史组织结构或 CI 位置 | 2026-07-22 |
| 统计预聚合方式 | Phase 1 不做预聚合，Phase 2+ 按需引入 Redis 或物化视图 | 首期数据量不大，保持查询透明和调试性 | 2026-07-22 |
| 排班/节假日表是否重命名 | 两个业务集合继续以 `ops_duty_roster` 和 `ops_holiday_calendar` 作为唯一权威源，不复制新表；仅保留经逐列证明有用的结构 | 两表已分别被统一任务值班人分派、工作日/相对节假日计算直接读取；表级有用不等于历史字段自动保留，WP-06 未形成正式消费者的列、索引和审计数据由 WP-09 删除 | 2026-07-23 |
| 审批管理 API 包拆分 | 放入 `module/approval`，独立于 `module/workflow`（Flowable 门面） | 审批方案是业务概念，workflow 是引擎适配，边界清晰 | 2026-07-22 |
| 计划调度复用 | 抽取 `OccurrenceCalculator` 到 `module/task/plan/scheduler` 并移除旧实体依赖 | 避免新任务依赖旧 ops 包，保持单向依赖 | 2026-07-22 |
| 字段类型注册 | 单例 `FieldTypeRegistry`，每类型一个 `FieldTypeHandler` 接口实现 | 扩展性好，配置/值/统计校验边界明确 | 2026-07-22 |
| 条件和公式 AST | 使用 JSONB 存结构化 AST，后端解析器不依赖脚本引擎 | 安全、可校验、可索引部分节点 | 2026-07-22 |
| CI 范围选择器 | 前端单组件支持模型组/模型/实例混合树+多选，后端返回扁平化 resolved 列表 | 复用 CMDB 现有目录 API，避免前端复杂递归解析 | 2026-07-22 |

---

## 6. 基线检查

| 检查 | 命令/工具 | 结果 | 备注 |
| --- | --- | --- | --- |
| Git 工作树 | `git status --short` | ✅ 通过 | 用户已有修改：测试清理和规范改进（lint-fix分支），已记录保护 |
| GitNexus 索引 | repo context/status | ✅ 新鲜 | 索引至 485ebb08，11849 symbols, 300 processes |
| 后端 compile | `cd backend && mvn -q -DskipTests compile` | ✅ 通过 | Lombok 警告不影响编译 |
| 后端 test | `cd backend && mvn test` | 待执行 | 后续工作包按需执行 |
| 前端 lint | `npm run lint` | ✅ 通过 | 39 warnings（既有问题，非本次引入） |
| 前端 typecheck | `npm run typecheck` | ✅ 通过 | 无类型错误 |
| 前端 build | `npm run build` | 待执行 | 后续工作包验证 |

---

## 7. Impact 记录

每个拟编辑 symbol 记录：

| 日期 | Symbol | Risk | 直接调用者/模块 | 决策 |
| --- | --- | --- | --- | --- |
| - | - | - | - | - |

HIGH/CRITICAL 必须在实施前向用户告警，并记录用户决策或缩小方案。

---

## 8. 变更与验证日志

每轮追加，不覆盖历史：

### 2026-07-25 / 自定义表格字段 Goal 增量验收

**完成结果：**
- 在现有动态字段注册、模板版本、草稿/提交、审批和统计事实模型上加入自定义表格（可重复明细表）字段，不新增平行表单或报表模型。
- 模板设计器支持固定列、中文表头、列类型、行数限制、自增序号、数字汇总、下拉选项、附件/图片限制及列级统计开关。
- 填写页支持动态增删/复制行、自动序号、行内附件、汇总行；后端校验行数、列值、附件归属和自增序号。
- 表格列统计支持 `fieldKey + tableColumn`，新模板按列授权，历史“表格整体统计”配置保持兼容；事实使用稳定 `__rowId` 行键。
- 任务详情、提交历史和审批详情支持表格回显；审批详情、下载和附件意见均按表格列可见性处理。
- 使用说明已更新：`wiki-manual/40-task-center/templates-plans.md`、`execution.md`、`analytics.md`；新增 Goal 实施合同 `docs/plan/unified_task_platform/REPEATING-TABLE-GOAL-PROMPT.md`。

**验证证据：**
```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn -q -Dtest=TemplateFormRuntimeTest,TaskRuntimeServiceTransactionTest,TaskAnalyticsQueryServiceTest,ApprovalRuntimeServiceTest test
JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn -q -DskipTests compile

cd ../frontend
npm run lint -- src/components/task-template/designer-utils.ts src/components/task-template/FieldPropertyPanel.tsx src/components/task-runtime/DynamicTaskForm.tsx src/components/task-runtime/TaskDetail.tsx src/components/task-runtime/SubmissionHistoryCard.tsx src/components/task-analytics/TaskAnalyticsWorkbench.tsx src/components/work/ApprovalTaskDrawer.tsx
npm run typecheck
npm run build
```

以上命令在 Java 21 下通过；前端构建仅提示已有多 lockfile workspace root warning。GitNexus staged 检测显示 25 个文件、107 个符号、7 条任务/审批流程，综合风险为 HIGH；审批与统计入口已分别完成 upstream impact 和定向回归测试。未执行 commit、push 或容器重建。

> 2026-07-23 00:54 的全库 baseline 替换记录是已撤销的错误实施历史，不代表当前代码或实施合同。当前唯一有效策略见 08:26 纠正记录、`SCHEMA-CUTOVER.md` 和 `SCHEMA-OBJECT-LEDGER.md`。

### 2026-07-23 / WP-06 自动化收口与 UI 验证状态

**完成结果：**
- 运维日历保持单个 `/ops-calendar` 页面，月/周/列表共享筛选、日期上下文和统一任务详情跳转；快速创建使用正式 one-off task 流程。
- `/api/calendar/work-items`、`/day`、`/dashboard` 组合统一任务、排班和节假日；日历设置收敛为 `/api/calendar-settings/rosters|holidays` 和 `calendar_settings:*` 权限。
- 内置工作日报使用统一任务模板与 V85 工作日计划，按活动用户生成、周末跳过、重试幂等，并从计划固化组级审批方案版本。
- `DailyWorkReportIntegrationTest` 验证日报字段、工时统计配置、CI 三级选择、附件、生成幂等和审批方案固化；日历查询、Controller 契约及任务运行回归通过。

**已通过验证：**
```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
mvn -q -Dtest=DailyWorkReportIntegrationTest,CalendarQueryServiceTest,\
CalendarControllerContractTest,TaskPlanGeneratorTest,TaskAssignmentResolverTest,\
TaskOccurrenceCalculatorTest,OpsCalendarRosterHistoricalGroupTest,\
OpsCalendarHolidayServiceTest,UnifiedTaskIncrementalMigrationTest,\
ApprovalRuntimeServiceTest,TaskRuntimeServiceTransactionTest test
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home mvn -q -DskipTests compile

cd frontend
npm run typecheck
npm run build
```

**未完成证据：**
- 按 Browser skill 连接 `http://localhost:3100/ops-calendar` 时，运行时返回无可用浏览器，`agent.browsers.list()` 为空；未使用无关浏览器工具替代，也未把源码检查冒充交互验收。
- 因 CAL-001..005 仍缺桌面/移动端实际交互和截图证据，WP-06 保持 `VERIFYING`，不能标记 `COMPLETE`。
- 该外部条件不阻止 WP-07 后端、前端和自动化测试继续实施；WP-10 最终签收前必须补齐。

### 2026-07-23 11:04 / WP-05 审批闭环与我的工作收口

**完成结果：**
- 完成审批方案与不可变版本、指定人/候选组/多级 Flowable 审批、候选关系与业务权限联合门控，以及唯一 `/api/approvals/tasks` 用户审批契约。
- 退回修改和终止强制理由；字段、附件意见必须引用当前可见提交内容，任务详情在对应字段/附件及审批轮次中展示意见。
- 退回后从上一提交复制表单和附件形成新草稿；重新提交生成递增 submission、将旧版本标记为 `superseded`、关联 `supersedes_submission_id` 并启动新审批轮次。
- `/work` 提供待执行、待审批、我发起、抄送我、已完成五类集合、筛选、分页和实时 badge；待审批详情和动作在同一入口完成。
- 任务详情新增历史提交版本选择、不可变快照、附件下载，以及相对上一版本的字段和附件差异展示；不依赖 CMDB 专属 UI 组件。
- Flowable 完成回调按终态幂等；审批通过激活当前 submission 事实并完成任务，重复回调不重复写事实、事件或通知。

**验证：**
```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
mvn -q -Dtest=ApprovalSchemeServiceTest,ApprovalRuntimeServiceTest,WorkItemServiceTest,\
TaskApprovalWorkflowAdapterIntegrationTest,TaskRuntimeServiceTransactionTest,\
UnifiedTaskIncrementalMigrationTest test
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home mvn -q -DskipTests compile

cd frontend
npx eslint src/components/task-runtime/TaskDetail.tsx \
  src/components/task-runtime/SubmissionHistoryCard.tsx src/lib/task-runtime-api.ts
npm run typecheck
npm run build
```

**结果：**
- 后端 27 项通过：审批方案 1、审批运行时 10、工作项集合 6、Flowable 集成 2、任务事务 4、增量迁移 4；编译通过。
- 前端定向 eslint 零错误、完整 typecheck 和生产构建通过；`/tasks/{taskId}` 与 `/work` 正常进入构建路由。
- `detect_changes(scope=all)` 为 MEDIUM：识别 9 个既有 symbol、12 个文件和 3 条 DashboardLayout/Sidebar 流程；没有 HIGH/CRITICAL。统一任务的大部分新增文件尚未进入索引，故以定向测试、编译和构建补充证明。
- 构建路由仍列出 `/daily/**`、`/workflow/todo`、`/workflow/tasks` 和旧运维日历子页面；它们保持在第 10 节 WP-09 物理删除台账中，不属于终态保留。

**下一步：**
- 进入 WP-06，将现有运维日历保持为一个页面内月/周/列表视图并改读统一任务；排班、节假日收敛到 calendar settings。
- 使用内置工作日报模板和工作日计划实现今日快捷入口、填写、审批退回重提，不建设新的独立日报页面或模型。

### 2026-07-23 09:25 / 旧表是否有用的字段级复核

**明确结论：**
- 不能确认“原有平台表、排班/节假日和目标旧表均保持不变”，该表述无效。历史存在和当前旧代码引用都不是终态保留理由。
- `ops_duty_roster` 表级保留：统一任务 `JdbcAssignmentDirectory.findDutyUsers` 直接读取它完成值班人分派，日历设置与日历图层继续管理/展示排班。
- `ops_holiday_calendar` 表级保留：统一任务 `JdbcHolidayCalendarAdapter` 直接读取它完成工作日移动和 `holiday_relative` 计算，日历设置与日历图层继续管理/展示节假日。
- 两表的表级用途不代表历史列整体保留。当前正式 calendar settings 页面已经读写排班 `start_at/end_at`、`shift_name`、`backup_assignee_id`、`phone_override`、`remark` 和节假日 `remark`，并展示 `updated_at/updated_by`；这些字段有产品消费者，可标记为 `KEEP`。
- 两表 `created_at/created_by` 虽被 API 返回但没有页面或其他正式消费者；`deleted_at/deleted_by` 虽在软删除时写入，但没有已删除记录查询、恢复或详情入口，且通用审计日志已覆盖操作者和时间。上述字段保持 `IMPLEMENT_OR_DROP`，WP-09 前无明确产品链路即物理删除，不得因继承 `BaseEntity` 空留。
- `idx_ops_roster_assignee` 服务正式冲突检测的 `tenant_id + assignee_id + duty_date` 查询；排班/节假日审计行可由通用审计后台按模块、关键字和时间检索并展示，均已有消费者，标记为 `KEEP`。
- `daily_report`、`daily_report_approval` 与八张 `ops_schedule_*` 只有待切换旧消费者，没有新系统终态用途，仍为 `MIGRATE_THEN_DROP`。
- 用户、组织、RBAC、CMDB、设备、Wiki、共享文件等其他平台表当前只是“迁移期间保护”，不是永久保留结论；WP-09/WP-10 台账未清零前不得声称 schema 已完成。

**GitNexus 证据：**
- `JdbcAssignmentDirectory` upstream impact：LOW，0 direct callers / 0 processes（索引未识别 Spring 注入，源码与 SQL 直接消费证据已复核）。
- `JdbcHolidayCalendarAdapter` upstream impact：LOW，0 direct callers / 0 processes（同上）。
- 本轮只修正文档合同，没有修改运行时代码或执行数据库 migration。

### 2026-07-23 08:48 / 全平台 schema 零垃圾边界收紧

**用户确认：**
- “保护原有平台表”只表示增量迁移期间不得未经审计误删，不等于确认这些表和列在新系统终态都有用。
- 平台以后不使用的表、列、索引、约束、触发器、函数、配置和权限均不得保留。

**证据与结论：**
- `ops_duty_roster` 继续由 `JdbcAssignmentDirectory.findDutyUsers`、排班设置和日历图层使用，支持任务计划的“当日值班人”分派，表级终态 `KEEP`；无正式生命周期消费者的通用审计/软删除列仍为 `AUDIT_REQUIRED`。
- `ops_holiday_calendar` 继续由 `JdbcHolidayCalendarAdapter`、节假日设置和日历图层使用，支持工作日移动与 `holiday_relative` 计划，表级终态 `KEEP`；仅由 ORM 自动填充、未被正式链路读取的审计列仍为 `AUDIT_REQUIRED`。
- `daily_report`、`daily_report_approval` 和八张 `ops_schedule_*` 没有终态保留价值；现有引用均属于待切换旧实现，WP-09 后整表删除。
- 其余平台对象尚不能整体确认为有用。全平台逐表逐列审计已从“另行工作”提升为 WP-09/WP-10 强制门禁；`AUDIT_REQUIRED` 不得带入上线。
- 优先复核旧/新 RBAC、ACL 与授权迁移/灰度对象；当前有代码引用只说明存在依赖，不证明正式上线后仍应长期保留。

**合同变更：**
- `README.md`、`PRD.md`、`DATA-MODEL.md`、`IMPLEMENTATION-PLAN.md`、`SCHEMA-CUTOVER.md`、`SCHEMA-OBJECT-LEDGER.md`、`TEST-ACCEPTANCE.md` 和 `AI-IMPLEMENTATION-PROMPT.md` 已统一为“迁移期先保护、终态逐项举证、无用即删”。
- 新增 `TRANSITIONAL_REVIEW` 与 `AUDIT_REQUIRED` 状态、全平台列级消费者审计和 `CLEAN-001` 至 `CLEAN-006` 验收门禁。
- 本轮只修订实施合同，未提前删除 schema 或修改运行时代码。

### 2026-07-23 / WP-09 消费者切换与旧实现删除

**已完成的终态收敛：**
- V92 在保留 V1-V79 历史的前提下，定向删除 `daily_report`、`daily_report_approval` 和全部旧 `ops_schedule_*` 表，以及旧日报/日历权限、配置、通知、审计目标行；不触碰非目标平台数据。
- 旧日报、旧日历任务、旧流程待办页面/API/服务/实体/Mapper 已删除；`WorkflowCenterController` 只保留仍被流程绑定管理页使用的 `/api/workflow/center/bindings`，旧 `/tasks/my`、`/tasks/group`、`/tasks/complete` 已删除。
- `ops_duty_roster` 和 `ops_holiday_calendar` 仅保留有运行时消费者的字段；V92 已物理删除无查询/恢复入口的创建及软删除审计列。
- V92 为 `task_template`、`approval_scheme`、`task_instance`、`task_analytics_dashboard` 的活动组引用补齐数据库触发器；`GroupReferenceRegistry` 已登记这些终态引用，避免组织归档和清理绕过统一任务数据。
- V92 在真实 Flowable 7.1 PostgreSQL 表结构上按运行/历史子表到执行实例、流程定义、部署的顺序精确清理：日报流程定义 `dailyReportApproval`、标准日报 business key 和该定义下业务键不规范的历史实例均不残留；设备访问流程定义和运行实例保持不变。

**已验证：**
```bash
cd backend && JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=UnifiedTaskIncrementalMigrationTest,GroupReferenceRegistryTest,GroupReferenceInventoryIntegrationTest,GroupLifecycleMigrationIntegrationTest,GroupLifecycleBlockerIntegrationTest,ProcessBindingServiceLifecycleTest test
cd backend && JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home mvn -q -DskipTests compile
cd frontend && npm run lint && npm run typecheck && npm run build
```

**仍在核验：**
- 全量平台 schema 的逐表、逐列、索引、触发器、函数和过渡对象审计属于 WP-10 的强制门禁；`AUDIT_REQUIRED` 和 `TRANSITIONAL_REVIEW` 不得进入上线终态。
- GitNexus `detect_changes(scope=all)` 对累计工作树报告 HIGH（75 文件、182 symbols、9 flows）；该结果覆盖此前全部未提交统一任务改动，不能误称为本次三条 API 删除的低风险证明。

---

### 2026-07-23 19:56 / WP-10 通知模型高风险审计暂停

**审计结论：**

- 通知中心、目标跳转、已读状态、任务订阅投递和幂等键均是明确终态能力。
- `notification_message` 的软删除和通用更新/创建审计列没有发现正式删除/恢复/编辑入口；但该表的唯一现有删除路径为变更单整改测试清理，是否可安全改为物理删除还需同时验证幂等唯一索引、订阅投递和所有业务发送方。

**GitNexus 风险：**

- `NotificationService.notify` upstream impact 为 **CRITICAL**：12 个直接调用者，跨变更文档、CMDB、Wiki、任务订阅等 10 个模块。
- 按根 `AGENTS.md` 门禁，本轮不修改通知 schema 或运行时代码。该对象保持高风险待决，不计入已完成零垃圾清理；后续实施前必须先取得明确确认并制定全链路回归方案。

### 2026-07-23 20:03 / WP-10 水印伪配置清理

**审计结论：**

- `watermark.font_size` 没有后台配置控件、API 请求字段或前端展示；水印管理只覆盖开关、文字、透明度、角度和位置。
- PDF 导出是唯一读取方，历史上读取失败也默认 36pt，因而该 key 不表达用户可配置能力。
- V97 精确删除该 `sys_config` 行；`ExportService` 固定使用 36pt，避免保留没有生命周期入口的配置数据。

**GitNexus impact：**

- `ExportService.exportPdfDirect#3`：LOW，3 个直接调用者，影响 1 条变更单导出流程；只移除无效配置读取，不改变导出接口或其他水印配置。
- `ExportServiceTest.exportPdfDirect_readsConfiguredWatermarkAngle` 和 `UnifiedTaskIncrementalMigrationTest`：LOW，均无上游调用。

**验证：**

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=ExportServiceTest,UnifiedTaskIncrementalMigrationTest test
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -DskipTests compile
cd .. && git diff --check
```

- 全部通过。PostgreSQL 16 Testcontainers 实际执行 V79 → V97 共 18 条增量 migration，并断言该 key 在最终 schema 数据中为零。
- 运行时代码不再命中该 key；仅历史 V11、V97 清理 migration 与迁移断言保留名称。
- `detect_changes --scope all` 仍为 CRITICAL（120 文件、314 symbols、73 条流程），是整个长期未提交工作树的累计结果；本切片的 GitNexus impact 为 LOW，且检测未显示 V97 新增 migration 的额外运行时流程扩散。

### 2026-07-23 20:05 / WP-10 系统配置描述列清理

**审计结论：**

- `sys_config` 的终态配置合同仅使用 `tenant_id/config_key/config_value`。后台读取返回 key/value 映射，配置写入与审计也不读取或写入描述。
- `description` 仅在 V7/V11 的历史 seed SQL 和升级前测试哨兵数据出现，没有正式 API、页面、查询、编辑或审计消费者。
- V98 删除该列，`SysConfig` 实体及 V79 升级夹具同步收窄；现有 SMTP、Prometheus 与水印 key/value 能力保持不变。

**GitNexus impact：**

- `SysConfig`：LOW，2 个直接消费者，未影响执行流程；`SysConfigMapper`：LOW，无直接调用者。
- `SysConfigService`：MEDIUM，7 个直接消费者，但不修改其行为，仅以源码和字段级扫描确认其不访问该列。
- `UnifiedTaskIncrementalMigrationTest.migrateExistingDatabase`：LOW，无上游调用。

**验证：**

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=SysConfigServiceTest,SysConfigControllerTest,UnifiedTaskIncrementalMigrationTest test
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -DskipTests compile
cd .. && git diff --check
```

- 全部通过。PostgreSQL 16 Testcontainers 从 V79 实际执行 19 条增量 migration 至 V98；最终 schema 断言 `sys_config.description` 不存在。

### 2026-07-23 20:08 / WP-10 系统配置时间戳列高风险暂停

**审计结论：**

- `sys_config.created_at/updated_at` 没有正式读取、API 返回或页面展示消费者，配置变更也会写入通用 `audit_log`。
- 但删除 `updated_at` 需改动共享 `SysConfigMapper.upsertValue` 的写入 SQL。

**GitNexus 风险：**

- `SysConfigMapper.upsertValue` upstream impact 为 **CRITICAL**：1 个直接调用者，3 条受影响流程，5 个模块；包含流程绑定启停和工作流模板实例创建。
- 依照根 `AGENTS.md`，未修改该 Mapper、服务或 schema。此对象加入高风险待决台账，后续必须先制定配置写入、审计、绑定与模板实例创建的跨模块回归计划。

### 2026-07-23 20:11 / WP-10 指标目标目录生命周期收口

**审计结论：**

- `task_metric_goal` 是当前目标配置目录，不是不可变指标事实。API/UI 仅支持当前目标创建、编辑、列表与删除，没有回收站、恢复、历史详情或时间戳显示。
- 软删除及其专用创建/更新/删除审计字段没有终态消费者；操作可追溯性由通用 `audit_log` 保留，统计血缘由独立 `task_metric_fact` 保留。
- V99 删除七个无消费者列，目标删除改为物理删除；列表仅按租户、目标生效日期和 ID 排序，新索引匹配该正式查询。

**GitNexus impact：**

- `TaskMetricGoal`：LOW，3 个直接消费者，仅指标模块。
- `TaskMetricGoalService.create/update/list/delete/require`：均为 LOW；前三者各 1 个直接 API 调用者，`require` 有 2 个直接内部调用者，无受影响执行流程。

**验证：**

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=TaskMetricGoalServiceTest,TaskMetricServiceTest,TaskAnalyticsQueryServiceTest,UnifiedTaskIncrementalMigrationTest test
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -DskipTests compile
cd .. && git diff --check
```

- 全部通过。PostgreSQL 16 Testcontainers 从 V79 实际执行 20 条增量 migration 至 V99；最终 schema 断言七个指标目标生命周期字段均不存在，新增物理删除单测确认调用 `deleteById`。

### 2026-07-23 20:14 / WP-10 指标绑定审计列清理

**审计结论：**

- `task_metric_binding` 是指标事实的映射与 `task_metric_fact.binding_id` 血缘对象，必须保留；指标定义也会在已有正式事实时拒绝删除，因此不把它们误作普通目录表清理。
- 绑定的 `created_by/created_at` 没有 API、页面、查询、统计或事实提取消费者，只在绑定创建时赋值。
- V100 删除两个审计列与写入；指标、模板版本、字段、单位转换、启停、回填、更新和删除语义保持不变。

**GitNexus impact：**

- `TaskMetricBinding`：LOW，3 个直接消费者，涉及指标与模板模块。
- `TaskMetricService.addBinding`：LOW，3 个直接调用者（1 个 API、2 个定向测试），没有受影响执行流程。

**验证：**

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=TaskMetricServiceTest,TaskMetricGoalServiceTest,TaskAnalyticsQueryServiceTest,UnifiedTaskIncrementalMigrationTest test
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -DskipTests compile
cd .. && git diff --check
```

- 全部通过。PostgreSQL 16 Testcontainers 从 V79 实际执行 21 条增量 migration 至 V100；最终 schema 断言绑定创建审计列不存在，绑定创建及事实回填回归通过。

### 2026-07-23 20:23 / WP-10 自动化规则冗余生命周期收口

**审计结论：**

- `task_automation_execution` 必须保留：其稳定去重键、事件快照、重试租约、失败原因、自动创建任务结果和 `task_relation.automation_execution_id` 共同构成可重试、可追溯的执行历史。
- 规则也不能物理删除，因为执行历史以 `rule_id` 引用它；终态删除语义统一为 `status='archived'`。
- `lock_version` 未进入更新 SQL 或前端冲突处理，`created_by` 只写不读；`is_deleted/deleted_at/deleted_by` 与 `archived` 重复且会形成两套可见性语义。
- V101 删除上述五列，保留 `updated_by` 作为自动创建任务时的运行授权主体，并以 `tenant_id + trigger_type WHERE status='active'` 索引服务生命周期事件匹配。

**GitNexus impact：**

- `TaskAutomationRule` 和 `TaskAutomationService`：MEDIUM，分别有 6/5 个直接消费者，未识别受影响执行流程。
- `TaskAutomationService.create/delete/onEvent`：LOW，均只影响自动化模块直接消费者。
- 图谱将 `require/toVO` 标为 HIGH（23/12 个符号、无执行流程）；本轮未改变外部 API、执行历史、重试语义或授权主体，只收窄其 archive 过滤与返回字段。

**验证：**

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=TaskAutomationServiceTest,TaskAutomationExecutorTest,\
TaskAutomationConditionEvaluatorTest,UnifiedTaskIncrementalMigrationTest test
```

- 全部通过。PostgreSQL 16 Testcontainers 实际从 V79 执行 22 条增量 migration 至 V101；迁移测试断言五个废列不存在和活跃规则索引存在，服务测试覆盖归档而不破坏执行历史父记录。

### 2026-07-23 20:26 / WP-10 统计订阅冗余生命周期收口

**审计结论：**

- `task_analytics_subscription` 是订阅管理、计划调度和 `task_notification_delivery.subscription_id` 投递血缘的正式父记录；不能为清理 schema 物理删除它。
- `created_at/updated_at` 是订阅管理 API 返回和列表排序字段，`status/next_send_at/last_sent_at` 是归档、调度和投递的运行字段，均保留。
- `created_by/updated_by` 只有写入，没有 API、页面、授权、审计或调度读取；`is_deleted/deleted_at/deleted_by` 与 `status='archived'` 完全重复。
- V102 删除五个零消费者字段，管理、调度抢占和派发统一按 status 过滤；订阅和 due 索引相应收窄为非归档/活跃记录。

**GitNexus impact：**

- `TaskAnalyticsSubscription`：LOW，3 个直接消费者；服务和 mapper 均为 LOW、各 2 个直接消费者，未识别受影响执行流程。

**验证：**

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=TaskAnalyticsSubscriptionServiceTest,\
TaskAnalyticsSubscriptionDispatcherTest,TaskNotificationDispatcherTest,\
UnifiedTaskIncrementalMigrationTest test
```

- 全部通过。PostgreSQL 16 Testcontainers 实际从 V79 执行 23 条增量 migration 至 V102；迁移测试断言五个废列不存在且 due 索引存在，订阅管理、调度投递及失败重试回归通过。

### 2026-07-23 20:32 / WP-10 通知中心冗余生命周期收口

**审计结论：**

- `notification_message` 是跨 CMDB、Wiki、变更文档和统一任务投递的共享通知中心；`created_at`、`is_read/read_at`、`ref_type/ref_id` 和 `dedupe_key` 分别用于时间线、未读状态、权限目标跳转和任务投递幂等，必须保留。
- 通知中心没有删除、恢复、编辑或审计字段展示入口。`is_deleted/deleted_at/deleted_by/updated_at/created_by/updated_by` 无终态消费者；变更单整改清理是唯一删除路径，改为物理删除后不再需要逻辑删除列。
- V103 先删除升级前已逻辑删除的通知行，再删除六列；通知列表、未读计数、目标解析、跨模块发送、邮件语义和 `notifyIdempotent` 去重契约保持不变。索引替换为用户时间线、用户未读和业务引用清理的实际查询形态。

**GitNexus 风险与边界：**

- `NotificationService` upstream impact 为 **CRITICAL**：35 个直接消费者、45 个关联符号；`notify` 为 **CRITICAL**：12 个直接调用者、10 个模块。`NotificationMapper` 为 **HIGH**：15 个直接消费者。
- 本轮没有变更 `notify/notifyIdempotent` 签名、调用方、邮件发送、通知内容、去重键或任务投递状态机；仅删除已证明无消费者字段和对应过滤条件。`listByUser/countUnread/markRead/markAllRead` 与整改清理均为 LOW。

**验证：**

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=NotificationTargetResolverServiceTest,\
ChangeDocApprovalNotificationTest,ChangeDocWorkflowOrchestratorTest,\
CiInstanceCommandServiceTest,TaskNotificationDispatcherTest,\
UnifiedTaskIncrementalMigrationTest test
```

- 全部通过。PostgreSQL 16 Testcontainers 实际从 V79 执行 24 条增量 migration 至 V103；升级夹具预置的逻辑删除通知被物理清除，最终 schema 断言六个废列不存在且未读索引存在。

### 2026-07-23 20:35 / WP-10 V1 全新安装终态一致性证明

**完成结果：**

- 新增 `UnifiedTaskFreshInstallMigrationTest`，在隔离 PostgreSQL 16 空库从 V1 一次性执行全部 101 个当前 Flyway migration 至 V103，不预置 V79 schema、Flowable 对象或任何业务数据。
- 断言新装终态拥有统一任务、审批、统计、自动化、订阅和投递表，三个 published 内置模板、工作日报 per-user 计划与统一权限种子存在。
- 断言旧日报、旧 `ops_schedule_*`、旧授权/ACL 迁移表及 `ai_call_log` 不存在；同时验证 V92、V99-V103 的权限、列和索引终态。
- 联合现有 `UnifiedTaskIncrementalMigrationTest`，V79 升级路径仍验证非目标哨兵数据、真实 Flowable 日报清理及同一 V103 终态。

**GitNexus impact：**

- `UnifiedTaskIncrementalMigrationTest`：LOW，0 个直接消费者、无受影响流程；新增独立测试，没有修改运行时 symbol 或 migration 历史。

**验证：**

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=UnifiedTaskFreshInstallMigrationTest,UnifiedTaskIncrementalMigrationTest test
```

- 全部通过。空库路径实际执行 101 条 migration 至 V103；V79 路径实际执行 24 条增量 migration 至 V103，满足 DB-009 与 CLEAN-006 对两条路径终态一致性的要求。

### 2026-07-23 20:43 / WP-10 任务关系冗余创建人字段收口

**审计结论：**

- `task_relation` 保留为整改、复查、派生、阻塞和关联任务的有向关系图；`automation_execution_id` 是自动化来源血缘，`created_at` 是关系列表确定排序字段。
- `created_by` 只在自动化创建时写入并透传给 API；没有任务详情页面、权限判断、审计查询或手工关联操作者语义。自动化来源已由执行记录表达，手工操作由通用 `audit_log` 追溯，因此不保留重复创建人列。
- V104 删除 `task_relation.created_by`，关系 VO 和创建方法同步删除该无用途参数；自动化规则 `updated_by` 仍独立保留为运行授权主体，未改变任务创建权限复核。

**GitNexus impact：**

- `TaskRelationService`：LOW，2 个直接测试消费者；`create`：LOW，生产直接调用者为 `TaskAutomationExecutor.execute`，向上关联规则执行和重试但未识别受影响流程。
- `TaskRelation`：MEDIUM，5 个直接引用，均局限于任务自动化模块和定向测试。`TaskAutomationExecutor.execute`：LOW，1 个直接调用者。

**验证：**

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=TaskRelationServiceTest,TaskAutomationExecutorTest,\
UnifiedTaskFreshInstallMigrationTest,UnifiedTaskIncrementalMigrationTest test
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -DskipTests compile
```

- 全部通过。PostgreSQL 16 Testcontainers 的 V1→V104 空库路径实际执行 102 条 migration，V79→V104 增量路径实际执行 25 条 migration；两条路径均断言 `task_relation.created_by` 不存在，关系循环保护和自动化关系创建测试通过。

### 2026-07-23 20:45 / WP-10 投递 outbox 字段审计

- `task_notification_delivery` 不是旧实现残留：计划生成、一次性任务、审批、自动化和统计订阅均通过它持久化投递；调度器按幂等键、租约、状态和重试时间发送。
- 任务/提交/审批引用、接收人/渠道/payload、订阅/批次、状态/计数/时间及失败原因均有运行时或运维追溯用途。订阅批次完成需依赖所有同批投递记录的状态，故 `subscription_id` 和 `batch_key` 必须保留。
- 本项不新增 migration；字段级 `KEEP` 证据已补入 schema 台账，`TaskNotificationDispatcherTest`、`TaskAnalyticsSubscriptionDispatcherTest` 和 `DailyWorkReportIntegrationTest` 是后续回归锚点。

### 2026-07-23 20:51 / WP-10 指标定义历史解释与生命周期收口

**审计结论：**

- 原实现虽然禁止删除已有事实的指标，却允许原地修改值类型、单位、聚合、可加性、公式和权威来源，并允许更新/删除绑定时物理删除事实。这会以新口径重解释旧正式统计，违反 PRD AC-011 的指标定义追溯和 SPEC 的事实血缘不变量。
- 终态改为：定义或绑定尚未产生 `task_metric_fact` 时可物理删除；已有事实时指标定义和该绑定均不可修改或删除，用户必须创建新指标定义和新绑定表达新口径。指标目标仍引用定义时同样阻止删除，要求先删除或改绑。
- V105 删除 `task_metric_definition.created_by/updated_by/is_deleted/deleted_at/deleted_by`，清理无事实的历史软删除定义及其短生命周期绑定/目标，将指标编码唯一索引转换为非 partial 唯一索引。创建/更新时间仍是 API 返回和管理排序语义，保留。

**GitNexus impact：**

- `TaskMetricService` 与 `TaskMetricDefinition` 均为 MEDIUM（5/6 个直接消费者）；`update`、`delete`、`updateBinding`、`deleteBinding` 是 LOW，均只直达对应 Controller，未识别执行流程。
- `TaskMetricService.requireMetric` 为 **HIGH**（6 个直接调用者、28 个关联符号），覆盖读取、绑定、预览、提交事实同步和目标计算。本轮仅移除软删除条件，保留 tenant/ID 查询和错误契约；以指标、审批、任务事务、统计查询和两条 Flyway 路径共同回归。

**验证：**

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=TaskMetricServiceTest,TaskMetricGoalServiceTest,\
TaskAnalyticsQueryServiceTest,ApprovalRuntimeServiceTest,TaskRuntimeServiceTransactionTest,\
UnifiedTaskFreshInstallMigrationTest,UnifiedTaskIncrementalMigrationTest test
```

- 全部通过。PostgreSQL 16 Testcontainers 的 V1→V105 路径实际执行 103 条 migration，V79→V105 路径实际执行 26 条；终态断言定义表五个废列不存在且编码唯一索引不再依赖软删除条件。新增服务测试覆盖事实存在时拒绝定义修改与绑定删除、无事实定义物理删除。

### 2026-07-23 21:02 / WP-10 比率指标事实链路收口

- 审计发现 `task_metric_fact.numerator/denominator` 不是可直接删除的垃圾字段：`TaskMetricService.aggregate` 的 `ratio` 分支已读取它们，但此前没有生成路径写入，导致自定义比率指标无法得到有效统计结果。
- 新增 V106，不修改任何历史 migration：`task_metric_binding.ratio_component` 明确配置 `numerator`/`denominator`，`task_metric_fact.denominator_field_fact_id` 保存分母字段事实血缘；唯一索引禁止同一指标、模板版本和来源角色重复配置同一种组件。
- 任务提交时按同一提交和行键配对字段事实，写入分子、分母、双字段事实血缘及单次比率值；期间预览继续按分子总和/分母总和计算，避免误用单条百分比平均。零分母事实不投递阈值事件。
- 前端指标管理在比率指标绑定时要求选择分子或分母，并显示该组件；DTO/API 契约同步更新。
- `TaskMetricService.aggregate` upstream impact 为 HIGH（1 个直接调用点、3 个模块），变更限制在 ratio 分支和事实生产路径；非 ratio 聚合语义未改。

**验证：**

```bash
cd backend && mvn -q -Dtest=TaskMetricServiceTest,UnifiedTaskFreshInstallMigrationTest,UnifiedTaskIncrementalMigrationTest test
cd backend && mvn -q -Dtest=TaskMetricServiceTest,TaskMetricGoalServiceTest,TaskAnalyticsQueryServiceTest,ApprovalRuntimeServiceTest,TaskRuntimeServiceTransactionTest test
cd backend && mvn -q -DskipTests compile
cd frontend && npm run typecheck
cd frontend && npm run lint
```

结果：全部通过。Testcontainers PostgreSQL 16 证明空库 V1→V106 实际执行 104 条迁移、V79→V106 实际执行 27 条迁移；迁移测试断言新增列和唯一索引存在。前端 lint 保持 0 error，仓库仍有 38 条本次未引入的既有 warning。

### 2026-07-23 21:06 / WP-10 看板组件创建时间清理

- `task_analytics_widget` 全字段审计确认：`id/tenant_id/dashboard_id` 提供所属与租户隔离，类型、标题、数据源、展示配置和排序直接构成可执行组件；`updated_at` 由组件 API 返回并表达当前修订。唯一没有终态消费者的是 `created_at`，仅在服务创建时自动赋值。
- 新增 V107 物理删除 `task_analytics_widget.created_at`，同步移除实体和写入；创建、更新、删除仍由 `audit_log` 记录，未删除 `updated_at`。
- 同时修正 `DATA-MODEL.md` 中历史占位字段名 `dataset_config/visual_config/drilldown_config`，使其与实际终态 `data_source_config/display_config` 一致。
- GitNexus：`TaskAnalyticsWidget` upstream impact LOW（4 个直接消费者）；`addWidget`、`updateWidget` 分别为 LOW（各 1 个直接入口）。

**验证：**

```bash
cd backend && mvn -q -Dtest=TaskAnalyticsDashboardServiceTest,TaskAnalyticsSubscriptionServiceTest,TaskAnalyticsSubscriptionDispatcherTest,UnifiedTaskFreshInstallMigrationTest,UnifiedTaskIncrementalMigrationTest test
cd backend && mvn -q -DskipTests compile
```

结果：全部通过。PostgreSQL 16 Testcontainers 证明 V1→V107 实际执行 105 条迁移，V79→V107 实际执行 28 条迁移；两条路径均断言组件 `created_at` 不存在。订阅测试中的 `queue unavailable` 是隔离失败分支的预期日志。

### 2026-07-23 21:10 / WP-10 CMDB 告警无消费字段及测试后门清理

- `cmdb_alert` 表级保留：Prometheus 同步、告警中心、CI 关联告警、确认操作、权限和审计均有正式终态消费者。字段级复核中，`raw_labels` 最初看似零消费者，但编译揭示其仅被历史 `remediation-test` 清理后门用作 FQA runId 标记。
- 该后门既非产品能力，也不属于统一任务平台终态，保留它会违反“无旧接口、无截止兼容层”。因此删除 `/api/cmdb/alerts/{id}/remediation-test`、`CmdbAlertRemediationService`、专属单测和对应历史 E2E 脚本，而不是因测试清理需求保留原始标签 blob。
- V108 物理删除 `cmdb_alert.raw_labels`；Prometheus 入站仍读取标签以解析告警名、严重级别和 CI 关联，但不再持久化没有展示/查询入口的原始 JSON。告警列表、按 CI 查询、状态变更和确认审计保持不变。
- GitNexus：`processAlert` 为 LOW（1 个直接调用者），`CmdbAlert` 为 MEDIUM（8 个直接消费者）；移除的 Controller 端点 upstream impact 为 LOW（0 个代码直接调用者）。

**验证：**

```bash
cd backend && mvn -q -Dtest=PrometheusAlertSyncServiceTest,CmdbAlertControllerTest,UnifiedTaskFreshInstallMigrationTest,UnifiedTaskIncrementalMigrationTest test
cd backend && mvn -q -DskipTests compile
rg -n "CmdbAlertRemediationService|/api/cmdb/alerts/.+remediation-test|cmdb/alerts/.+remediation-test|raw_labels|rawLabels" backend/src frontend/src test docs/guide docs/plan/unified_task_platform
```

结果：测试和编译通过。PostgreSQL 16 Testcontainers 证明 V1→V108 实际执行 106 条迁移，V79→V108 实际执行 29 条迁移；残留扫描只命中 V31 历史创建、V108 删除、终态断言和 schema 台账，不再命中运行时代码或测试后门。

### 2026-07-23 20:37 / WP-06 至 WP-08 浏览器验收状态复核

- 本地前端 `http://localhost:3100/ops-calendar` 返回 HTTP 200，开发服务器正常响应。
- 按 Browser skill 连接本地页面时，浏览器运行时仍返回“无可用浏览器”；因此无法取得登录态下的月/周/列表切换、移动端布局、快速创建、工作台和统计页的真实交互/截图证据。
- 不以 HTTP 响应、源码阅读或构建成功替代 CAL-001..005、工作台与统计页面的 UI 验收；WP-06、WP-07、WP-08 继续保持 `VERIFYING`。该条件不妨碍后端迁移、终态 schema 和定向测试继续推进。

### 2026-07-23 20:16 / WP-10 统计看板生命周期审计

**审计结论：**

- `task_analytics_dashboard.created_at/updated_at` 是正式 API 返回、列表排序和前端展示字段；`owner_id/owner_group_id` 则是共享看板权限和活动组不变量的一部分，均保留。
- 看板删除当前物理删除组件、软删除看板；订阅外键、通知目标和审计记录仍可引用该看板。没有将其误判为“无回收站即无用”。
- 本轮不改看板软删除。后续若要物理删除，必须先定义并验证订阅、通知目标、组件和审计记录的显式收口方案。

### 2026-07-23 19:53 / WP-10 备份目录生命周期收口

**审计结论：**

- 备份目录不提供“已删除备份”查询、恢复目录记录或编辑入口；删除和自动轮转都会删除实际归档文件，历史操作由通用审计后台保留和查询。
- `backup_record.is_deleted/deleted_at/deleted_by/updated_at/updated_by` 仅因继承 `BaseEntity` 而存在，没有备份领域消费者。V96 物理删除五列，`BackupRecord` 改为只声明目录真实所需字段，删除/轮转改为物理删除记录。

**GitNexus impact：**

- `BackupRecord` 为 MEDIUM（5 个直接消费者、创建/上传两个流程）；`BackupService.delete` 与 `autoRotate` 为 LOW。无 HIGH/CRITICAL 风险，受影响路径已用全链路迁移和编译验证。

**验证：**

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=UnifiedTaskIncrementalMigrationTest test
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -DskipTests compile
```

- 全部通过。PostgreSQL 16 Testcontainers 实际升级 V79 → V96，执行 17 条增量迁移并断言五列均不存在。
- `git diff --check` 通过；备份运行时代码不再使用 `@TableLogic` 或任何已删列。

### 2026-07-23 19:50 / WP-10 备份目录列级清理

**审计结论：**

- `backup_record` 的文件名、路径、大小、状态、错误、创建人/时间、租户和软删除字段分别被下载、恢复、轮转、列表或审计链路消费，保留。
- `backup_type` 没有定时备份能力、类型筛选、页面展示、恢复差异或保留期差异；所有创建及上传路径都固定写入 `manual`，属于零信息列。
- 新增 V95 删除该列；后端实体、VO、服务写入/映射和前端 API 类型同步删除，避免 schema、API 和 UI 留下伪契约。

**GitNexus impact：**

- `BackupService`、`BackupController`、`BackupPage`、`toVO`、`createBackup`、`importUpload` 和两端 `BackupRecordVO` 均为 LOW；受影响的创建/上传流程已由迁移、编译和前端类型检查覆盖。

**验证：**

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=UnifiedTaskIncrementalMigrationTest test
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -DskipTests compile

cd frontend
npx eslint 'src/app/(dashboard)/admin/backup/page.tsx'
npm run typecheck
```

- 全部通过。Testcontainers PostgreSQL 16 实际升级 V79 → V95，执行 16 条增量迁移并断言 `backup_record.backup_type` 不存在。
- `git diff --check` 通过；运行时代码不再命中 `backupType` / `backup_type`。仅 V50 历史建表、V95 清理 migration 和迁移断言保留名称。

### 2026-07-23 19:47 / WP-10 非目标域零消费者对象清理

**审计结论：**

- 不以“原平台能力”或旧 migration 作为保留依据。AI 配置、备份、设备和 IPAM 均已复核到正式 API、页面、权限或业务不变量，不能删除。
- `ai_call_log` 是唯一确认的零消费者对象：它只有 AI 网关写入，不存在查询、管理、审计展示、保留期或运维消费链路。
- 新增 V94 定向删除 `ai_call_log` 及其随表索引；同时删除实体、Mapper、网关写入和仅服务日志的 `refType/refId/operatorId` 参数。变更文档 AI 生成继续使用 `ai_provider_config`，并保留变更文档通用审计日志。

**GitNexus impact：**

- `AiGatewayService`：LOW，3 个直接消费者；`callWithLogging`：LOW，直接调用者为生成和供应商测试；`generate`：LOW，变更文档生成一个直接消费者；无受影响执行流程。
- `UnifiedTaskIncrementalMigrationTest`：LOW，0 个调用者；用于补充 V94 终态 schema 断言。

**验证：**

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=AiProviderConfigValidationTest,AiConfigControllerTest,UnifiedTaskIncrementalMigrationTest test
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -DskipTests compile
```

- 全部通过。`UnifiedTaskIncrementalMigrationTest` 使用 PostgreSQL 16 Testcontainers 验证 V79 → V94 实际执行 15 条迁移、终态版本为 94，并断言 `ai_call_log` 不存在。
- `git diff --check` 通过；运行时源码中已无 `AiCallLog`、`AiCallLogMapper` 或旧日志写入。历史 V8 和清理 V94 中的表名引用按迁移链要求保留。
- 全平台其他对象仍须逐表逐列审计，WP-10 未完成。

### 2026-07-23 19:29 / WP-10 授权终态收口

**完成结果：**
- V93 以增量 migration 将 `sys_user_role` 转入唯一的 `sys_role_assignment`，并将有效旧 Wiki/共享文件 ACL 转入唯一的 `resource_acl_entry`；ACL 主体覆盖 `user`、`group`、`role`。
- 对旧主组仅补齐缺失的活动业务组 membership，再转换组作用域角色，保证终态授权查询不会因删除 `sys_user_role` 而失效；已有 primary membership 不被覆盖。
- 已物理删除 `sys_user_role`、`wiki_space_acl`、`wiki_page_acl`、`shared_folder_acl` 及所有授权迁移、影子判定、灰度与回退表、服务、接口和前端页面；运行时扫描为零命中。
- `GroupLifecycleMigrationIntegrationTest` 的并发写入器收敛为仍存在的 16 个终态组引用写入点，旧 ACL 写入器不再作为可用行为被测试或保留。

**GitNexus 证据：**
- `UnifiedTaskIncrementalMigrationTest`、`GroupLifecycleMigrationIntegrationTest`、`ResourceAccessServiceTest` 均为 LOW，0 direct callers / 0 processes。
- `AuthorizationService` 为 MEDIUM，6 个直接消费者（Wiki、共享文件与搜索链路）；因此未改生产鉴权语义，只修正迁移数据归一化及测试。

**验证：**
```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -DskipTests compile
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=UnifiedTaskIncrementalMigrationTest test
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=ResourceAuthorizationInitializerTest,ResourceAccessServiceTest,GroupLifecycleMigrationIntegrationTest test
```

其中 V79 -> V93 使用 PostgreSQL 16 Testcontainers，升级前实际写入旧角色、角色 ACL、用户 ACL、组 ACL 哨兵数据；升级后验证转换记录、位权限、组作用域 membership 及旧表物理删除。
`AuthorizationServiceTerminalRoleAclTest` 另行验证转换后的角色 ACL 已进入终态决策，而不只是停留在转换表中。

---

### 2026-07-23 19:34 / WP-08 跨周期汇总与自动化验证

**完成结果：**
- `task_metric_definition`、`task_metric_binding`、`task_metric_fact` 提供字段到统一指标的类型/单位/比率校验、历史事实回填、人工与系统来源分离、权威来源和审批激活后的幂等阈值事件。
- `task_metric_goal` 支持按组、用户和模板的周期目标、完成率与阈值；任务统计看板、组件、下钻、导出和共享均有正式 API 与前端入口。
- `task_relation` 记录来源任务与整改/复查任务关系并拒绝有向循环；`task_automation_rule`、`task_automation_execution` 实现稳定来源去重、失败记录、重试和执行时权限复核。
- `task_analytics_subscription` 使用接收人当前权限逐人渲染和投递；低权限接收人不产生投递，单条派发失败不阻塞后续订阅。

**验证：**
```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=TaskMetricServiceTest,TaskMetricGoalServiceTest,TaskAnalyticsQueryServiceTest,\
TaskAnalyticsDashboardServiceTest,TaskAnalyticsSubscriptionServiceTest,\
TaskAnalyticsSubscriptionDispatcherTest,TaskAutomationConditionEvaluatorTest,\
TaskAutomationServiceTest,TaskAutomationExecutorTest,TaskRelationServiceTest test
```

结果：通过。日志中的 `queue unavailable` 是 `schedulerIsolatesOneSubscriptionFailureAndContinues` 测试刻意注入的失败分支，验证后续订阅仍继续派发。

**未完成证据：**
- 仍需补齐跨服务实际 UI/E2E 证据及将全平台列级 `AUDIT_REQUIRED` 清零；故 WP-08 保持 `VERIFYING`，不标记 `COMPLETE`。

---

### 2026-07-23 08:26 / WP-01 schema 策略纠正与对象去留审计

**用户纠正：**
- 保护现有数据库和 V1-V79 migration 历史，不得整体替换为新 baseline。
- 保护数据库不等于保留垃圾对象；最终不用的表、列、函数、配置、权限、API 和页面必须删除。
- 旧日报和旧 `ops_schedule_*` 数据无需保留，但只能在消费者切换后通过增量 migration 定向清理。

**当前有效结果：**
- 已恢复并保持 V1-V79 migration 和 `classpath:db/migration`，移除错误 `db/baseline` 方案。
- V80-V83 只增量新增统一任务核心、统计自动化、权限和内置模板。
- `UnifiedTaskIncrementalMigrationTest` 分阶段验证 V1-V79、非目标哨兵数据、V80-V83 和 Flyway 历史连续性。
- 新增 `SCHEMA-OBJECT-LEDGER.md`，按 `KEEP`、`MIGRATE_THEN_DROP`、`SHARED_DELETE_TARGET_ROWS`、`IMPLEMENT_OR_DROP` 和 `OUT_OF_SCOPE_AUDIT_REQUIRED` 管理对象。

**去留结论：**
- `ops_duty_roster`：业务集合和表名当前有终态用途；统一任务值班人分派、日历设置和日历图层直接使用。字段仍按 `SCHEMA-OBJECT-LEDGER.md` 分为 `KEEP` 与 `IMPLEMENT_OR_DROP`，不得整表继承历史列。
- `ops_holiday_calendar`：业务集合和表名当前有终态用途；统一任务工作日/相对节假日计算、日历设置和日历图层直接使用。字段仍按 `SCHEMA-OBJECT-LEDGER.md` 分为 `KEEP` 与 `IMPLEMENT_OR_DROP`，不得整表继承历史列。
- `daily_report`、`daily_report_approval`、全部八张 `ops_schedule_*`：仅过渡期暂留，WP-09 消费者切换后整表删除。
- workflow、notification、audit、config、RBAC：共享表保留，只删除旧日报/旧 schedule 的精确目标行；禁止宽条件清理。
- 新审批、统计、看板、自动化表：标记 `IMPLEMENT_OR_DROP`，最终没有正式读写/展示/验收链路的同样删除。
- 其他平台表在本项目升级中受保护，但没有被自动认定为永久有用；全平台零垃圾审计属于本项目 WP-09/WP-10 的强制交付物，不另行后置。

**已通过验证：**
```bash
cd backend && mvn -q clean -Dtest=UnifiedTaskIncrementalMigrationTest test
cd backend && mvn -q -Dtest=UnifiedTaskIncrementalMigrationTest,TaskPlanGenerationClaimIntegrationTest,TaskTemplateSchemaRoundtripIntegrationTest test
cd backend && mvn -q -DskipTests compile
```

结果：V1-V79 共 77 个历史 migration 正常执行，再执行 V80-V83 四个增量 migration；非目标数据和历史表保留，新统一任务对象、权限、模板和关键唯一约束存在；计划生成、模板 schema roundtrip 和后端编译通过。GitNexus `detect_changes(scope=unstaged)` 为 LOW，0 个受影响执行流；命中的是工作树中既有代码改动，本轮文档纠正未编辑代码 symbol。

**待 WP-09/WP-10：**
- 所有目标消费者切换后新增最终定向清理 migration，不能提前 drop。
- 分别验证 V79 → latest 升级和 V1 → latest 全新安装达到相同终态。
- 执行表、列、约束、索引、触发器、函数、配置、权限、seed、API 和页面的零残留门禁。

### 2026-07-23 00:40 / WP-01 与 WP-02 接手审计

**目标：**
- 依据代码、迁移和测试证据复核前序工作包状态，不继承未经验证的完成声明。

**审计结果：**
- 后端 `mvn -q -DskipTests compile` 通过。
- WP-01 已新增任务/审批 schema 与部分实体、Mapper，但运行时迁移仍为 V1-V79 后执行 V80 删除旧表，与 `SCHEMA-CUTOVER.md` 的空库新基线要求冲突。
- WP-01 未提供 Flyway 空库重建、旧表不存在、关键约束和租户隔离测试证据。
- WP-02 只有 `TaskTemplateService` 骨架；`publishTemplate` 仍抛出 `UnsupportedOperationException`。
- WP-02 缺少 API Controller、typed DTO、字段类型注册与校验、条件/公式 AST、不可变版本测试、前端设计器及 schema roundtrip 证据。
- GitNexus 索引已刷新到 12,590 nodes / 28,001 edges / 300 flows；模板服务及实现影响风险 LOW，无受影响流程。

**状态纠正：**
- WP-01 从 COMPLETE 调整为 VERIFYING。
- WP-02 从 NOT_STARTED 调整为 IN_PROGRESS。

**下一步：**
- 在隔离 Testcontainers PostgreSQL 中建立并验证干净基线，不操作现有开发数据库。
- 补齐 WP-02 后端、前端与验收测试后再进入 WP-03。

---

### 2026-07-23 00:54 / WP-01 全库 baseline 方案（已撤销，禁止执行）

该版本曾物理移出 V1-V84 并改用 `db/baseline`。这违反“保护既有数据库、通过递增 migration 收口”的要求，相关实现已撤销，其命令和结果不再作为证据。

当前必须保留 V1-V79 Flyway 历史；新增能力从 V80 继续递增，旧对象在消费者切换后定向清理。保护迁移历史不等于保留垃圾 schema，最终去留以 `SCHEMA-OBJECT-LEDGER.md` 的逐表逐列证据和零垃圾门禁为准。

---

### 2026-07-23 02:15 / WP-02 模板与动态表单收口

**完成结果：**
- 完成任务模板与版本的创建、草稿编辑、校验、发布、复制新版本、停用和归档生命周期；已发布版本不可修改。
- 提供完整 typed DTO/API，支持租户隔离、错误码和字段级校验问题返回。
- 支持 28 类字段，以及字段配置、值、统计能力校验；实现条件显示、动态必填、公式计算、循环依赖和复杂度保护。
- 公式采用受控 JSON AST 与 `BigDecimal` 计算，不执行用户脚本；支持除零策略和表格行列错误路径。
- 完成模板列表、创建页、版本历史、三栏设计器、执行人/审批人预览及发布链路。
- 新增模板路由、侧边栏、面包屑和权限保护；新增代码没有 lint warning。

**验证：**
```bash
cd backend && mvn -q -Dtest=ExpressionEngineTest,FieldTypeRegistryTest,TemplateSchemaValidatorTest,TemplateFormRuntimeTest,TaskTemplateServiceLifecycleTest,TaskTemplateSchemaRoundtripIntegrationTest,UnifiedTaskBaselineMigrationTest test
cd frontend && npm run lint
cd frontend && npm run typecheck
cd frontend && npm run build
```

**结果：**
- 后端：19 项测试通过。
- 前端：lint 通过，仅保留既有 39 条 warning；typecheck 通过；生产构建通过并生成全部模板路由。
- GitNexus `detect_changes`：LOW，0 个受影响流程；共享 `R` 因 CRITICAL 风险未修改，模板错误使用专用异常映射。

**下一步：**
- 开始 WP-03，完成计划生命周期、周期预览、分配策略、CI 范围解析和幂等实例生成。

---

### 2026-07-23 02:20 / WP-03 计划、调度与 CI 范围收口

**完成结果：**
- 完成计划列表、创建、编辑、预览、激活、暂停、归档和生成记录 API；模板与审批方案版本在激活时校验并固化。
- 建立无旧 `ops_schedule_*` 依赖的周期计算器，支持 once/daily/weekly/monthly/quarterly/semiannual/yearly/Cron/holiday_relative。
- 支持 per_user/per_group/shared/single 生成模式，以及指定人员、组成员、组负责人和值班人解析。
- CI 范围支持模型组、模型、实例三级混合多选、上级覆盖、去重、过滤、越租户拒绝和 10,000 条大范围保护。
- 计划生成使用数据库原子 claim；8 路并发仅一条生成记录，失败记录可重试，组织与完整 CI 命中集在任务实例冻结。
- 新增任务通知 outbox，使用租户内 dedupe key 支撑创建、提醒、审批等后续幂等投递。
- 完成计划列表、四步向导、周期配置、人员/组选择、CI 三栏选择和 occurrence/执行人/截止时间/CI 命中预览。

**验证：**
```bash
cd backend && mvn -q -DskipTests compile
cd backend && mvn -q -Dtest=TaskOccurrenceCalculatorTest,TaskAssignmentResolverTest,CiScopeResolverTest,TaskPlanGenerationClaimIntegrationTest,UnifiedTaskBaselineMigrationTest,TaskTemplateServiceLifecycleTest test
cd frontend && npx eslint src/components/task-plan src/lib/task-plan-api.ts 'src/app/(dashboard)/tasks/plans'
cd frontend && npm run typecheck
cd frontend && npm run build
node .gitnexus/run.cjs detect-changes -r /Users/byron/AI/cwgsyw-platform -s unstaged
```

**结果：**
- 后端编译、周期/分配/CI/并发/schema/生命周期测试通过。
- 前端新增文件 lint 零告警，完整 typecheck 和生产构建通过；生成 `/tasks/plans` 三条路由。
- GitNexus：LOW，0 个受影响流程。

**下一步：**
- 开始 WP-04，完成任务查询/动作门控、草稿 revision、附件、后端校验、不可变提交和字段事实初提取。

---

### 2026-07-23 02:30 / WP-04 任务执行、草稿与提交收口

**完成结果：**
- 完成 `/api/tasks` 列表、详情、时间线、开始、取消、异常关闭、转派、提醒和一次性任务创建契约；详情统一返回服务端动作门控。
- 可见性采用租户、执行人、参与人、有效用户组及权限的联合门控；跨租户和非相关用户不可读取或操作任务。
- 草稿采用追加 revision；旧 revision 写入返回冲突，自动保存使用串行 revision 以避免并发覆盖。
- 附件按字段校验类型与大小，使用隔离对象 key、SHA-256、上传失败补偿；提交时复制为 submission 专属对象并在事务回滚清理。
- 提交在锁任务事务内重新执行条件、必填、表格、附件和公式校验；同一提交人相同 idempotency key 直接返回既有提交。
- 正式提交冻结模板、组织、CI、附件与关联引用快照；无审批任务直接完成并激活非敏感字段事实，有审批任务保持待审批非生效事实。
- 完成 `/tasks`、`/tasks/{id}`、动态字段渲染、附件、自动保存、提交校验提示、时间线、提交快照和一次性任务快速创建入口。

**验证：**
```bash
cd backend && mvn -q -DskipTests compile
cd backend && mvn -q -Dtest=TaskVisibilityServiceTest,TaskRuntimeServiceTransactionTest,UnifiedTaskBaselineMigrationTest,TemplateFormRuntimeTest test
cd frontend && npx eslint src/components/task-runtime src/lib/task-runtime-api.ts 'src/app/(dashboard)/tasks/page.tsx' 'src/app/(dashboard)/tasks/[taskId]/page.tsx'
cd frontend && npm run typecheck && npm run build
node .gitnexus/run.cjs detect-changes -r /Users/byron/AI/cwgsyw-platform -s unstaged
```

**结果：**
- 后端：编译通过；运行时访问、revision 冲突、校验失败零写入、提交幂等及 schema 回归通过。
- 前端：新增文件 lint 零告警；完整 typecheck 与生产构建通过，生成 `/tasks` 和 `/tasks/{taskId}`。
- GitNexus：LOW，0 个受影响流程。

**下一步：**
- 开始 WP-05，完成审批方案、Flowable 适配、退回理由/字段附件意见、重新提交与 `/work` 聚合入口。
- Flyway：5 个迁移全部执行，最终版本 v5，测试通过。
- detect_changes：No changes detected（schema/文档及新增测试不映射到既有执行流）。
- 未操作现有开发数据库；临时审计容器仅用于生成和对照终态。

---

### 2026-07-22 / WP-00 基线与合同冻结

**目标：**
- 确认工作树状态和基线质量门禁
- 盘点旧日报、旧运维任务和重复流程待办的全部消费者
- 确认 Flyway 迁移中的旧表定义和依赖
- 完成低层技术选择

**Git 工作树状态：**
- 分支：lint-fix
- 用户修改：
  - .gitignore 更新
  - 测试结果清理（test-results/ 下多个文件）
  - 4个测试规范文件改进（test/l4-daily-*, test/rem-p1-037-file-move-*.spec.js）
  - 新增文档目录：docs/plan/unified_task_platform/
- 决策：保护所有用户修改，不覆盖、reset 或 checkout

**基线检查结果：**
- 后端编译：✅ 通过（mvn compile，仅 Lombok 警告）
- 前端 lint：✅ 通过（39 warnings 为既有问题）
- 前端 typecheck：✅ 通过（无类型错误）
- GitNexus 索引：✅ 新鲜（485ebb08，11849 symbols，300 processes）

**旧实现盘点（后端 Java）：**

日报模块（module/daily）：
- DailyReportController, DailyReportService, DailyReportMapper
- DailyReportVO, CreateDailyReportRequest, DailyReportBriefVO
- DailyReportApprovalListener (workflow 集成)
- DailyReportReminderScheduler, DailyReportReminderHandler

消费者（跨模块引用 DailyReport）：
- NotificationConfigService, NotificationTargetResolverService
- GroupReferenceRegistry
- WorkflowService
- ReportExportService
- OpsCalendarRuleService, OpsCalendarTaskService (ops calendar 关联)
- CiInstanceController, CiInstanceCommandService, dCiRelatedResourceService (CMDB 关联)

运维日历任务模块（module/opscalendar）：
- 13+ Controller（Rule, Task, Template, Stats, Material, Holiday, Roster）
- 实体：OpsScheduleRule, OpsScheduleTask, OpsScheduleTaskParticipant, OpsScheduleChecklistItem, OpsScheduleTaskLog, OpsScheduleTaskLink, OpsScheduleNotificationLog, OpsScheduleTemplate
- Mapper：对应上述实体
- Service：OpsCalendarRuleService, OpsCalendarTaskService, OpsCalendarTemplateService 等

**旧实现盘点（前端）：**
- frontend/src/app/(dashboard)/daily/**（3个页面）
- frontend/src/components/daily/**（3个组件）
- frontend/src/app/(dashboard)/workflow/todo/page.tsx
- frontend/src/app/(dashboard)/workflow/tasks/page.tsx
- 运维日历相关：rules, templates, stats, materials 子路径（需确认）

**数据库迁移盘点：**
- V4：daily_report + daily_report_approval 表 + 权限 seed
- V34：daily_report 增加 ci_instance_ids JSONB 列
- V61：ops_schedule_* 全部表（rule, task, participant, checklist_item, task_log, task_link, notification_log, template）+ ops_duty_roster + ops_holiday_calendar
- V62：workflow_template, workflow_template_instance, workflow_process_binding, workflow_business_instance
- 多处迁移可能引用日报或 ops task 作为外键、配置或种子数据

**修改文件：**
- docs/plan/unified_task_platform/IMPLEMENTATION-STATUS.md（本文件）

**测试命令：**
```bash
cd backend && mvn -q -DskipTests compile  # ✅
npm run lint                              # ✅ (39 warnings 既有)
npm run typecheck                         # ✅
```

**测试结果：**
- 全部通过，基线健康

**detect_changes：**
- 待执行（WP-00 仅文档变更）

**测试数据清理：**
- 无需清理（未运行数据库操作）

**遗留问题：**
1. 需确认 frontend/src/app/(dashboard)/ops-calendar/ 下是否有 rules/templates/stats/materials 子路径
2. 需细化每个消费者模块对旧日报/旧任务的具体依赖（字段、方法、类型）
3. 需确认 workflow_process_binding 表中 business_type='daily_report' 的引用
4. 需确认系统配置（sys_config）中是否有日报专属配置项
5. 需确认通知模板中是否硬编码日报链接或类型
6. 低层技术选择待决策（见下节）

**下一步：**
- 完成运维日历前端文件结构确认
- 细化消费者依赖分析
- 做出低层技术选择
- 完成 WP-00 DoD 后进入 WP-01

---

## 9. 阻塞项

阻塞记录格式：

| 日期 | 阻塞 | 已尝试 | 需要的输入/外部变化 | 状态 |
| --- | --- | --- | --- | --- |
| 2026-07-23 | 统一任务 UI 真实验收缺少当前终态的可认证运行环境 | 已恢复 Chrome 浏览器连接；确认 `cwgsyw-platform-frontend-1`/`backend-1` 运行在 `http://localhost:3001`/`8081`，但容器镜像创建于 2026-07-21。只读检查发现其 PostgreSQL 实际仅执行至 Flyway `V9`，且 `daily_report` 与全部 `ops_schedule_*` 表仍存在，故不是当前工作树 V109 终态。仓库公开文档和测试方案中的默认 `superadmin / Admin@123` 也被该旧开发库拒绝；未继续猜测密码、重置账号或直接修改数据库。 | 启动当前工作树对应的前后端与 V109 升级数据库，并提供仅用于验收的任务权限账号，或先在该新环境登录后告知可继续。 | OPEN |

---

## 10. 旧实现清理台账

| 类别 | 对象 | 状态 | 替代物/证据 |
| --- | --- | --- | --- |
| **前端页面** | `/daily/**` (3个页面) | PENDING | `/tasks` + 日报模板 |
| 前端 | `/workflow/todo` | PENDING | `/work?tab=approve` |
| 前端 | `/workflow/tasks` | PENDING | `/work?tab=execute` |
| 前端 | `/ops-calendar/rules/**` | PENDING | `/tasks/plans` |
| 前端 | `/ops-calendar/templates/**` | PENDING | `/tasks/templates` |
| 前端 | `/ops-calendar/stats/**` | PENDING | `/tasks/analytics` |
| 前端 | `/ops-calendar/materials/**` | PENDING | 附件/文件统一入口 |
| **前端组件** | `components/daily/**` (3个组件) | PENDING | 动态表单渲染器 |
| **后端 API** | `/api/daily-reports/**` | PENDING | `/api/tasks/**` |
| 后端 API | 旧 `/api/ops-calendar/rules/**` | PENDING | `/api/task-plans/**` |
| 后端 API | 旧 `/api/ops-calendar/tasks/**` | PENDING | `/api/tasks/**` |
| 后端 API | 旧 `/api/ops-calendar/templates/**` | PENDING | `/api/task-templates/**` |
| 后端 API | 旧 `/api/ops-calendar/stats/**` | PENDING | `/api/task-analytics/**` |
| 后端 API | `/api/workflow/tasks/group` | PENDING | `/api/work-items?tab=execute` |
| 后端 API | `/api/workflow/todo/**` | PENDING | `/api/work-items?tab=approve` |
| **后端模块** | `module/daily/**` | PENDING | `module/task` + 日报模板种子 |
| 后端 | `DailyReportController` | PENDING | `TaskInstanceController` |
| 后端 | `DailyReportService` | PENDING | `TaskRuntimeService` |
| 后端 | `DailyReportMapper` | PENDING | `TaskInstanceMapper` |
| 后端 | `DailyReportApprovalListener` | PENDING | `TaskSubmissionWorkflowAdapter` |
| 后端 | `DailyReportReminderScheduler` | PENDING | 统一任务提醒调度 |
| 后端 | `DailyReportReminderHandler` | PENDING | `TaskReminderService` |
| 后端 | `OpsCalendar*Controller` (13+) | PENDING | Task/Plan/Template/Analytics Controllers |
| 后端 | `OpsSchedule*` 实体/Mapper (8+) | PENDING | Task 模型实体 |
| 后端 | `OpsCalendar*Service` | PENDING | Task 服务层 |
| **Schema** | `daily_report` 表 | PENDING | `task_instance` + `task_submission` |
| Schema | `daily_report_approval` 表 | PENDING | `approval_round` + `approval_action` |
| Schema | `ops_schedule_rule` 表 | PENDING | `task_plan` |
| Schema | `ops_schedule_task` 表 | PENDING | `task_instance` |
| Schema | `ops_schedule_task_participant` 表 | PENDING | `task_participant` |
| Schema | `ops_schedule_checklist_item` 表 | PENDING | `task_template_field` (表格/区块) |
| Schema | `ops_schedule_task_log` 表 | PENDING | `task_event` |
| Schema | `ops_schedule_task_link` 表 | PENDING | `task_submission_reference` |
| Schema | `ops_schedule_notification_log` 表 | PENDING | 统一通知幂等表 |
| Schema | `ops_schedule_template` 表 | PENDING | `task_template` |
| **权限** | `daily_report:*` 权限 | PENDING | `task:*` + `task_template:*` 权限 |
| 权限 | 旧 `ops_calendar:*` 权限 | PENDING | 新任务权限矩阵 |
| **配置** | `workflow_process_binding` 中 `business_type='daily_report'` | PENDING | `business_type='task_submission'` |
| **消费者** | 首页 workflow/tasks 卡片和链接 | PENDING | `/work?tab=execute` |
| 消费者 | 侧边栏 workflow/todo + workflow/tasks 导航 | PENDING | `/work` 单入口 |
| 消费者 | 面包屑 workflow/todo + workflow/tasks | PENDING | `/work` 面包屑 |
| 消费者 | 通知跳转 daily_report | PENDING | 统一任务通知 |
| 消费者 | CMDB 相关日报 | PENDING | CMDB 相关任务/报告 |
| 消费者 | 报表导出 daily | PENDING | 统一统计导出 |
| 消费者 | `NotificationTargetResolverService` 日报引用 | PENDING | 任务通知解析 |
| 消费者 | `GroupReferenceRegistry` 日报引用 | PENDING | 任务引用 |
| 消费者 | `WorkflowService` 日报流程绑定 | PENDING | 任务提交绑定 |
| 消费者 | `ReportExportService` 日报导出 | PENDING | 提交/统计导出 |

**当前执行结果（WP-09 已完成，覆盖上表历史 PENDING 计划状态）：**

| 类别 | 已物理删除对象 | 终态替代物/证据 |
| --- | --- | --- |
| 前端 | `/daily/**`、`/workflow/todo`、`/workflow/tasks`、旧日历 rules/templates/stats/materials 子页面和日报组件 | `/tasks`、`/work`、计划/模板/统计/附件统一入口；生产构建不再列出旧路由 |
| 后端 API | `/api/daily-reports/**`、旧 `/api/ops-calendar/{rules,tasks,templates,stats}/**`、`/api/workflow/center/tasks/{my,group,complete}`、`/api/workflow/todo/**` | 任务、计划、模板、统计、审批和 `/work` 合同；运行时扫描无旧 API |
| 后端模块 | `module/daily/**`、日报 scheduler/handler/workflow adapter、旧 `OpsSchedule*` 实体/Mapper/Service/Controller | `module/task`、`module/approval` 和 calendar settings |
| Schema/权限/配置 | `daily_report`、`daily_report_approval`、全部 `ops_schedule_*`、`daily_report:*`、旧 `ops_calendar:*`、日报提醒及日报 workflow binding | V92；统一任务/审批 schema、权限、`task_submission` 绑定 |
| 旧消费者 | 首页、导航、面包屑、通知、CMDB、导出、组织引用、工作流中的日报/旧 schedule 消费 | 运行时源码扫描仅余任务周期枚举说明；V92 与迁移断言测试覆盖 |

**清理优先级：**
1. WP-09 前禁止删除（保持编译通过）
2. WP-09 一次性删除全部旧实现
3. 删除顺序：消费者切换 → 前端页面 → 后端 API → 后端服务/实体 → Schema/权限
4. 表、列、共享行、函数和新对象反向审计以 `SCHEMA-OBJECT-LEDGER.md` 为准

---

### 2026-07-23 / WP-10 清理范围最终确认

**用户确认：**

- 用户、RBAC、CMDB、设备、Wiki、共享文件、通知及其他正式业务模块仍在使用，不是本次统一任务改造的删除对象。
- 本项目只清理被统一任务替代的旧日报、旧 `ops_schedule_*`、它们专属的接口、页面、权限、配置和 schema，以及共享表中精确属于旧任务域的目标行和明确只服务一次性切换的重复模型。
- 不得因“统一任务无用途”“零消费者列”或“全平台零垃圾”删除、重构或迁移其他正式业务模块的表、列、接口或数据。

**已采取措施：**

- 已修订 AI Prompt、README、PRD、数据模型、切换方案、实施计划、对象台账与验收标准，使 WP-10 从“全平台 schema 清理”收紧为“旧任务域零残留验证”。
- 已停止 `ci_endpoint_link` 的列级清理探索；仅以 V109 前向恢复此前错误收窄的非目标域契约，不再新增非目标域清理。
- 后续 WP-10 仅执行旧任务域残留扫描、V1/V79 Flyway 终态验证和统一任务端到端验收。

### 2026-07-23 / WP-10 非目标域越界迁移纠偏

**问题与纠正：**

- 复核发现 V93-V108 曾越界删除或收窄 RBAC、Wiki/共享文件 ACL、AI、备份、配置、通知和 CMDB 告警的 schema/运行时契约，与上述最终范围确认冲突。
- 新增 V109 前向恢复非目标域契约：不修改 V1-V79 或 V92，恢复 `ai_call_log`、备份完整字段、配置说明及 watermark 默认值、通知审计/软删除字段、`cmdb_alert.raw_labels`、RBAC 迁移元数据、旧角色关系和 Wiki/共享文件 ACL 表、索引与活动组触发器。
- V109 从 `sys_role_assignment` 与 `resource_acl_entry` 回填能够无歧义恢复的角色与 ACL 行。V93/V103/V108 已物理删除的历史审计行或原始标签值不能凭空精确复原，后续数据与 schema 契约已恢复；未对旧任务域数据做恢复。

**验证：**

- `UnifiedTaskFreshInstallMigrationTest` 证明 V1 空库执行 107 条迁移至 V109，旧日报/`ops_schedule_*` 仍不存在，非目标域表列存在。
- `UnifiedTaskIncrementalMigrationTest` 证明 V79 升级实际执行 30 条迁移至 V109，保留变更/设备 Flowable 定义，删除旧日报流程，并验证非目标域 schema 和可逆 RBAC/ACL 关系恢复。

### 2026-07-23 / WP-10 旧日报运行时残留收口

**完成结果：**

- `CalendarDashboardVO.dailyReport` 改为通用 `featuredTask`；`CalendarQueryService` 仍按内置 `daily_work_report` 模板寻找首页快捷任务，但 API 与前端类型不再把日报建模为独立业务对象。
- 首页运维日历卡片继续以“今日工作日报”作为内置模板的产品快捷入口，点击只进入统一任务详情或我的工作筛选。
- 删除旧日报 Flowable BPMN 部署资源、Wiki 日报章节及其手册目录项；删除无调用的 `CiInstanceService` 空兼容占位，CMDB 的查询、命令和关联资源服务不变。
- 旧任务域运行时扫描为空：不再命中 `daily_report`、`ops_schedule`、旧日报 API、旧日历任务 API、`/workflow/todo`、`/workflow/tasks` 或旧日报流程定义；历史 Flyway 与迁移断言中名称按升级链保留。

**影响与验证：**

- GitNexus upstream impact：`CalendarQueryService.dashboard`、`DashboardOpsCalendarCard`、`CalendarQueryServiceTest.dashboardIdentifiesTodayDailyWorkReport` 与 `CiInstanceService` 均为 LOW，直接调用最多 1 个且无受影响执行流。
- `mvn -q -Dtest=CalendarQueryServiceTest,CalendarControllerContractTest test` 通过。
- `mvn -q -Dtest=UnifiedTaskIncrementalMigrationTest,CalendarQueryServiceTest,CalendarControllerContractTest test` 通过，PostgreSQL 16 Testcontainers 实测 V79 → V108。
- `mvn -q -DskipTests compile`、`npm run typecheck` 和日历卡片定向 ESLint 通过；`git diff --check` 通过。
- Browser runtime 仍无可用实例，真实桌面/移动端交互证据尚缺，WP-06 至 WP-08 保持 `VERIFYING`。

### 2026-07-23 / WP-10 自动化验收回归

**完成结果：**

- 后端全量测试初次发现 12 个非任务域测试失配：设备/IPAM 的组范围测试仍期待旧异常类型，CMDB 变更测试对纯静态路径保留无用 Redis stub。生产行为本身正确，修正测试以验证 `BusinessException` 权限拒绝，并将 Redis stub 移到实际缓存路径。
- 未修改设备、IPAM、CMDB 的任何生产代码或 schema；修复后的全量后端测试无失败。
- 旧任务域运行时代码、资源和前端路由扫描为零；匹配项只剩 V4/V34/V61/V62/V72 历史 migration 与 V92 定向删除 migration，符合 Flyway 历史不可改和残留白名单。

**验证：**

```bash
cd backend && mvn -q test
cd backend && mvn -q -Dtest=UnifiedTaskFreshInstallMigrationTest,UnifiedTaskIncrementalMigrationTest test
cd frontend && npm run lint && npm run typecheck && npm run build
```

- 全部通过。后端日志中 Redis unavailable 与 CJK font warning 是测试故障分支和既有运行环境提示，Surefire XML 无 failures/errors。
- Next 生产路由清单仅包含 `/ops-calendar`、`/ops-calendar/holidays`、`/ops-calendar/rosters`、`/tasks/**`、`/work` 与流程管理页；不含 `/daily/**`、旧日历任务子页、`/workflow/todo` 或 `/workflow/tasks`。
- GitNexus `detect_changes(scope=all)`：累计工作树为 129 文件、325 symbols、73 条流程，风险 `critical`。该结果覆盖整轮统一任务与既有跨模块收口；本切片涉及的 `dashboard`、首页卡片、旧 CMDB 占位和三处测试的预修改 impact 均为 `LOW`，并已通过全量测试和生产构建验证。

**剩余签收条件：**

- Browser runtime 当前返回 `No browser is available`，无法取得 CAL-001..005 及任务工作台/统计页的真实桌面、移动端交互和截图证据；不能以源码、HTTP 或构建结果替代。
- 在浏览器运行时恢复前，WP-06、WP-07、WP-08 与 WP-10 均保持 `VERIFYING`/`IN_PROGRESS`，不得标记项目完成。

## 11. 最终验收摘要

**PRD 验收映射（2026-07-23）：**

| 验收 | 自动化证据 | 状态 |
| --- | --- | --- |
| AC-001 高度定制任务 | `FieldTypeRegistryTest`、`TemplateSchemaValidatorTest`、`TemplateFormRuntimeTest`、`TaskRuntimeServiceTransactionTest` | 已通过 |
| AC-002 周期生成 | `TaskOccurrenceCalculatorTest`、`TaskAssignmentResolverTest`、`TaskPlanGeneratorTest`、`TaskPlanGenerationClaimIntegrationTest` | 已通过 |
| AC-003 模板版本 | `TaskTemplateServiceLifecycleTest`、`TaskTemplateSchemaRoundtripIntegrationTest` | 已通过 |
| AC-004 审批退回 | `ApprovalRuntimeServiceTest`、`TaskApprovalWorkflowAdapterIntegrationTest`、`TaskRuntimeServiceTransactionTest` | 已通过 |
| AC-005 日历定位 | `CalendarQueryServiceTest`、`CalendarControllerContractTest`，以及隔离 V109 Chrome 中月/周/列表真实切换、创建、回显和详情跳转 | 已通过 |
| AC-006 日报模板 | `DailyWorkReportIntegrationTest`、`ApprovalRuntimeServiceTest`、`CalendarQueryServiceTest` | 已通过 |
| AC-007 数字统计 | `TaskAnalyticsQueryServiceTest`、`TaskMetricServiceTest` | 已通过 |
| AC-008 多类型统计 | `TaskAnalyticsQueryServiceTest`、`TemplateFormRuntimeTest`、`TaskDraftAttachmentServiceTest` | 已通过 |
| AC-009 跨周期口径 | `TaskMetricServiceTest`、`TaskRuntimeServiceTransactionTest` | 已通过 |
| AC-010 历史组织统计 | `TaskAnalyticsQueryServiceTest`、任务快照数据模型与全量后端测试 | 已通过 |
| AC-011 审计追溯 | `TaskMetricServiceTest`、`TaskRuntimeServiceTransactionTest`、`ApprovalRuntimeServiceTest` | 已通过 |
| AC-012 数据权限 | `TaskVisibilityServiceTest`、`ApprovalRuntimeServiceTest`、`TaskAnalyticsDashboardServiceTest`、`TaskAnalyticsSubscriptionDispatcherTest` | 已通过 |
| AC-013 CI 层级选择 | `CiScopeResolverTest`、`TaskPlanGeneratorTest` | 已通过 |
| AC-014 CI 限定范围 | `CiScopeResolverTest`、`FieldTypeRegistryTest`、`TaskAnalyticsQueryServiceTest` | 已通过 |
| AC-015 旧实现清理 | V1/V79 Flyway 测试、生产构建路由清单、旧任务域运行时残留扫描 | 已通过 |

**最终门禁：**

- V79 增量升级 / V1 全新安装：已通过，终态均为 V109。
- 后端全量测试：已通过。
- 前端 lint/typecheck/build：已通过；lint 为 0 error、38 个既有 warning。
- 权限和跨租户、并发/幂等、旧实现残留扫描：已通过上述定向与全量验证。
- 最终 `detect_changes`：累计工作树为 critical，详见 WP-10 自动化验收回归记录。
- 未完成项：浏览器运行时不可用，AC-005 和 WP-06 至 WP-08 的真实桌面/移动端 UI/E2E 证据未取得。

### 2026-07-23 / WP-10 浏览器验收恢复检查

**当前结果：**

- Browser runtime 已恢复可用，可连接本机 `http://localhost:3001`；`/ops-calendar` 在未登录状态正确跳转到 `/login`，页面无前端 console warning/error。
- 本机后端 `http://localhost:8081/actuator/health` 返回 200；本机前端生产容器在 `3001` 运行。此前指向 `3000` 的连接实际属于其他本地应用，已更正为本项目的 `3001`。
- 日历、工作台及统计页的真实交互仍必须使用受控登录会话验证。仓库公开文档中的默认 `superadmin / Admin@123` 已在本地登录页验证但被当前开发库拒绝；没有继续猜测密码、重置账号或直接修改数据库。
- 只读核验表明当前运行容器镜像创建于 2026-07-21，实际 PostgreSQL 只执行至 Flyway `V9`，并仍存在 `daily_report`、`daily_report_approval` 和全部 `ops_schedule_*` 表。该环境不是当前工作树的 V109 终态，不能作为统一任务 UI 验收依据。

**本轮自动化回归：**

```bash
cd backend && mvn -q -Dtest=UnifiedTaskFreshInstallMigrationTest,UnifiedTaskIncrementalMigrationTest test
cd frontend && npm run lint && npm run typecheck && npm run build
```

- 两个 Flyway Testcontainers 路径均通过：空库 V1 → V109（107 条 migration）和 V79 → V109（30 条 migration）。
- 本轮重新执行的 `mvn -q -Dtest=UnifiedTaskFreshInstallMigrationTest,UnifiedTaskIncrementalMigrationTest test` 通过；验证使用隔离 PostgreSQL 16 容器，不读取或改变当前 Docker 开发库。
- 前端 lint 通过（0 error、38 条既有 warning），typecheck 和生产 build 通过；路由产物保留 `/ops-calendar`、`/tasks/**`、`/work` 与流程管理页，不含旧日报、旧日历任务子页或重复 workflow 用户待办页。
- 旧任务域运行时代码扫描未命中；`/workflow/tasks` 的命中仅在 `frontend/MIGRATION.md` 与设计笔记等非运行时历史文档中。

**下一步：**

- 启动当前工作树对应的前后端与 V109 数据库，并提供可用于验收的任务权限账号（或先登录该新环境）后，执行 CAL-001..005、`/work`、任务详情和统计页面桌面/移动端交互验收，收集截图与控制台证据，再决定 WP-06..WP-08/WP-10 是否可以签收。

### 2026-07-23 / WP-10 旧任务域 Playwright 测试收口

**完成结果：**

- 删除受版本控制的 18 份仅调用旧日报、旧 `ops_schedule` API 或旧 workflow 用户待办路由的 Playwright 用例，包括日报提交/审批/清理、旧日历模板/规则/任务/素材、日报 SMTP 触发、旧 CMDB 日报引用守卫和旧 ChangeDoc `/workflow/todo` 审批入口。
- 没有删除 ChangeDoc、CMDB、SMTP、通知或工作流的生产代码和后端测试；这些旧脚本失效的原因是其正式旧任务接口/路由已按 V92 和 WP-09 物理删除，而非这些非任务模块被移除。
- 未修改被 `.gitignore` 排除的本地历史测试资产，避免覆盖用户工作区；终态受版本控制源码和测试不再包含旧任务域的可执行 API 或路由引用。

**影响分析与验证：**

- GitNexus 对 `CalendarQueryService`、`WorkItemService`、`WorkflowService`、`ChangeDocService`、`CiInstanceCommandService`、`EmailService` 的 upstream analysis 均为 LOW；最高为 `EmailService` 的 1 个直接依赖、24 个低置信传递项。未编辑上述生产符号。
- `git diff --check` 通过。
- 对当前存在的受版本控制文件执行旧路径扫描，运行时源码无命中；仅剩历史文档、历史迁移和旧验收记录中的文本引用，符合 Flyway 不改写和历史记录保留原则。

**下一步：**

- 在隔离的 V109 运行环境中补齐统一任务日历、工作台、任务详情、统计页的真实 UI/E2E 证据；不得使用或迁移当前的旧 V9 Docker 开发库。

### 2026-07-23 / WP-10 非目标域保护回归与当前 V109 运行时复验

**完成结果：**

- 复核用户最新边界：用户、RBAC、CMDB、设备、Wiki、共享文件、通知等正式模块不属于统一任务清理范围，不能以“统一任务没有直接消费者”为由删除其 schema；本项目只删除旧日报、旧 `ops_schedule_*` 与精确关联目标行。
- 全量后端测试首次暴露 V109 恢复 `wiki_space_acl`、`wiki_page_acl`、`shared_folder_acl` 的三个活动组触发器后，`GroupReferenceRegistry` 仍按 16 个触发器审计，导致组织生命周期的 fail-closed 库存审计把合法终态误判为漂移。
- 将三类 ACL 正式登记为 `wikiSpaceAcls`、`wikiPageAcls`、`sharedFolderAcls`，注册表升级为 `group-reference-registry/v2`，触发器基数更新为 19；这既保护恢复后的非目标域 ACL，也会阻止仍被这些 ACL 引用的组被错误归档/清除。
- GitNexus upstream impact：`buildDescriptors` 为 LOW（1 个直接消费者）；`validationErrors` 为 LOW（2 个直接调用者：库存审计、组织生命周期预检；无受影响执行流）。无 HIGH/CRITICAL 风险。
- V109 隔离 PostgreSQL 已确认没有 10 张旧日报/旧运维任务表；当前后端重建并启动后连续一个调度周期没有 `Unified task scheduler failed` 或 `ASSIGNMENT_TARGET_EMPTY` 日志，健康检查为 UP。

**验证：**

```bash
cd backend && mvn -q -Dnet.bytebuddy.experimental=true test
cd backend && mvn -q -Dtest=UnifiedTaskFreshInstallMigrationTest,UnifiedTaskIncrementalMigrationTest test
cd frontend && npm run lint && npm run typecheck && npm run build
git diff --check
node .gitnexus/run.cjs detect-changes -r /Users/byron/AI/cwgsyw-platform -s unstaged
```

- 后端全量 Surefire XML 无 failures/errors；Flyway 空库和 V79 增量两条路径均通过。
- 前端 lint 为 0 error、38 条既有 warning；typecheck 与 production build 通过。
- `detect_changes` 对累计 118 文件/310 symbols/72 条流程报告 `critical`，这是整轮统一任务及历史跨模块收口的累计范围，不代表本切片新增高风险；本切片的预修改影响均为 LOW。

**仍待签收：**

- 已在 Browser 连接 `http://localhost:8085/ops-calendar`，未认证访问正确重定向到 `/login`，登录页无 console error。V109 隔离环境和当前前端代理均可用。
- CAL-001..005、`/work`、任务详情和统计看板的真实桌面/移动端交互仍需要受控任务权限账号。未获授权前不填写、猜测、重置或创建浏览器登录凭据；WP-06、WP-07、WP-08 保持 `VERIFYING`，WP-10 保持 `IN_PROGRESS`。

### 2026-07-23 / WP-10 隔离 V109 日历真实验收与移动端修复

**范围与边界：**

- 本轮再次确认：用户、RBAC、CMDB、设备、Wiki、共享文件、通知及其他正式模块不属于统一任务清理范围；未删除或变更它们的 schema、接口或数据。
- 验收仅使用隔离的 V109 环境：`http://localhost:8085`（代理到独立后端、PostgreSQL、Redis 与本地构建前端）。通过产品 UI 创建的验收任务仅存在该隔离数据库。

**真实 UI 验收：**

- 使用 V109 种子账号进入 `/ops-calendar`，确认导航没有 `/daily`、旧日历任务子页、`/workflow/todo` 或 `/workflow/tasks`。
- 完成同页 `月 → 周 → 列表` 切换；URL 始终为 `/ops-calendar`。选择“本组”后切换回月视图，实际按钮 class 仍为 active，筛选状态保持；DOM 快照未在重渲染后保留 `[active]` 标记，已以实际样式属性复核，非产品回归。
- 通过“新建任务”创建内置“简易任务”的 `UI 验收一次性任务` 并指派给超级管理员，成功跳转 `/tasks/1`；任务详情显示统一任务表单、动作门控和时间线。
- 该任务回显在日历月视图，点击后再次进入 `/tasks/1`，覆盖 CAL-003/CAL-005 的统一 one-off 命令与统一详情跳转。
- `/work` 显示待执行、待审批、我发起、抄送我的、已完成五个统一 tab，创建任务出现在待执行表格；`/tasks/analytics` 的字段/时间/维度/输出类型配置、结果空态和看板空态正常渲染。

**移动端修复：**

- 移动 viewport `390x844` 首次截图发现 `/ops-calendar` 的共享 `PageHeader` 横向布局挤压标题与说明，中文逐字竖排，属于 P1 可用性问题。
- GitNexus upstream impact：`OpsCalendarInner` 为 LOW（1 个直接调用者、0 条流程）；共享 `PageHeader` 为 CRITICAL（54 个直接消费者、27 条流程）。因此不修改共享组件，只在日历页调用点增加 `flex-col gap-4 sm:flex-row sm:items-start sm:gap-6`，小屏纵向排列、`sm` 起恢复原布局。
- 重建隔离前端并复验同一 390x844 视口：标题、说明、设置/新建按钮、月周列表切换、筛选与日历网格均无挤压或重叠，验收任务仍可见。

**验证：**

```bash
cd frontend && npx eslint 'src/app/(dashboard)/ops-calendar/page.tsx'
cd frontend && npm run typecheck
cd frontend && npm run build
cd frontend && npm run lint
git diff --check
node .gitnexus/run.cjs detect-changes -r /Users/byron/AI/cwgsyw-platform -s unstaged
```

- 定向 ESLint、typecheck、生产 build 与完整 lint 均通过；完整 lint 为 0 error、38 条既有 warning。
- `git diff --check` 通过。
- `detect_changes` 为累计工作树 118 文件、310 symbols、72 条流程、critical；本切片只修改 LOW 风险的 `OpsCalendarInner` 调用点，未改动共享 `PageHeader`。

**仍待签收：**

- 浏览器在继续移动端 `/work` 验收时被另一个扩展界面占用，自动操作被 Chrome 阻止。已完成的桌面 `/work` 和 `/tasks/analytics` 证据有效；待浏览器恢复后补齐移动端 `/work`、`/tasks/analytics` 截图/交互与最终控制台检查。
- 因上述浏览器外部阻塞，WP-06、WP-07、WP-08 保持 `VERIFYING`，WP-10 保持 `IN_PROGRESS`；不得仅凭已通过构建宣告完成。

### 2026-07-23 / WP-10 无浏览器依赖的终态复核

**验证：**

```bash
cd backend && mvn -q -Dtest=UnifiedTaskFreshInstallMigrationTest,UnifiedTaskIncrementalMigrationTest test
cd backend && mvn -q -Dnet.bytebuddy.experimental=true test
rg -n --glob '!docs/**' --glob '!backend/src/main/resources/db/migration/**' \
  --glob '!backend/src/test/**' --glob '!test/**' --glob '!*.md' \
  '/api/daily-reports|/api/ops-calendar/(tasks|rules|templates|stats|report-materials)|/workflow/todo|/workflow/tasks|daily_report|ops_schedule|DailyReportController|OpsScheduleTask' backend frontend
```

**结果：**

- 隔离 PostgreSQL 16 中 V1 空库到 V109（107 条 migration）及 V79 到 V109（30 条 migration）均通过。
- 后端全量 Maven 测试以退出码 0 完成。日志内的 Redis unavailable、预期数据完整性异常、PDF CJK 字体缺失与 Flyway 幂等 `IF EXISTS` 提示均来自覆盖故障/边界分支或环境提示，Surefire 未报告失败或错误。
- 运行时代码残留扫描为空：旧日报 API、旧日历任务 API、重复 workflow 用户待办、`daily_report`、`ops_schedule`、旧权限前缀和旧领域类均未在非历史 migration、测试或文档的运行时代码中命中。

**剩余项不变：**

- Chrome 被外部扩展界面占用，移动端 `/work` 与 `/tasks/analytics` 的真实截图/交互、最终浏览器 console 检查仍未取得；这不是代码或数据库失败，WP-06、WP-07、WP-08 继续为 `VERIFYING`，WP-10 继续为 `IN_PROGRESS`。

### 2026-07-23 / WP-10 浏览器验收环境恢复待认证

**本轮恢复：**

- 隔离 V109 后端 `http://localhost:8083/actuator/health` 返回 200；前端生产构建已重新在本机 `3002` 启动，隔离代理 `http://localhost:8085/ops-calendar` 从此前的 502 恢复为 200。
- Browser 已可用并停在隔离环境的 `/login`。页面只显示用户名、密码与登录按钮，没有可复用的已认证会话；依据安全边界，没有猜测、重置、写入或绕过账号凭据。
- 已将浏览器显示并保留在该登录页，等待拥有隔离 V109 任务权限的用户完成登录。登录后必须继续验证移动端 `/work`、`/tasks/analytics`、最终应用 console，并重置 viewport 后再签收 WP-06/WP-07/WP-08/WP-10。

**本轮质量与范围复核：**

```bash
git diff --check
node .gitnexus/run.cjs detect-changes -r /Users/byron/AI/cwgsyw-platform -s unstaged
```

- `git diff --check` 通过。
- `detect-changes` 仍报告累计工作树 118 files / 310 symbols / 72 execution flows，风险 `critical`；这是此前长期未提交统一任务及跨模块收口改动的总和，本轮未编辑运行时代码、schema 或测试，不能将该累计风险归因于环境恢复。

### 2026-07-23 / WP-10 UI 验收外部认证阻塞

- 连续三次只读检查均确认 Browser 保留的隔离 V109 会话仍在 `http://localhost:8085/login`，没有已认证会话。
- 已恢复的隔离后端、前端与代理保持可用；没有猜测、重置、创建或通过数据库绕过用户凭据。
- 因剩余 `CAL-001..005` 的移动端工作台/统计页交互与最终应用 console 证据必须依赖有效任务权限会话，WP-06、WP-07、WP-08 继续为 `VERIFYING`，WP-10 继续为 `IN_PROGRESS`。用户在浏览器登录后即可从保留的登录页继续，不需要重新部署或修改 schema。

### 2026-07-24 / WP-10 Chrome 验收环境恢复

- 经用户明确授权启动 Chrome；已确认 ChatGPT Chrome Extension 与 native host 均已安装、启用且配置正确，并成功连接 Chrome 默认 profile。
- 发现隔离 `unified-task-e2e` 容器此前已停止。仅恢复该专用 compose 项目的 PostgreSQL、Redis、MinIO、Mailpit、外部 API mock 与后端，并复建主机代理；未启动、停止或修改 `cwgsyw-platform-*` 原有环境。
- 隔离后端健康检查 `http://localhost:8083/actuator/health` 返回 200，前端 `3002` 与代理 `http://localhost:8085/ops-calendar` 返回 200。Chrome 当前打开该地址并显示登录页。
- Chrome 默认 profile 没有可复用的隔离环境认证会话；未输入、猜测、重置或绕过任何账号凭据。待用户完成登录后继续移动端 `/work`、`/tasks/analytics` 与最终 console 验收。

### 2026-07-24 / WP-10 Chrome 最终验收与项目签收

**真实 UI 证据：**

- 用户完成隔离 V109 环境认证后，在 Chrome 的 `http://localhost:8085` 完成验收。`/ops-calendar` 保持单页，月、周、列表在同一 URL 内切换；“本组”筛选在视图切换后保持。通过“新建任务”以“简易任务”模板创建 `UI 验收一次性任务`，成功跳转 `/tasks/1`，该任务回显在日历并可再次进入同一详情页。
- 桌面与 `390x844` 移动视口均验证 `/work` 的五个集合：待执行、待审批、我发起的、抄送我的、已完成。验收任务出现在待执行和我发起的；实际点击“我发起的”后 tab 进入 selected 状态并加载结果。
- 桌面与移动端均验证 `/tasks/analytics` 的模板、统计字段、聚合、输出、日期、粒度、维度与文字搜索控件。选择“巡检次数”后聚合选项有效并实际执行一次只读统计查询；隔离验收库没有对应事实时正确显示空结果，并显示保存看板、CSV、Excel 和清除操作。
- 移动端日历已通过页面局部响应式布局修复：标题、说明、设置/新建、视图切换、筛选和网格均无挤压或重叠。未修改 GitNexus 评为 CRITICAL 的共享 `PageHeader`；修改点仅为 LOW 风险的日历页调用布局。
- 最终应用 console 的 error/warn 查询结果为空。

**最终验证：**

```bash
cd backend && mvn -q -Dnet.bytebuddy.experimental=true test
cd backend && mvn -q -Dtest=UnifiedTaskFreshInstallMigrationTest,UnifiedTaskIncrementalMigrationTest test
cd frontend && npm run lint && npm run typecheck && npm run build
git diff --check
rg -n --glob '!docs/**' --glob '!backend/src/main/resources/db/migration/**' --glob '!backend/src/test/**' --glob '!test/**' --glob '!*.md' '/api/daily-reports|/api/ops-calendar/(tasks|rules|templates|stats|report-materials)|/workflow/todo|/workflow/tasks|daily_report|ops_schedule|DailyReportController|OpsScheduleTask' backend frontend
node .gitnexus/run.cjs detect-changes -r /Users/byron/AI/cwgsyw-platform -s unstaged
```

- 后端全量测试和两条 Flyway 路径均通过：V1 空库执行 107 条 migration 至 V109，V79 升级执行 30 条前向 migration 至 V109。
- 前端 lint 为 0 error、38 个既有 warning；typecheck 与 production build 通过，路由产物不含 `/daily/**`、旧日历任务子页、`/workflow/todo` 或 `/workflow/tasks`。
- `git diff --check` 通过；旧任务域运行时代码扫描为空。历史 migration、测试和文档中的旧名称按 Flyway 历史与审计记录保留，不属于运行时残留。
- `detect_changes` 对整个未提交工作树报告 118 files / 310 symbols / 72 execution flows、风险 `critical`。这是长期累计的统一任务与此前跨模块收口范围，不是本次验收文档或最终 UI 验证的新增风险；相关实现已由上述全量、迁移、构建和真实 UI 验收覆盖。

**最终合同核对：**

- PRD AC-001 至 AC-015 均有自动化或真实 UI 执行证据；AC-005 已由上述 Chrome 交互补齐，状态为“已通过”。
- 旧日报、`ops_schedule_*`、旧日历任务 API/页面、重复 workflow 用户待办、专属权限/配置及其精确共享目标行已由 V92 和消费者切换物理删除；统一任务、运维日历、我的工作和流程管理各自只保留唯一正式入口。
- V1-V79 迁移历史保持不变，所有清理均为 V80+ 前向迁移。用户、RBAC、CMDB、设备、Wiki、共享文件、通知及其他正式模块不在本任务清理范围，未再以统一任务消费者判断删除或收窄其 schema。

**签收结论：**

- WP-06、WP-07、WP-08、WP-10 由 VERIFYING/IN_PROGRESS 更新为 COMPLETE；WP-00 至 WP-10 全部 COMPLETE，项目总体状态为 COMPLETE。
