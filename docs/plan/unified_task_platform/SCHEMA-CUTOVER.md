# 统一任务平台 Schema 增量迁移方案

**状态：** 实施中  
**适用环境：** 现有开发、测试、演示及后续正式环境  
**核心策略：** 保护现有数据库，通过 V80 之后的 Flyway 增量迁移新增统一任务模型；消费者切换后仅定向清理被统一任务替代的旧日报、旧运维任务及其专属关联物。

---

## 1. 数据保护边界

本项目不得清空、重建或整体替换现有数据库。

本次增量升级必须保护：

- 既有 V1-V79 Flyway 文件、版本号、内容和 checksum。
- 用户、组织、RBAC、CMDB、设备、变更文档、Wiki、共享文件、通知、配置、审计等其他正式业务模块的表及数据；本项目不得删除或重构这些模块的 schema。
- `ops_duty_roster` 与 `ops_holiday_calendar` 中经台账确认有终态用途的结构和数据；统一任务的值班人解析、工作日/相对节假日计算和日历设置继续直接使用这两个业务集合。本项目不以字段消费者审计为由清理其结构。
- Wiki、变更文档等仍在使用的 Flowable 定义、实例、绑定和业务映射。
- 现有 `flyway_schema_history`，通过正常 `migrate` 向后升级。

已确认无需保留、可在消费者切换后删除的数据包括：

- 旧独立日报及其审批、提醒、通知引用和流程绑定数据。
- 旧 `ops_schedule_*` 运维任务、规则、模板、素材/检查项、参与人、日志和通知幂等数据。
- 重复的流程用户待办/审批兼容对象中，仅服务旧日报或旧运维任务的部分。

其他正式业务模块的表、列和数据不属于本项目删除范围。WP-09/WP-10 只核验旧日报、旧 `ops_schedule_*`、它们的专属权限/配置/API/页面，以及共享表中精确属于旧任务域的目标行；除这些对象和明确只服务一次性切换的重复模型外，不创建删除 migration。

即使目标域数据允许删除，也必须等 WP-09 的消费者、API 和代码完成切换后，再由单独的增量 migration 定向删除。

对象级去留、字段用途和共享表行级删除条件以 `SCHEMA-OBJECT-LEDGER.md` 为准。终态不得用“历史存在”或“旧代码仍引用”作为保留理由。

---

## 2. 禁止事项

- 不修改、删除、重命名已经执行过的 V1-V79 migration。
- 不把 Flyway `locations` 切换到另一套全库 baseline。
- 不执行 `DROP DATABASE`、`DROP SCHEMA CASCADE` 或全库清理。
- 不使用全库 `pg_dump` 结果覆盖现有迁移链。
- 不通过 Flyway `repair` 掩盖历史 migration checksum 变化。
- 不使用无对象清单的 `CASCADE` 删除目标表。
- 不删除共享 MinIO bucket、Redis 数据库或 Flowable 全部运行数据。
- 不在消费者仍引用旧表时提前执行目标域 drop migration。

---

## 3. 迁移序列

现有 V1-V79 保持原样。统一任务平台从 V80 继续：

```text
V80  新增统一任务核心 schema
V81  新增统计与自动化 schema
V82  新增统一任务/审批/工作台/日历设置权限
V83  初始化简易任务、工作日报、基础巡检模板
V84+ 后续工作包所需的审批、统计和自动化增量变更
目标域清理版本（WP-09） 定向删除旧日报、旧 ops_schedule 和专属流程对象
平台收口版本（WP-09/WP-10） 仅验证旧日报和旧 ops_schedule 目标域零残留；不得删除其他正式业务模块对象
```

版本号如因实施期间增加 migration 而顺延，以仓库当前最大版本为准；禁止为了保持本表编号而改写已执行版本。

### 3.1 V80-V83 过渡期

V80-V83 只新增统一任务能力，不删除旧表。原因是 WP-05 至 WP-08 期间旧 Controller/Service 仍会被 Spring 装配，提前删除表会使现有应用路径失效。

这不是最终双写或兼容设计：

- 新功能只写统一任务表。
- 旧功能只在其消费者尚未切换期间保持可运行。
- WP-09 切换全部消费者后，在同一工作包物理删除旧代码和旧表。
- 最终构建和 schema 不保留旧 API、页面、类、权限或表。

