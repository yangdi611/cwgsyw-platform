# 统一任务平台 Schema 对象去留台账

**状态：** 实施中  
**审计日期：** 2026-07-23  
**适用范围：** 统一任务目标域、旧日报、旧 `ops_schedule_*`、它们的专属关联物、共享表中的精确旧任务目标行，以及明确只服务一次性过渡的重复模型。用户、RBAC、CMDB、设备、Wiki、共享文件、通知等其他正式业务模块的 schema 不属于本次清理范围，必须保持不变。

---

## 1. 判定原则

保护既有数据库不等于永久保留每个旧对象。对象只有满足下列至少一项，才能进入终态：

1. 有已冻结产品能力直接需要，且存在正式 API、服务或页面消费者。
2. 是多个仍在运行模块共享的平台基础设施，删除会破坏明确的非目标业务。
3. 是审计、不可变历史、数据血缘或合规所需记录，并有查询或追溯入口。

以下情况不能作为保留证据：

- 仅在历史 Flyway migration 中出现。
- 仅被待删除的旧 Controller、Service、Mapper、页面或测试引用。
- 仅为了可能回退、以后也许有用或避免编写定向清理 migration。
- 已创建但没有运行时写入、查询、管理或展示链路。

表级 `KEEP` 只确认该业务集合在终态仍然存在，不代表历史列整体保留。每个列、索引、约束、触发器和函数仍需独立举证；只有旧代码引用、ORM 自动填充或通用基类继承，不构成终态用途。

对象状态：

| 状态 | 含义 |
| --- | --- |
| `KEEP` | 终态保留；有正式消费者和产品用途 |
| `MIGRATE_THEN_DROP` | 当前仅为切换期暂留；消费者迁移后整对象删除 |
| `SHARED_DELETE_TARGET_ROWS` | 共享表保留，只删除旧日报/旧运维任务对应行 |
| `IMPLEMENT_OR_DROP` | 既有或新规划对象必须在指定工作包接入完整终态链路，否则删除 |
| `TRANSITIONAL_REVIEW` | 当前只证明存在迁移/灰度/兼容消费者；终态默认删除，除非补齐长期产品用途证据 |
| `AUDIT_REQUIRED` | 本次清理范围内尚未完成表级或列级去留证明；WP-10 前必须转为其他确定状态 |
| `OUT_OF_SCOPE_KEEP` | 其他正式业务模块对象；本项目仅保护其迁移安全，不审计或删除其表、列和接口 |

---

## 2. 明确终态保留

本节不是“旧表白名单”。当前只确认以下两张既有业务表在统一任务终态仍有直接用途。旧日报与旧 `ops_schedule_*` 明确不属于本节，按第 3 节删除；其他正式业务模块对象为 `OUT_OF_SCOPE_KEEP`，不在本项目中重审或删除。

### 2.1 排班 `ops_duty_roster`

**状态：** `KEEP`

保留依据：

- 统一任务 `JdbcAssignmentDirectory.findDutyUsers` 读取排班并解析“值班人”分配规则。
- 日历设置继续提供排班管理，运维日历展示排班图层。
- `GroupReferenceRegistry` 继续保护未来排班对活动组的引用。

字段去留：

| 字段 | 终态 | 用途 |
| --- | --- | --- |
| `id`、`tenant_id` | KEEP | 标识与租户隔离 |
| `duty_date` | KEEP | 值班解析、日期查询、日历图层 |
| `start_at`、`end_at` | KEEP | 正式排班设置页创建/编辑时提交，列表展示班次时间，后端校验时间区间并用于冲突语义 |
| `shift_name` | KEEP | 正式排班设置页创建、编辑和列表展示班次名称，冲突提示也读取该字段 |
| `assignee_id` | KEEP | 主值班人和统一任务分派 |
| `backup_assignee_id` | KEEP | 正式排班设置页创建/编辑备班人并在列表展示备班姓名 |
| `phone_override` | KEEP | 正式排班设置页读写临时联系电话，列表优先展示该号码，冲突检测用其判断联系方式是否缺失 |
| `group_id` | KEEP | 按组排班、分派范围、组织生命周期约束 |
| `remark` | KEEP | 正式排班设置 API 和页面创建、编辑及展示管理说明 |
| `is_deleted` | KEEP | 正式删除入口执行软删除，排班列表和统一任务值班人解析均排除已删除记录 |
| `deleted_at`、`deleted_by` | DROP | 没有已删除记录查询、恢复或详情消费者，通用审计日志已记录操作者和时间；V92 已物理删除 |
| `updated_at`、`updated_by` | KEEP | 正式排班列表展示最近更新时间和更新人 |
| `created_at`、`created_by` | DROP | 页面和其他正式消费者不读取，创建行为已进入通用审计日志；V92 已物理删除并收窄 DTO/实体契约 |

