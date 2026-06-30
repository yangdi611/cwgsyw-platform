# 运维日历技术规格说明

> 模块：运维日历 / Ops Calendar
> 对应 PRD：`docs/scheduler/ops-calendar-prd.md`
> 日期：2026-06-30
> 目标：将 PRD 转换为可拆分、可编码、可验收的前后端实现规格。

---

## 0. 修订记录（2026-06-30 评审决策）

本规格经评审后确认以下 7 项决策，正文相关章节已据此更新：

1. **日报提醒不降级**：日报是周报/月报/季报的数据基础，`daily_report` 保留为一等任务类型并纳入素材归集；为避免「每个未提交者每天一条可闭环任务」污染日历，采用「**每日一条汇总跟踪任务 + 向未提交者扇出通知**」（见 9.2）。
2. **工作台卡片替换**：确认用「运维日历」卡片替换「近期 CMDB 变更」主卡片（见 8.3、验收用例）。
3. **节假日相对触发（holiday_relative）推迟到 Phase 4**：MVP 周期规则先支持 weekly/monthly/quarterly/semiannual/cron；Phase 2 可通过手工节假日条目、排班和固定日期任务覆盖客户场景；工作日相对推算（节前/节后/季末 N 工作日）在 Phase 4 落地（见 6.3、第 10 节）。
4. **文档纳入版本管理**：本 PRD/spec 通过 `git add -f` 强制纳入（`docs/*` 默认被 gitignore 忽略）。
5. **调度扫描改为按 `next_generate_at` 过滤**：不再每分钟全表扫描所有启用规则，改用 `next_generate_at <= now` 命中 `idx_ops_rule_next_generate` 索引（见 6.1、6.2）。
6. **所有写操作必须写 `audit_log`**：遵循项目「强制规则 2」。`ops_schedule_task_log` 是领域时间线，平台 `audit_log` 是合规审计，二者并行写（见 7.4）。
7. **通知模板渲染 null-safe**：`assigneePhone` 等字段可能为空（用户手机号管理后续完善），渲染时空值降级为占位或省略，不得抛异常（见 6.4）。

### 2026-06-30 验收修复

8. **执行权限收紧**：`canOperate`（确认/开始/完成）仅限负责人、协同人（assignee/collaborator 参与人）、管理员；组长（`read_group` 同组）**不再**默认具备执行权限，避免代替执行人误闭环。组长可执行的写操作限于查看、编辑、取消、异常关闭（见 7.2）。
9. **规则启用前校验负责人可解析**：`group_leader` 类型规则启用前必须配置 `assigneeRule.groupId`，`fixed` 类型必须配置 `userId`，否则拒绝启用——防止生成「无负责人、无通知对象」的死任务。内置 seed 规则默认停用，管理员启用前需补 `groupId`。
10. **日历区间查询改为区间重叠**：跨区间任务（`planned_start_at < windowEnd AND due_at >= windowStart`）正确命中；兼容仅有 start（全天/点事件）或仅有 due 的任务，避免「6/28 起、7/5 止」的任务在查 7/1 时漏查。

---

## 1. 范围

本规格覆盖运维日历 MVP 与客户当前需求落地所需的核心能力：

1. 侧边栏一级菜单“运维日历”。
2. 工作台用“运维日历”卡片替换“近期 CMDB 变更”卡片。
3. 月历、周视图、列表视图。
4. 点击日期打开当日工作项放大视图。
5. 任务闭环：待确认、未开始、进行中、已完成、已逾期、异常关闭、已取消。
6. 周期规则：每周、每月、每季度、每半年、cron、节假日相对日期（`holiday_relative` 在 Phase 4 落地，见第 0 节决策 3）。
7. 通知：站内信、邮件、未确认提醒、逾期升级。
8. 排班、节假日历。
9. 季报、半年报素材归集入口。
10. 日报提醒迁移为运维日历内置规则。

第一阶段不实现企业微信、钉钉、短信、复杂工作流审批、完整报告自动生成。

---

## 2. 现状基线

### 2.1 已有能力

| 能力 | 现有实现 |
|---|---|
| 定时任务 | Spring `@EnableScheduling` 已启用 |
| 日报提醒 | `DailyReportReminderScheduler` 每分钟扫描并手写匹配 cron |
| 通知中心 | `NotificationService.notify` 创建站内信并发送邮件 |
| 系统配置 | `SysConfigService` 读写 `sys_config` |
| 日报导出 | `ReportExportService.exportExcel` 支持按时间范围导出已审批日报 |
| 权限 | `sys_resource`、`sys_permission`、`hasPermission(resource, action)` |
| 前端 API | `frontend/src/lib/api.ts` axios 封装 |
| 工作台 | `frontend/src/app/(dashboard)/page.tsx` 当前包含“近期 CMDB 变更” |
| 侧边栏 | `frontend/src/components/layout/Sidebar.tsx` 配置导航 |

### 2.2 需要替换或迁移

1. 不继续扩展 `notify.reminder.*` 配置项作为所有提醒来源。
2. 新增通用 `ops_calendar` 模块。
3. 日报提醒作为内置 schedule rule 存在，而不是单独硬编码 scheduler。
4. 工作台主工作区中的“近期 CMDB 变更”卡片替换为“运维日历”卡片。

---

## 3. 模块结构

### 3.1 后端包结构

建议新增：

```text
backend/src/main/java/com/cwgsyw/platform/module/opscalendar/
  OpsCalendarTaskController.java
  OpsCalendarRuleController.java
  OpsCalendarTemplateController.java
  OpsCalendarRosterController.java
  OpsCalendarHolidayController.java
  OpsCalendarStatsController.java

  service/
    OpsCalendarTaskService.java
    OpsCalendarRuleService.java
    OpsCalendarScheduler.java
    OpsCalendarNotificationService.java
    OpsCalendarVisibilityService.java
    OpsCalendarMaterialService.java
    OpsCalendarRosterService.java
    OpsCalendarHolidayService.java
    OpsCalendarChecklistService.java

  handler/
    OpsCalendarTaskHandler.java
    DailyReportReminderHandler.java
    QuarterReportReminderHandler.java
    PasswordRotationReminderHandler.java
    QuarterAssessmentHandler.java
    MonitoringAnalysisReminderHandler.java
    SemiAnnualAggregationHandler.java
    HolidayInspectionHandler.java
    DutyRosterReminderHandler.java
    WeeklyInspectionReminderHandler.java
    GenericReminderHandler.java

  mapper/
    OpsScheduleRuleMapper.java
    OpsScheduleTaskMapper.java
    OpsScheduleTaskParticipantMapper.java
    OpsScheduleChecklistItemMapper.java
    OpsScheduleTaskLogMapper.java
    OpsScheduleTaskLinkMapper.java
    OpsScheduleNotificationLogMapper.java
    OpsScheduleTemplateMapper.java
    OpsDutyRosterMapper.java
    OpsHolidayCalendarMapper.java

  entity/
    OpsScheduleRule.java
    OpsScheduleTask.java
    OpsScheduleTaskParticipant.java
    OpsScheduleChecklistItem.java
    OpsScheduleTaskLog.java
    OpsScheduleTaskLink.java
    OpsScheduleNotificationLog.java
    OpsScheduleTemplate.java
    OpsDutyRoster.java
    OpsHolidayCalendar.java

  dto/
    TaskQueryRequest.java
    TaskCreateRequest.java
    TaskUpdateRequest.java
    TaskCompleteRequest.java
    TaskCloseExceptionRequest.java
    TaskVO.java
    TaskDetailVO.java
    DayTasksVO.java
    DashboardCalendarVO.java
    RuleCreateRequest.java
    RuleUpdateRequest.java
    RulePreviewRequest.java
    RulePreviewVO.java
    RuleVO.java
    RosterRequest.java
    RosterVO.java
    HolidayRequest.java
    HolidayVO.java
    ReportMaterialQuery.java
    ReportMaterialVO.java
```

