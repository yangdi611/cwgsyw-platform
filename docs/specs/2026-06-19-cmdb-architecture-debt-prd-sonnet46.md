# PRD: CMDB 架构债务清理 (P1/P2/P3)

日期: 2026-06-19
状态: Ready_For_Architecture
分支: feature/cmdb-architecture-debt-phase1
基线: development
作者: Product (claude-sonnet-4-6)

---

## 1. 背景与问题陈述

cwgsyw-platform 的 CMDB 模块经历多轮迭代修复后，已积累明显的架构债务。这些债务导致：

- 功能行为不可预期（实例详情页属性可能显示为空，保存可能静默失败）
- 前后端协议存在多处不匹配，运行时才暴露错误
- 拓扑 SQL 查询字段名与数据库实际字段名不一致，存在运行时风险
- Association Kind / Def 双级关系设计未落地，关联创建缺乏约束
- 命名体系混乱（modelId 同时表示数值 id 和模型编码），前端路由语义模糊
- 字段类型体系不统一，前后端组件各自做判断
- CMDB 变更历史依赖系统审计表，字段级 diff 依赖 JSON 字符串解析
- CiInstanceService 职责过胖，存在循环依赖隐患
- 当前最终 schema 和 API contract 无文档，新 worker 只能从 V14-V40 迁移链猜测

以上问题共同影响了：
- 运维人员：实例详情页可能无法正常展示和编辑属性
- 开发者：难以安全地在 CMDB 模块中增加功能，风险不透明
- 测试/QA：没有明确 contract，无法有效回归
- 后续 Engineer/Architect：缺少统一参考文档，持续打零散补丁

本 Phase 1 的目标是：**明确所有问题、制定统一改造方案（PRD + Spec），为 Phase 2 的可控、分步实现打下基础。**

---

## 2. 目标

1. 消除 P1 级功能缺陷（实例详情 DTO 不一致、保存 payload 错误、拓扑 SQL 字段名错误）
2. 落地 Association Kind / Def 双级关系设计，使关联约束可执行
3. 统一 modelCode/id/displayName 命名体系，消除歧义
4. 统一字段类型枚举和 enumOptions 格式，前后端共用同一语义
5. 解耦 CMDB 变更历史与 AuditLog，建立领域级变更记录
6. 拆分 CiInstanceService 职责，消除架构坏味道
7. 明确前端路由参数语义和管理/业务页面边界
8. 统一权限资源与 action 命名
9. 产出 current schema 文档和 API contract 文档，作为后续工程的单一参考来源

---

## 3. 非目标（本 Phase 1 不做）

- 修改任何代码
- 修改数据库或数据迁移
- 迁移生产数据
- 部署到任何环境
- 前端全局切换 snake_case（方向确认为前端对齐后端 camelCase）

---

## 4. 用户故事

### 运维人员

- 作为运维人员，我想在 CMDB 实例详情页正常查看和编辑所有动态属性，以便维护配置数据的准确性
- 作为运维人员，我想保存实例属性时收到明确的成功/失败反馈，以便确认修改已生效
- 作为运维人员，我想通过拓扑图正确查看实例之间的关联关系，以便进行影响分析
- 作为运维人员，我想创建实例关联时系统验证 src/dst 模型组合是否被允许，以便维护关联数据质量

### 开发者

- 作为开发者，我想查阅一份明确的 CMDB API contract 文档，以便快速了解字段命名和类型规范，不再猜测
- 作为开发者，我想查阅一份 current schema 文档，以便直接了解当前 DB 表结构，不用推导 V14-V40 迁移链
- 作为开发者，我想 CiInstanceService 职责单一，以便安全扩展功能而不引入意外副作用

### 测试/QA

- 作为测试人员，我想有明确的验收标准和字段映射，以便有效回归 CMDB 核心功能

---

## 5. 范围（P1/P2/P3）

### P1: 功能缺陷修复（高优先级，影响现有功能正确性）

#### P1-1. 实例详情 DTO 协议统一

问题：前端 snake_case（`model_id`, `attrs`, `field_config`, `created_at`）vs 后端 camelCase（`modelId`, `fieldsData`, `attributes`, `createdAt`），导致实例详情页头部信息可能 undefined，基本信息 tab 可能渲染为空。

目标：
- 前端统一对齐后端 camelCase 字段名
- `inst.attrs` → `inst.fieldsData`
- `field_config` → `attributes`
- `model_id` → `modelId`
- 时间字段 `created_at/updated_at` → `createdAt/updatedAt`

