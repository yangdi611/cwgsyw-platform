# CMDB Current Schema（当前态列定义）

> **来源**：本文档由 V14–V44 的 Flyway 迁移与实体 Java 文件叠加推导，记录 **V44 之后** 所有 CMDB 表的最终列定义。
> 不是 Spec 文本的转述 —— 每一列都标注 **来源迁移** 与 **canonical / alias / deprecated / unmapped** 状态。
> **Scope**：CMDB 领域表（`ci_*`）。`audit_log`、`sys_resource`、`sys_permission` 等共享表不在本文档范围。
>
> **状态图例**
> - **canonical** —— 当前语义权威列/字段，新代码必须用。
> - **alias** —— 兼容窗口期的旧名，值与 canonical 相同，下版本删除。
> - **deprecated** —— 历史遗留列，写入路径已停用，仅保留以不破坏 Flyway 历史。
> - **unmapped** —— DB 列存在，但对应实体类 **没有** 映射字段（MyBatis-Plus 不会读写它）。

---

## 0. 全局约定（所有表通用）

所有继承 `BaseEntity` 的表都拥有以下 9 列。`ci_change_record` **不**继承 BaseEntity（append-only 日志），只有 `id / tenant_id / created_at`。

| 列 | 类型 | 约束 / 默认 | 说明 |
|---|---|---|---|
| `id` | `BIGSERIAL` | `PRIMARY KEY` | 主键，自增 |
| `tenant_id` | `VARCHAR(64)` | `NOT NULL DEFAULT 'default'` | 多租户隔离，MVP 固定 `'default'` |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | 创建时间（`FieldFill.INSERT`） |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | 更新时间（`FieldFill.INSERT_UPDATE`） |
| `created_by` | `BIGINT` | `NOT NULL DEFAULT 0` | 创建人 userId；`0` = 系统 |
| `updated_by` | `BIGINT` | `NOT NULL DEFAULT 0` | 更新人 userId（`FieldFill.INSERT_UPDATE`） |
| `is_deleted` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | 逻辑删除标记（`@TableLogic`） |
| `deleted_at` | `TIMESTAMP` | nullable | 删除时间 |
| `deleted_by` | `BIGINT` | nullable | 删除人 userId |

> **时间字段统一 `TIMESTAMP`**（不用 `TIMESTAMPTZ`，见 CLAUDE.md 约定）。
> **不做物理删除**，所有删除走 `@TableLogic` 软删。

---

## 1. `ci_model_group` — 模型分类

模型在 UI 中的分组（如「主机管理」「应用管理」）。

| 列 | 类型 | 约束 | 来源 | 状态 |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | `PK` | V14 | BaseEntity |
| `tenant_id` | `VARCHAR(64)` | `NOT NULL DEFAULT 'default'` | V14 | BaseEntity |
| `code` | `VARCHAR(64)` | `NOT NULL` | V14 | **canonical** 业务编码 |
| `name` | `VARCHAR(128)` | `NOT NULL` | V14 | canonical 显示名 |
| `icon` | `VARCHAR(64)` | nullable | V14 | unmapped（实体无字段） |
| `sort_order` | `INTEGER` | `NOT NULL DEFAULT 0` | V14 | canonical |
| `is_built_in` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V14 | unmapped（实体无字段） |
| `is_deleted` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V14 | BaseEntity |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V14 | BaseEntity |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V14 | BaseEntity |
| `created_by` | `BIGINT` | `NOT NULL DEFAULT 0` | V14 | BaseEntity |
| `updated_by` | `BIGINT` | `NOT NULL DEFAULT 0` | V39 | BaseEntity |
| `deleted_at` | `TIMESTAMP` | nullable | V39 | BaseEntity |
| `deleted_by` | `BIGINT` | nullable | V39 | BaseEntity |

