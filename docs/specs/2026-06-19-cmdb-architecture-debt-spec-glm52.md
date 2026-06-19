# 技术 Spec: CMDB 架构债务清理（P1 / P2 / P3）

> 日期: 2026-06-19
> 角色: Architect (custom:glm / glm-5.2)
> 状态: Phase 1 — Spec only，待 Engineer 在 Phase 2 按 AC 拆分实现
> 分支策略: 从 `development` 新建 `feature/cmdb-architecture-debt-phase1`（Spec 阶段），Phase 2 实现分支按 AC 另行切出
> 上游:
> - Brief: `docs/specs/2026-06-19-cmdb-architecture-debt-brief.md`
> - PRD: `docs/specs/2026-06-19-cmdb-architecture-debt-prd-gaccode.md`（父任务 t_6f3a1230，已完成）
> 本 Spec 不反向修改 PRD 的产品边界。技术方案与产品验收标准对齐，但不替换产品口径。

---

## 0. 证据基线声明

本 Spec 的"当前状态"部分均基于对实际代码和迁移文件的审计，不是对 brief 的转述。审计覆盖：

- 实体：`CiModel`、`CiInstance`、`CiInstanceRel`、`CiAttribute`、`CiAssociationKind`、`CiAssociationDef`、`CiAssociationAttrDef`
- DTO：`CiInstanceDetailVO`、`UpdateInstanceRequest`、`CiAttributeVO`
- Mapper：`CiInstanceRelMapper`（含 `findTopologyEdges` SQL）
- Service：`CiInstanceService`（469 行全文）
- 迁移：`V14`、`V15`、`V16`、`V23`、`V24`、`V35`、`V36`、`V39`
- 前端：`instances/by-model/[modelId]/[id]/page.tsx`、`InstanceBasicInfoTab.tsx`

凡 brief 中描述与代码实际不符或低估严重度之处，本 Spec 以代码证据为准并显式标注差异。Engineer 在实现阶段应以本 Spec 的证据为准；若代码已变化，重新审计后再动手。

---

## 1. 架构问题清单与影响面（当前状态证据）

下表汇总每项债务的代码级证据、当前严重度和影响面。严重度按"是否已经在生产路径上必然出错"判定，不是按"理论可能"。

| 编号 | 债务 | 代码证据（文件:行） | 严重度 | 影响面 |
|---|---|---|---|---|
| P1-1 | 实例详情 DTO 协议不一致（snake/camel） | 前端 `page.tsx:22-27` 定义 `model_id/attrs/field_config/created_at`；后端 `CiInstanceDetailVO.java:11-23` 返回 `modelId/fieldsData/attributes/createdAt` | HIGH（用户可见空值） | 实例详情页头部、基本信息 Tab、字段渲染 |
| P1-1b | 属性 DTO 同样 snake/camel 不一致（brief 未提及，审计发现） | 前端 `page.tsx:17-21` 与 `InstanceBasicInfoTab.tsx:14-18` 定义 `field_key/is_required/group_id/sort_order`；后端 `CiAttributeVO.java:6-22` 返回 `fieldKey/isRequired/groupId/sortOrder` | HIGH | 属性分组渲染、字段编辑控件全部依赖错误字段名 |
| P1-2 | 动态属性保存 payload 错误 | 前端 `InstanceBasicInfoTab.tsx:64` 发送 `{ attrs: editAttrs }`；后端 `UpdateInstanceRequest.java:13` 接收 `fieldsData` | HIGH（保存静默失效） | 所有实例动态属性编辑 |
| P1-3 | 拓扑 SQL 引用不存在的列（brief 称"风险"，实为必然运行错误） | `CiInstanceRelMapper.java:35,41,49` SQL 使用 `r.src_instance_id/r.dst_instance_id/r.association_kind`；`V16__cmdb_instance_rel.sql:6-8` 实际列名为 `def_id/src_id/dst_id` | CRITICAL（拓扑/影响分析必抛 PSQLException） | 拓扑图、影响分析、关系遍历 |
| P1-4 | AssociationDef 实体贫血，6 列只映射 3 列 | `CiAssociationDef.java:11-14` 仅 `srcModelId/dstModelId/associationKind`；`V14__cmdb_metadata.sql:96-110` 表实际有 `def_id/kind_id/src_model_id/dst_model_id/name/mapping/on_delete` | HIGH（双级关系无法落地） | 关联创建校验、删除行为、基数约束 |
| P1-4b | ci_instance_rel.def_id 语义错挂 | `CiInstanceRel.java:22-23` `associationKind -> def_id`（字段名暗示存 kind，实际列名是 def_id）；业务创建传 kind 不校验 def 存在 | HIGH | 关系数据完整性 |
| P1-5 | modelId/name/displayName 语义混乱 + model_id 列孤儿 | `CiModel.java:13-14,22-24`（`name` 作编码、`displayName` 作展示、手写 `getModelId()` 返回 `name`）；`V14:23` 表有独立 `model_id` 列但实体未映射 → 该列数据为空/孤儿；`CiInstanceService.java:374-376` `loadModel` 按 `name` 查询 | MEDIUM-HIGH | 路由参数语义、模型查询、外部引用 |
| P1-6 | 字段类型与 enumOptions 格式双轨 | 后端 `SchemaValidator`（`CiInstanceService.java:286-317`）按 `singlechar/int/bool/enum/list/user/date` 分支，enumOptions 当 `List<String>` 解析（:305）；DB `ci_attribute.option` 是 JSONB 存 `[{id,name,is_default}]`（`V14:63,153-158`）；前端 `InstanceBasicInfoTab.tsx:149-190` 按 `longchar/enum/enummulti/bool/date/int/float` 分支，enum 的 option 当 `{id,name}[]` | HIGH（校验/渲染/导入三套语义） | 表单、CSV 导入、后端校验互不一致 |
| P1-7 | 变更历史强耦合 AuditLog JSON | `CiInstanceService.java:208-253` 从 `auditLogMapper.queryPage` 过滤 `ci_instance` 后解析 `beforeJson/afterJson`；`CiChangeService` 同模式（brief 述）；`:51-52` `@Lazy CiChangeService` 做缓存失效，循环依赖味道 | MEDIUM（功能可用但脆） | 变更统计、字段级 diff、拓扑对比 |
| P2-1 | CiInstanceService 过胖 | `CiInstanceService.java` 469 行，内嵌 `SchemaValidator` 静态内部类（:257-318）、唯一性校验（:386-400）、审计写入（:460-468）、关联设备查询（:320-341）、关联变更单（:343-346）、关联日报（:348-370）、变更历史（:208-253） | MEDIUM（可维护性） | 新增实例字段/导入规则时的回归面 |
| P2-2 | 前端路由 modelId 语义不清 | `instances/by-model/[modelId]/[id]/page.tsx:40` `modelId` 实际是模型编码（传给 `api.get(/cmdb/models/${modelId})`），但命名暗示 numeric id | MEDIUM | 路由可读性、QA 理解 |
| P2-3 | 权限 action 混用 write/update，资源碎片化 | `V14:190` `cmdb_model` actions 含 `write`；`V23:5` 同资源 actions 改为 `create/read/update/delete`（无 write）；`V24:36` 单独插 `cmdb_relation:update`；`V25/V26` 又插 `cmdb_import/cmdb_impact` 系列；无统一 `cmdb_topology/cmdb_attribute/cmdb_alert` 资源定义 | MEDIUM | 角色授权一致性、前端能力判断 |
| P3-1 | 无 current schema 文档 | V14-V40 共 14 个 CMDB 相关迁移，多次补列（V35 补 display_name、V36 补 status/owner/description、V37 补 attribute group 列、V39 补 BaseEntity 列），无法线性反推最终 schema | LOW（效率债） | 新 Worker 上手、Spec 撰写 |
| P3-2 | 无 API contract / DTO mapping 文档 | 无单一文档列出 canonical 字段名、兼容 alias、路由参数语义 | LOW（效率债） | 前后端协作 |

