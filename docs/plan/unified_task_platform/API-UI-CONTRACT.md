# 统一任务平台 API 与 UI 契约

**状态：** 待实施  
**响应封装：** 复用平台 `R<T>` 与 `PageResult<T>`  
**序列化：** 遵循当前后端 snake_case 全局策略和前端 API 约定

---

## 1. 目标

本文件定义最终正式路由。实施结束后不得同时保留同义旧路由。

API 分为：

- 用户工作项读模型。
- 任务模板与计划管理。
- 任务执行与提交。
- 审批待办与动作。
- 日历读模型。
- CI 范围选择。
- 统计看板。
- 流程管理。

---

## 2. 通用合同

### 2.1 分页

查询列表统一：

```text
page >= 1
size default 20, max 200
```

响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "records": [],
    "total": 0,
    "page": 1,
    "size": 20
  }
}
```

具体字段以项目现有 `PageResult` 序列化为准，不新增第二种分页包装。

### 2.2 时间

- 日期：`YYYY-MM-DD`。
- 日期时间：ISO-8601，无模糊本地格式。
- API 必须明确 businessDate 与 createdAt/submittedAt 的区别。

### 2.3 并发

可编辑资源更新请求携带 `lockVersion` 或 `revision`：

```json
{ "revision": 3, "formData": {} }
```

冲突返回 409 和当前版本摘要。

### 2.4 错误

动态表单错误建议返回：

```json
{
  "code": "FORM_VALIDATION_FAILED",
  "message": "表单校验失败",
  "details": {
    "fieldErrors": [
      { "fieldKey": "inspection_count", "message": "必须大于等于 0" }
    ]
  }
}
```

若全局异常结构暂不支持 details，应在本工作包中统一扩展一次，不为不同 Controller 自定义错误形状。

---

## 3. 我的工作 API

### 3.1 列表

```text
GET /api/work-items
```

参数：

```text
tab=execute|approve|initiated|copied|completed
keyword
templateId
status
priority
overdue
groupId
from/to
page/size
```

统一 item：

```json
{
  "itemType": "task | approval",
  "itemId": "123",
  "taskId": 99,
  "title": "2026-07-22 工作日报",
  "subtitle": "工作日报 · 运维一组",
  "status": "in_progress",
  "priority": "normal",
  "businessDate": "2026-07-22",
  "dueAt": "2026-07-22T18:00:00",
  "overdue": false,
  "actionRequired": true,
  "href": "/tasks/99"
}
```

`tab=approve` 的 item 可额外包含 `approvalTaskId`、`nodeName`，但不得让前端解析 businessKey 构造业务链接。

### 3.2 数量

```text
GET /api/work-items/counts
```

返回各 tab 待处理数量，用于导航 badge。不得写死 badge。

---

## 4. 任务模板 API

```text
GET    /api/task-templates
POST   /api/task-templates
GET    /api/task-templates/{templateId}
PUT    /api/task-templates/{templateId}
DELETE /api/task-templates/{templateId}

GET    /api/task-templates/{templateId}/versions
POST   /api/task-templates/{templateId}/versions
GET    /api/task-template-versions/{versionId}
PUT    /api/task-template-versions/{versionId}
POST   /api/task-template-versions/{versionId}/validate
POST   /api/task-template-versions/{versionId}/publish
POST   /api/task-template-versions/{versionId}/deprecate
POST   /api/task-template-versions/{versionId}/preview
```

规则：

- 创建模板同时创建 version 1 draft。
- published 版本 PUT 返回 409。
- preview 返回执行人和审批人视图所需 schema，不持久化运行数据。
- DELETE 只允许无正式版本/无引用时软删除；其他情况归档。

模板版本响应：

```json
{
  "id": 10,
  "templateId": 2,
  "version": 1,
  "status": "draft",
  "name": "每日数据库巡检",
  "instructions": "...",
  "layout": {},
  "fields": [],
  "defaultReminder": {},
  "defaultApprovalSchemeVersionId": null
}
```

---

## 5. 任务计划 API

```text
GET    /api/task-plans
POST   /api/task-plans
GET    /api/task-plans/{planId}
PUT    /api/task-plans/{planId}
DELETE /api/task-plans/{planId}