**约束**：`UNIQUE(tenant_id, code)`
**实体**：`CiModelGroup` —— 映射 `code, name, sortOrder`；`icon / is_built_in` 列存在但实体未映射。
**种子**：5 个内置分组（host_manage / network / app_manage / middleware / datacenter）—— V14。

---

## 2. `ci_model` — 模型定义

CI 类型定义（如「主机」「应用」）。**AD-4 收敛**：`name` 列承载 modelCode 语义，`model_id` 列已孤儿化。

| 列 | 类型 | 约束 | 来源 | 状态 |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | `PK` | V14 | BaseEntity |
| `tenant_id` | `VARCHAR(64)` | `NOT NULL DEFAULT 'default'` | V14 | BaseEntity |
| `model_id` | `VARCHAR(64)` | `NOT NULL` | V14 | **deprecated**（AD-4：写入路径停用，保留以不破坏 Flyway 历史；下大版本删除） |
| `name` | `VARCHAR(128)` | `NOT NULL` | V14 | **canonical** = modelCode（`getModelCode()` 返回此列） |
| `icon` | `VARCHAR(64)` | nullable | V14 | unmapped（实体无字段） |
| `group_code` | `VARCHAR(64)` | nullable | V14 | canonical → Java `groupCode` |
| `description` | `VARCHAR(512)` | nullable | V14 | unmapped（实体无字段；UpdateModelRequest 含 description 但实体未映射） |
| `is_built_in` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V14 | canonical → `isBuiltIn` |
| `is_paused` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V14 | unmapped（实体无字段） |
| `sort_order` | `INTEGER` | `NOT NULL DEFAULT 0` | V14 | unmapped（实体无字段） |
| `color` | `VARCHAR(7)` | nullable | V27 | canonical → `color` |
| `enable_2d_view` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V27 | canonical → `enable2dView` |
| `display_name` | `VARCHAR(256)` | nullable | V35 | canonical → `displayName`（V35 补建，V14 遗漏） |
| `is_deleted` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V14 | BaseEntity |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V14 | BaseEntity |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V14 | BaseEntity |
| `created_by` | `BIGINT` | `NOT NULL DEFAULT 0` | V14 | BaseEntity |
| `updated_by` | `BIGINT` | `NOT NULL DEFAULT 0` | V39 | BaseEntity |
| `deleted_at` | `TIMESTAMP` | nullable | V39 | BaseEntity |
| `deleted_by` | `BIGINT` | nullable | V39 | BaseEntity |

**约束**：`UNIQUE(tenant_id, model_id)`；索引 `idx_ci_model_tenant`（partial `WHERE NOT is_deleted`）
**实体**：`CiModel` —— `getModelCode() = this.name`；旧 `getModelId()` 已移除。`model_id / icon / description / is_paused / sort_order` 列存在但实体未映射。
**种子**：2 个内置模型 host / app —— V14。

> ⚠️ **`model_id` vs `name`**：`ci_instance.model_id` 与 `ci_attribute.model_id` 仍引用模型，其值历史上等于 `ci_model.name`（如 `'host'`）。AD-4 不做 `ALTER TABLE RENAME`，故 `model_id` 列保留但孤儿化。

---

## 3. `ci_attribute_group` — 属性分组

模型属性在详情页的分组（如「基本信息」「硬件信息」）。

