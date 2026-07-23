# 统一任务平台数据模型

**状态：** 待实施  
**数据库：** PostgreSQL  
**ORM：** MyBatis-Plus  
**前提：** 保护现有数据库和 V1-V79 migration 历史；旧日报和旧运维任务数据在消费者切换后定向删除；用户、RBAC、CMDB、设备、Wiki、共享文件、通知等其他正式业务模块的表列保持不变。

---

## 1. 目标

数据模型必须同时满足：

- 模板和审批方案版本不可变。
- 一次性与周期任务统一。
- 草稿可修改，正式提交不可变。
- 任务状态和审批状态分离。
- CI 范围条件与实际命中快照分离。
- 统计事实可追溯到原始提交字段。
- 租户、权限、软删除和审计边界明确。
- 旧日报和 `ops_schedule_*` 表在 WP-09 终态清理后不存在。

---

## 2. 命名与通用约定

### 2.1 表前缀

| 领域 | 前缀 |
| --- | --- |
| 任务模板/计划/实例/提交 | `task_` |
| 审批业务映射 | `approval_` |
| 统计/看板 | `task_metric_`、`task_analytics_` |
| Flowable | 保留 Flowable 自有表名 |

### 2.2 主键与租户

- 业务表使用 `BIGSERIAL/BIGINT` 主键。
- 所有租户业务表包含 `tenant_id VARCHAR(64) NOT NULL`。
- 外键引用业务对象时，同时在服务层校验 tenant；重要组合可使用复合唯一约束支持数据库级一致性。
- 全局内置定义如果跨租户共享，使用独立 system 表或 `tenant_id='system'`，不得混用空 tenant。

### 2.3 时间与版本

- 使用 `TIMESTAMP`，应用层统一按项目时区策略处理。
- 业务日期使用 `DATE`。
- 模板版本、提交版本、审批轮次使用从 1 开始的整数。
- 并发修改表使用 `lock_version INT NOT NULL DEFAULT 0` 或 MyBatis-Plus `@Version`。

### 2.4 删除策略

- 可配置资产（模板、计划、看板）使用软删除和生命周期状态。
- 正式提交、审批动作、任务事件、事实记录只允许失效，不物理删除。
- 草稿可随任务删除或测试清理物理删除。
- 任务实例正式产生后默认软删除/取消，不物理删除。

### 2.5 JSONB 使用边界

适合 JSONB：

- 模板字段复杂配置。
- 表单原始数据和布局。
- 受控条件/公式 AST。
- 分配、提醒、升级和 CI 范围规则。
- 审批字段/附件意见。
- 统计组件配置。

不适合只存 JSONB：

- 任务状态、负责人、时间、模板版本等常用过滤字段。
- 需要索引和聚合的正式指标事实。
- 附件、参与人和审批动作等一对多审计记录。

---

## 3. 关系概览

```text
task_template
  └─ task_template_version
       └─ task_template_field
            └─ task_metric_binding

task_plan
  └─ task_instance
       ├─ task_participant
       ├─ task_draft
       ├─ task_submission
       │    ├─ task_submission_attachment
       │    ├─ task_submission_reference
       │    ├─ task_field_fact
       │    └─ task_metric_fact
       ├─ approval_round
       │    └─ approval_action
       └─ task_event

approval_scheme
  └─ approval_scheme_version

task_metric_definition
  ├─ task_metric_binding
  └─ task_metric_fact

task_analytics_dashboard
  └─ task_analytics_widget

task_metric_goal

task_automation_rule
  └─ task_automation_execution

task_instance
  └─ task_relation

task_analytics_dashboard
  └─ task_analytics_subscription
```

---

## 4. 模板模型

### 4.1 `task_template`

模板身份与生命周期，不直接保存可变字段定义。