POST   /api/task-plans/preview
POST   /api/task-plans/{planId}/activate
POST   /api/task-plans/{planId}/pause
POST   /api/task-plans/{planId}/archive
GET    /api/task-plans/{planId}/generations
```

预览请求：

```json
{
  "templateVersionId": 10,
  "scheduleType": "weekly",
  "scheduleConfig": {},
  "generationMode": "per_user",
  "assignmentRule": {},
  "ciScopeConfig": {},
  "previewCount": 10
}
```

预览响应包含 occurrence、执行对象、截止时间、CI 命中数量和警告。

一次性手工任务也通过计划命令创建：

```text
POST /api/tasks/one-off
```

服务内部可生成 once plan 或直接生成 task，但必须绑定模板版本并遵守同一校验。推荐保存 once plan，便于“我发起的”追溯。

---

## 6. 任务实例 API

### 6.1 查询

```text
GET /api/tasks
GET /api/tasks/{taskId}
GET /api/tasks/{taskId}/timeline
```

列表参数：

```text
scope=my|group|all
keyword/templateId/planId
executionStatus/approvalStatus
priority/overdue
assigneeId/groupId
businessDateFrom/businessDateTo
page/size
```

详情必须返回服务端动作门控：

```json
{
  "task": {},
  "template": {},
  "draft": {},
  "currentSubmission": {},
  "approval": {},
  "timeline": [],
  "actions": {
    "canStart": true,
    "canEditDraft": true,
    "canSubmit": true,
    "canCancel": false,
    "canViewSensitive": true
  }
}
```

前端不得只根据 status 自行推断权限。

### 6.2 命令

```text
POST /api/tasks/{taskId}/start
POST /api/tasks/{taskId}/cancel
POST /api/tasks/{taskId}/close-exception
POST /api/tasks/{taskId}/remind
POST /api/tasks/{taskId}/reassign
```

每个命令使用独立 DTO，不使用 `{action}` 动态路径。

---

## 7. 草稿、附件与提交 API

```text
GET  /api/tasks/{taskId}/draft
PUT  /api/tasks/{taskId}/draft
POST /api/tasks/{taskId}/draft/attachments
DELETE /api/tasks/{taskId}/draft/attachments/{attachmentId}

POST /api/tasks/{taskId}/validate
POST /api/tasks/{taskId}/submissions
GET  /api/tasks/{taskId}/submissions
GET  /api/tasks/{taskId}/submissions/{submissionId}
GET  /api/tasks/{taskId}/submissions/{submissionId}/diff?against={otherSubmissionId}
```

草稿更新：

```json
{
  "revision": 3,
  "formData": {},
  "referenceSelections": []
}
```

提交请求：

```json
{
  "draftRevision": 4,
  "idempotencyKey": "client-generated-uuid"
}
```

提交响应：

```json
{
  "taskId": 99,
  "submissionId": 501,
  "version": 2,
  "executionStatus": "submitted",
  "approvalStatus": "in_review",
  "approvalRoundId": 12
}
```

附件上传遵循项目现有上传大小和 MinIO 安全边界；响应不提供永久匿名 URL。

---

## 8. 审批 API

用户审批使用唯一正式契约：

```text
GET  /api/approvals/tasks
GET  /api/approvals/tasks/{approvalTaskId}
POST /api/approvals/tasks/{approvalTaskId}/actions
GET  /api/tasks/{taskId}/approval-rounds
GET  /api/approval-rounds/{roundId}
```

动作请求：

```json
{
  "action": "approve | return_for_changes | return_previous_node | terminate",
  "comment": "缺少数据库备份验证记录",
  "fieldComments": [
    {
      "fieldKey": "backup_verification",
      "severity": "error",
      "comment": "请补充恢复验证结果"
    }
  ],
  "attachmentComments": [
    {
      "attachmentId": 123,
      "comment": "日志时间范围不完整"
    }
  ]
}
```

退回与终止 comment 必填。成功后返回更新后的 task/round 状态摘要。

流程管理继续使用 `/api/workflow/...`，但 Controller 按定义管理、实例管理、模板管理、绑定/方案管理拆分；用户审批不再经过旧 `/api/workflow/tasks*`。

---

## 9. 日历 API

```text
GET /api/calendar/work-items
GET /api/calendar/day
GET /api/calendar/dashboard
```

`work-items` 参数：

```text
from/to
view=month|week|list
scope=my|group|all
templateId
executionStatus
approvalStatus
assigneeId/groupId
include=tasks,rosters,holidays
```

返回统一 item：

```json
{
  "itemType": "task | roster | holiday",
  "id": "task:99",
  "title": "数据库巡检",
  "startAt": "...",
  "endAt": "...",
  "status": "in_progress",
  "overdue": false,
  "href": "/tasks/99",
  "meta": {}
}
```

日历 API 全部只读。创建任务调用 `/api/tasks/one-off`。

排班与节假日管理最终使用：

```text
/api/calendar-settings/rosters
/api/calendar-settings/holidays
```

---

## 10. CI 范围 API

### 10.1 目录

```text
GET /api/cmdb/catalog/model-groups
GET /api/cmdb/catalog/model-groups/{groupCode}/models
GET /api/cmdb/catalog/models/{modelCode}/instances
GET /api/cmdb/catalog/search
```

如现有 `/api/cmdb/model-groups`、`/api/cmdb/models`、`/api/cmdb/instances` 已满足合同，可复用而不新增同义 API；前端 selector 通过一个 adapter/hook 组合它们。

实例查询支持：

```text
keyword/status/owner/groupId/page/size
```

### 10.2 解析与预览

```text
POST /api/cmdb/scopes/resolve
POST /api/cmdb/scopes/preview
```

请求：

```json
{
  "selections": [
    { "level": "model_group", "key": "database" },
    { "level": "model", "key": "mysql" },
    { "level": "instance", "key": "123" }
  ],
  "filters": { "status": ["active"] },
  "limit": 100
}
```

响应包含规范化去重 selections、命中总数、当前页实例和上级覆盖警告。

---

## 11. 统计 API

### 11.1 元数据

```text
GET /api/task-analytics/templates/{templateVersionId}/fields
GET /api/task-analytics/dimensions
GET /api/task-metrics
POST /api/task-metrics
PUT /api/task-metrics/{metricId}
```

### 11.2 查询

```text
POST /api/task-analytics/query
POST /api/task-analytics/drilldown
POST /api/task-analytics/export
```

查询请求是结构化白名单：

```json
{
  "source": { "templateVersionIds": [10] },
  "time": {
    "field": "business_date",
    "from": "2026-07-01",
    "to": "2026-07-31",
    "grain": "day"
  },
  "metrics": [
    { "fieldKey": "inspection_count", "aggregation": "sum", "alias": "total" }
  ],
  "dimensions": ["owner_group"],
  "filters": [],
  "effectivePolicy": "approved_or_no_approval",
  "orderBy": [{ "field": "total", "direction": "desc" }],
  "limit": 100
}
```

### 11.3 看板

```text
GET    /api/task-analytics/dashboards
POST   /api/task-analytics/dashboards
GET    /api/task-analytics/dashboards/{dashboardId}
PUT    /api/task-analytics/dashboards/{dashboardId}
DELETE /api/task-analytics/dashboards/{dashboardId}