| 列 | 类型 | 约束 | 来源 | 状态 |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | `PK` | V14 | BaseEntity |
| `tenant_id` | `VARCHAR(64)` | `NOT NULL DEFAULT 'default'` | V14 | BaseEntity |
| `model_id` | `VARCHAR(64)` | `NOT NULL` | V14 | canonical（引用 `ci_model.name`） |
| `group_id` | `VARCHAR(64)` | `NOT NULL` | V14 | **canonical** → Java `code`（`@TableField("group_id")`） |
| `code` | `VARCHAR(64)` | nullable | V37 | alias（= group_id 回填，实体未直接映射） |
| `name` | `VARCHAR(128)` | `NOT NULL` | V14 | canonical |
| `is_default` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V14 | unmapped（实体无字段） |
| `is_built_in` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V14 | unmapped（实体无字段） |
| `sort_order` | `INTEGER` | `NOT NULL DEFAULT 0` | V14 | canonical |
| `is_deleted` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V14 | BaseEntity |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V14 | BaseEntity |
| `updated_at` | `INTEGER`→`TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V37 | BaseEntity |
| `created_by` | `BIGINT` | `NOT NULL DEFAULT 0` | V37 | BaseEntity |
| `updated_by` | `BIGINT` | `NOT NULL DEFAULT 0` | V37 | BaseEntity |
| `deleted_at` | `TIMESTAMP` | nullable | V37 | BaseEntity |
| `deleted_by` | `BIGINT` | nullable | V37 | BaseEntity |

**约束**：`UNIQUE(tenant_id, model_id, group_id)`
**实体**：`CiAttributeGroup` —— Java 字段 `code` 映射到列 `group_id`。V37 补建的 `code` 列由 `code = group_id` 回填，作为兼容副本。
**V37 背景**：V14 建表遗漏 `code / updated_at / created_by / updated_by / deleted_at / deleted_by`，导致 MyBatis-Plus SELECT 抛 column not found。

---

## 4. `ci_attribute` — 属性定义

模型字段定义 + 类型系统（AD-5 FieldType 枚举）。

| 列 | 类型 | 约束 | 来源 | 状态 |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | `PK` | V14 | BaseEntity |
| `tenant_id` | `VARCHAR(64)` | `NOT NULL DEFAULT 'default'` | V14 | BaseEntity |
| `model_id` | `VARCHAR(64)` | `NOT NULL` | V14 | canonical（引用 `ci_model.name`） |
| `field_key` | `VARCHAR(64)` | `NOT NULL` | V14 | **canonical** → `fieldKey` |
| `name` | `VARCHAR(128)` | `NOT NULL` | V14 | canonical 显示名 |
| `group_id` | `VARCHAR(64)` | nullable | V14 | canonical → `groupId` |
| `field_type` | `VARCHAR(32)` | `NOT NULL` | V14 | canonical（AD-5 枚举见下） → `fieldType` |
| `option` | `JSONB` | nullable | V14 | **canonical**（enum/enummulti 选项） → `List<Map>` |
| `default_val` | `TEXT` | nullable | V14 | canonical → `defaultValue` |
| `placeholder` | `VARCHAR(255)` | nullable | V14 | unmapped（实体无字段） |
| `unit` | `VARCHAR(32)` | nullable | V14 | unmapped（实体无字段） |
| `is_required` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V14 | canonical |
| `is_editable` | `BOOLEAN` | `NOT NULL DEFAULT TRUE` | V14 | canonical |
| `is_unique` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V14 | canonical |
| `is_built_in` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V14 | canonical |
| `is_list_show` | `BOOLEAN` | `NOT NULL DEFAULT TRUE` | V14 | canonical |
| `sort_order` | `INTEGER` | `NOT NULL DEFAULT 0` | V14 | canonical |
| `is_deleted` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V14 | BaseEntity |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V14 | BaseEntity |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V14 | BaseEntity |
| `created_by` | `BIGINT` | `NOT NULL DEFAULT 0` | V14 | BaseEntity |
| `updated_by` | `BIGINT` | `NOT NULL DEFAULT 0` | V39 | BaseEntity |
| `deleted_at` | `TIMESTAMP` | nullable | V39 | BaseEntity |
| `deleted_by` | `BIGINT` | nullable | V39 | BaseEntity |

**约束**：`UNIQUE(tenant_id, model_id, field_key)`；索引 `idx_ci_attribute_model`（partial）
**`option` 注释**（V42）：`Enum/enummulti field options in JSONB format. Canonical: [{"id":"linux","name":"Linux","is_default":true}]`
**实体**：`CiAttribute` —— `enumOptions`（String）字段 **@Deprecated**，读取一个 DB 中不存在的列（V42 确认 `ci_attribute` 从未有 `enum_options` 列），正确路径是 `option` JSONB。`placeholder / unit` 列存在但实体未映射。

### AD-5 Canonical FieldType 枚举

| field_type | 含义 |
|---|---|
| `singlechar` | 短字符串 |
| `longchar` | 长文本 |
| `int` | 整数 |
| `float` | 浮点 |
| `bool` | 布尔 |
| `date` | 日期（ISO-8601 字符串） |
| `enum` | 单选 |
| `enummulti` | 多选 |
| `objuser` | 用户引用（存 user id 字符串） |

> 裸 `list` 类型已废弃，前端分支逻辑对齐为 `enummulti`（AD-5）。

---

## 5. `ci_association_kind` — 关联种类（语义字典）

关联的语义类型（如「运行」「依赖」「连接」）。**AD-3**：纯语义字典，实例关联以 `ci_association_def.def_id` 为依据。

| 列 | 类型 | 约束 | 来源 | 状态 |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | `PK` | V14 | BaseEntity |
| `tenant_id` | `VARCHAR(64)` | `NOT NULL DEFAULT 'default'` | V14 | BaseEntity |
| `kind_id` | `VARCHAR(64)` | `NOT NULL` | V14 | **canonical** → Java `code`（`@TableField("kind_id")`） |
| `name` | `VARCHAR(128)` | `NOT NULL` | V14 | canonical |
| `src_to_dst` | `VARCHAR(64)` | nullable | V14 | unmapped（实体无字段） |
| `dst_to_src` | `VARCHAR(64)` | nullable | V14 | unmapped（实体无字段） |
| `is_built_in` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V14 | canonical |
| `is_deleted` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V14 | BaseEntity |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V14 | BaseEntity |
| `created_by` | `BIGINT` | `NOT NULL DEFAULT 0` | V39 | BaseEntity |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V39 | BaseEntity |
| `updated_by` | `BIGINT` | `NOT NULL DEFAULT 0` | V39 | BaseEntity |
| `deleted_at` | `TIMESTAMP` | nullable | V39 | BaseEntity |
| `deleted_by` | `BIGINT` | nullable | V39 | BaseEntity |

**约束**：`UNIQUE(tenant_id, kind_id)`
**实体**：`CiAssociationKind` —— Java 字段 `code` 映射列 `kind_id`。`src_to_dst / dst_to_src` 列存在但实体未映射。
**种子**：6 个内置 kind —— V14：`bk_mainline, belong, run, connect, depend, deploy`。

---

## 6. `ci_association_def` — 模型关联定义

定义两个模型间允许建立哪种关联（方向、语义、基数、删除策略）。业务主键 `def_id`，被 `ci_instance_rel.def_id` 引用（AD-3）。

| 列 | 类型 | 约束 | 来源 | 状态 |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | `PK` | V14 | BaseEntity |
| `tenant_id` | `VARCHAR(64)` | `NOT NULL DEFAULT 'default'` | V14 | BaseEntity |
| `def_id` | `VARCHAR(128)` | `NOT NULL` | V14 | **canonical** 业务主键 → `defId` |
| `kind_id` | `VARCHAR(64)` | `NOT NULL` | V14 | canonical（引用 `ci_association_kind.kind_id`） → `kindId` |
| `src_model_id` | `VARCHAR(64)` | `NOT NULL` | V14 | canonical（引用 `ci_model.name`） → `srcModelId` |
| `dst_model_id` | `VARCHAR(64)` | `NOT NULL` | V14 | canonical（引用 `ci_model.name`） → `dstModelId` |
| `name` | `VARCHAR(128)` | nullable | V14 | canonical |
| `mapping` | `VARCHAR(8)` | `NOT NULL DEFAULT 'n:n'` | V14 | canonical（`1:1` / `1:n` / `n:n`） |
| `on_delete` | `VARCHAR(16)` | `NOT NULL DEFAULT 'none'` | V14 | canonical（`none` / `cascade` / `restrict`） → `onDelete` |
| `is_built_in` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V14 | canonical |
| `is_deleted` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V14 | BaseEntity |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V14 | BaseEntity |
| `created_by` | `BIGINT` | `NOT NULL DEFAULT 0` | V39 | BaseEntity |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V39 | BaseEntity |
| `updated_by` | `BIGINT` | `NOT NULL DEFAULT 0` | V39 | BaseEntity |
| `deleted_at` | `TIMESTAMP` | nullable | V39 | BaseEntity |
| `deleted_by` | `BIGINT` | nullable | V39 | BaseEntity |

**约束**：`UNIQUE(tenant_id, def_id)`
**实体**：`CiAssociationDef` —— 全部列已映射。AC3（V41 回填）确保 `ci_instance_rel.def_id` 指向合法 `def_id`。

---

## 7. `ci_association_attr_def` — 关联扩展属性定义

关联实例上可携带的扩展属性 schema（按 kind 定义，`metadata` 校验依据）。

| 列 | 类型 | 约束 | 来源 | 状态 |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | `PK` | V24 | BaseEntity |
| `tenant_id` | `VARCHAR(64)` | `NOT NULL DEFAULT 'default'` | V24 | BaseEntity |
| `association_kind` | `VARCHAR(64)` | `NOT NULL` | V24 | canonical（引用 kind） |
| `field_key` | `VARCHAR(64)` | `NOT NULL` | V24 | canonical |
| `name` | `VARCHAR(128)` | `NOT NULL` | V24 | canonical |
| `field_type` | `VARCHAR(32)` | `NOT NULL` | V24 | canonical（AD-5 枚举） |
| `is_required` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V24 | canonical |
| `enum_options` | `TEXT` | nullable | V24 | canonical（此表为 TEXT，区别于 `ci_attribute.option` JSONB） |
| `default_value` | `VARCHAR(512)` | nullable | V24 | canonical |
| `sort_order` | `INT` | `NOT NULL DEFAULT 0` | V24 | canonical |
| `is_deleted` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V24 | BaseEntity |
| `deleted_at` | `TIMESTAMP` | nullable | V24 | BaseEntity |
| `deleted_by` | `BIGINT` | nullable | V24 | BaseEntity |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V24 | BaseEntity |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V24 | BaseEntity |
| `created_by` | `BIGINT` | nullable | V24 | BaseEntity |
| `updated_by` | `BIGINT` | nullable | V24 | BaseEntity |

**约束**：唯一索引 `idx_ci_assoc_attr_kind_key (tenant_id, association_kind, field_key) WHERE NOT is_deleted`
**实体**：`CiAssociationAttrDef` —— 全部列映射。

> ⚠️ 此表 `enum_options` 为 **TEXT** 类型（与 `ci_attribute.option` 的 JSONB 不同），未走 AD-5 的 JSON 统一。

---

## 8. `ci_instance` — CI 实例

模型的具体数据，动态属性存 `attrs JSONB`。

| 列 | 类型 | 约束 | 来源 | 状态 |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | `PK` | V15 | BaseEntity |
| `tenant_id` | `VARCHAR(64)` | `NOT NULL DEFAULT 'default'` | V15 | BaseEntity |
| `model_id` | `VARCHAR(64)` | `NOT NULL` | V15 | canonical（引用 `ci_model.name`） → `modelId` |
| `name` | `VARCHAR(255)` | nullable | V15 | canonical 实例名 |
| `attrs` | `JSONB` | `NOT NULL DEFAULT '{}'` | V15 | **canonical** 动态属性 → Java `fieldsData`（`JacksonTypeHandler`） |
| `status` | `VARCHAR(64)` | nullable | V36 | canonical（V36 补建，V15 遗漏） |
| `owner` | `VARCHAR(255)` | nullable | V36 | canonical（V36 补建） |
| `description` | `VARCHAR(512)` | nullable | V36 | canonical（V36 补建） |
| `is_deleted` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V15 | BaseEntity |
| `deleted_at` | `TIMESTAMP` | nullable | V15 | BaseEntity |
| `deleted_by` | `BIGINT` | nullable | V15 | BaseEntity |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V15 | BaseEntity |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V15 | BaseEntity |
| `created_by` | `BIGINT` | `NOT NULL DEFAULT 0` | V15 | BaseEntity |
| `updated_by` | `BIGINT` | nullable | V15 | BaseEntity |

**索引**：
- `idx_ci_instance_model (tenant_id, model_id, created_at DESC) WHERE NOT is_deleted`
- `idx_ci_instance_attrs GIN(attrs) WHERE NOT is_deleted`

**实体**：`CiInstance` —— `@TableName(autoResultMap=true)`；`attrs` 列映射 Java `fieldsData`（`Map<String,Object>`）。V36 从 `attrs` JSONB 回填 `status/owner/description` 到独立列。
**JSONB 更新注意**（CLAUDE.md）：更新含 JSONB 字段必须用 `updateById(entity)`，不能用 `LambdaUpdateWrapper.set(...)`（会绕过 `JacksonTypeHandler` 触发 hstore 错误）。

---

## 9. `ci_instance_rel` — 实例关联

两个 CI 实例间的有向关联 `src_id → dst_id`，通过 `def_id` 引用关联定义。**AD-2/AD-3**：列名收敛为 `def_id / src_id / dst_id`，`def_id` 指向 `ci_association_def.def_id`。

| 列 | 类型 | 约束 | 来源 | 状态 |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | `PK` | V16 | BaseEntity |
| `tenant_id` | `VARCHAR(64)` | `NOT NULL DEFAULT 'default'` | V16 | BaseEntity |
| `def_id` | `VARCHAR(128)` | `NOT NULL` | V16 | **canonical**（引用 `ci_association_def.def_id`） → `defId` |
| `src_id` | `BIGINT` | `NOT NULL` | V16 | canonical 源实例 → `srcInstanceId` |
| `dst_id` | `BIGINT` | `NOT NULL` | V16 | canonical 目标实例 → `dstInstanceId` |
| `attrs` | `JSONB` | `NOT NULL DEFAULT '{}'` | V16 | **legacy / unmapped**（V16 原始关联属性列，已被 `metadata` 取代；实体未映射） |
| `metadata` | `JSONB` | `NOT NULL DEFAULT '{}'` | V24 | **canonical** 关联扩展属性 → `metadata`（`JacksonTypeHandler`） |
| `is_deleted` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | V16 | BaseEntity |
| `deleted_at` | `TIMESTAMP` | nullable | V16 | BaseEntity |
| `deleted_by` | `BIGINT` | nullable | V16 | BaseEntity |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V16 | BaseEntity |
| `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V16 | BaseEntity |
| `created_by` | `BIGINT` | `NOT NULL DEFAULT 0` | V16 | BaseEntity |
| `updated_by` | `BIGINT` | nullable | V16 | BaseEntity |