### 3.2 前端结构

建议新增：

```text
frontend/src/app/(dashboard)/ops-calendar/page.tsx
frontend/src/app/(dashboard)/ops-calendar/rules/page.tsx
frontend/src/app/(dashboard)/ops-calendar/rosters/page.tsx
frontend/src/app/(dashboard)/ops-calendar/holidays/page.tsx

frontend/src/components/ops-calendar/
  CalendarMonthView.tsx
  CalendarWeekView.tsx
  CalendarListView.tsx
  DayWorkItemsDialog.tsx
  TaskDetailDrawer.tsx
  TaskFormDialog.tsx
  RuleFormDialog.tsx
  TaskStatusBadge.tsx
  TaskTypeBadge.tsx
  ChecklistEditor.tsx
  RosterTable.tsx
  HolidayTable.tsx
  DashboardOpsCalendarCard.tsx

frontend/src/hooks/
  useOpsCalendarTasks.ts
  useOpsCalendarRules.ts
  useOpsCalendarRoster.ts
  useOpsCalendarHoliday.ts
```

---

## 4. 数据库设计

建议新增 Flyway：

```text
backend/src/main/resources/db/migration/V61__ops_calendar.sql
```

如当前主干已新增更高版本，实际实现时顺延版本号。

### 4.1 枚举约定

使用 `VARCHAR` + CHECK 约束，符合现有迁移风格。

任务类型 `task_type`：

```text
inspection, roster, report, compliance, monitoring, daily_report, other
```

任务状态 `status`：

```text
pending_confirm, not_started, in_progress, completed, overdue, exception_closed, cancelled
```

触发类型 `trigger_type`：

```text
once, daily, weekly, monthly, quarterly, semiannual, yearly, cron, holiday_relative
```

可见性 `visibility`：

```text
private, group, public
```

风险等级 `risk_level`：

```text
none, low, medium, high, critical
```

关联对象类型 `link_type`：

```text
daily_report, ci_instance, prometheus_alert, change_doc, file, external
```

### 4.2 ops_schedule_rule

```sql
CREATE TABLE ops_schedule_rule (
    id                    BIGSERIAL PRIMARY KEY,
    tenant_id             VARCHAR(64) NOT NULL DEFAULT 'default',
    name                  VARCHAR(255) NOT NULL,
    description           TEXT,
    task_type             VARCHAR(32) NOT NULL,
    enabled               BOOLEAN NOT NULL DEFAULT TRUE,
    trigger_type          VARCHAR(32) NOT NULL,
    trigger_config        TEXT NOT NULL DEFAULT '{}',
    generate_days_ahead   INT NOT NULL DEFAULT 7,
    reminder_config       TEXT NOT NULL DEFAULT '{}',
    due_config            TEXT NOT NULL DEFAULT '{}',
    assignee_rule         TEXT NOT NULL DEFAULT '{}',
    recipient_rule        TEXT NOT NULL DEFAULT '{}',
    escalation_rule       TEXT NOT NULL DEFAULT '{}',
    template_id           BIGINT,
    checklist_template_id BIGINT,
    visibility            VARCHAR(32) NOT NULL DEFAULT 'private',
    public_summary        TEXT,
    sensitive             BOOLEAN NOT NULL DEFAULT FALSE,
    next_generate_at      TIMESTAMP,
    last_generated_at     TIMESTAMP,
    is_deleted            BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at            TIMESTAMP,
    deleted_by            BIGINT,
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by            BIGINT,
    updated_by            BIGINT,
    CHECK (task_type IN ('inspection','roster','report','compliance','monitoring','daily_report','other')),
    CHECK (trigger_type IN ('once','daily','weekly','monthly','quarterly','semiannual','yearly','cron','holiday_relative')),
    CHECK (visibility IN ('private','group','public'))
);

CREATE INDEX idx_ops_rule_tenant_enabled ON ops_schedule_rule(tenant_id, enabled) WHERE NOT is_deleted;
CREATE INDEX idx_ops_rule_next_generate ON ops_schedule_rule(next_generate_at) WHERE enabled AND NOT is_deleted;
```

`trigger_config` 示例：

```json
{
  "weekday": "FRI",
  "time": "16:00",
  "interval": 1
}
```

季度规则：

```json
{
  "quarterPosition": "last_workday",
  "offsetWorkdays": -5,
  "time": "09:00"
}
```

节假日相对规则：

```json
{
  "holidayType": "legal",
  "relative": "before",
  "offsetWorkdays": 2,
  "time": "09:00"
}
```

### 4.3 ops_schedule_task