### 1.1 审计中发现的 brief 未覆盖问题

以下三项在 brief/PRD 中未显式列出，但审计中确认存在，建议纳入 Phase 2 一并处理或在 Spec 中显式声明为已知项：

1. **`ci_model.model_id` 列孤儿**（P1-5 子问题）：`V14:23` 建表有 `model_id VARCHAR(64) NOT NULL` 并有唯一约束，但 `CiModel.java` 实体未用 `@TableField` 映射它，反而用 `name` 列承载编码。`CiInstanceService.loadModel()` 走 `findByName()`。这意味着 `ci_model.model_id` 列在当前代码路径下不被读写（种子数据 `V14:130` 也只插了 `model_id` 和 `name` 两个独立值）。这是命名混乱的根因之一，P1-5 命名收敛必须明确决定：保留 `model_id` 列为编码列并修复实体映射，还是废弃该列改用 `name`。
2. **`CiAssociationDef` 缺少 `defId` 映射**：表有 `def_id` 列且是业务主键（唯一约束 `V14:109`），但实体没有该字段，无法通过 defId 查询 def。AC3 落地双级关系前必须先补实体映射。
3. **`ci_instance_rel` 无 `association_def` 外键语义**：`def_id` 列名暗示指向 `ci_association_def.def_id`，但实体字段命名 `associationKind`（`CiInstanceRel.java:23`），且业务创建链路传的是 kind 而非 defId。P1-4b 的修复需要同时改实体字段命名和创建链路。

---

## 2. 关键设计决策（AD）

以下决策锁定技术方向。每条标注 rationale 和影响范围。破坏性变更需在 Phase 2 实现前回到 Product/Architect 确认（见 §7 风险）。

### AD-1: DTO 全局对齐后端 camelCase（前端改，后端不动）

**决策**: 所有 CMDB 前端 DTO 接口定义改为后端实际返回的 camelCase。不引入全局 snake_case 中间层，不加 response interceptor 做自动转换。

**Rationale**:
- 后端是事实来源（`CiInstanceDetailVO`、`CiAttributeVO` 已是 camelCase 且被多个 controller 复用）。
- 前端错误是局部历史遗留（早期按不同约定写的 interface），改动集中在 `cmdb/` 目录内几个 interface 定义和字段读取处。
- 引入自动转换层会增加一个隐式契约，后续每个字段都要在两处维护，违背"统一"目标。

**影响范围**: 前端 `page.tsx`、`InstanceBasicInfoTab.tsx` 及所有读取 `inst.model_id/attrs/field_config/created_at` 或 `attr.field_key/is_required` 的组件。后端零改动。

**canonical 字段 vs 兼容 alias**: 本 Spec 不建议在后端 response 里同时返回 camel 和 snake 两套字段（会膨胀契约）。兼容窗口通过前端类型放宽（`model_id?: string; modelId?: string`）+ 运行时取值兜底实现，窗口结束后删除 alias。具体见 §3。

### AD-2: `ci_instance_rel` 字段名清理为 def_id / src_id / dst_id（SQL 改，实体不动）