关联对象去留：

| 对象 | 终态 | 依据 |
| --- | --- | --- |
| `idx_ops_roster_date` | KEEP | 统一任务值班人分派按 `tenant_id + duty_date` 查询，日历也按日期范围查询 |
| `idx_ops_roster_assignee` | KEEP | 正式冲突检测按 `tenant_id + assignee_id + duty_date` 查询同一人员同日排班，与索引前导列一致 |
| `trg_ops_duty_roster_active_group` | KEEP | 防止排班写入非活动组，保护仍被统一任务消费的 `group_id` 不变量 |
| `audit_log` 中 `target_type='ops_duty_roster'` 的行 | KEEP | 通用审计后台可按模块、动作、关键字和时间查询并展示目标类型，排班创建、更新、删除均在同一事务写入 |

当前已由唯一 `/api/calendar-settings/rosters` 管理入口提供正常删除与最近更新元数据展示，完整操作记录由通用审计后台查询；旧 `OpsCalendarRoster*` 内部类名可在 WP-09 收敛为中性 calendar settings 模块，但不得为了改名复制第二张表或保留双 API。

### 2.2 节假日 `ops_holiday_calendar`

**状态：** `KEEP`

保留依据：

- 统一任务 `JdbcHolidayCalendarAdapter` 直接用于工作日移动和 `holiday_relative` 周期计算。
- 日历设置继续提供法定/公司/活动假期和调休补班管理。
- 运维日历展示节假日图层。

字段去留：

| 字段 | 终态 | 用途 |
| --- | --- | --- |
| `id`、`tenant_id` | KEEP | 标识与租户隔离 |
| `name` | KEEP | 展示和相对节假日预览 |
| `start_date`、`end_date` | KEEP | 假期区间和 occurrence 计算 |
| `holiday_type` | KEEP | 法定/公司/活动假期过滤 |
| `workday_overrides` | KEEP | 周末调休补班 |
| `enabled` | KEEP | 启停而不删除定义 |
| `remark` | KEEP | 正式节假日设置 API 和页面创建、编辑及展示管理说明 |
| `is_deleted` | KEEP | 正式删除入口执行软删除，节假日列表和统一任务工作日计算均排除已删除记录 |
| `deleted_at`、`deleted_by` | DROP | 没有已删除记录查询、恢复或详情消费者，通用审计日志已记录操作者和时间；V92 已物理删除 |
| `updated_at`、`updated_by` | KEEP | 正式节假日列表展示最近更新时间和更新人 |
| `created_at`、`created_by` | DROP | 页面和其他正式消费者不读取，创建行为已进入通用审计日志；V92 已物理删除并收窄 DTO/实体契约 |

关联对象去留：

| 对象 | 终态 | 依据 |
| --- | --- | --- |
| `idx_ops_holiday_range` | KEEP | 统一任务工作日移动和相对节假日计算按租户与日期范围查询启用记录 |
| `audit_log` 中 `target_type='ops_holiday_calendar'` 的行 | KEEP | 通用审计后台可按模块、动作、关键字和时间查询并展示目标类型，节假日创建、更新、删除及导入均写入审计 |

当前已由唯一 `/api/calendar-settings/holidays` 管理入口返回并展示最近更新元数据，完整操作记录由通用审计后台查询；若后续取消该追溯能力，必须同步删除无消费者审计列，不能只停止赋值。

### 2.3 共享平台对象

**状态：** `KEEP` 或 `SHARED_DELETE_TARGET_ROWS`