| 字段 | 类型 | 约束/说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id` | VARCHAR(64) | NOT NULL |
| `code` | VARCHAR(100) | 租户内稳定编码 |
| `name` | VARCHAR(255) | NOT NULL |
| `category` | VARCHAR(100) | 可筛选分类 |
| `description` | TEXT | 模板说明 |
| `status` | VARCHAR(32) | `draft/published/deprecated/archived` 的模板总体状态 |
| `latest_version_id` | BIGINT | 当前最新版本，可空避免创建循环 FK 时先插入 |
| `builtin` | BOOLEAN | 系统内置标记 |
| `scope_type` | VARCHAR(32) | `tenant/group/private` |
| `owner_group_id` | BIGINT | 组模板所属组，可空 |
| `created_by/updated_by` | BIGINT | 操作人 |
| `created_at/updated_at` | TIMESTAMP | 时间 |
| `is_deleted/deleted_at/deleted_by` | ... | 软删除 |

约束：

```text
UNIQUE active (tenant_id, code)
CHECK scope_type IN ('tenant','group','private')
```

### 4.2 `task_template_version`

每次发布生成不可变快照。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id` | VARCHAR(64) | NOT NULL |
| `template_id` | BIGINT | FK task_template |
| `version` | INT | 从 1 递增 |
| `status` | VARCHAR(32) | `draft/published/deprecated` |
| `name_snapshot` | VARCHAR(255) | 发布时名称 |
| `description_snapshot` | TEXT | 发布时说明 |
| `instructions` | TEXT | 富文本说明，存储需清洗 |
| `layout_schema` | JSONB | 区块、分栏、顺序 |
| `completion_policy` | JSONB | 完成条件 |
| `default_assignment` | JSONB | 默认分配建议 |
| `default_reminder` | JSONB | 默认提醒建议 |
| `default_approval_scheme_version_id` | BIGINT | 可空 |
| `published_by/published_at` | ... | 发布信息 |
| `created_by/created_at/updated_at` | ... | 草稿信息 |

约束：

```text
UNIQUE (tenant_id, template_id, version)
published 记录禁止 UPDATE 字段定义
```

不可变性优先由应用服务保证，并通过集成测试验证；如采用数据库触发器，必须只保护 published 行且错误可读。

### 4.3 `task_template_field`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id` | VARCHAR(64) | NOT NULL |
| `template_version_id` | BIGINT | FK |
| `field_key` | VARCHAR(100) | 版本内稳定唯一 |
| `label` | VARCHAR(255) | NOT NULL |
| `field_type` | VARCHAR(50) | 注册类型 |
| `sort_order` | INT | 顺序 |
| `required` | BOOLEAN | 静态必填 |
| `default_value` | JSONB | 类型化默认值 |
| `validation_config` | JSONB | 范围、长度等 |
| `display_config` | JSONB | 布局、提示等 |
| `visibility_config` | JSONB | 角色可见性 |
| `condition_config` | JSONB | 显示/必填条件 AST |
| `formula_config` | JSONB | 公式 AST，可空 |
| `analytics_config` | JSONB | 指标/维度语义 |
| `sensitive` | BOOLEAN | 敏感字段 |
| `created_at` | TIMESTAMP | 创建时间 |

约束：

```text
UNIQUE (template_version_id, field_key)
```

表格列和 repeater 子字段可以：

- 首选使用同表 `parent_field_id` 表达树形字段；或
- 保存在 `validation/display` JSONB。

正式实现建议增加 `parent_field_id` 与 `path`，便于统计表格列和字段级意见引用。

---

## 5. 审批方案模型

### 5.1 `approval_scheme`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id` | VARCHAR(64) | NOT NULL |
| `code/name/description` | ... | 方案身份 |
| `status` | VARCHAR(32) | `draft/published/deprecated/archived` |
| `latest_version_id` | BIGINT | 最新版本 |
| `scope_type/owner_group_id` | ... | 可用范围 |
| BaseEntity 字段 | ... | 审计/软删 |

### 5.2 `approval_scheme_version`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `scheme_id/tenant_id/version` | ... | 唯一版本 |
| `status` | VARCHAR(32) | 草稿/发布/停用 |
| `definition_config` | JSONB | 结构化节点与动作配置 |
| `process_definition_id` | VARCHAR(255) | 具体 Flowable 版本 |
| `process_definition_key/version` | ... | 冗余追溯 |
| `published_by/published_at` | ... | 发布信息 |

约束：

```text
UNIQUE (tenant_id, scheme_id, version)
```

---

## 6. 计划模型

### 6.1 `task_plan`

