# PRD: CMDB 架构债务清理（P1/P2/P3）

> 日期: 2026-06-19
> 角色: Product
> 状态: Phase 1 — PRD only，待 Architect 在后续独立 Spec 中补充技术方案
> Brief: `docs/specs/2026-06-19-cmdb-architecture-debt-brief.md`
> 目标读者: Architect、Engineer、QA、CMDB 管理员

---

## 1. 背景

cwgsyw-platform 的 CMDB 模块已经覆盖模型、实例、属性、关联、CSV 导入、影响分析、拓扑、变更历史、告警与关联资源等核心能力。随着多轮功能迭代和修复，当前 CMDB 已经形成一组相互影响的架构债务：前后端 DTO 字段命名不一致、关联关系 Kind/Def 双级模型未真正落地、`modelId`/`id`/`name`/`displayName` 语义混杂、字段类型和枚举配置格式不统一、变更历史依赖通用 AuditLog JSON、服务层职责偏胖、前端路由和权限模型存在历史包袱。

这些问题已经不再适合通过单点补丁继续修复。继续局部修补会造成更多兼容判断、隐藏分支和认知负担，最终影响实例详情、动态属性编辑、拓扑、影响分析、CSV 导入、权限控制和变更追踪等关键使用场景的稳定性。

本 Phase 1 的目标是先把 P1/P2/P3 全部放在同一产品需求中统一规划，形成可供 Architect 输出技术 Spec、可供 Engineer 在 Phase 2 按 AC 拆分实现的产品口径。本 PRD 不写技术方案，不直接要求改代码、改数据库、迁移生产数据或部署。

## 2. 用户价值

### 2.1 运维用户价值

- 实例详情页能够稳定展示模型、基础字段、动态属性、关联关系和变更信息。
- 动态属性编辑保存后能可靠生效，避免“页面显示成功但数据未更新”的体验。
- 拓扑和影响分析基于正确的实例关系，减少因为历史字段残留导致的空图、错图或运行错误。

### 2.2 CMDB 管理员价值

- 模型编码、展示名、数字主键、路由参数等概念边界清晰，降低配置和排错成本。
- 关联种类与模型间关联定义职责明确，可以控制哪些模型之间允许建立何种关系。
- 字段类型和枚举配置格式统一，减少前端表单、CSV 导入、后端校验之间的理解偏差。

### 2.3 平台治理价值

- CMDB 领域变更不再长期依赖通用审计 JSON，可为字段级 diff、变更统计、拓扑对比和告警联动提供稳定基础。
- 权限资源和 action 命名统一，角色授权、页面能力判断和接口保护更容易维护。
- current schema 和 API contract 有文档事实来源，后续 PRD、Spec 和工程任务不再从 V14–V40 迁移链反推当前状态。

## 3. 目标

1. 统一 CMDB 关键产品概念和用户可见行为，减少前后端契约歧义。
2. 明确 P1/P2/P3 架构债务的产品范围、优先级和验收标准。
3. 为 Architect 输出技术 Spec 提供完整上下文、边界、风险和交接要求。
4. 为 Phase 2 工程拆分提供可验证、可回滚、可分批实施的 AC 粒度输入。
5. 确保本阶段只完成 PRD + 后续 Spec 规划，不把实现修改混入 Phase 1。

## 4. 非目标 / 明确排除项

Phase 1 不做以下事项：

- 不修改 Java、TypeScript、SQL 或前端路由实现代码。
- 不新增或执行 Flyway 迁移。
- 不直接迁移生产数据。
- 不部署、不发布、不合并实现变更。
- 不在 PRD 中确定具体类拆分、表结构字段、接口签名或迁移脚本细节。
- 不要求一个 Engineer 在 Phase 2 一次性完成所有 P1/P2/P3，实现阶段必须按 AC 拆分。

## 5. P1 / P2 / P3 范围

### 5.1 P1 — 必须优先解决的用户可见和数据一致性问题

#### P1-1 实例详情 DTO 协议一致

当前实例详情前端使用 snake_case 字段，如 `model_id`、`attrs`、`field_config`、`created_at`、`updated_at`、`created_by_name`；后端实际返回 camelCase 字段，如 `modelId`、`modelName`、`fieldsData`、`attributes`、`createdAt`、`updatedAt`。这会导致详情页头部、基础信息 Tab、字段渲染和保存行为出现空值或不生效。