| 对象 | 状态 | 处理边界 |
| --- | --- | --- |
| `workflow_template` | SHARED_DELETE_TARGET_ROWS | 保留 Wiki、变更文档等模板；从 `supported_business_types` 删除 `daily_report` |
| `workflow_template_instance` | SHARED_DELETE_TARGET_ROWS | 删除仅服务 `daily_report` 的实例；保留其他业务实例 |
| `workflow_process_binding` | SHARED_DELETE_TARGET_ROWS | 删除 `business_type='daily_report'`；统一任务使用正式任务提交绑定/审批方案版本 |
| `workflow_business_instance` | SHARED_DELETE_TARGET_ROWS | 删除 `business_type='daily_report'` 目标数据；保留其他业务历史 |
| Flowable `ACT_*` | SHARED_DELETE_TARGET_ROWS | V92 已按 `dailyReportApproval` 定义 ID 或明确日报 business key 清理运行/历史子表、定义和独占部署；真实 Flowable 7.1 PostgreSQL 迁移测试证明非目标设备访问流程不受影响 |
| `notification_message` | SHARED_DELETE_TARGET_ROWS | 删除或迁移 `ref_type IN ('daily_report','ops_schedule_task')`，保留其他通知 |
| `audit_log` | SHARED_DELETE_TARGET_ROWS | 只清旧目标类型；保留排班、节假日及其他平台审计 |
| `sys_config` | SHARED_DELETE_TARGET_ROWS | 删除日报专属 key，保留 SMTP 等通用配置 |
| `sys_resource`/`sys_permission`/角色权限关联表 | SHARED_DELETE_TARGET_ROWS | 删除 `daily_report:*`、`ops_calendar:*`；保留并使用 task/approval/work_item/calendar_settings 权限 |
| `sys_user`、`sys_group`、CMDB、设备、Wiki、共享文件、变更文档 | OUT_OF_SCOPE_KEEP | 这些正式业务模块仍在使用；本项目只保护其迁移安全，不删除其表、列、接口或数据 |

### 2.4 明确过渡模型复核对象

以下对象当前有代码引用，但引用本身可能属于历史切换过程，不能直接据此判定 `KEEP`：

| 对象组 | 当前状态 | 必须回答的问题 |
| --- | --- | --- |
| `sys_user_role` | OUT_OF_SCOPE_KEEP | RBAC 模块的既有角色关系契约，不属于统一任务替换范围；V109 前向恢复表和可从已迁移 assignment 反推的有效关系。 |
| `sys_role_assignment` | KEEP | 用户角色和作用域的唯一权威来源；RBAC、资源角色 ACL、账户清理和 Wiki 系统所有权均有正式消费者 |
| `authorization_migration_*`、`authorization_account_rollout`、`authorization_decision_diff`、`authorization_tenant_cutover` | OUT_OF_SCOPE_KEEP | RBAC 的迁移、灰度、审计和切换元数据，不属于统一任务目标域；V109 恢复 schema 和 tenant cutover 默认记录。 |
| `wiki_space_acl`、`wiki_page_acl`、`shared_folder_acl` | OUT_OF_SCOPE_KEEP | Wiki/共享文件 ACL 契约属于其他正式模块；V109 恢复表、索引、活动组触发器，并从 `resource_acl_entry` 回填可逆有效授权。 |
| `resource_acl_entry` | KEEP | Wiki 空间/页面、共享文件夹/文件 ACL 的唯一权威来源；主体为 `user`、`group`、`role`，由 `AuthorizationService`、`ResourceAccessService` 和资源初始化器正式读写 |
| workflow 模板、实例、绑定和业务映射 | AUDIT_REQUIRED | 仅核验 `daily_report` 目标行和明确旧任务 business key；保留其他业务类型、表和字段 |
| CMDB、设备、IPAM、Wiki、共享文件、变更文档、AI、通知、审计 | OUT_OF_SCOPE_KEEP | 正式业务模块对象不属于统一任务清理范围；通知和审计仅按第 4 节精确删除旧任务目标行 |

### 2.5 已完成的非目标域审计样本