一次性与周期性统一保存。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id` | VARCHAR(64) | NOT NULL |
| `name/description` | ... | 计划说明 |
| `template_version_id` | BIGINT | 固化模板版本 |
| `approval_scheme_version_id` | BIGINT | 可空，固化审批版本 |
| `schedule_type` | VARCHAR(32) | once/daily/... |
| `schedule_config` | JSONB | 时间规则 |
| `generation_mode` | VARCHAR(32) | per_user/per_group/shared/single |
| `assignment_rule` | JSONB | 人员、组、排班规则 |
| `ci_scope_config` | JSONB | 计划级 CI 动态范围，可空 |
| `reminder_config` | JSONB | 提醒阶段 |
| `escalation_config` | JSONB | 逾期升级 |
| `generate_ahead_days` | INT | 提前生成 |
| `start_date/end_date` | DATE | 生效窗口 |
| `status` | VARCHAR(32) | draft/active/paused/finished/archived |
| `next_generate_at/last_generated_at` | TIMESTAMP | 调度游标 |
| `lock_version` | INT | 并发 |
| BaseEntity 字段 | ... | 审计/软删 |

### 6.2 `task_plan_generation`

调度运行与 occurrence 审计，可支持失败重试。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id/plan_id` | ... | 计划 |
| `occurrence_key` | VARCHAR(255) | 稳定幂等键 |
| `occurrence_at` | TIMESTAMP | 发生时间 |
| `subject_type/subject_id` | VARCHAR/BIGINT | user/group/shared |
| `status` | VARCHAR(32) | pending/succeeded/failed/skipped |
| `task_id` | BIGINT | 成功任务，可空 |
| `error_code/error_message` | ... | 失败摘要，不含敏感数据 |
| `attempt_count/last_attempt_at` | ... | 重试 |

约束：

```text
UNIQUE (tenant_id, plan_id, occurrence_key)
```

---

## 7. 任务运行模型

### 7.1 `task_instance`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id` | VARCHAR(64) | NOT NULL |
| `plan_id` | BIGINT | 可空，手工任务可无计划 |
| `template_version_id` | BIGINT | NOT NULL |
| `approval_scheme_version_id` | BIGINT | 可空 |
| `occurrence_key` | VARCHAR(255) | 计划任务幂等键，可空 |
| `title/description_snapshot` | ... | 运行时标题/说明 |
| `business_date` | DATE | 统计业务日期 |
| `planned_start_at/due_at` | TIMESTAMP | 时间 |
| `execution_status` | VARCHAR(32) | 状态机 |
| `approval_status` | VARCHAR(32) | 独立状态 |
| `priority` | VARCHAR(16) | low/normal/high/critical |
| `owner_user_id/owner_group_id` | BIGINT | 主负责人/归属组 |
| `owner_user_snapshot` | JSONB | 姓名等历史快照 |
| `owner_group_snapshot` | JSONB | 组历史快照 |
| `current_draft_id` | BIGINT | 可空 |
| `current_submission_id` | BIGINT | 可空 |
| `current_approval_round_id` | BIGINT | 可空 |
| `started_at/completed_at/cancelled_at` | TIMESTAMP | 状态时间 |
| `cancelled_by/close_reason` | ... | 终止信息 |
| `visibility` | VARCHAR(32) | private/group/tenant |
| `sensitive` | BOOLEAN | 敏感任务 |
| `lock_version` | INT | 并发 |
| BaseEntity 字段 | ... | 审计/软删 |

索引：

```text
(tenant_id, owner_user_id, execution_status, due_at)
(tenant_id, owner_group_id, execution_status, due_at)
(tenant_id, business_date)
(tenant_id, template_version_id, business_date)
UNIQUE active (tenant_id, plan_id, occurrence_key) WHERE plan_id IS NOT NULL
```

### 7.2 `task_participant`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id/task_id/user_id` | ... | 参与关系 |
| `role` | VARCHAR(32) | owner/collaborator/copied/escalation |
| `user_snapshot/group_snapshot` | JSONB | 生成时快照 |
| `created_at/created_by` | ... | 审计 |

约束：

```text
UNIQUE (task_id, user_id, role)
```

### 7.3 `task_draft`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id/task_id` | ... | 一任务一草稿 |
| `form_data` | JSONB | 当前草稿 |
| `reference_data` | JSONB | CI/关联对象选择条件与当前值 |
| `revision` | INT | 乐观并发 |
| `last_saved_by/last_saved_at` | ... | 自动保存 |