**决策**: `findTopologyEdges` 及任何其他手写 SQL 统一改用真实列名 `def_id/src_id/dst_id`。实体 `CiInstanceRel` 的 `@TableField` 映射保持不变（已经是正确的）。

**Rationale**:
- `V16` 是建表迁移，列名 `def_id/src_id/dst_id` 是事实，不可能改表去迎合错误 SQL。
- 实体映射 `CiInstanceRel.java:17-23` 本来就对，问题只在 `CiInstanceRelMapper.java:35,41,49` 的手写 `@Select` SQL。

**影响范围**: `CiInstanceRelMapper.java`（改 SQL 字符串）、`CiTopologyService`（调用方，行为变正确）、影响分析链路。实体和表零改动。

### AD-3: 实例关联创建以 AssociationDef.defId 为依据，Kind 仅作语义标签

**决策**:
1. `CiAssociationDef` 实体补全 `defId`、`mapping`、`onDelete`、`name` 字段映射（表已有列）。
2. 实例关联创建请求从传 `associationKind` 改为传 `defId`。
3. 创建时校验：defId 存在 → def 的 srcModelId/dstModelId 与实例的 model 匹配 → mapping 基数未超限（如 1:1 检查是否已存在）→ onDelete 记录删除策略。
4. `CiInstanceRel.associationKind` 字段重命名为 `defId`（Java 字段名，`@TableField("def_id")` 不变），消除字段名暗示 kind 的歧义。
5. `ci_association_kind` 保留为纯语义字典（src_to_dst / dst_to_src 文案），不在实例创建链路做硬约束。

**Rationale**: PRD P1-4 明确要求双级落地，brief 决策 5/6 一致。表的 DDL（`V14:96-110`）本来就为双级设计，只是实体和 service 没跟上。

**兼容策略（旧数据）**: 现有 `ci_instance_rel.def_id` 可能存的是 kind 值而非 def 的 defId。迁移阶段：
- 步骤 A: 查询所有现有 `def_id` 值，对每个值尝试匹配 `ci_association_def.def_id`；匹配上的标记为"已合规"。
- 步骤 B: 未匹配的，按 `(src_model, dst_model, kind)` 三元组尝试推导应归属的 def，推导成功则回填正确 defId。
- 步骤 C: 仍无法推导的，创建"默认 def"（`default_<kind>`）兜底并记录到迁移日志，人工后续清理。
- 迁移脚本必须在事务内执行并输出报告，不允许静默丢弃关系。

### AD-4: modelId / name / displayName 命名收敛方案

**决策**:
- DB 层：废弃 `ci_model.model_id` 列的写入路径，统一用 `name` 列承载模型编码（modelCode 语义）。`model_id` 列保留但标记为 deprecated，下个大版本删除。**不**做 `ALTER TABLE RENAME`（会动 Flyway 历史）。
- 实体层：`CiModel.name` 语义文档化为 modelCode；移除手写 `getModelId()`（`CiModel.java:22-24`），新增 `getModelCode()` 返回 `this.name`，`getDisplayName()` 返回 `displayName`。
- DTO 层：`CiInstanceDetailVO.modelId` 字段重命名为 `modelCode`（破坏性，需兼容窗口）；新增 `displayName` 字段（当前只有 `modelName` 承载展示名）。
- 路由层：`[modelId]` 目录重命名为 `[modelCode]`，`[id]` 保持但文档明确为 instanceId。Next.js 动态路由改名需同步改所有 `useParams` 和 `<Link href>` 引用。

**Rationale**: `name` 列已被 `loadModel`/`findByName`/实例 `modelId` 外键全面使用，改列名代价远大于改实体字段名。`model_id` 列孤儿化是历史错误，不值得为它翻盘整个查询层。

**兼容窗口**:
- 后端 DTO 同时返回 `modelCode`（canonical）和 `modelId`（alias，等于 modelCode）一个版本，下版本删 alias。
- 前端路由旧路径 `/cmdb/instances/by-model/[code]` 与新路径共存，旧 `[modelId]` 路径保留 redirect 一个版本。

**需要 Product 确认的破坏性点**: DTO 字段改名 `modelId → modelCode` 属于用户不可见但外部集成可见的契约变化。若 CMDB API 有外部消费者，需 Product 确认兼容窗口长度。本 Spec 默认 1 个版本（约 2 周）。

### AD-5: FieldType 枚举与 enumOptions 统一格式

**决策**:
- 定义 canonical FieldType 枚举（后端 enum + 前端 const）：
  - `singlechar`（短字符串）
  - `longchar`（长文本）
  - `int`（整数）
  - `float`（浮点）
  - `bool`（布尔）
  - `date`（日期，ISO-8601 字符串）
  - `enum`（单选）
  - `enummulti`（多选）
  - `objuser`（用户引用，存 user id 字符串）
- enumOptions canonical 格式统一为 JSON 数组：`[{"id":"linux","name":"Linux","isDefault":true}]`，存 `ci_attribute.option` JSONB 列（已是此格式，见 V14:153-158）。
- 后端 `CiAttribute.enumOptions`（String 类型）废弃，改读 `option` JSONB 列（实体补 `@TableField("option")` + JSON handler）。
- 前端 `InstanceBasicInfoTab.renderEditField` 的分支逻辑与 canonical 枚举对齐，删除未定义类型（如裸 `list` 改为 `enummulti`）。

**Rationale**: `ci_attribute` 表本来就有 `option` JSONB 列且种子数据格式正确，问题是 `CiAttribute` 实体没映射它，反而搞了个 `enumOptions` String 字段读不存在的列，`SchemaValidator` 又把它当 `List<String>` 解析——三处不一致。统一到 `option` JSONB + canonical FieldType 即可。