下列结论来自正式 API、前端页面、权限、写入路径和定向测试的共同复核，不以历史 migration 或单一实体引用作为依据。

| 对象 | 终态 | 正式消费者或删除依据 |
| --- | --- | --- |
| `ai_provider_config` | KEEP | `AiGatewayService` 读取有效供应商生成变更文档；`/api/admin/ai/providers` 和 `/admin/ai` 管理加密密钥、模型和提示词；`AiProviderConfigValidationTest` 验证配置写入边界。 |
| `ai_call_log` 及 `idx_ai_call_log_*` | OUT_OF_SCOPE_KEEP | AI 调用审计属于 AI 模块，不属于统一任务清理范围；V109 恢复表、索引、实体、Mapper 与网关写入。 |
| `backup_record` | OUT_OF_SCOPE_KEEP | 备份/恢复目录的完整字段契约属于备份模块；V109 恢复 `backup_type` 和审计/软删除字段，避免统一任务迁移改变备份 API、列表或审计语义。 |
| `sys_config['watermark.font_size']` | OUT_OF_SCOPE_KEEP | 配置项属于配置/导出模块；V109 恢复默认值，不以统一任务范围判断其去留。 |
| `sys_config.description` | OUT_OF_SCOPE_KEEP | 配置说明列属于通用配置契约；V109 恢复 schema 与 ORM 字段。 |
| `task_metric_goal.is_deleted/deleted_at/deleted_by/created_by/updated_by/created_at/updated_at` | DROP | 指标目标管理只提供当前目标的创建、更新、删除和列表；没有已删除目标查询、恢复、历史详情或时间戳展示。目标配置物理删除后，`audit_log` 保留操作追溯，指标事实仍保留独立血缘。V99 删除列、软删除过滤和写入，`DELETE /api/task-metric-goals/{id}` 改为物理删除，并以租户/生效日期索引服务当前列表。 |
| `task_metric_binding.created_by/created_at` | DROP | 绑定仍是 `task_metric_fact.binding_id` 的正式血缘对象，但其创建操作人和时间没有 API、页面、查询或统计消费者，只在创建时赋值。V100 删除两列及对应写入；绑定的指标/模板/字段/单位/启用状态与事实回填语义不变。 |
| `task_metric_definition.created_by/updated_by/is_deleted/deleted_at/deleted_by` | DROP | 指标定义的创建/更新操作者和删除时间没有管理页面、API 返回、授权或审计查询消费者；通用 `audit_log` 记录配置操作。定义和绑定在无事实时物理删除；一旦存在 `task_metric_fact`，定义和已产出事实的绑定均冻结，以保持历史统计解释可追溯。V105 删除五列、旧软删除行和 partial 唯一索引。 |
| `task_metric_binding.ratio_component`、`task_metric_fact.numerator/denominator/denominator_field_fact_id` | KEEP | 比率指标由两个可配置字段绑定构成；提交时成对写入分子、分母和两个字段事实血缘，期间预览按分子和/分母和计算，不能用单条百分比平均替代。V106 使此前无生产者的占位字段成为正式终态链路。 |
| `task_analytics_widget.created_at` | DROP | 组件创建没有单独的 API 返回、页面展示、排序、查询、权限或调度用途；创建/更新/删除均记录在 `audit_log`，组件 API 仍返回并依赖 `updated_at` 表达当前版本。V107 删除该列，不影响组件配置、排序、看板刷新或审计追溯。 |
| `cmdb_alert.raw_labels` | OUT_OF_SCOPE_KEEP | Prometheus 告警原始标签是 CMDB 告警模块的持久化契约；V109 恢复字段及入站写入，不以统一任务范围判断其去留。 |
| `task_relation.created_by` | DROP | 任务关系保留任务图、`automation_execution_id` 血缘和 `created_at` 排序；`created_by` 仅在自动化创建时写入并原样返回，既不参与权限、页面展示、审计查询，也不能代表手工关联的正式操作者。自动化来源由执行记录表达，手工操作由 `audit_log` 追溯。V104 删除该列和 VO/服务参数。 |
| `task_automation_rule.lock_version/created_by/is_deleted/deleted_at/deleted_by` | DROP | `lock_version` 未进入更新条件或前端冲突处理，`created_by` 只写不读；执行记录需持续引用规则，故规则删除由 `status='archived'` 表示，软删除状态重复且会使归档规则出现两套可见性语义。V101 删除五列，活跃事件匹配使用 `tenant_id + trigger_type WHERE status='active'` 索引；`updated_by` 保留为自动创建任务时的授权执行主体。 |
| `task_analytics_subscription.created_by/updated_by/is_deleted/deleted_at/deleted_by` | DROP | 订阅管理 API 与页面只读取名称、接收人、计划、渠道、状态和时间；创建/更新人只写不读。已投递明细必须通过 `task_notification_delivery.subscription_id` 保留血缘，因此删除统一为 `status='archived'`，不物理删除订阅；软删除列重复。V102 删除五列并以 `status='active'` 服务调度抢占和 due 索引。 |
| `device`、`device_credential` | KEEP | `/api/devices`、`/devices`、统一搜索及 CMDB 实例关联提供设备与受控凭据生命周期；活动组触发器保护组织引用，凭据查看写入通用审计日志。`password_access_log` 已在 V52 因零消费者删除。 |
| `ip_pool`、`ip_allocation` | KEEP | `/api/ip-pools` 与 `/ipam` 提供地址池、分配、释放、CI 关联、利用率和组范围管理；唯一索引和活动组触发器保护地址唯一性、计数和组织归属。 |