约束：

```text
UNIQUE (tenant_id, task_id)
```

### 7.4 `task_submission`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id/task_id/template_version_id` | ... | 来源 |
| `version` | INT | 任务内递增 |
| `form_data` | JSONB | 不可变原文 |
| `computed_data` | JSONB | 后端公式结果 |
| `reference_snapshot` | JSONB | 关联对象总快照 |
| `submitter_id/submitter_snapshot` | ... | 提交人 |
| `organization_snapshot` | JSONB | 提交时组织 |
| `submitted_at` | TIMESTAMP | 时间 |
| `status` | VARCHAR(32) | current/pending_review/approved/changes_requested/superseded/terminated |
| `effective` | BOOLEAN | 是否进入正式统计 |
| `supersedes_submission_id` | BIGINT | 前一版本 |
| `content_hash` | VARCHAR(64) | 可选，完整性/幂等 |

约束：

```text
UNIQUE (tenant_id, task_id, version)
```

### 7.5 `task_submission_attachment`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id/submission_id/task_id` | ... | 来源 |
| `field_key` | VARCHAR(100) | 所属字段 |
| `storage_key` | VARCHAR(512) | MinIO 对象键 |
| `file_name/content_type/size` | ... | 元数据 |
| `category/description` | ... | 分类说明 |
| `checksum` | VARCHAR(128) | 完整性 |
| `uploaded_by/uploaded_at` | ... | 审计 |
| `sensitive` | BOOLEAN | 敏感附件 |

草稿附件建议单独使用 `task_draft_attachment`，提交时复制元数据/引用并冻结；对象存储清理由引用计数或补偿任务负责。

### 7.6 `task_submission_reference`

保存规范化关联与 CI 快照，便于反向查询。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id/task_id/submission_id` | ... | 来源 |
| `field_key` | VARCHAR(100) | 所属字段 |
| `reference_type` | VARCHAR(50) | ci_instance/ci_model/ci_model_group/... |
| `reference_key` | VARCHAR(255) | ID 或稳定编码 |
| `reference_snapshot` | JSONB | 名称、模型、组、状态等 |
| `source_level` | VARCHAR(32) | group/model/instance |
| `created_at` | TIMESTAMP | 时间 |

索引：

```text
(tenant_id, reference_type, reference_key)
(submission_id, field_key)
```

### 7.7 `task_event`

业务时间线。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id/task_id` | ... | 任务 |
| `submission_id/approval_round_id` | BIGINT | 可空 |
| `event_type` | VARCHAR(64) | 事件 |
| `operator_id/operator_snapshot` | ... | 操作人 |
| `content` | TEXT | 可读摘要 |
| `details` | JSONB | 结构化非敏感细节 |
| `created_at` | TIMESTAMP | 时间 |

---

## 8. 审批运行模型

### 8.1 `approval_round`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id/task_id/submission_id` | ... | 来源 |
| `round_no` | INT | 任务内轮次 |
| `scheme_version_id` | BIGINT | 固化方案 |
| `process_instance_id` | VARCHAR(255) | Flowable |
| `process_definition_id` | VARCHAR(255) | 固化定义 |
| `status` | VARCHAR(32) | in_review/approved/changes_requested/terminated/failed |
| `started_by/started_at/ended_at` | ... | 时间 |
| `result` | VARCHAR(32) | 终态 |

约束：

```text
UNIQUE (tenant_id, task_id, round_no)
UNIQUE (tenant_id, process_instance_id)
```

### 8.2 `approval_action`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id/round_id/submission_id` | ... | 来源 |
| `flowable_task_id` | VARCHAR(255) | 节点任务 |
| `node_key/node_name` | VARCHAR | 节点 |
| `approver_id/approver_snapshot` | ... | 审批人 |
| `action` | VARCHAR(32) | approve/return... |
| `comment` | TEXT | 退回时必填 |
| `field_comments` | JSONB | 字段意见数组 |
| `attachment_comments` | JSONB | 附件意见数组 |
| `created_at` | TIMESTAMP | 时间 |

约束：