**兼容（历史数据）**: 现有 `ci_attribute.enumOptions`（String 列，若存在）数据迁移到 `option` JSONB：尝试 `JSON.parse` 为 `[{id,name}]`，失败则按换行/逗号分割为 `[{id: raw, name: raw}]`。迁移脚本输出无法解析的行号供人工修复。

### AD-6: CMDB 领域变更记录表 `ci_change_record`，AuditLog 保留审计职责

**决策**:
- 新增 `ci_change_record` 表（Phase 2 AC6 的迁移脚本设计），字段：`id, tenant_id, instance_id, model_code, action(create/update/delete/relate), field_changes JSONB, operator_id, created_at`。`field_changes` 存结构化字段级 diff（`[{field, before, after}]`），不再依赖 beforeJson/afterJson 全量快照解析。
- `CiInstanceService` 的 create/update/delete 在写 AuditLog 的同时，双写 `ci_change_record`（双写期）。
- `CiChangeService` 的统计/TopInstance/全局变更列表改为查 `ci_change_record`；AuditLog 仅保留审计查询用途。
- 灰度校验：双写期跑对账任务（`ci_change_record` 与 `audit_log` 的 cmdb 条目按 instance_id+action+时间窗口比对），不一致告警。

**Rationale**: PRD P1-7 要求解耦。AuditLog 是通用审计（所有模块共用），结构不稳定；CMDB 需要领域内稳定的字段级 diff。双写 + 对账是最低风险过渡方式。

**不做的**: 不一次性下线 AuditLog 的 cmdb 记录（会破坏现有审计视图）。双写至少一个版本，对账稳定后再评估是否停写 AuditLog 的 cmdb 模块。

### AD-7: 权限资源/action 收敛口径

**决策**: canonical 资源与 action 矩阵如下，所有 CMDB 权限 seed 和前端 `hasPermission` 调用对齐此矩阵。

| Resource | Actions |
|---|---|
| `cmdb_model` | read, create, update, delete, manage |
| `cmdb_attribute` | read, create, update, delete |
| `cmdb_instance` | read, create, update, delete, export |
| `cmdb_relation` | read, create, update, delete |
| `cmdb_topology` | read |
| `cmdb_import` | read, execute |
| `cmdb_impact` | read |
| `cmdb_change` | read |
| `cmdb_alert` | read |

**Action 语义**:
- `read`: 查看；`create/update/delete`: 写操作；`export`: 导出；`execute`: 执行导入；`manage`: 管理配置（含字段组、关联 def 等元操作）。
- 废弃 `write`（V14:190 残留），统一为 `update`。

**兼容**: 旧权限 `cmdb_model:write` 通过 seed 迁移映射为 `cmdb_model:update`（插 role_permission 别名）。前端 `hasPermission('cmdb_model','write')` 调用点改为 `'update'`，保留一个兼容映射函数一个版本。

---

## 3. API DTO Schema 契约（Canonical）

以下为收敛后的 canonical DTO schema。标记 `[alias]` 的字段为兼容窗口期额外返回的旧名字段，窗口结束后移除。

### 3.1 CiInstanceDetailVO（GET /api/cmdb/instances/{id} 响应）

```
{
  "id": 123,                          // Long, DB 主键
  "name": "web-01",                   // String, 实例名
  "modelCode": "host",                // [canonical] 模型编码
  "modelId": "host",                  // [alias] = modelCode, 兼容期保留
  "modelName": "主机",                // = CiModel.displayName
  "displayName": "主机",              // [canonical] 显式展示名（与 modelName 同义，过渡后 modelName 废弃）
  "status": "online",
  "owner": "alice",
  "description": "...",
  "fieldsData": { "inner_ip": "..." },// [canonical] Map<String,Object>
  "attributes": [ CiAttributeVO ],    // [canonical] 字段配置
  "createdAt": "2026-06-19T...",
  "updatedAt": "2026-06-19T..."
}
```

前端 `CiInstanceVO` interface 必须改为上述 camelCase，删除 `model_id/attrs/field_config/created_at/created_by_name`。`created_by_name` 后端当前不返回，前端如需展示操作人从变更历史取。

### 3.2 UpdateInstanceRequest（PUT /api/cmdb/instances/{id} 请求）

```
{
  "name": "...",           // 可选
  "status": "...",         // 可选
  "owner": "...",          // 可选
  "description": "...",    // 可选
  "fieldsData": { ... }    // [canonical] Map<String,Object>, 部分更新合并
}
```

前端保存必须发 `fieldsData`，不发 `attrs`。后端 `UpdateInstanceRequest.java:13` 已是 `fieldsData`，零改动。

### 3.3 CiAttributeVO（嵌套于实例详情、模型详情）

```
{
  "id": 1,
  "modelCode": "host",          // [canonical]
  "fieldKey": "inner_ip",       // [canonical]
  "name": "内网IP",
  "groupId": "base",
  "groupName": "基本信息",
  "fieldType": "singlechar",    // 见 AD-5 枚举
  "isRequired": true,
  "isEditable": false,
  "isUnique": true,
  "isBuiltIn": true,
  "isListShow": true,
  "defaultValue": null,
  "option": [ {"id":"x","name":"X","isDefault":true} ],  // [canonical] JSONB, enumOptions 废弃
  "sortOrder": 1
}
```

前端 `CiAttributeVO` interface 删除 `field_key/is_required/group_id/sort_order/option`(按换行字符串)，改为 `fieldKey/isRequired/groupId/sortOrder/option`(对象数组)。