此节仅记录已发生的历史审计样本，不扩大本项目清理范围；其他正式业务模块对象均为 `OUT_OF_SCOPE_KEEP`。

### 2.6 高风险待决对象

| 对象 | 当前结论 | 处置条件 |
| --- | --- | --- |
| `notification_message.is_deleted/deleted_at/deleted_by/updated_at/created_by/updated_by` | OUT_OF_SCOPE_KEEP | 通知中心的审计/软删除字段属于其他正式模块；V109 恢复 schema、实体过滤和原有索引，统一任务仍可使用 `dedupe_key` 幂等投递。 |
| `sys_config.created_at/updated_at` | 字段级扫描没有正式读取、返回或展示消费者，配置变更另有 `audit_log` 记录；但删除 `updated_at` 必须修改 `SysConfigMapper.upsertValue`。其 GitNexus upstream impact 为 `CRITICAL`（1 个直接调用者、3 条流程、5 个模块），涉及流程绑定启停和工作流模板实例创建。 | 不在未经明确确认的情况下更改。必须先完成配置写路径、审计语义、工作流绑定和模板实例创建的跨模块回归方案；在此之前不能把“无读消费者”误写为已删除。 |
| `task_analytics_dashboard` 软删除及 `created_at/updated_at` | 当前看板列表按 `updated_at` 排序，详情 API 返回创建/更新时间，页面使用这些值；`owner_id/owner_group_id` 参与访问控制与活动组触发器。看板还有 widget 和 subscription 外键，通知目标也指向该资源。 | KEEP。删除是否应改为物理删除，必须先设计订阅、通知目标、组件和审计记录的显式级联收口；在此之前软删除有实际引用完整性用途，不能按“无回收站”判为垃圾。 |

`password_access_log` 已在 V52 因零读写链路被删除，是本轮终态审计应遵循的已有范例。当前运行时代码引用数量只能作为线索，不能替代产品和终态架构判断。

---

## 3. 消费者迁移后整表删除

### 3.1 旧日报

**状态：** `MIGRATE_THEN_DROP`

| 旧对象 | 统一替代物 |
| --- | --- |
| `daily_report` 全表及全部列 | `task_instance`、`task_draft`、`task_submission`、`task_field_fact` |
| `daily_report_approval` 全表及全部列 | `approval_round`、`approval_action` |
| 日报 CI JSON 列 `ci_instance_ids` | `task_instance.ci_scope_snapshot`、`task_submission_reference` |
| 日报索引和外键 | 新任务表对应约束和索引 |
| `trg_daily_report_active_group` | 统一任务组织快照和任务组引用约束 |

删除前置条件：