产品期望：实例详情页面基于统一 DTO contract 展示和保存，不再依赖前端猜测字段名。

#### P1-2 实例动态属性保存 payload 一致

当前前端保存动态属性时发送 `{ attrs: editAttrs }`，后端更新请求实际接收 `fieldsData`。这会导致用户编辑动态属性后保存不生效。

产品期望：用户编辑实例动态属性后，保存结果可被详情页重新拉取并正确展示。

#### P1-3 关联关系字段历史残留清理

当前 `ci_instance_rel` 表使用 `def_id`、`src_id`、`dst_id`、`attrs` 等字段，但部分 mapper 或查询仍可能使用旧字段名 `src_instance_id`、`dst_instance_id`、`association_kind`。这会影响拓扑、影响分析和关系查询的稳定性。

产品期望：实例关系查询、拓扑和影响分析使用一致的关系语义，避免因历史字段名残留导致运行错误。

#### P1-4 Association Kind / Association Def 双级关系落地

当前系统已有 `ci_association_kind`、`ci_association_def`、`CiAssociationKind`、`CiAssociationDef` 等对象，但实例关联创建主要依赖裸 `associationKind`，未完整约束 src model、dst model、方向、mapping、onDelete 等规则。

产品期望：

- Association Kind 表示关系语义标签，如“部署于”“依赖”“属于”。
- Association Def 表示具体两个模型之间允许的关系定义。
- 用户创建实例关联时基于 Association Def 选择合法关系，而不是仅输入或选择裸 Kind。
- 不符合模型组合、方向或基数规则的关联创建应被阻止，并给出可读错误。

#### P1-5 modelId / id / name / displayName 命名收敛

当前系统中 numeric primary key、模型编码、历史 name、展示名和前端 route `[modelId]` 语义混用。用户和工程都难以判断某个 `modelId` 指的是数字主键还是业务编码。

产品期望：

- `id` 表示数据库数字主键。
- `modelCode` 表示业务稳定模型编码。
- `displayName` 表示用户可见展示名。
- 前端路由和页面文案不继续让 `modelId` 同时承载 numeric id 和 code。

#### P1-6 字段类型和 enumOptions 统一

当前字段类型在迁移、后端和前端中存在 `singlechar`、`longchar`、`int`、`enum`、`objuser`、`bool`、`date`、`list` 等混合判断；`enumOptions` 有时像 JSON，有时被前端按换行字符串处理。

产品期望：字段类型和枚举配置在模型管理、实例表单、CSV 导入和校验中使用同一套语义，用户配置一次即可在所有入口一致生效。

#### P1-7 CMDB 变更历史与 AuditLog 职责解耦

当前 CMDB 变更统计、筛选和 TopInstance 等能力依赖 `AuditLog.beforeJson/afterJson` 解析。AuditLog 是系统审计，不应长期作为 CMDB 领域变更唯一来源。

产品期望：CMDB 领域变更历史具备独立、稳定、可查询的产品能力，同时 AuditLog 保留审计用途。

### 5.2 P2 — 同一方案中规划、后续按 AC 实现的维护性问题

#### P2-1 CiInstanceService 职责拆分

当前 `CiInstanceService` 同时承担实例 CRUD、schema 校验、唯一性校验、关系 metadata 校验、审计写入、关联资源查询和变更统计 cache invalidation 等职责。

产品期望：服务职责边界清晰，降低后续新增实例字段、导入规则、关联规则或变更统计能力时的回归风险。

#### P2-2 前端路由和页面边界收敛

当前 `/cmdb/admin/models/[modelId]`、`/cmdb/instances/by-model/[modelId]`、`/cmdb/topology/[instanceId]`、`/cmdb/impact/[instanceId]` 等路由中，`modelId` 语义不清，部分页面还同时承担多个入口职责。

产品期望：管理配置页、业务浏览页、实例详情页、拓扑页和影响分析页边界清晰；路由参数语义可被用户、QA 和工程一致理解。

#### P2-3 权限资源/action 统一

当前权限存在 `read/write/update/delete/export/manage` 等 action 混用，resource 边界也不完全一致，如 relation、import、impact、topology、attribute 的授权含义不够清楚。

