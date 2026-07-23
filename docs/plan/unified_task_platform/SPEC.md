# 统一任务、审批与统计平台技术 SPEC

**日期：** 2026-07-22  
**状态：** 待实施  
**来源：** `docs/plan/unified_task_platform/PRD.md`  
**技术栈：** Spring Boot 3.4、Java 21、MyBatis-Plus、PostgreSQL、Flowable 7.1、Next.js 16、React 19、TypeScript

---

## 1. 实施目标

本 SPEC 将 PRD 收敛为工程不变量。最终系统只能有一套业务任务模型、一套用户审批入口和一套正式统计事实来源。

完成后必须达到：

1. 一次性任务、周期任务、日报、周报、巡检和资料收集统一使用任务模板、计划、实例和提交版本。
2. 运维日历保持单页面月/周/列表视图，但不拥有独立任务状态机。
3. 日报成为内置任务模板，不存在独立日报 Controller、Service、页面、权限或数据表。
4. Flowable 继续承担审批编排，但审批节点与业务任务明确分离。
5. 自定义表单数据可生成可追溯字段事实和指标事实。
6. 模型组、模型和具体 CI 支持混合多选、动态范围解析和历史快照。
7. 旧接口、旧页面和旧 schema 在同一实施范围内物理删除。

---

## 2. 总体架构

### 2.1 模块分层

```text
frontend
  ├─ /work                 我的工作读模型
  ├─ /tasks                任务实例与详情
  ├─ /tasks/templates      模板设计与版本
  ├─ /tasks/plans          一次性/周期计划
  ├─ /tasks/analytics      统计方案与看板
  ├─ /ops-calendar         单页面日历视图
  └─ /workflow             审批与流程管理

backend
  ├─ module/task
  │   ├─ template          模板、字段、版本
  │   ├─ plan              调度、分配、提醒规则
  │   ├─ runtime           任务实例、草稿、提交版本
  │   ├─ reference         CI 与其他对象关联
  │   ├─ analytics         字段事实、指标、看板
  │   ├─ automation        目标、阈值、任务链路与定时分发
  │   ├─ notification      任务通知与幂等
  │   └─ web               DTO 与 Controller
  ├─ module/approval
  │   ├─ scheme            审批方案版本
  │   ├─ runtime           审批轮次与动作
  │   └─ web               用户审批 API
  ├─ module/workflow       Flowable 门面与管理能力
  ├─ module/opscalendar    仅保留日历设置、排班、节假日或迁入 task/calendar
  └─ module/cmdb           CI 目录与引用解析
```

### 2.2 依赖方向

```text
task runtime ───────→ task template
task plan ─────────→ task template
task plan ─────────→ CMDB / org resolver
task submission ───→ approval facade
approval runtime ──→ workflow runtime facade
workflow callback ─→ approval completion handler
analytics extractor → task submission + template field
calendar read model → task query + roster + holiday
```

禁止依赖：

- 任务业务代码直接调用 Flowable `RuntimeService`、`TaskService` 或 `RepositoryService`。
- 流程引擎直接修改任务表单数据。
- 日历服务拥有另一套任务实体或状态。
- 统计服务只解析前端传入公式或任意 SQL。
- 通用任务模块依赖旧 `daily` 包。

---

## 3. 核心聚合与职责

### 3.1 TaskTemplate 聚合

负责：

- 模板元数据和生命周期。
- 不可变模板版本。
- 字段定义、布局、条件、计算和字段可见性。
- 默认提醒、完成条件和审批建议。

不负责：

- 具体执行人。
- 具体发生日期。
- 运行时草稿或提交数据。

### 3.2 TaskPlan 聚合

负责：

- 一次性或周期性时间规则。
- 分配规则、生成模式、提醒和逾期升级。
- 固化使用的模板版本和审批方案版本。
- CI 动态范围条件。
- 下一次生成时间和幂等 occurrence。

### 3.3 TaskInstance 聚合

负责：

- 某次具体工作及执行状态。
- 负责人、协作人、抄送人和组织快照。
- 计划时间、业务日期、截止时间和逾期标记。
- 当前草稿、当前有效提交和当前审批状态引用。
- 任务时间线。

### 3.4 TaskSubmission 聚合

负责：

- 不可变的正式提交版本。
- 表单 JSON 快照、附件快照、CI 快照和计算结果。
- 当前有效、被退回、被后续版本替代等版本状态。
- 指标提取来源。