- `return_for_changes` 和 `terminate` 的 comment 非空由服务层校验。
- 同一 Flowable 任务只允许一个成功终结 action，可使用唯一索引或事务锁。

### 8.3 `workflow_business_instance`

现有表可以保留，但统一任务审批使用：

```text
business_type = task_submission
business_id = submission_id
business_key = task_submission:{submissionId}
```

日报专属绑定和适配信息从基线删除。

---

## 9. 通知模型

### 9.1 `task_notification_delivery`

如现有通用通知表足以保存幂等信息，可以扩展现有模型；否则新增：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id/task_id` | ... | 任务 |
| `submission_id/approval_round_id` | BIGINT | 可空 |
| `event_type` | VARCHAR(64) | 阶段 |
| `recipient_id` | BIGINT | 接收人 |
| `channel` | VARCHAR(32) | notification/email/... |
| `dedupe_key` | VARCHAR(255) | 唯一键 |
| `status` | VARCHAR(32) | pending/sent/failed/dead |
| `attempt_count` | INT | 重试 |
| `next_attempt_at/sent_at` | TIMESTAMP | 时间 |
| `last_error` | TEXT | 脱敏错误 |

```text
UNIQUE (tenant_id, dedupe_key)
```

---

## 10. 统计模型

### 10.1 `task_field_fact`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id/task_id/submission_id` | ... | 血缘 |
| `template_id/template_version_id` | ... | 模板 |
| `field_id/field_key` | ... | 字段 |
| `row_key` | VARCHAR(100) | 表格行，可空 |
| `value_type` | VARCHAR(32) | 类型 |
| `number_value` | NUMERIC(30,10) | 数字 |
| `text_value` | TEXT | 文本/option key |
| `boolean_value` | BOOLEAN | 布尔 |
| `date_value` | DATE | 日期 |
| `datetime_value` | TIMESTAMP | 时间 |
| `reference_type/reference_key` | VARCHAR | 人员/组/CI |
| `business_date` | DATE | 业务日期 |
| `owner_user_id/owner_group_id` | BIGINT | 维度快照键 |
| `effective` | BOOLEAN | 当前正式事实 |
| `created_at/invalidated_at` | TIMESTAMP | 生命周期 |

索引：

```text
(tenant_id, template_version_id, field_key, business_date)
(tenant_id, owner_group_id, business_date)
(tenant_id, reference_type, reference_key, business_date)
(submission_id, field_key)
```

全文检索可以对允许的 `text_value` 建 `GIN(to_tsvector(...))`，敏感字段不得写入全文索引。

### 10.2 `task_metric_definition`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id/code/name` | ... | 统一指标 |
| `value_type/unit/scale` | ... | 数值语义 |
| `aggregation` | VARCHAR(32) | 默认聚合 |
| `additivity` | VARCHAR(32) | additive/semi/non/distinct/snapshot/formula |
| `formula_config` | JSONB | 跨字段公式，可空 |
| `authority_policy` | JSONB | 权威来源 |
| `created_at/updated_at` | TIMESTAMP | 指标管理创建时间与最近修改时间 |

指标一旦产生正式 `task_metric_fact`，定义与已产出事实的绑定不可修改或删除；需要新口径时创建新的指标定义并重新绑定。未产生事实的定义和绑定可物理删除，指标目标必须先删除或改绑，避免软删除模型遗留不可用配置。

### 10.3 `task_metric_binding`

把模板字段映射到统一指标。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `metric_id` | BIGINT | 指标 |
| `template_version_id/field_id` | BIGINT | 字段 |
| `source_role` | VARCHAR(32) | fact/system_rollup/manual_report |
| `ratio_component` | VARCHAR(16) | 比率指标必填：`numerator` 或 `denominator`；同一指标、模板版本和来源角色必须成对配置 |
| `unit_conversion` | JSONB | 单位换算 |
| `enabled` | BOOLEAN | 生效 |