### 3.4 CreateInstanceRelRequest（POST /api/cmdb/instances/{id}/associations 请求）

```
{
  "defId": "host_run_vm",       // [canonical] 指向 ci_association_def.def_id
  "dstInstanceId": 456,
  "metadata": { "since": "2026-01-01" }   // 按 ci_association_attr_def 校验
}
```

不再接收裸 `associationKind`。旧字段 `associationKind` 作为 `[alias]` 兼容一个版本（后端收到 associationKind 时按 AD-3 兼容策略推导 defId），之后移除。

### 3.5 CiAssociationDefVO（管理端，GET /api/cmdb/association-defs）

```
{
  "id": 1,
  "defId": "host_run_vm",       // [canonical] 业务主键
  "kindId": "run",              // 关联到 ci_association_kind.kind_id
  "kindName": "运行",
  "srcModelCode": "host",
  "dstModelCode": "vm",
  "name": "主机运行虚拟机",
  "mapping": "1:n",             // 1:1 | 1:n | n:n
  "onDelete": "cascade"         // none | cascade | restrict
}
```

当前 `CiAssociationDef.java` 实体缺 `defId/mapping/onDelete/name`，AC3 实现时补全。

### 3.6 路由参数语义

| 路由 | 参数 | 语义 | 兼容 |
|---|---|---|---|
| `/cmdb/admin/models/[modelCode]` | modelCode | CiModel.name（模型编码） | 旧 `[modelId]` redirect |
| `/cmdb/instances/by-model/[modelCode]` | modelCode | 同上 | 同上 |
| `/cmdb/instances/by-model/[modelCode]/[instanceId]` | instanceId | DB 主键 Long | `[id]` 保留为 alias |
| `/cmdb/topology/[instanceId]` | instanceId | DB 主键 | 不变 |
| `/cmdb/impact/[instanceId]` | instanceId | DB 主键 | 不变 |

---

## 4. 数据流（ASCII）

### 4.1 实例详情加载（修复后）

```
[Browser]
  GET /api/cmdb/instances/{instanceId}
     │
     ▼
[CiInstanceController.getById]
     │
     ▼
[CiInstanceService.getDetail]
  ├─ loadInstance(id) ──► ci_instance (by PK)
  ├─ loadModel(inst.modelId=name) ──► ci_model (by name col)
  ├─ ciAttributeMapper.listByModel ──► ci_attribute (option JSONB)
  └─ 组装 CiInstanceDetailVO { modelCode, fieldsData, attributes[option], ... }
     │ (camelCase, 无 snake)
     ▼
[Browser: CiInstanceVO interface (camelCase)]
  ├─ inst.modelCode / inst.fieldsData / inst.attributes[i].fieldKey
  └─ 渲染基本信息 Tab ✓
```

### 4.2 实例动态属性保存（修复后）

```
[Browser: InstanceBasicInfoTab]
  PUT /api/cmdb/instances/{id}  body: { fieldsData: {...} }
     │  (不发 attrs)
     ▼
[CiInstanceController.update]
     │
     ▼
[CiInstanceService.update]
  ├─ loadInstance
  ├─ 合并 fieldsData（部分更新）
  ├─ SchemaValidator.validate(merged, attrs)  ──► 按 AD-5 FieldType 校验
  ├─ validateUniqueFields
  ├─ ciInstanceMapper.updateById
  ├─ writeAudit (AuditLog)          ──► audit_log
  └─ writeChangeRecord [新增双写]    ──► ci_change_record
     │
     ▼
[Browser: invalidateQueries → 重新 GET → 看到新值 ✓]
```

### 4.3 拓扑遍历（修复后）

```
[Browser] GET /api/cmdb/topology/{instanceId}
     │
     ▼
[CiTopologyService.build]
  └─ ciInstanceRelMapper.findTopologyEdges(rootId, tenantId, maxDepth)
       │  SQL 使用真实列: r.def_id, r.src_id, r.dst_id  ✓
       │  (不再引用 src_instance_id/dst_instance_id/association_kind)
       ▼
     [PostgreSQL: 查询成功，不再抛 PSQLException ✓]
       │
       ▼
     返回 List<CiInstanceRel>
```

### 4.4 关联创建（双级落地后）

```
[Browser] POST /api/cmdb/instances/{srcId}/associations
  body: { defId: "host_run_vm", dstInstanceId: 456, metadata: {...} }
     │
     ▼
[CiRelationService.createRelation]   (或 CiInstanceService)
  ├─ loadDef(defId) ──► ci_association_def (by def_id)
  │     └─ 校验 def 存在
  ├─ loadInstance(srcId), loadInstance(dstInstanceId)
  ├─ 校验 srcInstance.modelCode == def.srcModelCode
  ├─ 校验 dstInstance.modelCode == def.dstModelCode
  ├─ 校验 mapping 基数 (1:1 → 查已有关系; 1:n/n:n → 放行)
  ├─ SchemaValidator.validateAssociationAttrs(metadata, def.attrDefs)
  ├─ 写 ci_instance_rel { def_id=defId, src_id, dst_id, metadata }
  └─ 写 ci_change_record (action=relate)
     │
     ▼  失败任一校验 → 抛 IllegalArgumentException + 可读消息
     成功 → 返回关系 VO
```

---

## 5. 兼容与迁移方案

### 5.1 DTO 兼容窗口