产品期望：CMDB 权限资源和 action 命名一致，角色配置可解释，页面能力判断与接口鉴权保持同一口径。

### 5.3 P3 — 文档和长期维护能力

#### P3-1 current schema 文档

当前迁移链经历多次补洞，Worker 难以从 V14–V40 准确反推最终 schema。

产品期望：输出 `docs/cmdb/schema-current.md`，作为当前 CMDB schema 的事实来源。

#### P3-2 API contract / frontend DTO mapping 文档

当前 DTO 命名、字段类型、路由参数语义缺少统一文档。

产品期望：输出 CMDB API contract / frontend DTO mapping 文档，明确 DTO 字段命名、canonical 字段、兼容字段、字段类型、枚举配置、路由参数语义和权限资源口径。

## 6. 用户故事

### US-1 运维用户查看实例详情

作为运维用户，我想打开任意 CI 实例详情页后看到正确的模型、基础信息、动态属性和更新时间，以便快速判断该实例的当前状态。

### US-2 运维用户编辑动态属性

作为运维用户，我想在实例详情页编辑动态属性并保存，以便维护 CMDB 中的真实资产信息。

### US-3 运维用户查看拓扑和影响分析

作为运维用户，我想基于实例关系查看拓扑和影响分析，以便评估变更风险和故障影响范围。

### US-4 CMDB 管理员配置模型关系

作为 CMDB 管理员，我想定义哪些模型之间允许建立哪些类型的关系，以便控制 CMDB 数据质量并避免错误关联。

### US-5 CMDB 管理员维护模型字段

作为 CMDB 管理员，我想使用统一字段类型和枚举配置维护模型属性，以便实例表单、CSV 导入和校验规则表现一致。

### US-6 平台管理员配置权限

作为平台管理员，我想用一致的 CMDB 权限资源和 action 给角色授权，以便控制不同用户能查看、创建、更新、导出或管理哪些 CMDB 能力。

### US-7 工程和 QA 查阅事实文档

作为工程或 QA，我想查阅 current schema 和 API contract 文档，以便不依赖迁移链猜测当前系统行为，并能基于文档设计实现和测试用例。

### US-8 审计和治理人员查看变更历史

作为审计或治理人员，我想区分系统审计日志和 CMDB 领域变更记录，以便既能追踪用户操作，又能分析 CMDB 数据变更趋势。

## 7. Draft Acceptance Criteria

### AC1 实例详情 DTO / payload contract 修复

- [ ] 实例详情页不再因为 camelCase/snake_case 字段不一致导致模型信息、字段配置或动态属性为空。
- [ ] 动态属性保存使用后端认可的 canonical 字段。
- [ ] 保存后重新拉取详情，用户能看到更新后的动态属性。
- [ ] 兼容窗口内，旧字段或旧 payload 的处理策略被明确记录在 API contract 中。
- [ ] QA 能基于一个含动态字段的模型创建实例、编辑字段、刷新页面并验证值仍存在。

### AC2 `ci_instance_rel` 字段名和关系查询口径清理

- [ ] 拓扑、影响分析和实例关联列表使用一致的关系字段语义。
- [ ] 不再有用户可触发的流程依赖旧字段名 `src_instance_id`、`dst_instance_id`、`association_kind`。
- [ ] 现有关系数据在兼容策略下仍能被查询和展示。
- [ ] QA 能创建两个实例关系，并在详情、拓扑、影响分析入口看到一致结果。

### AC3 Association Kind / Association Def 双级关系落地

- [ ] 管理员能区分维护 Association Kind 和 Association Def。
- [ ] Association Def 能表达 src model、dst model、kind、方向、mapping 和删除行为等业务约束。
- [ ] 实例关联创建必须基于合法 Association Def。
- [ ] 不允许的模型组合、方向或 mapping 被阻止，并返回用户可理解的错误。
- [ ] 旧的裸 kind 创建方式有明确兼容、迁移或废弃策略。

### AC4 modelCode / id / displayName 命名收敛

- [ ] 用户可见页面和文档能区分数字主键、模型编码和展示名。
- [ ] 新增或调整的 API contract 不再使用语义混杂的 `modelId` 表示多个概念。
- [ ] 前端路由参数含义清晰，业务路由优先表达 `modelCode`，实例路由表达 `instanceId`。
- [ ] 旧 URL 或旧参数在兼容窗口内有明确处理方式。
- [ ] QA 能通过模型编码进入实例列表，并通过实例 ID 进入详情页。