#### P1-2. 实例基本信息保存 payload 修复

问题：前端 `PUT /cmdb/instances/:id` 发送 `{ attrs: editAttrs }`，后端 `UpdateInstanceRequest` 期望 `{ fieldsData: ... }`，导致动态属性保存静默失败。

目标：前端保存 payload 字段名改为 `fieldsData`，与后端 request body 对齐。

#### P1-3. 关联关系 SQL 字段名清理

问题：`CiInstanceRelMapper.findTopologyEdges()` 仍使用旧字段名 `src_instance_id / dst_instance_id / association_kind`，而 V16 迁移和 Entity 映射使用 `src_id / dst_id / def_id`，导致拓扑 SQL 存在运行时风险。

目标：统一 SQL 和 Mapper 使用 `src_id / dst_id / def_id`，与 DB schema 一致。

#### P1-4. Association Kind / Def 双级关系设计落地

问题：实例创建关联时仅校验 `associationKind` 存在和实例存在，未约束 src/dst model 组合、方向、mapping 类型、on_delete 行为，`ci_instance_rel.def_id` 实际指向 association kind 而非 association def。

目标：
- AssociationKind：语义标签，定义关联的名称和方向文案
- AssociationDef：具体两个模型之间的关系定义，绑定 kind、src model、dst model、mapping（1:1/1:n/n:n）、on_delete
- 实例关联创建基于 `defId`（`CiAssociationDef.defId`），不再裸传 kind
- `ci_instance_rel.def_id` 语义上指向 `ci_association_def.def_id`

#### P1-5. modelId / id / name / displayName 命名收敛

问题：`model_id` 字段同时用于数值主键和模型编码；`CiModel.name` 实际承载模型编码；前端路由 `[modelId]` 有时是 numeric id，有时是 model code。

目标：
- 明确 `id`（数值主键）、`modelCode`（唯一编码，原 `name`）、`displayName`（展示名）三者语义
- 后端 DTO 字段名: `id`, `modelCode`, `displayName`
- 前端路由参数: `[modelCode]`（模型路由）、`[instanceId]`（实例路由）

#### P1-6. 字段类型和 enumOptions 格式统一

问题：前后端字段类型枚举不统一（`singlechar/longchar/int/enum/objuser` vs `bool/date/list/enum/int`），enumOptions 存储/读取格式不一致（JSON vs 换行字符串）。

目标：
- 定义统一 FieldType 枚举（如：`TEXT`, `LONG_TEXT`, `INTEGER`, `DECIMAL`, `BOOLEAN`, `DATE`, `DATETIME`, `ENUM`, `USER_REF`, `LIST`）
- enumOptions 统一为 JSON 数组格式：`[{"value": "...", "label": "..."}]`
- 前端表单、CSV 导入、SchemaValidator 共用同一语义

#### P1-7. CMDB 变更历史解耦

问题：`CiChangeService` 依赖 `AuditLog.beforeJson/afterJson` 做变更统计和字段级 diff，造成：领域变更依赖系统审计表、JSON 结构变化影响统计、`CiInstanceService` 通过 `@Lazy CiChangeService` 做 cache invalidation 存在循环依赖。

目标：
- 设计领域级 `ci_change_record` 表记录 CMDB 变更（实例创建/更新/删除/关联变更）
- `AuditLog` 保留系统审计职责，不用于 CMDB 变更统计
- 消除 `@Lazy` 循环依赖

---

### P2: 架构优化（次高优先级，影响可维护性）

#### P2-1. CiInstanceService 职责拆分

问题：单一 Service 同时承担 CRUD、字段 schema 校验、唯一性校验、relation metadata 校验内部类、审计写入、关联资源查询、change stats cache invalidation。

目标：拆分为以下职责明确的单元：
- `CiInstanceQueryService`：查询相关
- `CiInstanceCommandService`：写操作（创建/更新/删除）
- `CiSchemaValidationService`：字段 schema 校验、唯一性校验
- `CiRelationMetadataService`：relation metadata 校验
- 变更事件发布解耦 cache invalidation

#### P2-2. 前端路由和页面边界清晰化

问题：`[modelId]` 语义不清，topology 页面兼任拓扑和拓扑对比入口，管理页和业务页边界模糊。