草稿与正式提交必须分离。正式提交一旦生成不得原位修改。

### 3.5 ApprovalScheme 与 ApprovalRound 聚合

负责：

- 审批方案版本。
- 任务提交对应的审批轮次。
- Flowable 流程实例关联。
- 节点动作、退回理由、字段意见和附件意见。

审批通过后只回写审批结果和任务状态，不修改提交内容。

### 3.6 Analytics 聚合

负责：

- 统计启用字段的规范化事实。
- 跨模板指标定义与字段绑定。
- 统计方案、组件、筛选和共享范围。
- 权限过滤和下钻血缘。

### 3.7 Automation 聚合

负责：

- 统计指标目标值和预警阈值。
- 基于任务提交、审批通过、指标变化的受控触发规则。
- 自动创建整改、复查等后续任务。
- 父任务、来源任务和子任务链路。
- 看板订阅和定时发送配置。

自动化只消费已验证的业务事件和正式指标事实，不执行任意脚本，不允许规则直接写数据库或绕过任务创建权限。

---

## 4. 模板与表单协议

### 4.1 模板生命周期

```text
draft → published → deprecated → archived
```

规则：

- 只有 draft 可编辑。
- published 版本不可变。
- 修改 published 模板时创建下一草稿版本。
- deprecated 版本不能新建计划，但已有计划和任务继续可读。
- archived 仅历史查询。
- 任务实例始终引用具体 `template_version_id`。

### 4.2 字段类型注册

后端建立字段类型注册表，每种类型提供：

- 配置校验器。
- 值校验和规范化器。
- 默认序列化方式。
- 是否支持统计及可用统计操作。
- 是否支持作为维度。
- 是否支持敏感和导出控制。

首期类型：

```text
text, textarea, rich_text
number, money, percentage
single_select, multi_select, boolean, rating, tags
date, datetime, date_range, duration
user, group, role
ci_scope, relation
table, repeater
file, image
formula, aggregate_reference
section, help_text
```

### 4.3 字段定义合同

字段定义至少包含：

```json
{
  "key": "inspection_count",
  "label": "巡检次数",
  "type": "number",
  "required": true,
  "defaultValue": 0,
  "validation": { "min": 0, "scale": 0 },
  "display": { "width": 6, "placeholder": "请输入次数" },
  "visibility": {
    "executor": "read_write",
    "approver": "read",
    "copied": "read",
    "analytics": true,
    "export": true
  },
  "analytics": {
    "enabled": true,
    "role": ["metric"],
    "unit": "次",
    "aggregation": "sum",
    "additivity": "additive"
  }
}
```

数据库可以拆分字段元数据和复杂 JSON 配置，但 API 统一返回该结构。

### 4.4 条件表达式

使用受控 AST，不保存任意 JavaScript：

```json
{
  "op": "eq",
  "left": { "field": "has_exception" },
  "right": { "literal": true }
}
```

允许操作：

```text
eq, ne, gt, gte, lt, lte
in, not_in, contains, is_empty, not_empty
and, or, not
```

条件仅能引用同一模板版本中的字段。发布时校验引用存在且无循环依赖。

### 4.5 公式表达式

公式使用结构化 AST 或受控解析器。首期函数：

```text
ADD, SUBTRACT, MULTIPLY, DIVIDE
SUM, AVG, MIN, MAX, COUNT
ROUND, COALESCE
```

要求：

- 发布时校验字段类型和循环引用。
- 前端只做即时预览。
- 后端提交时重新计算并覆盖客户端结果。
- 除零返回校验错误或按公式配置返回空值，不能产生无限值。
- 金额和精度敏感值使用 `BigDecimal`。

---

## 5. 任务计划与调度

### 5.1 计划类型

```text
once, daily, weekly, monthly, quarterly,
semiannual, yearly, cron, holiday_relative
```

可视化配置是正式入口；Cron 是高级模式。

### 5.2 生成模式

```text
per_user      每个命中用户一份任务
per_group     每个命中组一份协作任务
shared        所有命中参与者共同一份
single        一次性固定一份
```

### 5.3 幂等键

任务生成必须有稳定 occurrence key：

```text
{planId}:{occurrenceAt}:{generationMode}:{subjectType}:{subjectId}
```