- `/daily/**`、`/api/daily-reports/**`、日报专属模块和动态流程代码已删除。
- 首页、通知、CMDB、综合报表、流程管理和导航均切到统一任务。
- 内置“工作日报”模板、工作日计划、提交、审批、统计和导出链路已验收。

### 3.2 旧运维任务

**状态：** `MIGRATE_THEN_DROP`

| 旧对象 | 统一替代物 |
| --- | --- |
| `ops_schedule_rule` | `task_plan`、`task_plan_generation` |
| `ops_schedule_task` | `task_instance` |
| `ops_schedule_task_participant` | `task_participant` |
| `ops_schedule_checklist_item` | `task_template_field`、`task_draft`、`task_submission` |
| `ops_schedule_task_log` | `task_event` |
| `ops_schedule_task_link` | `task_submission_reference`、`task_relation` |
| `ops_schedule_notification_log` | `task_notification_delivery` |
| `ops_schedule_template` | `task_template`、`task_template_version` |
| 旧 schedule 索引、外键、CHECK | 新任务表对应约束和索引 |
| `trg_ops_schedule_task_active_group` | 统一任务组引用/组织快照约束 |
| `trg_ops_schedule_rule_active_groups` | 统一计划分配规则校验 |
| `require_active_ops_rule_groups` | 统一计划分配 resolver/validator |
| `enforce_active_ops_rule_group_references` | 统一计划分配 resolver/validator |

删除前置条件：

- 运维日历月/周/列表和快速创建已改用统一任务 API。
- 规则、模板、统计、素材页面/API 已由任务计划、任务模板、任务统计和附件能力替代。
- `GroupReferenceRegistry` 不再登记旧日报、旧 task/rule 引用。
- 通知、审计和配置不再产生旧 `ref_type`、`target_type` 或旧权限。

物理删除顺序必须从叶表到根表，显式删除，不使用无边界 `CASCADE`。

---

## 4. 共享表目标行清理清单

WP-09 最终 migration 至少覆盖：

| 共享对象 | 精确目标条件 |
| --- | --- |
| `sys_config` | `config_key IN ('notify.reminder.enabled','notify.reminder.cron','notify.reminder.template','daily_report_process_definition_id')`；如发现租户化同义 key，先登记再扩充 |
| `workflow_process_binding` | `business_type='daily_report'` |
| `workflow_business_instance` | `business_type='daily_report'` |
| `workflow_template_instance` | `business_type='daily_report'` 或经精确外键证明仅服务该类型 |
| `workflow_template.supported_business_types` | JSON/文本数组只移除 `daily_report`，不得删除 Wiki/变更文档声明 |
| `notification_message` | `ref_type IN ('daily_report','ops_schedule_task')`；不得删除 `ops_duty_roster`/`ops_holiday_calendar` 通知 |
| `audit_log` | `target_type IN ('daily_report','ops_schedule_rule','ops_schedule_task','ops_schedule_template')`；不得按 `module='ops_calendar'` 整体删除 |
| 角色权限关联表 | 外键指向被删 `daily_report:*`、`ops_calendar:*` 权限 |
| `sys_permission` | `code LIKE 'daily_report:%' OR code LIKE 'ops_calendar:%'` |
| `sys_resource` | `code IN ('daily_report','ops_calendar')`，且关联权限先清理 |

Flowable 行必须依据 process definition key/ID、business key 和业务映射联合确认。V92 以 `dailyReportApproval` 的定义 ID 和旧日报 business-key 格式作为精确归属，不依赖流程显示名称，也不使用 `CASCADE`。

---

## 5. 新对象反向审计

新增 schema 也不得自动视为有用。以下对象已完成正式写入、查询/管理或展示链路，并有定向验收；终态为 `KEEP`：