```sql
CREATE TABLE ops_schedule_task (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           VARCHAR(64) NOT NULL DEFAULT 'default',
    rule_id             BIGINT REFERENCES ops_schedule_rule(id),
    occurrence_key      VARCHAR(128),
    title               VARCHAR(255) NOT NULL,
    task_type           VARCHAR(32) NOT NULL,
    source_type         VARCHAR(32) NOT NULL DEFAULT 'manual',
    status              VARCHAR(32) NOT NULL DEFAULT 'pending_confirm',
    planned_start_at    TIMESTAMP,
    due_at              TIMESTAMP,
    assignee_id         BIGINT REFERENCES sys_user(id),
    group_id            BIGINT REFERENCES sys_group(id),
    priority            VARCHAR(32) NOT NULL DEFAULT 'normal',
    content             TEXT,
    visibility          VARCHAR(32) NOT NULL DEFAULT 'private',
    public_summary      TEXT,
    sensitive           BOOLEAN NOT NULL DEFAULT FALSE,
    result_status       VARCHAR(32),
    result_summary      TEXT,
    risk_level          VARCHAR(32),
    confirmed_at        TIMESTAMP,
    confirmed_by        BIGINT REFERENCES sys_user(id),
    started_at          TIMESTAMP,
    completed_at        TIMESTAMP,
    completed_by        BIGINT REFERENCES sys_user(id),
    cancelled_at        TIMESTAMP,
    cancelled_by        BIGINT REFERENCES sys_user(id),
    close_reason        TEXT,
    is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMP,
    deleted_by          BIGINT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by          BIGINT,
    updated_by          BIGINT,
    CHECK (task_type IN ('inspection','roster','report','compliance','monitoring','daily_report','other')),
    CHECK (source_type IN ('manual','rule','holiday','roster','system')),
    CHECK (status IN ('pending_confirm','not_started','in_progress','completed','overdue','exception_closed','cancelled')),
    CHECK (priority IN ('low','normal','high','critical')),
    CHECK (risk_level IS NULL OR risk_level IN ('none','low','medium','high','critical')),
    CHECK (visibility IN ('private','group','public'))
);

CREATE UNIQUE INDEX uq_ops_task_occurrence
  ON ops_schedule_task(tenant_id, rule_id, occurrence_key)
  WHERE rule_id IS NOT NULL AND occurrence_key IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_ops_task_calendar ON ops_schedule_task(tenant_id, planned_start_at, due_at) WHERE NOT is_deleted;
CREATE INDEX idx_ops_task_assignee ON ops_schedule_task(tenant_id, assignee_id, status) WHERE NOT is_deleted;
CREATE INDEX idx_ops_task_group ON ops_schedule_task(tenant_id, group_id, status) WHERE NOT is_deleted;
CREATE INDEX idx_ops_task_status ON ops_schedule_task(tenant_id, status, due_at) WHERE NOT is_deleted;
```

`occurrence_key` 规则：

```text
{ruleId}:{plannedDate}:{taskType}:{assigneeOrGroup}
```

例如：

```text
42:2026-09-25:report:group-3
```

### 4.4 ops_schedule_task_participant

```sql
CREATE TABLE ops_schedule_task_participant (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    task_id     BIGINT NOT NULL REFERENCES ops_schedule_task(id),
    user_id     BIGINT NOT NULL REFERENCES sys_user(id),
    role        VARCHAR(32) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (role IN ('assignee','collaborator','recipient','escalation'))
);

CREATE UNIQUE INDEX uq_ops_task_participant
  ON ops_schedule_task_participant(task_id, user_id, role);
CREATE INDEX idx_ops_participant_user
  ON ops_schedule_task_participant(tenant_id, user_id, role);
```

### 4.5 ops_schedule_checklist_item

```sql
CREATE TABLE ops_schedule_checklist_item (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    task_id     BIGINT NOT NULL REFERENCES ops_schedule_task(id),
    title       VARCHAR(255) NOT NULL,
    required    BOOLEAN NOT NULL DEFAULT FALSE,
    input_type  VARCHAR(32) NOT NULL DEFAULT 'checkbox',
    options     TEXT,
    value       TEXT,
    checked     BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (input_type IN ('checkbox','text','number','select','attachment'))
);

CREATE INDEX idx_ops_checklist_task ON ops_schedule_checklist_item(task_id, sort_order);
```

### 4.6 ops_schedule_task_log

```sql
CREATE TABLE ops_schedule_task_log (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    task_id     BIGINT NOT NULL REFERENCES ops_schedule_task(id),
    action      VARCHAR(64) NOT NULL,
    operator_id BIGINT,
    content     TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ops_task_log_task ON ops_schedule_task_log(task_id, created_at DESC);
```

### 4.7 ops_schedule_task_link

用于承接任务完成时关联的日报、CI、Prometheus 告警、变更文档、文件或外部链接，支撑详情回显、素材归集和审计追溯。

```sql
CREATE TABLE ops_schedule_task_link (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    task_id     BIGINT NOT NULL REFERENCES ops_schedule_task(id),
    link_type   VARCHAR(32) NOT NULL,
    link_id     BIGINT,
    link_title  VARCHAR(255),
    link_url    VARCHAR(512),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by  BIGINT,
    CHECK (link_type IN ('daily_report','ci_instance','prometheus_alert','change_doc','file','external'))
);

CREATE INDEX idx_ops_task_link_task ON ops_schedule_task_link(task_id, link_type);
CREATE INDEX idx_ops_task_link_object ON ops_schedule_task_link(tenant_id, link_type, link_id)
  WHERE link_id IS NOT NULL;
```

写入规则：

1. `complete` 请求中的 `linkedDailyReportIds` 写 `link_type=daily_report`。
2. `linkedCiInstanceIds` 写 `link_type=ci_instance`。
3. `linkedAlertIds` 写 `link_type=prometheus_alert`。
4. `linkedChangeDocIds` 写 `link_type=change_doc`。
5. 文件附件可写 `link_type=file`，外部材料可写 `link_type=external`。
6. 同一任务提交完成时先删除旧关联，再按请求重建，保证重复提交或补充提交时结果一致。

### 4.8 ops_schedule_notification_log

用于通知幂等和失败重试。

```sql
CREATE TABLE ops_schedule_notification_log (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      VARCHAR(64) NOT NULL DEFAULT 'default',
    task_id        BIGINT NOT NULL REFERENCES ops_schedule_task(id),
    stage          VARCHAR(64) NOT NULL,
    user_id        BIGINT NOT NULL REFERENCES sys_user(id),
    channel        VARCHAR(32) NOT NULL DEFAULT 'notification',
    success        BOOLEAN NOT NULL DEFAULT FALSE,
    error_message  TEXT,
    retry_count    INT NOT NULL DEFAULT 0,
    sent_at        TIMESTAMP,
    last_error_at  TIMESTAMP,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_ops_notification_once
  ON ops_schedule_notification_log(task_id, stage, user_id, channel);
```

`stage` 示例：

```text
created, remind_3d, remind_1d, due_today, unconfirmed, overdue, escalation, completed
```

重试规则：

1. 唯一键仍保证每个任务、阶段、用户、渠道只有一条发送记录。
2. 若记录不存在，先插入 `success=false` 的待发送记录，再执行发送。
3. 若记录已存在且 `success=true`，直接跳过。
4. 若记录已存在且 `success=false`，允许按重试策略再次发送，并更新 `retry_count`、`error_message`、`last_error_at`、`updated_at`。
5. 发送成功后更新 `success=true`、`sent_at=now()`、清空 `error_message`。

### 4.9 ops_schedule_template

```sql
CREATE TABLE ops_schedule_template (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      VARCHAR(64) NOT NULL DEFAULT 'default',
    name           VARCHAR(255) NOT NULL,
    template_type  VARCHAR(32) NOT NULL,
    task_type      VARCHAR(32),
    title_template TEXT,
    body_template  TEXT,
    checklist_json TEXT,
    enabled        BOOLEAN NOT NULL DEFAULT TRUE,
    is_builtin     BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted     BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at     TIMESTAMP,
    deleted_by     BIGINT,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by     BIGINT,
    updated_by     BIGINT,
    CHECK (template_type IN ('notification','checklist','mixed'))
);
```