数据库唯一约束：

```text
tenant_id + plan_id + occurrence_key
```

并发调度以数据库唯一约束作为最终防线，捕获唯一冲突后视为已生成，不重发通知。

### 5.4 计划变更

- 计划变更只影响尚未生成的 occurrence。
- 已生成任务不得被计划更新静默改写。
- 批量更新未来已生成任务必须使用显式命令和影响预览。
- 修改模板需要发布新版本并显式升级计划。
- 计划停用不取消已生成任务。

### 5.5 调度事务

单个 occurrence 的事务边界包含：

1. 锁定或验证计划状态。
2. 解析执行对象和 CI 动态范围。
3. 插入任务实例、参与人和快照。
4. 记录生成事件。
5. 写入待发送通知 outbox 或通知日志。

外部通知不阻塞任务主事务。失败后独立重试。

---

## 6. CI 层级选择与快照

### 6.1 层级

```text
CiModelGroup.code
  → CiModel.modelId/groupCode
    → CiInstance.id/modelId
```

选择项统一表示：

```json
{
  "level": "model_group | model | instance",
  "key": "database | mysql | 123",
  "label": "数据库 | MySQL | mysql-prod-01"
}
```

### 6.2 使用模式

```text
fixed_scope       计划生成时全部关联
bounded_select    执行人在限定范围选具体实例
free_instance     执行人在授权范围自由选实例
scope_select      执行人可选组、模型或实例
```

### 6.3 解析规则

- 上级范围覆盖下级时去重。
- 查询强制 tenant 和 CMDB 权限过滤。
- 周期计划每次生成任务时重新解析动态范围。
- 任务生成后保存命中的实例快照。
- 提交时保存实际选择快照。
- 历史快照不因 CI 改名、删除或移动模型组而回写。
- 统计可以按快照模型组、模型和实例分组。

### 6.4 大范围保护

- 目录按需加载，实例服务端分页。
- 发布计划前返回命中数与前 N 条预览。
- 超过配置阈值时二次确认。
- 超过系统硬上限时拒绝同步生成，要求缩小范围或使用异步批次。

---

## 7. 任务执行状态机

### 7.1 执行状态

```text
not_started
in_progress
submitted
changes_requested
completed
cancelled
exception_closed
```

状态转换：

| 当前 | 动作 | 下一个状态 |
| --- | --- | --- |
| not_started | start/save_draft | in_progress |
| not_started/in_progress/changes_requested | submit(no approval) | completed |
| not_started/in_progress/changes_requested | submit(with approval) | submitted |
| submitted | approval_return | changes_requested |
| submitted | approval_pass | completed |
| submitted | approval_terminate | cancelled |
| 非终态 | cancel | cancelled |
| 非终态 | close_exception | exception_closed |

### 7.2 审批状态

```text
not_required
not_started
in_review
approved
changes_requested
terminated
failed
```

逾期不是执行状态，使用派生字段：

```text
overdue = now > due_at AND execution_status not terminal
```

### 7.3 状态并发

- 任务命令读取时校验版本号或更新时间。
- 提交、审批回调、取消使用行锁或乐观锁。
- 已终态命令返回稳定 409，不重复写事件和通知。
- 审批回调按 `process_instance_id + terminal_result` 幂等。

---

## 8. 草稿与提交版本

### 8.1 草稿

- 每个任务只有一个当前草稿记录。
- 自动保存携带 `revision`，旧 revision 更新返回 409。
- 草稿允许修改表单、附件和 CI 选择。
- 草稿不进入正式统计。

### 8.2 正式提交

提交事务：

1. 锁定任务和草稿。
2. 校验执行权限与状态。
3. 加载模板版本并执行完整后端校验。
4. 重新计算公式字段。
5. 冻结表单、附件、关联对象、CI 和组织快照。
6. 生成递增提交版本。
7. 标记此前有效版本为 superseded（如有）。
8. 根据审批方案完成任务或启动审批。
9. 提取字段事实；需审批数据先标记为未生效。
10. 写任务事件和通知 outbox。

流程启动失败时整个提交事务回滚，任务保持可重试状态。

### 8.3 重新提交

- changes_requested 状态允许基于上一提交复制草稿。
- 新提交版本与旧版本都保留。
- 新审批轮次引用新提交版本。
- 统计只读取当前有效且满足状态口径的版本。

