# PRD: CMDB Tier 1 — 模型 + 实例 + 关联关系 + 变更历史 + 迁移

> **Tier 1 范围**: CMDB 模块的最小可用版本。聚焦五类能力——模型定义 CRUD、实例数据 CRUD、关联关系 CRUD、变更历史记录、数据库迁移脚本重建（V14–V19）。
> **下游**: Spec 由 Architect 在同一文件中追加技术方案。

> **⚠️ 修正说明（2026-06-12）**: 以下内容已根据产品讨论结论修正——关联关系使用独立 `ci_instance_rel` 表（5种关联类型），变更历史复用平台 `audit_log` 表（不新建 cmdb_change_log），模型管理采用 Flyway 管理内置模型 + UI 管理自定义模型的混合模式。现有 DB 中 8 张 CI 表（ci_model / ci_attribute / ci_attribute_group / ci_instance / ci_instance_rel / ci_association_kind / ci_association_def / ci_model_group）已通过 V14-V19 迁移存在，模型 seed 数据已有 host（13属性）+ app（5属性）。

## 背景

当前平台已有 changedoc 模块通过前端 ci_selector 直接调用 CMDB 的 `/cmdb/instances/search` 和 `/cmdb/topology/{id}` 两个端点（参见 `changedoc-cmdb-coupling-analysis.md`），但后端尚未存在真正的 CMDB Java 模块。Tier 1 的目标是：在现有 PostgreSQL + Flyway + Spring Boot 基础设施上，构建 CMDB 的最小可用内核，让 changedoc 的依赖、以及未来资产管理、变更审批对 CMDB 的依赖，都落在稳定的内部 API 上。

V14–V19 的 migration 文件需要从既有 DB dump 反向重建，以保证新环境的 schema 与生产历史一致。

## 用户故事

- 作为**CMDB 管理员**，我想创建/编辑/删除配置模型（如"主机"、"应用"、"数据库实例"），以便定义公司 IT 资产的结构
- 作为**CMDB 管理员**，我想为模型定义字段（属性名、类型、是否必填、默认值、枚举项），以便约束实例数据的录入规范
- 作为**运维工程师**，我想按模型创建/查看/编辑/删除实例（如一台具体的主机、一个具体的应用），以便维护实时资产台账
- 作为**运维工程师**，我想在创建/修改/删除实例时看到系统自动记录的变更历史（谁、何时、改了什么、改前改后的值），以便审计和排障
- 作为**审批人/审计员**，我想按实例或时间范围查询变更历史，以便追溯配置漂移
- 作为**平台开发者**，我希望 CMDB 提供稳定的搜索/拓扑 API，以便 changedoc 的 ci_selector 能解耦到 CMDB 内部代理
- 作为**部署运维**，我希望 V14–V19 的 Flyway migration 文件完整可重放，以便新环境能一键初始化到与生产一致的 schema

## 验收标准

### 1. 模型定义 CRUD

- [ ] 提供模型列表接口（分页、按关键字搜索、按分组过滤）
- [ ] 提供模型创建接口：必填字段包括 `name`（唯一）、`display_name`、`group`（分组/分类）
- [ ] 提供模型编辑接口：`name` 不允许修改（或需重建约束）
- [ ] 提供模型删除接口：**存在实例时禁止删除**，返回 409 并列出关联实例数量
- [ ] 提供模型字段（属性）定义 CRUD：每个字段包含 `field_key`、`field_type`（string/number/enum/json/boolean）、`required`、`default_value`、`enum_options`（仅 enum 类型）、`description`
- [ ] 字段 `field_key` 在同一模型内唯一，且不与系统保留字段冲突（如 `id`、`model_id`、`created_at`）
- [ ] 模型定义变更（字段增删改）需记录变更历史（见第 3 节）

### 2. 实例数据 CRUD

- [ ] 提供实例创建接口：按模型 schema 校验字段数据，必填项缺失返回 400
- [ ] 提供实例列表/搜索接口：支持按模型过滤、按关键字（名称/主键字段）搜索、分页
- [ ] 提供实例详情接口：返回实例基础信息 + 完整 `fields_data` (JSONB)
- [ ] 提供实例更新接口：增量合并 `fields_data`，并对更新后整体重新做 schema 校验
- [ ] 提供实例删除接口：逻辑删除（保留变更历史），或按配置硬删除
- [ ] 实例需包含基础字段：`name`、`model_id`、`status`（在线/离线/维护中）、`owner`（关联用户/组）、`description`
- [ ] 实例的自定义字段统一存入 `fields_data` (JSONB)，与模型字段定义保持一致
- [ ] 跨模型关联字段（如"主机上运行的应用"）Tier 1 仅以**字段值存目标实例 ID** 的方式支持，不强制拓扑关系