| 变更 | 兼容策略 | 窗口 |
|---|---|---|
| 前端 snake_case → camelCase | 前端 interface 放宽为 `model_id?: string; modelId?: string`，运行时 `inst.modelId ?? inst.model_id`；下版本删 snake 分支 | 1 版本 |
| `attrs` payload → `fieldsData` | 前端直接改发 `fieldsData`（无后端兼容需求，后端本就认 fieldsData）；旧 `attrs` 不再发 | 立即 |
| `modelId` → `modelCode` (DTO) | 后端同时返回两者（值相同）一版本 | 1 版本 |
| `[modelId]` 路由 → `[modelCode]` | Next.js 保留旧路径组件做 redirect 一版本 | 1 版本 |
| `associationKind` → `defId` (创建请求) | 后端兼容接收 associationKind 一版本，按 AD-3 推导 defId | 1 版本 |

### 5.2 数据库迁移（Phase 2 各 AC 的 Flyway 脚本，本 Spec 只设计不执行）

所有迁移必须 `IF NOT EXISTS` / 幂等，且在事务内执行。

| AC | 迁移 | 内容 |
|---|---|---|
| AC3 | `V41__ci_instance_rel_def_id_backfill.sql` | 回填 ci_instance_rel.def_id 为合法 def（AD-3 步骤 A/B/C），输出报告到日志 |
| AC5 | `V42__ci_attribute_option_migrate.sql` | 将 enumOptions（String）解析迁移到 option（JSONB），无法解析的行记录 |
| AC6 | `V43__ci_change_record.sql` | 创建 ci_change_record 表 + 索引 |
| AC7 | `V44__cmdb_permissions_normalize.sql` | 废弃 write，补 cmdb_attribute/cmdb_topology/cmdb_change/cmdb_alert 资源，role_permission 别名映射 |

**不动**的表结构：`ci_model`（保留 model_id 孤儿列，不动 Flyway 历史）、`ci_instance_rel`（列名已对，只改 SQL 读取）。

### 5.3 回滚策略

每个 AC 独立可回滚：
- DTO/前端改动：git revert，无数据迁移则无回滚负担。
- Flyway 迁移：每个迁移脚本配对应的 undo 描述（虽 Flyway 社区版不自动 rollback，但 Spec 要求 Engineer 准备手动回滚 SQL）。
- `ci_change_record` 双写期：可随时停写、改回查 AuditLog，因为 AuditLog 未下线。
- 权限 seed：V44 若出错，手动删除新增 sys_resource/sys_permission 行，不影响旧权限（alias 映射保留旧 code）。

---

## 6. AC 级工程拆分（Phase 2）

每个 AC 独立实现、独立验证、独立回滚。建议顺序按依赖关系：AC1/AC2 无依赖可先行；AC3 依赖 AC2 的字段清理；AC4 依赖 AC1 的 DTO 改造；AC5 独立；AC6 依赖 AC1（保存链路改造完才好双写）；AC7 独立；AC8 依赖所有前序 AC（文档反映最终态）；AC9/AC10 可与 AC1-AC7 并行（重构类）。

### AC1: 实例详情 DTO / payload contract 修复

**范围**: 前端 interface 改 camelCase + 保存 payload 改 fieldsData。

**Files**:
- `frontend/src/app/(dashboard)/cmdb/instances/by-model/[modelId]/[id]/page.tsx`（CiInstanceVO interface, 字段读取）
- `frontend/src/components/cmdb/InstanceBasicInfoTab.tsx`（CiInstanceVO, CiAttributeVO interface, saveMutation payload, renderEditField 字段读取）
- 其他读取 `inst.model_id/attrs/field_config` 或 `attr.field_key/is_required` 的组件（审计时发现需全局 grep `\.model_id|\.attrs|\.field_config|\.field_key|\.is_required|\.group_id|\.sort_order` 在 cmdb 目录下的所有引用）

**验证**:
- 手动：打开含动态字段的模型实例详情，头部显示 modelCode、基本信息 Tab 渲染字段、编辑保存后刷新值仍在。
- 自动化：前端组件测试覆盖 InstanceBasicInfoTab 的 read/edit/save 流程。

### AC2: ci_instance_rel 字段名与拓扑 SQL 清理

**范围**: 修 `findTopologyEdges` SQL 为真实列名。