### 10.4 `task_metric_fact`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGSERIAL | PK |
| `tenant_id/metric_id` | ... | 指标 |
| `task_id/submission_id/field_fact_id` | ... | 血缘，可空组合；比率事实的 `field_fact_id` 指向分子 |
| `value` | NUMERIC(30,10) | 值 |
| `numerator/denominator` | NUMERIC | 比率基础，仅比率事实写入 |
| `denominator_field_fact_id` | BIGINT | 分母字段事实血缘，仅比率事实写入 |
| `business_date` | DATE | 时间 |
| `owner_user_id/owner_group_id` | BIGINT | 维度 |
| `dimensions` | JSONB | 稀疏扩展维度 |
| `effective` | BOOLEAN | 是否正式 |
| `source_type` | VARCHAR(32) | fact/system_rollup/manual_report |
| `created_at/invalidated_at` | TIMESTAMP | 生命周期 |

### 10.5 `task_analytics_dashboard`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id/tenant_id` | ... | PK/租户 |
| `name/description` | ... | 看板 |
| `owner_id` | BIGINT | 所有者 |
| `scope_type/owner_group_id` | ... | private/group/tenant |
| `layout_config` | JSONB | 布局 |
| `created_at/updated_at/is_deleted/...` | ... | 看板生命周期；保留原因见 schema 台账 |

### 10.6 `task_analytics_widget`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id/dashboard_id/tenant_id` | ... | 所属 |
| `widget_type` | VARCHAR(32) | kpi/line/bar/table/text/attachments... |
| `title` | VARCHAR(255) | 标题 |
| `data_source_config` | JSONB | 数据源、口径、过滤及下钻查询 |
| `display_config` | JSONB | 展示设置 |
| `sort_order` | INT | 顺序 |
| `updated_at` | TIMESTAMP | 最近组件修改时间，API 返回；创建时间由通用审计日志追溯 |

### 10.7 `task_metric_goal`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id/tenant_id/metric_id` | ... | 目标指标 |
| `scope_type` | VARCHAR(32) | tenant/group/user/template |
| `scope_key` | VARCHAR(255) | 范围 ID |
| `period_type` | VARCHAR(32) | week/month/quarter/year/custom |
| `period_config` | JSONB | 自定义周期/时区 |
| `target_value` | NUMERIC(30,10) | 目标值 |
| `comparison` | VARCHAR(16) | at_least/at_most/exact |
| `effective_from/effective_to` | DATE | 生效窗口 |
| BaseEntity 字段 | ... | 生命周期 |

### 10.8 `task_relation`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id/tenant_id` | ... | PK/租户 |
| `source_task_id/target_task_id` | BIGINT | 来源/目标 |
| `relation_type` | VARCHAR(32) | remediation/recheck/derived/blocks/related |
| `automation_execution_id` | BIGINT | 自动生成来源，可空 |
| `created_by/created_at` | ... | 审计 |

约束：

```text
UNIQUE (tenant_id, source_task_id, target_task_id, relation_type)
CHECK source_task_id <> target_task_id
```

服务层检测会形成循环的链路，至少限制 remediation/recheck/derived 的有向环。

### 10.9 `task_automation_rule`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id/tenant_id/name` | ... | 规则 |
| `trigger_type` | VARCHAR(32) | submission_approved/metric_threshold/task_completed/schedule |
| `trigger_config` | JSONB | 指标、比较符、窗口 |
| `action_type` | VARCHAR(32) | create_task/notify |
| `action_config` | JSONB | 模板版本、分配、截止规则 |
| `status` | VARCHAR(32) | draft/active/paused/archived |
| `updated_by` | BIGINT | 自动创建任务时的授权执行主体 |
| `created_at/updated_at` | TIMESTAMP | 规则管理时间线 |

规则不可物理删除，因为执行记录以 `rule_id` 保留重试、结果和来源事件的可追溯关系；管理端“删除”仅将其置为 `archived`。不保留重复的 `is_deleted/deleted_at/deleted_by` 或未接入更新条件的 `lock_version`。

### 10.10 `task_automation_execution`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id/tenant_id/rule_id` | ... | 规则执行 |
| `source_type/source_id` | VARCHAR/BIGINT | submission/metric_fact/task |
| `dedupe_key` | VARCHAR(255) | 幂等键 |
| `status` | VARCHAR(32) | pending/succeeded/failed/dead/skipped |
| `result_task_id` | BIGINT | 自动任务，可空 |
| `attempt_count/next_attempt_at` | ... | 重试 |
| `last_error/created_at/updated_at` | ... | 结果 |

```text
UNIQUE (tenant_id, dedupe_key)
```