### 2.5 关联关系 CRUD

- [ ] 使用已有 `ci_instance_rel` 表（src_instance_id → dst_instance_id → association_kind），支持 5 种关联类型：主线拓扑(bk_mainline)、属于(belong)、运行(run)、连接(connect)、依赖(depend)
- [ ] 提供创建关联接口：POST `/api/cmdb/instances/{id}/relations`，校验两个实例存在且无重复关联
- [ ] 提供删除关联接口：DELETE `/api/cmdb/instances/{id}/relations/{relationId}`
- [ ] 提供查询关联接口：GET `/api/cmdb/instances/{id}/relations?kind=run|depend|...`
- [ ] 提供拓扑查询接口：GET `/api/cmdb/topology/{instanceId}?depth=5`，基于 ci_instance_rel 做 BFS/DFS 图遍历
- [ ] 拓扑返回结构包含：nodes（id、name、model_id、model_name）+ edges（src、dst、kind、label）

### 3. 变更历史（复用平台 audit_log）

- [ ] 每次实例的创建、更新、删除都自动写入 `audit_log` 表（复用现有审计基础设施，module="cmdb"）
- [ ] 每条记录包含：`module`（"cmdb"）、`action`（create_instance/update_instance/delete_instance）、`target_id`（ci_instance.id）、`target_type`（"ci_instance"）、`operator_id`、`before_json`、`after_json`、`created_at`
- [ ] 提供按实例查询历史接口：`GET /api/cmdb/instances/{id}/history`
- [ ] 提供按时间范围查询接口（支持审计员按日期范围拉取所有变更）
- [ ] 提供按操作人查询接口
- [ ] 历史数据不可修改、不可删除（audit_log 表 append-only）
- [ ] 前端渲染时：对 before_json/after_json 做 JSONB diff，展示具体变更字段（谁→改了什么→从什么改成什么），显示操作人真实姓名（关联 sys_user）

### 4. Flyway 迁移（V14–V19）

- [ ] 从既有生产 DB dump 反向生成 V14、V15、V16、V17、V18、V19 六个 migration 文件
- [ ] 每个 migration 文件必须是幂等的或带有 `IF EXISTS`/`IF NOT EXISTS` 防护，确保可重复 apply
- [ ] 新建空库按顺序执行 V1–V22（含本次新增）后，schema 应与生产 dump 等价（列、索引、约束、外键一致）
- [ ] migration 文件名使用描述性命名：`V<NN>__<description>.sql`（遵循现有命名风格，如 `V21__merge_change_doc_legacy_fields.sql`）
- [ ] 每个 migration 在提交前需在本地空库跑通 `flyway migrate`，并在 PR 中附 flyway 执行日志

### 5. 搜索与拓扑（供 changedoc 解耦使用）

- [ ] 提供 `GET /api/cmdb/instances/search?keyword=...&size=10` 端点，返回结构兼容当前 changedoc 前端消费：`id`, `name`, `model_id`, `model_name`
- [ ] 拓扑端点复用 2.5 节的 `GET /api/cmdb/topology/{instanceId}?depth=5`，基于 `ci_instance_rel` 表做 BFS/DFS 图遍历
- [ ] 拓扑返回结构兼容当前前端消费：`nodes[].id`, `nodes[].name`, `nodes[].model_id`, `nodes[].model_name`, `nodes[].is_root` + `edges[].src`, `edges[].dst`, `edges[].kind`
- [ ] 两个端点的权限沿用 `cmdb_instance:read`

### 6. 权限与审计

- [ ] 模型 CRUD 受 `cmdb_model:create/read/update/delete` 四个权限控制
- [ ] 实例 CRUD 受 `cmdb_instance:create/read/update/delete` 四个权限控制
- [ ] 关联关系 CRUD 受 `cmdb_relation:create/read/delete` 权限控制
- [ ] 变更历史查询受 `cmdb_instance:read` 权限控制（集成在实例详情中）
- [ ] 所有写操作写入 `audit_log` 表（module="cmdb"，沿用现有审计基础设施）

### 7. 向后兼容

- [ ] 不修改现有 V1–V13、V20–V22 的 migration 文件
- [ ] 不改变 `/api/change-docs/*` 任何现有端点路径或响应结构
- [ ] 前端 changedoc 页面的 ci_selector 行为不变（Tier 1 仅保证 CMDB 端点存在，解耦动作在另一个 PRD 中）