### 4.10 ops_duty_roster

```sql
CREATE TABLE ops_duty_roster (
    id                 BIGSERIAL PRIMARY KEY,
    tenant_id          VARCHAR(64) NOT NULL DEFAULT 'default',
    duty_date          DATE NOT NULL,
    start_at           TIMESTAMP,
    end_at             TIMESTAMP,
    shift_name         VARCHAR(128) NOT NULL DEFAULT '全天',
    assignee_id        BIGINT NOT NULL REFERENCES sys_user(id),
    backup_assignee_id BIGINT REFERENCES sys_user(id),
    phone_override     VARCHAR(64),
    group_id           BIGINT REFERENCES sys_group(id),
    remark             TEXT,
    is_deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at         TIMESTAMP,
    deleted_by         BIGINT,
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by         BIGINT,
    updated_by         BIGINT
);

CREATE INDEX idx_ops_roster_date ON ops_duty_roster(tenant_id, duty_date) WHERE NOT is_deleted;
CREATE INDEX idx_ops_roster_assignee ON ops_duty_roster(tenant_id, assignee_id, duty_date) WHERE NOT is_deleted;
```

### 4.11 ops_holiday_calendar

```sql
CREATE TABLE ops_holiday_calendar (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL DEFAULT 'default',
    name              VARCHAR(255) NOT NULL,
    start_date        DATE NOT NULL,
    end_date          DATE NOT NULL,
    holiday_type      VARCHAR(32) NOT NULL DEFAULT 'legal',
    workday_overrides TEXT NOT NULL DEFAULT '[]',
    enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    remark            TEXT,
    is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMP,
    deleted_by        BIGINT,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by        BIGINT,
    updated_by        BIGINT,
    CHECK (holiday_type IN ('legal','company','campaign'))
);

CREATE INDEX idx_ops_holiday_range ON ops_holiday_calendar(tenant_id, start_date, end_date)
  WHERE enabled AND NOT is_deleted;
```

### 4.12 RBAC 初始化

```sql
INSERT INTO sys_resource (code, name, actions, sort_order)
VALUES ('ops_calendar', '运维日历', '["read","read_group","read_all","create","update","complete","manage","export"]'::jsonb, 65)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    actions = EXCLUDED.actions,
    sort_order = EXCLUDED.sort_order;

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'ops_calendar'
ON CONFLICT (code) DO NOTHING;
```

角色授权建议：

| 角色 | 权限 |
|---|---|
| member | read、create、complete |
| group_leader | read、read_group、create、update、complete、export |
| admin | 全部 |
| super_admin | 全部 |

---

## 5. 后端接口

统一前缀：

```text
/api/ops-calendar
```

响应沿用 `R<T>` 和 `PageResult<T>`。

### 5.1 查询任务列表

```text
GET /api/ops-calendar/tasks
```

权限：

```text
ops_calendar:read
```

参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| startDate | LocalDate | 是 | 查询开始日期 |
| endDate | LocalDate | 是 | 查询结束日期 |
| scope | string | 否 | mine、group、all、roster、public，默认按角色推断 |
| taskType | string | 否 | 任务类型 |
| status | string | 否 | 任务状态 |
| assigneeId | Long | 否 | 负责人 |
| groupId | Long | 否 | 组织 |

权限规则：

1. `scope=mine`：只需 `read`。
2. `scope=group`：需要 `read_group`，组级用户只能查本组。
3. `scope=all`：需要 `read_all`。
4. `scope=public`：只返回 `visibility=public` 的非敏感摘要。
5. `scope=roster`：返回当前用户相关排班；组长可看本组；管理员可看全部。

响应 `List<TaskVO>`：

```json
{
  "id": 1,
  "title": "2026 Q3 季报提醒",
  "taskType": "report",
  "status": "pending_confirm",
  "plannedStartAt": "2026-09-25T09:00:00",
  "dueAt": "2026-09-30T18:00:00",
  "assigneeId": 8,
  "assigneeName": "张三",
  "assigneePhone": "13800000000",
  "groupId": 2,
  "groupName": "运维组",
  "visibility": "group",
  "publicSummary": null,
  "sensitive": false,
  "canViewDetail": true,
  "canOperate": true
}
```

### 5.2 当日工作项

```text
GET /api/ops-calendar/tasks/day
```

参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| date | LocalDate | 是 | 日期 |
| scope | string | 否 | mine、group、all、roster、public |

响应 `DayTasksVO`：

```json
{
  "date": "2026-07-01",
  "dayOfWeek": "WEDNESDAY",
  "holidayName": null,
  "summary": {
    "total": 6,
    "pending": 2,
    "overdue": 1,
    "completed": 2
  },
  "groups": [
    {
      "key": "todo",
      "label": "待处理",
      "tasks": []
    },
    {
      "key": "roster",
      "label": "排班值守",
      "tasks": []
    }
  ]
}
```

分组由后端返回，前端按返回顺序展示。

### 5.3 查询任务详情

```text
GET /api/ops-calendar/tasks/{id}
```

权限：

```text
ops_calendar:read
```

返回 `TaskDetailVO`，包含：

1. 基础任务字段。
2. 参与人列表。
3. 检查项列表。
4. 附件占位信息，MVP 可先预留。
5. 关联对象列表，来自 `ops_schedule_task_link`。
6. 动态日志。
7. 可操作按钮：`canConfirm`、`canStart`、`canComplete`、`canCancel`、`canCloseException`。

敏感任务规则：

1. `sensitive=true` 且用户无详情权限时，不返回 `content`、`resultSummary`、检查项值和日志详情。
2. 仍可返回 `publicSummary`、日期、类型和状态。

### 5.4 创建临时任务

```text
POST /api/ops-calendar/tasks
```

权限：

```text
ops_calendar:create
```

请求：

```json
{
  "title": "节前数据库巡检",
  "taskType": "inspection",
  "plannedStartAt": "2026-09-29T09:00:00",
  "dueAt": "2026-09-29T18:00:00",
  "assigneeId": 8,
  "groupId": 2,
  "priority": "high",
  "content": "检查核心数据库运行状态和备份状态",
  "visibility": "group",
  "publicSummary": null,
  "sensitive": false,
  "participantIds": [9, 10],
  "recipientIds": [11, 12],
  "escalationUserIds": [3],
  "checklistItems": [
    {
      "title": "检查数据库连接状态",
      "required": true,
      "inputType": "checkbox"
    }
  ]
}
```

创建后：

1. 插入任务。
2. 插入参与人。
3. 插入检查项。
4. 插入 `create` 日志。
5. 发送 `created` 阶段通知给负责人和接收人。

### 5.5 编辑任务

```text
PUT /api/ops-calendar/tasks/{id}
```

权限：

```text
ops_calendar:update
```

限制：

1. 已完成、已取消、异常关闭任务不可直接编辑核心字段。
2. 普通用户只能编辑自己创建且未开始的任务。
3. 组长可编辑本组任务。
4. 管理员可编辑全部任务。