---

## 9. 审批与 Flowable

### 9.1 方案版本

审批方案发布生成不可变版本，版本记录：

- 节点和顺序。
- 审批人来源。
- 会签/或签策略。
- 允许动作。
- 退回目标。
- 具体 Flowable process definition ID 或生成配置。

任务计划引用具体方案版本，任务实例保存固化引用。

### 9.2 通用业务类型

统一任务提交使用：

```text
businessType = task_submission
businessId   = {submissionId}
businessKey  = task_submission:{submissionId}
```

不为日报、巡检、周报等模板分别注册业务适配器。

### 9.3 审批动作

```text
approve
return_for_changes
return_previous_node
terminate
```

退回修改要求非空理由。字段和附件意见使用结构化 JSON，但服务端校验引用属于本提交。

### 9.4 权限

完成审批必须同时满足：

1. Flowable 当前任务 assignee/candidate 关系。
2. `workflow:approve` 业务权限。
3. 租户一致。
4. 对关联任务和提交具有审批可见性。

### 9.5 回调

Flowable 完成后发布统一事件：

```text
ApprovalCompletedEvent
  submissionId
  approvalRoundId
  processInstanceId
  result
  completedAt
```

监听器只调用 approval/task 应用服务，不直接操作 Controller 或前端 DTO。

---

## 10. 统计事实与查询

### 10.1 双层存储

- `task_submission.form_data` 是不可变业务原文。
- `task_field_fact` 是可统计字段的规范化查询事实。
- `task_metric_fact` 是跨模板统一指标或公式指标事实。

事实表不是业务原文，必须能回溯到 submission、field key 和 table row key。

### 10.2 提取时机

- 提交后同步验证并生成字段事实，保证事务一致。
- 需要审批的数据先标记 `effective=false`。
- 审批通过后幂等激活事实。
- 被后续提交替代或审批退回时，旧事实标记失效但不删除。
- 大型派生指标可通过异步重算任务生成，保留版本和错误状态。

### 10.3 数据类型

事实类型：

```text
number, text, boolean, date, datetime,
option, user, group, ci, attachment, table_row
```

只允许一个对应值列非空。数据库 CHECK 或服务层必须保证类型和值列一致。

### 10.4 统计执行

- 前端提交结构化统计查询，不提交 SQL。
- 后端白名单解析指标、维度、聚合和排序。
- 时间范围、模板、租户和权限是强制过滤条件。
- 查询结果包含口径、单位、更新时间和下钻 token/参数。
- 大查询设置时间、行数和维度基数限制。

### 10.5 文字与附件

- 文字首期只做明细、全文检索和人工标签。
- 附件首期只做元数据、分类、文件列表和图片墙。
- 附件下载再次执行权限校验，不把永久 URL 放入统计结果。

### 10.6 跨模板和跨周期

- 不同模板字段只有绑定到同一指标定义后才能统一统计。
- 绑定必须校验数据类型、单位、聚合性质和时间口径。
- 指标 `authority_policy` 明确原始事实、系统汇总和人工上报的角色。
- 系统汇总值必须记录来源事实集合或可重建查询配置。
- 周报/季报中的 `aggregate_reference` 字段读取已冻结时间窗口的系统汇总，默认只读。
- 人工上报值与系统汇总值并存，不覆盖；差异超过配置阈值时要求差异说明。
- 正式统计不能同时累计底层事实与其上层汇总值。

### 10.7 目标、阈值和自动化

- 指标目标按租户、组、人员、模板和周期配置。
- 阈值规则只能引用已注册指标或当前任务字段。
- 规则触发生成幂等执行记录。
- 自动创建任务必须通过正式任务应用服务，绑定已发布模板版本并执行权限/范围校验。
- 来源任务与整改/复查任务使用显式关系表，支持链路查询和防循环。
- 自动化失败不回滚已经完成的原任务或审批；进入可重试/人工处置状态。
- 相同规则、来源事实和触发版本只执行一次。

---

## 11. 日历读模型

运维日历使用专用只读查询服务，组合：

- 统一任务实例。
- 排班。
- 节假日。

日历接口不创建任务、不推进状态。快捷创建调用正式任务/计划命令接口。

前端保持一个 `/ops-calendar` 页面：

- `view=month|week|list` 作为页面状态或查询参数。
- 共享 scope、template、type、status、assignee 等筛选。
- 切换视图保留筛选上下文。
- 点击任务进入统一任务详情。