**Files**:
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/mapper/CiInstanceRelMapper.java`（:35,41,49 SQL 字符串）

**验证**:
- 手动：创建两个实例关系，打开 `/cmdb/topology/{instanceId}`，不再 500，拓扑图正确渲染。
- 自动化：`CiInstanceRelMapperTest` 已有回归 guard（见 mapper 注释 :19-26），扩展用例覆盖新列名。

### AC3: AssociationDef 驱动的实例关系创建链路

**范围**: 实体补全 + 创建链路改 defId + 校验 + 数据回填迁移。

**Files**:
- `backend/.../entity/CiAssociationDef.java`（补 defId/mapping/onDelete/name）
- `backend/.../entity/CiInstanceRel.java`（associationKind → defId 重命名，@TableField("def_id") 不变）
- `backend/.../service/CiRelationService.java`（创建链路校验逻辑）
- `backend/.../controller/CiRelationController.java`（请求 DTO）
- `backend/.../mapper/CiAssociationDefMapper.java`（findByDefId）
- `backend/src/main/resources/db/migration/V41__ci_instance_rel_def_id_backfill.sql`
- 前端关联创建页 `associations/new/page.tsx`（选择 def 而非 kind）

**验证**:
- 管理员能 CRUD AssociationDef（含 src/dst model、mapping、onDelete）。
- 实例关联创建基于 defId，非法组合被拒并返回可读错误。
- V41 迁移跑完，旧关系数据可被拓扑/影响分析查询到。

### AC4: modelCode / id / displayName 命名收敛

**范围**: 实体字段重命名 + DTO 加 modelCode + 路由改名。

**Files**:
- `backend/.../entity/CiModel.java`（删 getModelId 手写方法，加 getModelCode）
- `backend/.../dto/instance/CiInstanceDetailVO.java`（加 modelCode, displayName；modelId 保留为 alias 一版本）
- `backend/.../dto/instance/CiInstanceVO.java`（同上）
- `backend/.../service/CiInstanceService.java`（loadModel 逻辑，setModelCode）
- 前端所有 `[modelId]` 目录 → `[modelCode]`，`useParams<{modelId}>` → `useParams<{modelCode}>`，`<Link href="/cmdb/.../[modelId]">` 引用
- 旧 `[modelId]` 路径保留 redirect 组件

**验证**:
- QA 通过模型编码进入实例列表，通过实例 ID 进入详情。
- 旧 URL 书签 redirect 到新路径。
- DTO 响应同时含 modelCode 和 modelId（值相同）。

### AC5: FieldType 与 enumOptions 统一

**范围**: 实体补 option JSONB 映射 + FieldType 枚举 + 前端分支对齐 + 迁移。

**Files**:
- `backend/.../entity/CiAttribute.java`（加 @TableField("option") + JSON handler，废弃 enumOptions 或标记 @Deprecated）
- `backend/.../service/CiInstanceService.java`（SchemaValidator 改读 option，enum 校验按 [{id,name}] 格式）
- `backend/.../dto/attribute/CiAttributeVO.java`（option 字段类型改 List/Map，废弃 enumOptions）
- `backend/src/main/resources/db/migration/V42__ci_attribute_option_migrate.sql`
- `frontend/src/components/cmdb/InstanceBasicInfoTab.tsx`（renderEditField 分支与 canonical FieldType 对齐）
- CSV 导入相关 service（按 canonical FieldType 校验）

**验证**:
- 用 enum 字段完成模型配置→实例创建→CSV 导入预检→实例编辑全链路。
- 历史 enumOptions 数据迁移后 option JSONB 可正确渲染。

### AC6: CMDB 领域变更记录与 AuditLog 解耦

**范围**: 新表 + 双写 + CiChangeService 改读新表 + 对账。

**Files**:
- `backend/src/main/resources/db/migration/V43__ci_change_record.sql`
- `backend/.../entity/CiChangeRecord.java`
- `backend/.../mapper/CiChangeRecordMapper.java`
- `backend/.../service/CiChangeService.java`（统计/TopInstance/全局列表改读新表）
- `backend/.../service/CiInstanceService.java`（create/update/delete 双写，去掉 @Lazy invalidateStatsCache 对 AuditLog 的依赖）
- 对账脚本（可选，cron 或手动）

**验证**:
- 实例创建/更新/关联变化在 ci_change_record 可追踪。
- 变更历史页面（实例级 + 全局）正常展示字段级 diff。
- 双写期对账无差异告警。

### AC7: 权限资源/action 收敛

**范围**: seed 迁移 + 前端 hasPermission 调用对齐。

**Files**:
- `backend/src/main/resources/db/migration/V44__cmdb_permissions_normalize.sql`
- 前端所有 `hasPermission('cmdb_*', ...)` 调用点（grep `hasPermission` in cmdb pages/components）
- 前端兼容映射函数（write → update，一个版本）

**验证**:
- 不同角色（viewer/member/group_leader/admin）验证 read/update/export/manage 差异。
- 旧 `write` 权限用户不因改名失权。

### AC8: current schema 与 API contract 文档

**范围**: 纯文档产出。

**Files**:
- `docs/cmdb/schema-current.md`（所有 CMDB 表的最终列定义，基于 V14-V44 最终态）
- `docs/cmdb/api-contract.md`（本 Spec §3 的完整版 + 路由表 + 权限矩阵）

**验证**:
- Engineer/QA 基于文档写出测试用例，不需读迁移链。
- 文档标注 canonical vs alias 字段。

### AC9: CiInstanceService 职责拆分

**范围**: 重构，无行为变化。

**建议拆分**:
- `CiInstanceQueryService`（list/getDetail/search/关联资源查询）
- `CiInstanceCommandService`（create/update/delete + 审计/变更双写）
- `CiFieldSchemaValidator`（从内部类提取为独立组件，复用 AD-5 校验）
- `CiInstanceUniquenessValidator`（唯一性校验）
- `CiRelatedResourceService`（device/changeDoc/dailyReport 关联查询）

**Files**: `backend/.../service/CiInstanceService.java` 拆分 + controller 改注入新 service。

**验证**: 回归测试覆盖实例 CRUD、字段校验、关联规则、变更记录，行为不变。

### AC10: 前端页面边界与旧路由兼容

**范围**: 路由清理 + redirect。

**Files**:
- 前端 cmdb 路由目录结构（admin vs 浏览边界明确）
- redirect 组件（旧路径）
- 拓扑页与影响分析页入口分离（当前拓扑页同时承担对比入口，见 page.tsx:88-91）

**验证**: 管理配置页与业务浏览页职责清晰，旧 URL redirect 生效。

---

## 7. 风险与回滚

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| AC3 数据回填推导失败（def_id 无法匹配任何 def） | 中 | 部分关系进入"默认 def"兜底，需人工清理 | V41 输出报告，兜底 def 可追溯，不静默丢数据 |
| AC4 DTO 字段改名破坏外部 API 消费者 | 低（需确认是否有外部消费者） | 外部集成失效 | 兼容窗口双字段；**需 Product 确认窗口长度** |
| AC5 历史 enumOptions 格式杂乱，迁移部分失败 | 中 | 部分枚举字段渲染异常 | V42 记录失败行，人工修复；迁移不影响非枚举字段 |
| AC6 双写期性能开销（每次实例写操作多一次 insert） | 低 | 写延迟略增 | ci_change_record 索引设计合理即可；监控写入延迟 |
| AC6 对账发现 AuditLog 与新表不一致 | 中 | 变更统计口径短期波动 | 灰度，不一致告警但不阻断，人工核对 |
| AC7 权限改名导致用户失权 | 中 | 用户无法操作 | alias 映射 + 角色批量补权限；上线前在 staging 验证所有角色 |
| 一次性合并全部 AC | — | 回归爆炸 | **强制按 AC 分批合并，每个 AC 独立 PR、独立验证** |
| P1-3 拓扑 SQL 修复前有人触发了该路径 | — | 已是 CRITICAL，生产可能已在报错 | AC2 优先级最高，先行修复 |

### 需 Product/Architect 实现前确认的破坏性点

1. **DTO modelId → modelCode 改名**：若有外部系统消费 CMDB API，兼容窗口多长？（本 Spec 默认 1 版本）
2. **ci_model.model_id 孤儿列处置**：本 Spec 建议保留不删（不动 Flyway 历史），下个大版本再清理。是否接受？
3. **AuditLog 的 cmdb 模块记录何时停写**：本 Spec 默认双写期持续到对账稳定，不停写。是否接受？

---

## 8. 验证计划（Verification Plan）

### 8.1 回归测试矩阵

| 场景 | 覆盖 AC | 验证方式 |
|---|---|---|
| 实例详情打开（含动态字段模型） | AC1 | 手动 + 组件测试 |
| 实例动态属性编辑→保存→刷新 | AC1, AC6 | 手动 + E2E |
| 拓扑图打开（有关系的实例） | AC2 | 手动 + CiInstanceRelMapperTest |
| 影响分析 | AC2 | 手动 |
| 关联创建（合法组合） | AC3 | 手动 + API 测试 |
| 关联创建（非法 model 组合/mapping 超限） | AC3 | API 测试（期望可读错误） |
| 模型编码路由进入实例列表→详情 | AC4, AC10 | 手动 + E2E |
| 旧 URL redirect | AC4, AC10 | 手动 |
| enum 字段模型配置→实例→CSV 导入 | AC5 | 手动 + 导入测试 |
| 变更历史（实例级 + 全局）展示字段 diff | AC6 | 手动 + API 测试 |
| 多角色权限验证（viewer 只读、admin 全权） | AC7 | 手动 + 权限测试 |
| current schema 文档可被 Engineer 用于写任务 | AC8 | 评审 |
| 实例 CRUD 回归（服务拆分后行为不变） | AC9 | 单元 + 集成测试 |

### 8.2 Phase 1 Spec 自身验收

本 Spec 作为 Phase 1 交付物，验收标准：
- [x] 含当前架构问题清单（§1，基于代码证据）
- [x] 含 API contract 统一方案（§3，canonical + alias）
- [x] 含 DB/schema 兼容方案（§5.2，迁移设计）
- [x] 含 Association Kind/Def 双级落地设计（AD-3, §4.4, AC3）
- [x] 含前端路由/DTO 改造方案（AD-1, AD-4, AC1, AC4, AC10）
- [x] 含权限模型调整方案（AD-7, AC7）
- [x] 含变更历史解耦方案（AD-6, AC6）
- [x] 含 AC 级拆分（§6，10 个 AC）
- [x] 含回归测试矩阵（§8.1）
- [x] 含风险和回滚策略（§7）
- [x] 含 current schema / API contract 文档输出方式（AC8）

---

## 9. 开放问题（供 Engineer/QA 反馈）

以下不阻塞 Phase 1 Spec 验收，但 Phase 2 实现时需澄清：

1. `ci_model.model_id` 列当前是否有任何数据？（审计显示种子数据 V14:130 插了 model_id='host'，但实体不读它。需确认生产数据该列是否被其他路径写过。）
2. CSV 导入服务当前按哪种 FieldType 语义校验？（审计未覆盖 CsvImportService 全文，AC5 实现前需补审。）
3. `CiChangeService` 全文未审计（本 Spec 基于 brief 描述 + CiInstanceService 中的调用点推断），AC6 实现前需完整审计其统计逻辑。
4. 前端 cmdb 目录下所有读取 snake_case 字段的组件清单需在 AC1 实现时全局 grep 确认（本 Spec 审计了详情页和基本信息 Tab，其他页面如 instances 列表、changes、alerts 可能也有同类问题）。

---

## 10. 下游交接

- **Engineer**: 按 §6 的 AC1-AC10 分批实现，每 AC 独立 PR。AC2（拓扑 SQL）优先级最高，因为是 CRITICAL 运行错误。AC1/AC5 紧随（用户可见）。AC3/AC6 中期。AC4/AC7/AC9/AC10 后期。AC8 文档最后（反映最终态）。
- **QA**: 按 §8.1 矩阵设计用例。重点覆盖 AC1（保存链路）、AC2（拓扑不再 500）、AC3（非法组合拒绝）、AC6（变更 diff 正确）。
- **Product**: 确认 §7 末尾的 3 个破坏性点。
- **本 Spec 不修改代码、不执行迁移、不部署**。所有实现动作在 Phase 2。

— Arch (glm-5.2)