POST   /api/task-analytics/dashboards/{dashboardId}/widgets
PUT    /api/task-analytics/widgets/{widgetId}
DELETE /api/task-analytics/widgets/{widgetId}
POST   /api/task-analytics/dashboards/{dashboardId}/share
```

### 11.4 跨模板指标与周期汇总

```text
GET    /api/task-metrics
POST   /api/task-metrics
GET    /api/task-metrics/{metricId}
PUT    /api/task-metrics/{metricId}
DELETE /api/task-metrics/{metricId}

POST   /api/task-metrics/{metricId}/bindings
PUT    /api/task-metric-bindings/{bindingId}
DELETE /api/task-metric-bindings/{bindingId}
POST   /api/task-metrics/{metricId}/preview

POST   /api/tasks/{taskId}/aggregate-references/preview
```

绑定请求必须包含 sourceRole、单位换算、时间口径和权威来源优先级。周报/季报的聚合引用预览同时返回系统值、人工值、差异和来源任务数量。

### 11.5 目标与自动化

```text
GET    /api/task-metric-goals
POST   /api/task-metric-goals
PUT    /api/task-metric-goals/{goalId}
DELETE /api/task-metric-goals/{goalId}

GET    /api/task-automations
POST   /api/task-automations
GET    /api/task-automations/{ruleId}
PUT    /api/task-automations/{ruleId}
POST   /api/task-automations/{ruleId}/activate
POST   /api/task-automations/{ruleId}/pause
GET    /api/task-automations/{ruleId}/executions
POST   /api/task-automations/{ruleId}/preview

GET    /api/tasks/{taskId}/relations
```

自动化 action 只接受结构化 `create_task` 或 `notify` 配置，不接受脚本、SQL 或任意 URL 回调。

### 11.6 看板订阅

```text
GET    /api/task-analytics/dashboards/{dashboardId}/subscriptions
POST   /api/task-analytics/dashboards/{dashboardId}/subscriptions
PUT    /api/task-analytics/subscriptions/{subscriptionId}
DELETE /api/task-analytics/subscriptions/{subscriptionId}
POST   /api/task-analytics/subscriptions/{subscriptionId}/test
```

测试发送和定时发送均按接收人权限渲染，不得把创建者可见的全部数据直接发送给低权限接收人。

---

## 12. 前端路由

### 12.1 最终保留/新增

```text
/work
  ?tab=execute|approve|initiated|copied|completed