### AC5 字段类型和 enumOptions 统一

- [ ] FieldType canonical 列表被文档明确。
- [ ] 前端表单、后端校验、CSV 导入和关联 metadata 校验对同一字段类型表现一致。
- [ ] enumOptions 统一为一个明确结构，不继续混用 JSON 和换行字符串。
- [ ] 历史字段类型的兼容或迁移策略被记录。
- [ ] QA 能用枚举字段完成模型配置、实例创建、CSV 导入预检和实例编辑全链路验证。

### AC6 CMDB 领域变更历史解耦

- [ ] PRD/Spec 明确 AuditLog 与 CMDB 领域变更的职责边界。
- [ ] 后续实现应支持实例级历史、全局变更列表、字段级 diff 和变更统计。
- [ ] 灰度或迁移期间，新旧变更来源差异有核对方式。
- [ ] 用户查看变更历史时，不应因 AuditLog JSON 结构变化导致页面不可用。
- [ ] QA 能验证一次实例创建、更新、关联变化在 CMDB 领域变更中可追踪。

### AC7 权限模型收敛

- [ ] CMDB resources 和 actions 有统一命名口径。
- [ ] model、attribute、instance、relation、topology、import、impact、alert 等能力边界清晰。
- [ ] 旧权限 action 如 `write` 与新 action 如 `update/manage` 的兼容策略明确。
- [ ] 前端页面能力判断和后端接口鉴权使用同一资源/action 语义。
- [ ] QA 能用不同角色验证只读、编辑、导出、管理等权限差异。

### AC8 current schema 与 API contract 文档

- [ ] `docs/cmdb/schema-current.md` 描述当前 CMDB 最终 schema。
- [ ] `docs/cmdb/api-contract.md` 或等价文档描述 DTO 命名、字段类型、enumOptions、路由参数和权限口径。
- [ ] 文档标注哪些字段是 canonical，哪些字段仅为兼容期 alias。
- [ ] 后续 PRD、Spec 和工程任务引用 current schema，而不是要求 Worker 从迁移链推断。
- [ ] QA 和 Engineer 能基于文档写出测试用例和实施任务。

### AC9 服务职责边界可维护

- [ ] 后续 Spec 明确实例 CRUD、schema validation、relation metadata validation、resource link、change event、audit 等职责边界。
- [ ] 新增实例字段或关联规则时，不需要在一个过胖服务中修改无关职责。
- [ ] 回归测试覆盖实例 CRUD、字段校验、关联规则和变更记录的核心流程。

### AC10 前端页面边界和路由语义清晰

- [ ] 管理配置页与业务浏览页职责明确。
- [ ] 拓扑页和影响分析页入口、参数和用户预期清晰。
- [ ] route 参数命名与 API contract 一致。
- [ ] 旧入口在兼容期内有 redirect、提示或文档说明。

## 8. 交互流

### 8.1 实例详情与动态属性保存

1. 用户进入某个模型的实例列表。
2. 用户点击一个实例进入详情页。
3. 页面展示模型编码、展示名、实例基础字段、动态属性、创建/更新时间。
4. 用户进入基础信息或动态属性编辑区域。
5. 用户修改字段并保存。
6. 系统提示保存成功。
7. 用户刷新或重新进入详情页，看到保存后的字段值。

### 8.2 关联创建

1. 用户进入实例详情的关联页。
2. 用户选择目标实例或目标模型。
3. 系统只展示当前 src/dst 模型组合允许的 Association Def。
4. 用户选择一个合法关系定义并提交。
5. 若符合方向和 mapping 规则，关系创建成功。
6. 若不符合规则，系统展示可读错误，说明哪个约束不满足。

### 8.3 模型字段配置

1. CMDB 管理员进入模型管理页面。
2. 管理员新增或编辑字段。
3. 管理员从统一 FieldType 列表中选择字段类型。
4. 若字段为 enum，管理员使用统一 enumOptions 格式维护选项。
5. 保存后，实例创建、实例编辑和 CSV 导入均使用同一字段语义。

### 8.4 权限授权与访问