**索引**：
- `idx_ci_rel_src (tenant_id, src_id) WHERE NOT is_deleted`
- `idx_ci_rel_dst (tenant_id, dst_id) WHERE NOT is_deleted`
- `idx_ci_rel_attrs GIN(attrs) WHERE NOT is_deleted`
- `idx_ci_rel_metadata GIN(metadata)`（V24，非 partial）
- `idx_ci_rel_unique UNIQUE (tenant_id, def_id, src_id, dst_id) WHERE NOT is_deleted`

**实体**：`CiInstanceRel` —— 仅映射 `metadata`，不映射 `attrs`。`attrs` 列保留但已 unmapped（canonical 关联属性走 `metadata`）。
**V41 回填**：历史上 `def_id` 被误写成裸 kind code（如 `'run'`）；V41 为每个 `(src_model, dst_model, kind)` 组合创建/推导合法 `ci_association_def`，把 `def_id` 回填为形如 `run_host__app` 的合法业务主键。

---

## 10. `ci_change_record` — CMDB 领域变更记录

**AD-6 / AC6**：CMDB 变更历史的领域内权威源，与通用 `audit_log` 解耦。`field_changes` 存结构化字段级 diff，不再依赖 `audit_log` 的 before/after 全量快照。

| 列 | 类型 | 约束 | 来源 | 状态 |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | `PK` | V43 | — |
| `tenant_id` | `VARCHAR(64)` | `NOT NULL DEFAULT 'default'` | V43 | — |
| `instance_id` | `BIGINT` | `NOT NULL` | V43 | canonical（引用 `ci_instance.id`） |
| `model_code` | `VARCHAR(64)` | `NOT NULL` | V43 | canonical（= `CiModel.name`，反范式化便于 SQL 过滤） |
| `action` | `VARCHAR(32)` | `NOT NULL` | V43 | canonical（`create` / `update` / `delete` / `relate`） |
| `field_changes` | `JSONB` | nullable | V43 | canonical 结构化 diff `[{"field","before","after"}]`（null before = 新增字段，null after = 删除字段） |
| `operator_id` | `BIGINT` | nullable | V43 | canonical 操作人 userId |
| `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT NOW()` | V43 | — |