/tasks
/tasks/{taskId}
/tasks/new
/tasks/templates
/tasks/templates/new
/tasks/templates/{templateId}
/tasks/templates/{templateId}/versions/{versionId}
/tasks/plans
/tasks/plans/new
/tasks/plans/{planId}
/tasks/analytics
/tasks/analytics/{dashboardId}
/tasks/metrics
/tasks/automations

/ops-calendar

/workflow/instances
/workflow/templates
/workflow/design
/workflow/design/{id}
/workflow/stats
```

是否保留 `/workflow/bindings` 与 `/workflow/admin` 取决于方案管理 UI 收敛；不得有两个同功能管理页。

### 12.2 必须删除

```text
/daily
/daily/new
/daily/{id}
/workflow/todo
/workflow/tasks
/ops-calendar/rules
/ops-calendar/templates
/ops-calendar/stats
/ops-calendar/materials
```

排班和节假日可以保留为设置子页或合并成：

```text
/ops-calendar/settings
```

禁止保留旧页面仅做重定向。系统未上线，导航和内部链接应一次性切换。

---

## 13. 页面要求

### 13.1 我的工作

- 顶部 tab 显示实时 badge。
- 支持搜索、状态、优先级、逾期、组和时间筛选。
- 待执行和待审批卡片视觉区分，但共享列表骨架。
- 审批展开或详情显示提交内容和退回历史。
- 空、加载、错误和无权限状态完整。

### 13.2 模板设计器

建议三栏：

```text
字段组件库 | 表单画布 | 字段配置
```

- 支持拖拽或明确的添加/排序操作。
- 支持执行人/审批人预览。
- 发布前展示校验问题。
- CI 字段配置显示四种选择模式和范围预览。
- 统计配置按字段类型提供合法选项，不显示无意义聚合。

### 13.3 任务详情

建议区块：

```text
概要与状态
任务说明
动态表单
附件与关联对象
审批状态/退回意见
历史提交与差异
任务时间线
```

- changes_requested 时在顶部突出退回原因。
- 字段意见显示在对应字段旁。
- 附件意见显示在附件项旁。
- 动作按钮全部使用后端 action gates。

### 13.4 运维日历

- 保持现有一个页面多个视图。
- 月/周/列表切换不跳子路由。
- 筛选条件共享并保留。
- 任务点击进入 `/tasks/{id}`。
- 快速新建打开一次性任务流程。
- 日历设置不挤占主操作层级。

### 13.5 日报快捷入口

可在首页或 `/work` 提供：

```text
今日工作日报：未开始/填写中/待审批/已完成
```

点击进入对应统一任务详情或筛选，不进入独立日报页面。

### 13.6 统计看板

- 数据源、指标、维度、筛选和组件分步配置。
- 每个组件展示口径说明和更新时间。
- 点击图表可下钻任务/提交。
- 文字列表和附件墙不是数学图表。
- 附件下载重新鉴权。

---

## 14. 前端类型与 Query Key

建议统一前端类型目录：

```text
frontend/src/features/tasks/types.ts
frontend/src/features/tasks/api.ts
frontend/src/features/tasks/queryKeys.ts
frontend/src/features/approvals/*
frontend/src/features/task-analytics/*
frontend/src/features/calendar/*
```

Query key 示例：

```text
['work-items', filters]
['work-item-counts']
['task-templates', filters]
['task-template-version', versionId]
['task-plans', filters]
['tasks', filters]
['task', taskId]
['task-draft', taskId]
['task-submissions', taskId]
['approval-tasks', filters]
['calendar-work-items', range, filters]
['task-analytics-dashboard', dashboardId]
```

状态命令成功后集中失效相关 key，不在每个组件散落不一致字符串。

---

## 15. 必须删除的旧 API

最终不得存在：

```text
/api/daily-reports/**

/api/ops-calendar/tasks/**
/api/ops-calendar/rules/**
/api/ops-calendar/templates/**
/api/ops-calendar/stats/**
/api/ops-calendar/report-materials/**

/api/workflow/tasks/my
/api/workflow/tasks/group
/api/workflow/approve
/api/workflow/center/tasks/my
/api/workflow/center/tasks/group
/api/workflow/center/tasks/complete
```

旧 Controller、DTO、前端调用、通知目标和测试必须一起删除或改写。

---

## 16. 契约验收

- route map 中每个正式页面只调用正式 API。
- 旧 API 路径源码搜索为零。
- 旧页面路径源码搜索为零。
- 所有写接口使用 typed DTO 和后端校验。
- 所有详情返回 action gates。
- 前端无新增 `any`。
- 通知和业务摘要直接返回 href，不由前端解释旧 businessKey。
- API shape 与前端属性访问一致，使用 GitNexus route/shape 工具复核。