---

## 12. 通知与任务事件

### 12.1 事件

```text
task_created
task_due_soon
task_overdue
task_submitted
approval_assigned
approval_returned
approval_approved
task_completed
task_cancelled
```

### 12.2 幂等

通知唯一键：

```text
tenant + task + event + recipient + channel + occurrence/round
```

通知跳转统一指向：

- 业务任务：`/tasks/{taskId}`。
- 审批待办：`/work?tab=approve&approvalTaskId={id}` 或正式审批详情。
- 不再产生 `/daily/*` 或旧 `/ops-calendar?taskId=` 专属兼容目标。

看板订阅使用独立调度，不复用任务提醒的业务事件；发送内容只包含接收人有权查看的聚合和短期鉴权入口。

---

## 13. 权限模型

正式资源建议：

| 资源 | Actions |
| --- | --- |
| `task` | `read`, `read_group`, `read_all`, `create`, `update`, `execute`, `assign`, `cancel`, `export` |
| `task_template` | `read`, `manage`, `publish` |
| `task_plan` | `read`, `manage`, `enable`, `disable` |
| `task_analytics` | `read`, `manage`, `share`, `export` |
| `workflow` | `read`, `approve`, `configure` |
| `calendar_settings` | `read`, `manage` |

删除：

- `daily_report:*`。
- `ops_calendar:*`（页面读取改用 task 权限；排班/节假日使用 calendar_settings）。

所有表和查询必须包含 tenant 过滤。组范围使用任务生成/提交时快照与当前授权规则组合，不能只依赖前端筛选。

---

## 14. 审计

复用平台 `audit_log` 记录管理和敏感动作；使用 `task_event` 记录业务时间线。

审计至少覆盖：

- 模板发布/停用。
- 计划发布/启停/修改。
- 任务创建/分配/取消/异常关闭。
- 正式提交/重新提交。
- 审批动作和理由。
- 附件下载/导出。
- 统计方案共享/导出。
- schema 或权限种子不属于运行时审计，但必须进入代码评审。

---

## 15. 错误合同

| 场景 | HTTP | 要求 |
| --- | --- | --- |
| 输入校验失败 | 400 | 字段级可读错误 |
| 未认证 | 401 | 统一认证响应 |
| 无权限/范围越界 | 403 | 不泄露对象是否存在 |
| 对象不存在 | 404 | 租户内不可见同样 404/403 按现有规范 |
| 状态冲突/旧 revision | 409 | 返回当前状态或 revision |
| 大范围/查询超限 | 422 | 返回可调整原因 |
| 服务内部错误 | 500 | 不暴露 SQL/Flowable/存储细节 |

失败命令不得半写入任务、提交、审批或通知状态。

---

## 16. 包和文件规模规则

- 新后端 Controller 不承载领域逻辑。
- 单个 Service 超过约 500 行前优先按聚合拆分。
- 前端页面只编排数据和路由；设计器、字段渲染、统计组件拆为独立组件和 hooks。
- 不向超过 600 行的旧页面添加主要行为；超过 900 行先拆分。
- API 响应和表单结构必须有 TypeScript 类型。
- 动态 JSON 在 DTO/服务边界验证，不以裸 `Map<String,Object>` 穿透所有层。

---

## 17. 可观测性

至少提供：

- 计划扫描数、生成成功/冲突/失败数。
- 提交校验失败和流程启动失败日志。
- 审批回调幂等重复计数。
- 通知发送、重试和永久失败数。
- 字段事实提取失败和重算数。
- 统计查询耗时、扫描量、缓存命中和超限数。

日志必须包含 tenant、plan/task/submission/round 等非敏感关联 ID，不记录敏感表单全文或附件内容。

---

## 18. 技术完成条件

- 所有新聚合由新 schema 支撑，无旧日报/ops task 表依赖。
- 所有用户任务和审批页面使用正式 API。
- Flowable 只有通用任务提交适配器，不存在日报专属适配器。
- 日历只读服务没有任务写方法。
- 统计结果能回溯到 submission 和 field fact。
- 所有命令具备租户、权限、状态和幂等校验。
- 旧代码、路由、权限和 migration 残留检查为零。
- `TEST-ACCEPTANCE.md` 的质量门禁通过。