### 3.2 后续 schema 变更

统一任务平台后续字段、约束或索引继续使用新的递增 migration，不修改 V80-V83。发布前 migration 同样视为不可变历史，以确保已有开发数据库能够连续升级。

---

## 4. 新增统一任务对象

按 `DATA-MODEL.md` 增量创建：

```text
task_template
task_template_version
task_template_field
task_plan
task_plan_generation
task_instance
task_participant
task_draft
task_draft_attachment
task_submission
task_submission_attachment
task_submission_reference
task_event
approval_scheme
approval_scheme_version
approval_round
approval_action
task_notification_delivery
task_field_fact
task_metric_definition
task_metric_binding
task_metric_fact
task_analytics_dashboard
task_analytics_widget
task_metric_goal
task_relation
task_automation_rule
task_automation_execution
task_analytics_subscription
```

新增表不得覆盖或替换同名既有对象；如升级测试发现命名冲突，必须先审计对象来源和数据用途，再决定增量兼容方式。

---

## 5. WP-09 定向清理对象

### 5.1 日报

在日报页面、API、服务、通知、导出、CMDB 引用和 Flowable 适配全部切换后，删除：

```text
daily_report_approval
daily_report
```

同时删除：

- `daily_report:*` 权限与资源。
- 日报专属 `sys_config` 项。
- `business_type='daily_report'` 的流程绑定和业务实例映射。
- 仅支持日报的模板业务类型声明、触发器和函数。
- 指向 `/daily/*` 的通知引用；若历史通知无法转换，按目标域数据删除，不影响其他通知。

### 5.2 旧运维任务与 schedule

在运维日历改读统一任务 API 后，按外键从叶子到根删除：

```text
ops_schedule_notification_log
ops_schedule_task_link
ops_schedule_task_log
ops_schedule_checklist_item
ops_schedule_task_participant
ops_schedule_task
ops_schedule_template
ops_schedule_rule
```

仅确认终态继续使用以下业务集合和表名，不承诺历史列原样保留：

```text
ops_duty_roster
ops_holiday_calendar
```

两表每一列仍按 `SCHEMA-OBJECT-LEDGER.md` 独立判定。当前没有正式消费者的列必须在 WP-06 补齐产品能力和验收证据，否则在 WP-09 使用后续递增 migration 删除；不得因为实体继承 `BaseEntity`、ORM 仍会自动填充或旧页面曾经展示过就保留。

同时删除 `ops_calendar:*` 旧权限，排班/节假日改用 `calendar_settings:*`，日历任务读取使用 `task:read*`。

### 5.3 流程中心

保留通用 Flowable 和仍被 Wiki、变更文档等模块使用的：

```text
workflow_template
workflow_template_instance
workflow_process_binding
workflow_business_instance
Flowable ACT_* 表及非目标业务数据
```

只删除旧日报/旧运维任务对应的行、配置和专属代码。不得 truncate 或 drop 通用 workflow 表。

### 5.4 删除方式

- 清理 migration 使用显式对象名和受限 `DELETE ... WHERE business_type/...`。
- 删除目标表不使用 `CASCADE`；若存在未预期依赖，应让 migration 失败并补齐消费者审计。
- 删除前先清目标域外键行和目标域通知/流程映射。
- 每个删除对象必须在 `SCHEMA-OBJECT-LEDGER.md` 和 `IMPLEMENTATION-STATUS.md` 中有替代物和验证证据。
- `audit_log` 等共享表按精确 `target_type` 清理，不得按 `module='ops_calendar'` 整体删除，以免误删排班/节假日审计。

### 5.5 新对象也必须证明用途

V80-V83 创建的对象不是天然永久保留。审批、统计、看板、自动化和订阅表在对应工作包完成前标记为 `IMPLEMENT_OR_DROP`；WP-10 前没有正式写入、查询/展示和验收链路的对象，必须通过后续增量 migration 删除。

### 5.6 旧任务域历史对象收口

WP-09/WP-10 必须审计日报和旧运维任务的全部旧对象，并逐项登记：