目标：
- 路由参数: `/cmdb/admin/models/[modelCode]`、`/cmdb/instances/by-model/[modelCode]`、`/cmdb/topology/[instanceId]`
- 管理配置页（`/cmdb/admin/*`）：模型定义、属性、关联 def 管理
- 业务浏览页（`/cmdb/instances/*`、`/cmdb/topology/*`、`/cmdb/impact/*`）：实例操作

#### P2-3. 权限模型收敛

问题：`write` 和 `update` 混用，relation/import/impact/topology/attribute 权限边界不清晰。

目标：
- 统一资源列表：`cmdb_model`, `cmdb_attribute`, `cmdb_instance`, `cmdb_relation`, `cmdb_topology`, `cmdb_import`, `cmdb_impact`, `cmdb_alert`
- 统一 action 列表：`read`, `create`, `update`, `delete`, `export`, `manage`
- 清理 `cmdb_model:write` 等非标 action

---

### P3: 文档补全（配套工程资产）

#### P3-1. Current Schema 文档

目标：输出 `docs/cmdb/schema-current.md`，覆盖 V14-V40 迁移后的最终表结构，包括：
- 所有表名、字段名、类型、约束、索引
- 外键和关联关系说明
- 字段命名约定（以此为单一参考来源）

#### P3-2. API Contract / Frontend DTO Mapping 文档

目标：输出 `docs/cmdb/api-contract.md`，明确：
- 所有 CMDB API 端点
- 请求/响应字段名（统一 camelCase）
- 字段类型和枚举值
- 路由参数语义（`modelCode` vs `instanceId`）

---

## 6. 验收标准草稿

### AC1: 实例详情 DTO / Payload 修复

- [ ] 实例详情页头部正确展示 `modelId`（数值）和 `modelCode`
- [ ] `InstanceBasicInfoTab` 读取 `inst.fieldsData`，属性列表正常渲染
- [ ] 保存基本信息时，`PUT /cmdb/instances/:id` payload 包含 `fieldsData` 字段
- [ ] 保存成功后，刷新页面可看到更新后的属性值
- [ ] 保存失败时，有明确错误提示

### AC2: 拓扑 SQL 字段名清理

- [ ] `findTopologyEdges()` SQL 使用 `src_id / dst_id / def_id`
- [ ] 拓扑图正常加载，节点和边均正确渲染
- [ ] 影响分析页面正常展示

### AC3: AssociationDef Controller + defId 创建关系

- [ ] 通过 `AssociationDef` 管理页面可以为两个具体模型创建关联定义（绑定 kind、src model、dst model、mapping、on_delete）
- [ ] 创建实例关联时，传 `defId`，系统校验 src/dst 实例的模型是否匹配 def 的 src/dst model
- [ ] 不符合 def 约束的关联创建请求返回 400，错误信息明确
- [ ] `ci_instance_rel.def_id` 实际指向 `ci_association_def.id`

### AC4: modelCode/id/displayName 命名收敛

- [ ] 后端 CiModel DTO 统一输出 `id`, `modelCode`, `displayName`
- [ ] 前端路由 `/cmdb/admin/models/[modelCode]`、`/cmdb/instances/by-model/[modelCode]` 使用 modelCode
- [ ] 前端通过 modelCode 查询模型和实例的 API 均正常工作
- [ ] 无 `modelId` 同时表示数值 id 和 code 的情况

### AC5: FieldType / enumOptions 统一

- [ ] 后端定义统一 FieldType 枚举，前端 types 文件同步
- [ ] enumOptions 存储格式统一为 `[{"value": "...", "label": "..."}]`
- [ ] 前端属性编辑表单、CSV 导入模板、SchemaValidator 共用同一 FieldType 枚举
- [ ] 历史 enumOptions 数据迁移脚本输出（或迁移策略确认）

### AC6: CMDB 变更历史解耦

- [ ] 新建 `ci_change_record` 表（或等效领域事件表），记录 CMDB 实例和关联的变更
- [ ] `CiChangeService` 从 `ci_change_record` 读取统计，不再解析 `AuditLog.beforeJson/afterJson`
- [ ] 消除 `@Lazy CiChangeService` 注入，无循环依赖警告
- [ ] 现有变更历史页面和统计页面功能正常

### AC7: 权限模型收敛

- [ ] 权限资源和 action 统一为规范列表
- [ ] 现有功能页面的权限守卫正常工作（无误放/误拦截）
- [ ] 新迁移脚本清理旧权限记录

### AC8: 文档产出

- [ ] `docs/cmdb/schema-current.md` 存在且覆盖全部 CMDB 相关表
- [ ] `docs/cmdb/api-contract.md` 存在且覆盖全部 CMDB API 端点、字段规范