### 5.6 状态操作

#### 确认收到

```text
POST /api/ops-calendar/tasks/{id}/confirm
```

允许状态：

```text
pending_confirm
```

结果：

1. `status` 改为 `not_started`。
2. 写入 `confirmed_at`、`confirmed_by`。
3. 插入 `confirm` 日志。

#### 开始执行

```text
POST /api/ops-calendar/tasks/{id}/start
```

允许状态：

```text
not_started, pending_confirm, overdue
```

结果：

1. `status` 改为 `in_progress`。
2. 写入 `started_at`。
3. 如从 `pending_confirm` 开始，自动补 `confirmed_at`。

#### 提交完成

```text
POST /api/ops-calendar/tasks/{id}/complete
```

请求：

```json
{
  "resultStatus": "normal",
  "resultSummary": "巡检正常，未发现异常告警",
  "riskLevel": "none",
  "checklistValues": [
    {
      "itemId": 1,
      "checked": true,
      "value": "正常"
    }
  ],
  "linkedDailyReportIds": [1],
  "linkedCiInstanceIds": [10, 11],
  "linkedAlertIds": [5],
  "linkedChangeDocIds": []
}
```

校验：

1. 必填检查项必须完成。
2. `resultStatus` 必填。
3. 异常或部分完成时 `resultSummary` 必填。

结果：

1. `status` 改为 `completed`。
2. 写入 `completed_at`、`completed_by`。
3. 更新检查项。
4. 按请求重建 `ops_schedule_task_link`，用于详情页回显和报表素材追溯。
5. 插入 `complete` 日志。

#### 异常关闭

```text
POST /api/ops-calendar/tasks/{id}/close-exception
```

请求：

```json
{
  "reason": "外部系统停机，无法执行巡检",
  "riskLevel": "medium"
}
```

#### 取消任务

```text
POST /api/ops-calendar/tasks/{id}/cancel
```

请求：

```json
{
  "reason": "任务计划变更"
}
```

### 5.7 手动重发提醒

```text
POST /api/ops-calendar/tasks/{id}/remind
```

权限：

```text
ops_calendar:update
```

说明：

1. 手动提醒 stage 使用 `manual:{yyyyMMddHHmmss}`，不受幂等唯一键限制。
2. 记录 `notify` 日志。

### 5.8 工作台卡片

```text
GET /api/ops-calendar/dashboard
```

权限：

```text
ops_calendar:read
```

返回：

```json
{
  "todayTotal": 5,
  "pendingConfirm": 2,
  "overdue": 1,
  "items": [
    {
      "id": 1,
      "title": "今日巡检",
      "taskType": "inspection",
      "status": "pending_confirm",
      "dueAt": "2026-07-01T18:00:00",
      "assigneeName": "张三"
    }
  ],
  "nextHints": [
    {
      "date": "2026-07-04",
      "title": "下周巡检负责人提醒",
      "taskType": "inspection"
    }
  ]
}
```

排序：

1. 已逾期。
2. 今日到期。
3. 待确认。
4. 进行中。
5. 公共重要节点。

### 5.9 周期规则接口

```text
GET    /api/ops-calendar/rules
GET    /api/ops-calendar/rules/{id}
POST   /api/ops-calendar/rules
PUT    /api/ops-calendar/rules/{id}
POST   /api/ops-calendar/rules/{id}/enable
POST   /api/ops-calendar/rules/{id}/disable
POST   /api/ops-calendar/rules/preview
```

权限：

```text
ops_calendar:manage
```

创建请求：

```json
{
  "name": "每季度季报提醒",
  "description": "每季度最后 5 个工作日提醒组长准备季报",
  "taskType": "report",
  "triggerType": "quarterly",
  "triggerConfig": {
    "quarterPosition": "last_workday",
    "offsetWorkdays": -5,
    "time": "09:00"
  },
  "generateDaysAhead": 7,
  "reminderConfig": {
    "stages": [
      { "stage": "created", "offsetHours": 0 },
      { "stage": "remind_1d", "offsetHoursBeforeDue": 24 }
    ]
  },
  "dueConfig": {
    "offsetDays": 5,
    "time": "18:00"
  },
  "assigneeRule": {
    "type": "group_leader",
    "groupId": 2
  },
  "recipientRule": {
    "type": "assignee"
  },
  "escalationRule": {
    "unconfirmedHours": 24,
    "overdueHours": 24,
    "userIds": [3]
  },
  "visibility": "group",
  "sensitive": false
}
```

预览响应：

```json
[
  {
    "plannedStartAt": "2026-09-25T09:00:00",
    "dueAt": "2026-09-30T18:00:00",
    "title": "2026 Q3 季报提醒",
    "occurrenceKey": "preview:2026Q3"
  }
]
```

### 5.10 排班接口

```text
GET  /api/ops-calendar/rosters
POST /api/ops-calendar/rosters
PUT  /api/ops-calendar/rosters/{id}
POST /api/ops-calendar/rosters/check-conflicts
```

权限：

```text
ops_calendar:manage
```

冲突检查返回：

```json
{
  "conflicts": [
    {
      "type": "duplicate_assignee",
      "message": "张三在 2026-10-01 已存在全天值班",
      "rosterId": 12
    }
  ],
  "warnings": [
    {
      "type": "missing_phone",
      "message": "李四缺少手机号"
    }
  ]
}
```

### 5.11 节假日接口

```text
GET  /api/ops-calendar/holidays
POST /api/ops-calendar/holidays
PUT  /api/ops-calendar/holidays/{id}
```

权限：

```text
ops_calendar:manage
```

### 5.12 素材归集接口

```text
GET /api/ops-calendar/report-materials
GET /api/ops-calendar/report-materials/export
```

权限：

```text
ops_calendar:export
```

参数：

| 参数 | 类型 | 说明 |
|---|---|---|
| periodType | string | quarter、semiannual |
| startDate | LocalDate | 开始日期 |
| endDate | LocalDate | 结束日期 |
| groupId | Long | 可选 |

第一版返回素材清单，不自动生成正式报告。

---

## 6. 调度实现

### 6.1 OpsCalendarScheduler

新增：

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class OpsCalendarScheduler {
    @Scheduled(cron = "0 * * * * *")
    public void tick() {
        generateUpcomingTasks();
        sendDueNotifications();
        markOverdueTasks();
        escalateUnconfirmedAndOverdueTasks();
    }
}
```

调度频率：

1. MVP 使用每分钟扫描。
2. 扫描逻辑必须幂等。
3. 多实例部署时需要数据库唯一约束兜底。后续可加分布式锁。

### 6.2 生成任务实例

伪代码：

```text
now = LocalDateTime.now()

# 只取「到点该生成」的规则，命中 idx_ops_rule_next_generate 部分索引，
# 不做全表扫描。next_generate_at 为空的新规则也纳入（首轮初始化）。
rules = enabled rules where not deleted
        AND (next_generate_at IS NULL OR next_generate_at <= now)