**索引**：`idx_ccr_instance_id`、`idx_ccr_model_code`、`idx_ccr_action`、`idx_ccr_created_at`、`idx_ccr_tenant_id`
**实体**：`CiChangeRecord` —— **不继承 BaseEntity**（append-only，无 `is_deleted / updated_*`）。`field_changes` 经 `JacksonTypeHandler` 映射 `List<Map>`。
**双写期**：`CiInstanceService` 的 create/update/delete 同时写 `audit_log`（跨模块审计）与 `ci_change_record`（CMDB 变更历史/统计）。`CiChangeService` 统计/全局列表查 `ci_change_record`。

---

## 附录 A：迁移影响汇总

| 表 | 建表 | 补列 / 数据迁移 |
|---|---|---|
| `ci_model_group` | V14 | V39（updated_by/deleted_at/deleted_by） |
| `ci_model` | V14 | V27（color/enable_2d_view）、V35（display_name）、V38（color 回填）、V39（updated_by/deleted_at/deleted_by） |
| `ci_attribute_group` | V14 | V37（code/updated_at/created_by/updated_by/deleted_at/deleted_by） |
| `ci_attribute` | V14 | V39（updated_by/deleted_at/deleted_by）、V42（option 列注释 + 数据完整性校验） |
| `ci_association_kind` | V14 | V39（created_by/updated_at/updated_by/deleted_at/deleted_by） |
| `ci_association_def` | V14 | V39（created_by/updated_at/updated_by/deleted_at/deleted_by） |
| `ci_association_attr_def` | V24 | — |
| `ci_instance` | V15 | V36（status/owner/description + 从 attrs 回填） |
| `ci_instance_rel` | V16 | V24（metadata JSONB + GIN 索引）、V41（def_id 数据回填） |
| `ci_change_record` | V43 | — |

> 注：本 worktree 的 V17/V18/V19 为 shared_file / group_leader / workflow 迁移（与 CLAUDE.md 历史迁移表编号不一致）。CMDB 建表与种子在 V14，索引分散在 V15/V16/V24/V29。

## 附录 B：CMDB 相关 `audit_log` 索引（V29）

`audit_log` 为跨模块共享表，V29 专为 CMDB 变更历史补建了 partial index（双写期 `ci_change_record` 尚未完全取代审计查询）：

- `idx_audit_cmdb_instance_changes (tenant_id, target_type, target_id, created_at DESC) WHERE module = 'cmdb' AND target_type = 'ci_instance'`
- `idx_audit_cmdb_stats (tenant_id, target_type, action, created_at) WHERE module = 'cmdb'`