### 10.11 `task_analytics_subscription`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id/tenant_id/dashboard_id` | ... | 看板 |
| `recipient_type/recipient_config` | ... | 用户/组 |
| `schedule_config` | JSONB | 周期和时区 |
| `channel` | VARCHAR(32) | notification/email |
| `status` | VARCHAR(32) | active/paused/archived |
| `next_send_at/last_sent_at` | TIMESTAMP | 调度 |
| `created_at/updated_at` | TIMESTAMP | 管理端时间线和排序 |

订阅是 `task_notification_delivery.subscription_id` 的历史父记录，删除仅变更为 `archived`，不物理删除或断开已投递明细。`created_by/updated_by` 没有读取、授权或展示消费者，且 `is_deleted/deleted_at/deleted_by` 与 `archived` 重复，不进入终态 schema。

---

## 11. 排班与节假日

现有 `ops_duty_roster` 和 `ops_holiday_calendar` 的业务集合与表名在终态保留。它们分别被统一任务值班人分派、工作日/相对节假日计算和日历设置直接使用；这只是表级结论，不表示历史列整体保留，逐列去留以 `SCHEMA-OBJECT-LEDGER.md` 为准。产品终态要求：

- 不依赖旧 `ops_schedule_task/rule/template`。
- 权限从 `ops_calendar:manage` 收敛到 `calendar_settings:*`。
- 日历读模型组合这些表与 `task_instance`。
- `IMPLEMENT_OR_DROP` 列必须形成正式 API、页面或作业消费者，否则由 WP-09 增量 migration 删除。

---

## 12. 必须删除的旧 schema

V1-V79 作为不可变历史仍会创建以下对象，但 WP-09 清理 migration 后它们必须不存在：

```text
daily_report
daily_report_approval
ops_schedule_rule
ops_schedule_task
ops_schedule_task_participant
ops_schedule_checklist_item
ops_schedule_task_log
ops_schedule_task_link
ops_schedule_notification_log
ops_schedule_template
```

同时删除：

- 日报专属索引、触发器和外键。
- 日报与旧运维任务权限种子。
- 日报专属流程绑定种子。
- 旧 task type/link type CHECK 约束。

---

## 13. 初始化种子

至少初始化：

### 13.1 内置任务模板

- 简易任务。
- 工作日报。
- 基础巡检。

工作日报字段：

```text
completed_items  textarea required
issues           textarea optional
tomorrow_plan    textarea required
work_hours       number required min=0 scale=2 unit=小时
ci_instances     ci_scope optional mode=free_instance multi=true
attachments      file optional
```

### 13.2 审批方案

- 无审批不建方案。
- 指定人审批。
- 组负责人任一人审批。
- 两级审批。

### 13.3 权限

按 `SPEC.md` 初始化 task、task_template、task_plan、task_analytics、workflow 和 calendar_settings 权限，并赋予内置角色合理默认值。

---

## 14. 数据库验证查询

切换完成后必须检查：

```sql
-- 旧表应为 0 个
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'daily_report','daily_report_approval','ops_schedule_rule','ops_schedule_task',
    'ops_schedule_task_participant','ops_schedule_checklist_item',
    'ops_schedule_task_log','ops_schedule_task_link',
    'ops_schedule_notification_log','ops_schedule_template'
  );

-- 新表必须存在
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'task_%';
```

测试还需验证：

- 每张租户业务表包含 tenant_id。
- 模板/计划/任务 occurrence 唯一约束生效。
- 提交版本重复被拒绝。
- 事实血缘外键完整。
- 旧权限和日报流程绑定种子不存在。

---

## 15. 待 SPEC 实施时确认的低层细节

以下细节允许实现者根据现有基础设施选择，但必须记录到 `IMPLEMENTATION-STATUS.md`：

- 草稿附件使用独立表还是通用上传会话表。
- 已发布模板不可变使用服务约束还是数据库触发器。
- 稀疏指标维度使用 JSONB 还是附加维度表。
- 统计预聚合采用物化视图还是日汇总表。
- 全量 schema 对象消费者审计中发现的其他无用列、索引、触发器或函数如何定向清理。

选择标准：数据一致性、查询性能、现有风格和最小复杂度，不得以兼容旧日报/旧运维任务为理由保留旧表。