for rule in rules:
  windowEnd = now + rule.generateDaysAhead
  occurrences = calculateOccurrences(rule, now, windowEnd)
  for occurrence in occurrences:
    task = buildTask(rule, occurrence)
    insert task with unique(tenant_id, rule_id, occurrence_key)
    if duplicate: skip
    copy checklist template
    create participants
    log create                 # ops_schedule_task_log
    writeAuditLog("ops_calendar", "generate_task", task.id)   # 平台 audit_log，operatorId=0
    notify created
  # 推进下次扫描点：取本规则下一个未来 occurrence，没有则按周期粒度顺延
  rule.last_generated_at = now
  rule.next_generate_at  = nextScanPoint(rule, now)
  update rule
```

`next_generate_at` 维护要点：

1. 新建/启用规则时初始化为 `NULL`（或首个 occurrence 提前 `generateDaysAhead` 的时间点），保证首轮被扫描。
2. 每轮生成后回填为「下一个该生成任务的时间」，避免每分钟空扫。
3. 停用或编辑触发配置时重算 `next_generate_at`。

### 6.3 时间计算

> 阶段说明：cron、周、月、季度、半年的 occurrence 计算属 Phase 2（MVP+）。
> 工作日判断（`isWorkday`）、季度最后 N 个工作日、节前/节后第 N 个工作日等
> **依赖节假日历的工作日推算属 Phase 4**，与 `holiday_relative` 触发类型一并交付。
> Phase 2 的季度规则若需要「最后 N 天」，先按自然日计算，不做工作日跳过。

建议使用：

1. `org.springframework.scheduling.support.CronExpression` 处理 cron。
2. Java `java.time` 处理周、月、季度、半年。
3. `OpsCalendarHolidayService` 判断工作日。

工作日判断：

```text
isWorkday(date):
  if date in holiday range: false
  if date in holiday.workday_overrides: true
  if SAT/SUN: false
  else true