- 表是否对应正式产品能力，是否存在非过渡性的写入和读取链路。
- 每一列是否被 API、服务、页面、作业、审计追溯或数据库不变量使用。
- 索引、外键、CHECK、触发器和函数是否仍保护真实查询或业务不变量。
- 同一能力是否存在新旧两套表、ACL/RBAC 关系、配置或迁移状态模型。
- 当前消费者是否仅用于迁移、灰度、兼容、影子比对、回滚或历史修复。

判定规则：

1. 正式终态能力和非过渡消费者同时成立，才可标记 `KEEP`。
2. 仅被过渡代码引用的对象标记 `TRANSITIONAL_REVIEW`，完成切换后默认删除；如需转为长期能力，必须补充产品入口、权限、生命周期和验收证据。
3. 无运行时消费者的对象不能保留；只有审计/合规价值时，也必须有正式查询或归档策略，不能以“可能以后有用”为理由留表。
4. 重复数据模型先制定转换和校验，再删除旧模型；不得用双写或永久兼容视图代替收口。
5. 所有删除均使用显式递增 migration，并以其他业务模块哨兵数据和升级/全新安装一致性测试证明安全。

---

## 6. 升级验证策略

### 6.1 已有数据库升级测试

Testcontainers 必须分两阶段执行：

1. 从空 PostgreSQL 执行现有 V1-V79，模拟已部署数据库。
2. 在非目标模块写入哨兵数据。
3. 再执行 V80 之后的 migration。
4. 验证原 `flyway_schema_history` 连续、历史 checksum 不变。
5. 验证非目标表和哨兵数据仍存在。
6. 验证新任务表、权限、模板、约束和索引存在。
7. WP-09 后验证只有目标旧对象被删除。

### 6.2 全新安装测试

同一 `classpath:db/migration` 从 V1 一次执行到最新版本，验证：

- 所有平台模块 schema 可用。
- 新任务能力可用。
- WP-09 之后目标旧表最终不存在。
- 不存在第二套 Flyway location 或需要手工 repair 的 checksum。

### 6.3 真实环境

自动化测试只连接隔离 Testcontainers。对真实开发/测试数据库执行迁移前仍需：

- 确认连接环境与备份策略。
- 备份数据库或至少目标域表。
- 评估目标域数据删除窗口。
- 停止会写旧日报/旧 schedule 表的应用版本。
- 先部署完成消费者切换的代码，再运行最终清理 migration。

AI 未经用户明确要求不得主动连接真实数据库执行迁移。

---

## 7. 验收查询

在消费者切换和旧任务域对象审计完成前，升级过程不得误删下列当前仍有正式消费者的对象：

```sql
SELECT to_regclass('public.sys_user'),
       to_regclass('public.ci_instance'),
       to_regclass('public.change_doc'),
       to_regclass('public.wiki_space'),
       to_regclass('public.ops_duty_roster'),
       to_regclass('public.ops_holiday_calendar');
```

这条查询只验证迁移阶段没有提前破坏现有消费者，不是终态 schema 白名单。最终仍须按对象台账删除无消费者的表、列、索引、约束、触发器、函数、配置和权限。

统一任务对象必须存在：

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'task_%';
```

WP-09 最终清理后，目标旧表必须为零：

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'daily_report','daily_report_approval','ops_schedule_rule','ops_schedule_task',
    'ops_schedule_task_participant','ops_schedule_checklist_item',
    'ops_schedule_task_log','ops_schedule_task_link',
    'ops_schedule_notification_log','ops_schedule_template'
  );
```

同时验证 `daily_report:*`、`ops_calendar:*` 权限为零，非目标业务的 workflow binding 和历史实例数量不减少。

此外必须按 `SCHEMA-OBJECT-LEDGER.md` 审计列、索引、触发器、函数、配置和 seed，不得把“旧表名为零”当成零垃圾的充分条件。

---

## 8. 回滚与故障处理

- migration 执行失败时依赖 Flyway/PostgreSQL 事务回滚，不执行 repair 后强行继续。
- V80+ 仅新增阶段可通过回退应用代码并保留未使用新表应急；修复仍用下一版本 migration。
- WP-09 删除目标数据前必须有数据库备份；删除后的数据恢复依赖备份，不依赖旧运行时代码或双写。
- 非目标数据出现变化视为 P0，立即停止迁移并定位 SQL，不接受“系统未上线”作为清空理由。