1. 平台管理员进入角色或权限配置。
2. 管理员选择 CMDB resource 和 action。
3. 用户登录后访问 CMDB 页面。
4. 前端页面依据授权展示或隐藏能力入口。
5. 后端接口依据同一资源/action 执行鉴权。

### 8.5 变更历史查看

1. 用户打开实例详情或全局变更页面。
2. 用户筛选模型、实例、字段或时间范围。
3. 系统展示 CMDB 领域变更记录。
4. 用户可查看字段级变化、变更时间和操作人。
5. 审计场景仍可通过 AuditLog 查询系统操作轨迹。

## 9. 兼容与迁移风险

| 风险 | 用户影响 | 产品要求 |
|---|---|---|
| DTO 字段命名切换 | 详情页、编辑页短期可能空白或保存失败 | 必须有兼容窗口，canonical 字段和 alias 字段在 API contract 中明确 |
| 关系 def_id 语义收敛 | 历史关系可能无法匹配新 Association Def | 必须先定义旧数据兼容、默认 Def 生成或迁移策略 |
| `modelId` 语义变化 | 旧 URL、书签或外部链接可能失效 | 必须有旧路由 redirect 或旧参数 alias 策略 |
| 字段类型收敛 | 历史字段可能不符合新枚举 | 必须提供审计、映射和用户可理解的修复建议 |
| enumOptions 格式统一 | 旧配置可能无法直接渲染 | 必须定义读取兼容和保存 canonical 格式 |
| 变更历史双来源 | AuditLog 与领域变更短期统计不一致 | 必须有双写、对账或灰度校验策略 |
| 权限 action 改名 | 用户可能突然失权或误授权 | 必须有旧权限 alias 或批量授权兼容策略 |
| 过大范围一次实现 | 回归风险高，难以定位问题 | Phase 2 必须按 AC 拆分、独立验证、独立回滚 |

## 10. 成功指标

- 实例详情动态属性保存链路在 QA 回归中稳定通过。
- 拓扑和影响分析不再因关系字段历史残留出现查询错误。
- 新建实例关系必须能追溯到合法 Association Def。
- CMDB 模型、字段、关系、权限和 API contract 文档可被 Architect、Engineer、QA 共同引用。
- Phase 2 工程任务可拆成多个独立 AC，而不是一次性大重构。
- 新增 CMDB 功能时，工程不再需要从历史迁移链猜测 schema 或字段含义。

## 11. Phase 2 建议拆分方向

> 以下为产品验收粒度建议，不是技术实施方案。

1. AC1: 实例详情 DTO / payload contract 修复。
2. AC2: `ci_instance_rel` 字段名和 mapper 查询口径清理。
3. AC3: AssociationDef 驱动的实例关系创建链路。
4. AC4: `modelCode` / `id` / `displayName` 命名与路由收敛。
5. AC5: FieldType 与 enumOptions 统一。
6. AC6: CMDB 领域变更记录与 AuditLog 解耦。
7. AC7: CMDB 权限资源/action 收敛。
8. AC8: current schema 与 API contract 文档输出。
9. AC9: 实例服务职责边界拆分。
10. AC10: 前端页面边界和旧路由兼容。

## 12. Architect Handoff

Architect 接手时请基于本 PRD 和 brief 输出独立技术 Spec，重点覆盖以下内容，但不要反向修改本 PRD 的产品边界：

- 当前架构问题清单和影响面。
- API contract 统一方案，包括 canonical 字段、兼容 alias、版本或灰度策略。
- DB/schema 兼容方案，包括关系字段、Association Def、历史数据和回滚策略。
- Association Kind / Association Def 双级关系的落地设计。
- 前端路由、DTO mapping 和页面边界调整方案。
- FieldType 与 enumOptions 的统一表示和迁移策略。
- 权限资源/action 的收敛方案和旧权限兼容策略。
- CMDB 领域变更历史与 AuditLog 解耦方案。
- AC 级工程拆分、回归测试矩阵、风险和回滚策略。
- `docs/cmdb/schema-current.md` 与 CMDB API contract 文档的输出方式。

Architect 输出 Spec 后，Engineer 再按 AC 分批实现。任一 AC 如果需要破坏性迁移、长时间停机、生产数据批量修复或用户可见行为改变，必须在实现前再次回到 Product/Architect 确认。