| 对象 | 正式写入 | 正式查询/管理/展示 | 验收证据 |
| --- | --- | --- | --- |
| `approval_scheme`、`approval_scheme_version`、`approval_round`、`approval_action` | 审批方案发布、任务提交和 Flowable 回调 | 审批方案页、`/work`、任务详情审批历史 | `ApprovalSchemeServiceTest`、`ApprovalRuntimeServiceTest` |
| `task_metric_definition`、`task_metric_binding`、`task_metric_fact` | 指标管理、提交事实提取、审批激活 | 指标管理、看板查询/下钻/导出 | `TaskMetricServiceTest`、`TaskAnalyticsQueryServiceTest` |
| `task_analytics_dashboard`、`task_analytics_widget` | 看板及组件管理 | `/tasks/analytics`、共享看板 | `TaskAnalyticsDashboardServiceTest` |
| `task_metric_goal` | 指标目标管理 | `/tasks/metrics`、完成率与阈值展示 | `TaskMetricGoalServiceTest` |
| `task_relation` | 自动化整改/复查及手工关联 | 任务关联列表 | `TaskRelationServiceTest` |
| `task_notification_delivery` | 计划生成、一次性任务、审批、自动化与统计订阅写入持久 outbox | 任务通知调度、失败重试和订阅批次完成状态 | `TaskNotificationDispatcherTest`、`TaskAnalyticsSubscriptionDispatcherTest`、`DailyWorkReportIntegrationTest` |
| `task_automation_rule`、`task_automation_execution` | 规则管理、生命周期事件、失败/重试 | `/tasks/automations`、执行记录 | `TaskAutomationServiceTest`、`TaskAutomationExecutorTest` |
| `task_analytics_subscription` | 看板订阅管理和调度投递 | 看板订阅管理与通知投递 | `TaskAnalyticsSubscriptionServiceTest`、`TaskAnalyticsSubscriptionDispatcherTest` |

任何后续新对象仍须在 WP-10 前具备：

- 至少一个正式写入链路。
- 至少一个正式查询/管理/展示链路。
- 权限与 tenant 约束测试。
- 对应产品验收用例。

未满足者不能以“以后扩展”留在终态 schema，必须实现或用新的增量 migration 删除。

`task_notification_delivery` 的字段级结论：`tenant_id + dedupe_key` 为入队幂等键；任务、提交、审批轮次、事件、接收人、渠道和 `payload` 是投递内容与目标；`subscription_id + batch_key` 让统计订阅只在整批成功时更新发送时间；`status/attempt_count/next_attempt_at/updated_at` 提供抢占租约与失败重试；`sent_at/created_at/last_error` 为投递历史、失败诊断和订阅完成追溯。上述字段均有当前运行时或运维追溯消费者，保持 `KEEP`。

---

## 6. 终态零垃圾门禁

最终清理审计不能只检查表名。WP-10 必须列出本次清理范围内的对象并逐项关联旧任务替代或过渡消费者：

- 表、列、序列、外键、CHECK、唯一约束和索引。
- 触发器、函数、视图和物化视图。
- 配置 key、权限、资源、角色种子和业务模板种子。
- Flowable 部署/定义与业务绑定。
- 后端 API、类、Mapper、定时器、事件监听器。
- 前端路由、页面、组件、导航、面包屑和通知跳转。

通过条件：

1. 本台账所有 `MIGRATE_THEN_DROP` 对象不存在。
2. 所有 `SHARED_DELETE_TARGET_ROWS` 目标行为零，非目标哨兵数据不减少。
3. 所有 `IMPLEMENT_OR_DROP` 对象已有消费者与验收证据，否则不存在。
4. 本次清理范围内所有 `AUDIT_REQUIRED` 已转为确定状态，所有 `TRANSITIONAL_REVIEW` 已删除或补齐长期产品用途、管理入口和验收证据后转为 `KEEP`。
5. 本次清理范围内的保留列可映射到正式 API/服务/页面/作业、审计合规入口或数据库不变量。
6. 仓库运行时代码不再命中旧技术名，允许命中仅限历史 migration、清理 migration、台账和残留断言测试。

本次清理范围内的 schema 盘点是 WP-09/WP-10 的完成条件。不得使用“当前还有代码引用”或“以后可能有用”保留旧任务对象；但不得把该规则扩展为删除其他正式业务模块的对象。

`ops_duty_roster` 和 `ops_holiday_calendar` 的表级用途及上表标记为 `KEEP` 的字段已有正式消费者证据；此前未获证明的创建/删除审计列已由 V92 物理删除，不能因表级 `KEEP` 留到终态。