### AC9: CiInstanceService 拆分

- [ ] `CiInstanceService` 不再直接包含字段 schema 校验逻辑
- [ ] 查询和命令职责分离
- [ ] 现有单元测试通过，关键路径有集成测试覆盖

---

## 7. 迁移与兼容风险

| 风险点 | 级别 | 说明 |
|---|---|---|
| DTO 字段名变更导致前端多处联动修改 | 高 | 需梳理全部使用 `inst.attrs`、`field_config`、`model_id` 的前端文件，逐一修正 |
| `findTopologyEdges` SQL 修改后拓扑功能回归 | 高 | 修改前需备好拓扑功能测试用例，修改后全量回归 |
| modelCode 替换 modelId 路由参数 | 高 | 需确认所有路由跳转和 API 调用均更新；需兼容旧链接或提供重定向 |
| AssociationDef 落地后历史关联数据 def_id 为 null 或指向 kind | 中 | 需数据迁移脚本将历史 def_id 修正为 association_def.id，或制定兼容读取策略 |
| enumOptions 格式迁移 | 中 | 历史数据格式不统一，需迁移脚本或读取时做格式兼容降级 |
| CiInstanceService 拆分后测试覆盖 | 中 | 需确保拆分前存在足够的单元/集成测试，否则拆分引入回归风险 |
| 权限 action 改名可能影响现有角色/权限配置 | 中 | 需种子数据迁移，确保现有角色权限不受影响 |
| ci_change_record 新表初始化 | 低 | Phase 2 实现时历史变更不回填，仅记录实施后的新变更；旧统计数据可能有断层 |

---

## 8. 排除项（明确不在本需求范围内）

- CMDB 以外的其他模块改造
- 告警（cmdb_alert）功能逻辑改造（权限 AC 中仅收敛权限资源命名）
- 全局前端切换 snake_case
- 数据库主键类型调整
- 生产数据迁移（Phase 1 仅产出文档，Phase 2 实现时另行安排）
- 任何代码变更（本 Phase 1 PRD 阶段不修改代码）

---

## 9. Phase 2 拆分建议

以下 AC 建议按独立任务交付，每个任务可单独验证：

| 任务 | 对应 AC | 说明 |
|---|---|---|
| AC1 | 实例详情 DTO/payload 修复 | 前端字段名对齐，可最快交付 |
| AC2 | ci_instance_rel SQL 清理 | 后端 mapper 修复，影响有限 |
| AC3 | AssociationDef Controller + defId 关联创建 | 需前后端配合，复杂度中等 |
| AC4 | modelCode/id/displayName 命名收敛 | 全栈改动，需前后端同步，建议配合 AC3 一起做 |
| AC5 | FieldType/enumOptions 统一 | 需前后端 + CSV 导入 + 数据迁移脚本 |
| AC6 | CMDB change record 设计与 AuditLog 解耦 | 需新建表 + 服务改造 + 测试 |
| AC7 | 权限模型收敛 | 需种子数据迁移 + 全量权限回归 |
| AC8 | current schema + API contract 文档 | 纯文档输出，可并行进行 |
| AC9 | CiInstanceService 拆分 | 建议在 AC1/AC2 完成后进行，降低重构风险 |

---

## 10. 架构交接（Architect 阅读本节后在本文件追加 Spec）

Architect 需要在本 PRD 同文件追加技术方案，覆盖以下内容：

1. 当前架构问题分析（逐条对应 P1/P2/P3，评估影响面）
2. API contract 统一方案（camelCase 规范、DTO 字段映射表）
3. DB/schema 兼容方案（哪些字段需要新迁移、是否需要数据迁移脚本）
4. Association Kind / Def 双级落地设计（表结构、约束逻辑、Controller 变更）
5. FieldType 枚举统一方案（前后端共用定义方式）
6. 前端路由和 DTO 改造方案（路由参数重命名策略、兼容过渡方案）
7. 权限模型调整方案（迁移脚本、role-permission 种子数据）
8. 变更历史解耦方案（ci_change_record 表设计、事件发布机制）
9. CiInstanceService 拆分方案（职责边界划分、接口设计）
10. AC 级工程任务拆分建议（工作量估算、依赖关系）
11. 回归测试矩阵（核心路径、高风险改动）
12. 风险与回滚策略

---

*本 PRD 由 Product 完成。Architect 请在本文件末尾追加 Spec 章节。*