## 交互流

### 模型管理

1. 管理员进入 `/admin/cmdb/models`
2. 系统展示模型列表（按 group 分组、支持关键字搜索）
3. 点击"新建模型" → 填写 `name`、`display_name`、`group` → 进入字段定义页
4. 字段定义页：逐行添加字段（field_key / type / required / default / enum_options）
5. 保存 → 系统校验 name 唯一 + field_key 不冲突 → 写入 cmdb_model / cmdb_model_field + 记录变更历史

### 实例管理

1. 用户进入 `/cmdb/instances?model=host`
2. 系统按 model 过滤展示实例列表（名称、状态、owner、主键字段值）
3. 点击"新建实例" → 系统按所选模型的字段定义动态渲染表单 → 用户填写 → 保存
4. 系统校验字段数据符合模型 schema → 写入 cmdb_instance + cmdb_instance.fields_data (JSONB) + 记录变更历史
5. 编辑实例 → 系统渲染当前 fields_data → 用户修改 → 保存 → 系统 diff before/after → 写入变更历史（包含 changed_fields）

### 变更历史查询

1. 用户在实例详情页点击"变更历史"tab
2. 系统调用 `GET /api/cmdb/changes?entity_type=instance&entity_id=xxx` 渲染时间线
3. 每条记录展示：时间、操作人、动作类型、changed_fields 列表、可展开查看 before/after diff
4. 审计员进入 `/admin/cmdb/audit`，可按时间范围 / 操作人 / 模型 拉取跨实例变更流

## 非功能性需求

- **性能**: 实例列表接口 P95 < 300ms（10k 实例规模）；搜索接口 P95 < 500ms；变更历史查询 P95 < 500ms
- **数据规模**: Tier 1 目标支持 10 个模型、10k 实例、100k 条变更历史
- **存储**: 使用 PostgreSQL JSONB 存储 fields_data / before_json / after_json；变更历史表按 `created_at` 建索引
- **迁移可靠性**: V14–V19 migration 必须本地空库验证通过；PR 中附 flyway 执行日志
- **安全**: 写操作（模型/实例 CRUD）受权限控制；变更历史仅读；所有写操作同步写 audit_log
- **可观测性**: 关键操作（模型字段变更、批量实例导入/导出）打印 INFO 日志，含操作人、实体 ID

## 不做的事（Tier 1 显式排除）

- ❌ 不做模型版本管理 / 字段变更的软过渡（字段改名 = 删除+新增，历史数据不自动迁移）
- ❌ 不做跨模型的强制外键约束（关联字段仅存 ID，不校验目标是否存在）
- ❌ 不做独立的关联关系表 — **已修正：Tier 1 使用已有 ci_instance_rel 表**
- ❌ 不做批量导入/导出（Tier 2 范围）
- ❌ 不做自动发现 / 同步（Tier 2 范围）
- ❌ 不做变更历史的归档 / 清理策略（Tier 2 范围）
- ❌ 不做前端 changedoc ci_selector 的解耦迁移（另一个 PRD：`2026-06-10-changedoc-refactor-prd.md`）
- ❌ 不做自定义视图 / 过滤器保存（Tier 2 范围）

## 开放问题（已回答）

1. **模型字段变更是否允许？** → 仅允许新增字段和修改 required/default/is_editable，不允许改名/改类型。历史实例中新增字段值为 null。
2. **实例删除的默认策略？** → 逻辑删除（MyBatis-Plus @TableLogic），沿用平台软删除规范。
3. ~~拓扑展开方式~~ → **已解决**：使用 ci_instance_rel 表 + 5 种关联类型做 BFS/DFS 遍历，不再基于字段值引用。
4. **V14–V19 的范围？** → 从生产 DB dump 重建迁移文件，涵盖所有 8 张 CI 表 + seed 数据（host 13属性 + app 5属性 + 5种关联类型 + 5个模型分组）。

## 技术债务说明

- 现有 changedoc 前端仍直调 `/cmdb/*` 端点（参见 CP-1/CP-2），本次 PRD 仅保证 CMDB 端点存在并兼容当前消费格式，解耦动作在 `2026-06-10-changedoc-refactor-prd.md` 中
- V14–V19 的 migration 重建属于历史债务清理，应与新表创建合并到同一批次执行，避免生产环境 schema 漂移

## 下游 handoff

- **Architect** 阅读本 PRD 后，在同一文件追加技术方案（接口契约、数据模型、数据流图、风险评估）
- **PRD 完成标准**: 验收标准全部 ✅ 可验证、开放问题已闭环、Architect 技术方案已追加