```

季度最后 N 个工作日：

```text
quarterEnd = last day of quarter
date = moveWorkdays(quarterEnd, offsetWorkdays)
```

节前 N 个工作日：

```text
target = moveWorkdays(holiday.startDate, -N)
```

节后第 N 个工作日：

```text
target = moveWorkdays(holiday.endDate, +N)
```

### 6.4 通知发送

`OpsCalendarNotificationService.send(task, stage, users)`：

1. 生成通知标题和正文。
2. 对每个用户读取或创建 `ops_schedule_notification_log(task_id, stage, user_id, channel)`。
3. 如果记录已存在且 `success=true`，直接跳过，保证成功通知不重复发送。
4. 如果记录不存在，插入 `success=false` 的待发送记录。
5. 如果记录已存在且 `success=false`，按重试策略继续发送，并递增 `retry_count`。
6. 调用 `NotificationService.notify`。
7. 成功后写入 `success=true`、`sent_at=now()`、清空错误信息。
8. 失败写入 `error_message`、`last_error_at`，继续其他用户。

模板变量：

| 变量 | 来源 |
|---|---|
| taskTitle | task.title |
| taskType | task.taskType |
| assigneeName | sys_user.real_name or username |
| assigneePhone | sys_user.phone or roster.phone_override |
| startTime | task.planned_start_at |
| dueTime | task.due_at |
| groupName | sys_group.name |
| quarter | 根据 planned_start_at 计算 |
| period | 规则或素材周期 |
| holidayName | 节假日历 |

模板渲染 null-safe 要求：

1. 任一变量取值为空（如负责人未维护 `phone`、任务无 `planned_start_at`）时，**不得渲染出 `null` 字面量**。
2. 缺失变量的处理：占位类（`{assigneePhone}`）渲染为空字符串或整行省略；时间类缺失渲染为「待定」。
3. `assigneePhone` 优先级：`roster.phone_override` > `sys_user.phone` > 空。三者皆空时该行省略，不阻断通知发送。
4. 渲染异常（变量缺失、格式错误）不得中断整个通知批次，按用户粒度兜底。

### 6.5 逾期扫描

规则：

```text
status in pending_confirm, not_started, in_progress
AND due_at < now
```

结果：

1. 更新为 `overdue`。
2. 写入 `overdue` 日志。
3. 发送 `overdue` 阶段通知给负责人。
4. 根据升级规则发送 `escalation`。

### 6.6 未确认升级

规则：

```text
status = pending_confirm
AND created_at + unconfirmedHours < now
```

结果：

1. 不改变任务状态。
2. 发送 `unconfirmed` 通知给负责人。
3. 发送 `escalation` 给升级人。
4. 使用 notification log 防止重复发送。

### 6.7 Handler

接口：

```java
public interface OpsCalendarTaskHandler {
    String taskType();
    default void beforeCreate(OpsScheduleRule rule, TaskOccurrence occurrence) {}
    default void afterCreate(OpsScheduleTask task) {}
    default void beforeNotify(OpsScheduleTask task, String stage) {}
    default void afterComplete(OpsScheduleTask task) {}
}
```

MVP handler：

| Handler | MVP 行为 |
|---|---|
| GenericReminderHandler | 默认生成任务和通知 |
| DailyReportReminderHandler | 生成每日未提交日报提醒，接收人为未提交日报用户 |
| DutyRosterReminderHandler | 从排班表解析负责人和联系方式 |
| WeeklyInspectionReminderHandler | 从下周排班或规则负责人生成巡检提醒 |
| SemiAnnualAggregationHandler | 生成素材归集任务，完成时可跳转素材页 |

---

## 7. 业务规则

### 7.1 可见性

`OpsCalendarVisibilityService` 负责所有查询可见性。

规则：

1. `read_all` 可看全部租户内非删除任务。
2. `read_group` 可看本组任务；管理员传 `groupId` 可筛选任意组。
3. `read` 可看：
   - `assignee_id = currentUser`
   - participant 包含 currentUser
   - created_by = currentUser
   - `visibility = public`
4. `visibility=public` 且无详情权限时，只返回脱敏字段。
5. `sensitive=true` 时，只有负责人、协同人、创建者、组长、管理员可看详情。

### 7.2 操作权限

| 操作 | 允许人 |
|---|---|
| 确认 | 负责人、协同人、管理员 |
| 开始 | 负责人、协同人、管理员 |
| 完成 | 负责人、协同人、管理员 |
| 取消 | 创建者、组长、管理员 |
| 异常关闭 | 负责人、组长、管理员 |
| 编辑 | 创建者、组长、管理员，且状态允许 |
| 重发提醒 | 创建者、组长、管理员 |

### 7.3 状态机

允许流转：

| 当前状态 | 目标状态 | 操作 |
|---|---|---|
| pending_confirm | not_started | confirm |
| pending_confirm | in_progress | start |
| not_started | in_progress | start |
| in_progress | completed | complete |
| overdue | completed | complete |
| pending_confirm/not_started/in_progress | overdue | system_overdue |
| pending_confirm/not_started/in_progress/overdue | exception_closed | close_exception |
| pending_confirm/not_started/in_progress | cancelled | cancel |

禁止：

1. `completed` 后再次完成。
2. `cancelled` 后开始或完成。
3. `exception_closed` 后开始或完成。

### 7.4 审计日志（项目强制规则，必须遵守）

> 依据 CLAUDE.md「强制规则 2」：所有写操作必须在同一事务内写平台 `audit_log`。
> 这与 `ops_schedule_task_log` 不是一回事，两者**都要写**：
> - `ops_schedule_task_log`：领域时间线，展示在任务详情页给业务用户看。
> - `audit_log`：平台级合规审计，统一格式，供审计/管理人员追责。

需写 `audit_log` 的写操作（`module = "ops_calendar"`）：

| 操作 | action | targetType | operatorId |
|---|---|---|---|
| 创建规则 | create | ops_schedule_rule | 当前用户 |
| 编辑/启停规则 | update | ops_schedule_rule | 当前用户 |
| 删除规则 | delete | ops_schedule_rule | 当前用户 |
| 手动创建任务 | create | ops_schedule_task | 当前用户 |
| 编辑任务 | update | ops_schedule_task | 当前用户 |
| 确认/开始/完成/取消/异常关闭 | confirm/start/complete/cancel/close_exception | ops_schedule_task | 当前用户 |
| 调度器生成任务 | generate | ops_schedule_task | `0L`（系统） |
| 创建/编辑排班 | create/update | ops_duty_roster | 当前用户 |
| 创建/编辑节假日 | create/update | ops_holiday_calendar | 当前用户 |

要求：

1. insert/update 与 `audit_log` 写入同一事务，遵循 `beforeJson/afterJson` 快照约定。
2. 调度器自动生成、自动逾期、自动升级等系统操作 `operatorId = 0L`。
3. 通知发送本身不强制写 `audit_log`（已有 `ops_schedule_notification_log` 兜底幂等与留痕）。

---

## 8. 前端实现

### 8.1 路由

主页面：

```text
/ops-calendar
```

管理页面：

```text
/ops-calendar/rules
/ops-calendar/rosters
/ops-calendar/holidays
```

### 8.2 侧边栏

在 `Sidebar.tsx` 中添加一级菜单项，位置在工作台之后、CMDB 之前。

```ts
{
  href: '/ops-calendar',
  label: '运维日历',
  icon: CalendarDays,
  resource: 'ops_calendar',
  action: 'read',
}
```

不要放入流程中心或系统管理 children。

### 8.3 工作台卡片替换

修改 `frontend/src/app/(dashboard)/page.tsx`：

1. 移除主工作区“近期 CMDB 变更”表格卡片。
2. 新增 `DashboardOpsCalendarCard`。
3. 卡片调用 `GET /ops-calendar/dashboard`。
4. 保留 CMDB 变更指标卡或改为普通入口即可。

卡片交互：

1. 点击标题跳转 `/ops-calendar`。
2. 点击任务打开 `TaskDetailDrawer` 或跳转带 query：`/ops-calendar?taskId=1`。
3. 点击“今日”打开 `/ops-calendar?date=2026-07-01&dayDialog=1`。

### 8.4 运维日历页面

状态：

```ts
type CalendarView = 'month' | 'week' | 'list'
type CalendarScope = 'mine' | 'group' | 'all' | 'roster' | 'public'
```

页面 state：

```ts
const [view, setView] = useState<CalendarView>('month')
const [scope, setScope] = useState<CalendarScope>(defaultScopeByUser)
const [currentDate, setCurrentDate] = useState(new Date())
const [selectedDate, setSelectedDate] = useState<string | null>(null)
const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
```

查询：

```ts
useQuery({
  queryKey: ['ops-calendar-tasks', range.start, range.end, scope, filters],
  queryFn: () => api.get('/ops-calendar/tasks', { params })
})
```

### 8.5 月历组件

`CalendarMonthView` props：

```ts
interface CalendarMonthViewProps {
  currentDate: Date
  tasks: TaskVO[]
  onDateClick: (date: string) => void
  onTaskClick: (taskId: number) => void
}
```

布局要求：

1. 7 列网格。
2. 每个日期固定高度，避免任务数量导致布局跳动。
3. 显示最多 3 条任务，超过显示“+N”。
4. 今日高亮。
5. 逾期任务高亮。
6. 公共任务使用淡色和“公共”标签。

### 8.6 当日工作项放大视图

`DayWorkItemsDialog`：

```ts
interface DayWorkItemsDialogProps {
  date: string
  scope: CalendarScope
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskClick: (taskId: number) => void
}
```

行为：

1. 打开时请求 `/ops-calendar/tasks/day`。
2. 顶部显示日期、星期、节假日、统计。
3. 分组展示：待处理、已逾期、排班值守、公共节点、已完成。
4. 已完成默认折叠。
5. 支持上一天、下一天。
6. 每个任务提供快捷操作。

### 8.7 任务详情抽屉

`TaskDetailDrawer`：

1. 请求 `/ops-calendar/tasks/{id}`。
2. 展示基础信息、参与人、检查项、结果、日志。
3. 根据 `canConfirm/canStart/canComplete/...` 展示操作按钮。
4. 完成操作打开结果表单。
5. 操作成功后 invalidate：
   - `ops-calendar-tasks`
   - `ops-calendar-day`
   - `ops-calendar-dashboard`

### 8.8 规则管理

`/ops-calendar/rules`：

1. 表格展示规则名称、类型、周期、负责人规则、启用状态、下次生成时间。
2. 支持新建、编辑、启用、停用、预览。
3. 表单中 `triggerConfig` 用结构化字段编辑，不要求用户直接写 JSON。
4. 高级模式可显示 cron 输入。

### 8.9 排班和节假日

`/ops-calendar/rosters`：

1. 按日期范围查询排班。
2. 表格编辑。
3. 冲突检查。
4. 缺少联系方式提示。

`/ops-calendar/holidays`：

1. 维护节假日名称、日期范围、类型、调休工作日。
2. 支持启用/停用。

---

## 9. 内置规则和模板

迁移中应插入内置模板，默认不一定全部启用。

### 9.1 内置规则

| 名称 | 类型 | 默认启用 | 说明 |
|---|---|---:|---|
| 日报未提交提醒 | daily_report | 是 | 替代旧日报提醒配置 |
| 下周巡检负责人提醒 | inspection | 否 | 每周五提醒 |
| 季报提醒 | report | 否 | 每季度最后 5 个工作日 |
| 季度用户核查 | compliance | 否 | 每季度第 1 个工作日 |
| 季度密码更新 | compliance | 否 | 每季度第 1 个工作日 |
| 季度考核模板发送 | report | 否 | 每季度最后 3 个工作日 |
| 监控数据分析提醒 | monitoring | 否 | 每季度最后 5 个工作日 |
| 半年报归集 | report | 否 | 每半年最后 10 个工作日 |
| 节前营前巡检 | inspection | 否 | Phase 4 启用，节前 2 个工作日；Phase 2 可用手工任务或固定日期规则覆盖 |
| 节后恢复巡检 | inspection | 否 | Phase 4 启用，节后第 1 个工作日；Phase 2 可用手工任务或固定日期规则覆盖 |
| 节假日排班提醒 | roster | 否 | Phase 4 启用，节前 1 个工作日；Phase 2 可用固定日期规则或手动提醒覆盖 |

### 9.2 日报提醒迁移策略

> 设计决策（2026-06-30）：日报数据是周报、月报、季报、半年报的基础数据，**不降级为纯通知**。
> `daily_report` 保留为一等任务类型，纳入素材归集。
> 但为避免「每个未提交者每天一条可闭环任务」淹没日历，生成策略采用
> **「每天一条汇总跟踪任务 + 向未提交者扇出通知」**：
> - 每天按规则生成 **1 条** `daily_report` 汇总任务（`occurrence_key = {ruleId}:{date}:daily_report`），
>   记录当日应提交数、已提交数、未提交名单，作为周/月/季报素材来源。
> - 由 `DailyReportReminderHandler` 在通知阶段向**当天未提交日报的用户**逐个扇出站内信和邮件，
>   通知幂等由 `ops_schedule_notification_log(task_id, stage, user_id, channel)` 控制（每人每天每阶段一次）。
> - 该汇总任务可由管理员/组长查看完成情况，不要求每个普通用户对它做 confirm/complete。

1. 保留旧配置项，作为迁移读取来源。
2. 新增内置规则「日报未提交提醒」（`task_type = daily_report`，默认启用）。
3. 首次迁移时：
   - `enabled` 取 `notify.reminder.enabled`
   - cron 取 `notify.reminder.cron`
   - 模板取 `notify.reminder.template`
4. 旧 `DailyReportReminderScheduler` 改为停用或删除，避免重复提醒。
5. `DailyReportReminderHandler` 查询当天未提交日报用户，按上述「汇总任务 + 扇出通知」策略执行。

---

## 10. 实施步骤

### Phase 1：后端基础

1. 新增 Flyway 表和 RBAC。
2. 新增实体、Mapper、DTO。
3. 实现任务 CRUD。
4. 实现任务状态操作。
5. 实现可见性服务。
6. 实现通知服务和通知幂等。
7. 实现工作台 `/dashboard` 接口。

### Phase 2：调度与规则

1. 实现规则 CRUD（写操作同事务写 `audit_log`，见 7.4）。
2. 实现规则预览。
3. 实现 `OpsCalendarScheduler`（按 `next_generate_at <= now` 过滤，见 6.2，不全表扫描）。
4. 实现 cron、周、月、季度、半年时间计算（**不含 holiday_relative，推到 Phase 4**）。
5. 实现逾期扫描和未确认升级。
6. 迁移日报提醒（汇总任务 + 扇出通知，见 9.2）。

### Phase 3：前端主体验

1. 新增一级菜单。
2. 新增 `/ops-calendar` 页面。
3. 实现月历、周视图、列表视图。
4. 实现当日工作项放大视图。
5. 实现任务详情抽屉。
6. 工作台替换卡片。

### Phase 4：管理能力

1. 规则管理页面。
2. 排班管理页面。
3. 节假日历页面。
4. 模板管理，或在规则表单中内联模板。
5. 素材归集入口。
6. **节假日相对触发（holiday_relative）**：工作日推算（`isWorkday`、季末/节前/节后第 N 个工作日），见 6.3。依赖节假日历页面先就绪。

---

## 11. 测试计划

### 11.1 后端单元测试

建议覆盖：

1. 状态机合法流转。
2. 必填检查项校验。
3. scope=mine/group/all/public 可见性。
4. 敏感任务脱敏。
5. 周期规则预览。
6. 工作日计算（Phase 4，随 holiday_relative）。
7. 季度最后 N 个工作日（Phase 4）。
8. 节前/节后相对日期（Phase 4）。
9. 通知幂等。
10. 逾期扫描。
11. 调度按 `next_generate_at` 过滤，不重复生成（见 6.2）。
12. 写操作同事务写 `audit_log`（见 7.4）。
13. 通知模板 null-safe 渲染（phone/时间为空不报错、不出现 null 字面量）。

### 11.2 后端集成测试

建议覆盖：

1. 创建任务 -> 查询日历 -> 当日工作项 -> 详情。
2. 创建任务 -> 确认 -> 开始 -> 完成。
3. 周期规则生成任务，重复扫描不重复生成。
4. 逾期任务自动更新状态。
5. 日报提醒 handler 只提醒未提交用户。

### 11.3 前端测试

建议覆盖：

1. 月历渲染任务。
2. 点击日期打开当日工作项。
3. 点击任务打开详情抽屉。
4. 快捷操作后列表刷新。
5. scope 切换重新请求。
6. 工作台卡片展示今日、逾期、待确认。

### 11.4 验收用例

| 用例 | 预期 |
|---|---|
| 普通用户进入运维日历 | 默认显示我的日历 |
| 组长进入运维日历 | 默认显示本组日历 |
| 管理员进入运维日历 | 默认显示全局日历 |
| 点击某天 | 打开当日工作项放大视图 |
| 创建季度季报规则 | 能预览未来 3 次触发时间 |
| 调度器运行 | 生成任务且不重复 |
| 任务逾期 | 状态变为已逾期并发送提醒 |
| 工作台 | 显示运维日历卡片，不再显示近期 CMDB 变更主卡片 |

---

## 12. 注意事项

1. `docs/*` 当前被 `.gitignore` 忽略，新增文档需要强制 add 或调整忽略规则。
2. 所有 JSON 配置字段 MVP 可用 `TEXT` 存储，Java 层用 Jackson 解析；后续可迁移 JSONB。
3. 调度器必须以数据库唯一约束作为幂等兜底。
4. 通知发送失败不能中断整个调度批次。
5. 不要在前端直接推断敏感字段可见性，后端必须脱敏。
6. 日历日期范围查询要限制最大跨度，建议不超过 120 天。
7. MVP 附件可先复用现有文件能力或预留字段，不阻塞任务闭环。
8. 调度器 tick **不得全表扫描所有规则**：生成阶段按 `next_generate_at <= now`（命中 `idx_ops_rule_next_generate`）过滤，每次生成后回写 `next_generate_at`/`last_generated_at`；提醒/逾期/升级阶段按 `due_at` 范围 + 状态过滤，命中既有索引。
9. **所有写操作必须在同一事务内写平台 `audit_log`**（项目强制规则 2），与领域表 `ops_schedule_task_log` 并存、不可互相替代。系统自动操作 `operatorId=0L`。详见 7.4。
