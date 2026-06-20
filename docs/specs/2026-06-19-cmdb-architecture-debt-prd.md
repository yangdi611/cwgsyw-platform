# PRD: CMDB 架构债务清理（P1/P2/P3）

> 日期: 2026-06-19
> 作者: Product / Architect handoff
> 状态: Phase 1 — PRD + Spec
> Brief: `docs/specs/2026-06-19-cmdb-architecture-debt-brief.md`
> Tech Spec: `docs/specs/2026-06-19-cmdb-architecture-debt-spec.md`

---

## 1. 背景

CMDB 已覆盖模型、实例、属性、关联、CSV 导入、影响分析、拓扑、变更历史、告警与关联资源等能力，但功能迭代中留下多处架构债务。当前问题已经不适合继续通过零散修补解决：DTO 协议、关联定义、模型命名、字段类型、变更历史、权限资源、前端路由和 current schema 文档之间存在系统性不一致。

本需求的 Phase 1 只输出 PRD + 技术 Spec，不直接修改代码、数据库或线上数据。后续 Phase 2 由工程按 AC 拆分实现。

## 2. 用户价值

- 运维用户：实例详情、动态属性编辑、拓扑与影响分析可稳定使用，避免页面空数据或保存无效。
- CMDB 管理员：模型、字段、关联定义的语义清晰，减少配置错误。
- 工程团队：前后端契约、schema、迁移策略有文档可查，后续开发不再从 V14–V40 迁移链反推当前状态。
- 平台治理：AuditLog 回归审计职责，CMDB 领域变更有独立记录，为统计、拓扑对比、回滚和告警联动打基础。

## 3. 范围

### P1 — 必须优先解决

1. 统一实例详情 DTO 与更新 payload contract。
2. 清理 `ci_instance_rel` 字段历史残留，统一 `src_id/dst_id/def_id/metadata` 语义。
3. 落地 Association Kind / Association Def 双级关系设计，实例关联创建以 `defId` 为依据。
4. 收敛 `id/modelCode/displayName` 命名，禁止 `modelId` 同时表示 numeric id 和 code。
5. 统一 FieldType 与 enumOptions 结构。
6. 设计 CMDB 领域变更表，逐步解耦 AuditLog JSON。

### P2 — 同一方案中规划，后续按 AC 实现

1. 拆分 `CiInstanceService` 职责。
2. 收敛前端路由和页面边界。
3. 统一 CMDB 权限资源/action。

### P3 — 文档与长期维护

1. 输出 current schema 文档。
2. 输出 API contract / frontend DTO mapping 文档。

## 4. 明确排除项

Phase 1 不做：

- 不修改 Java / TypeScript 实现代码。
- 不新增或执行 Flyway 迁移。
- 不做生产数据迁移。
- 不部署。
- 不合并实现分支。

## 5. 关键业务验收标准

### BA-1 实例详情可稳定显示与保存

- 实例详情页显示模型编码、创建时间、字段分组、动态属性值，不出现因 camelCase/snake_case 不一致导致的空白。
- 动态属性保存时使用后端认可的字段 `fieldsData`。
- 保存后重新拉取详情可看到更新值。

### BA-2 关联创建遵守模型间定义

- 用户创建实例关联时必须选择一个允许当前 src/dst 模型组合的 AssociationDef。
- 不允许仅通过裸 association kind 创建跨模型关系。
- 不满足 mapping / direction / onDelete 规则时返回可读错误。

### BA-3 模型命名语义清晰

- API 和前端路由中可区分 numeric `id`、业务编码 `modelCode`、展示名 `displayName`。
- `/cmdb/instances/by-model/...` 等业务路由以 `modelCode` 表达，不再使用语义混杂的 `[modelId]`。

### BA-4 字段类型和枚举配置一致

- 后端校验、前端表单、CSV 导入、关联 metadata 校验使用同一 FieldType 枚举。
- enumOptions 统一为 JSON array，不再有换行字符串/JSON 混用。

### BA-5 变更历史可靠

- CMDB 领域变更记录可独立支持实例历史、全局变更、统计和字段级 diff。
- AuditLog 仍保留审计用途，但不是 CMDB 领域统计的唯一数据源。

### BA-6 权限资源一致

- CMDB 权限资源和 action 命名一致，`write/update/import/impact` 混用问题被消除或有兼容别名。

### BA-7 文档可作为工程事实来源

- `docs/cmdb/schema-current.md` 描述当前最终 schema，而不是要求工程从迁移链猜。
- `docs/cmdb/api-contract.md` 描述 DTO 命名、字段类型、路由参数语义和兼容策略。

## 6. 迁移/兼容风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| DTO 字段改名导致旧前端调用失败 | 实例详情/编辑短期不可用 | Phase 2 使用双读/双写兼容窗口：后端接受旧 payload alias，前端先适配 canonical 字段 |
| `ci_instance_rel.def_id` 语义从 kind 迁到 def | 旧关系数据无法匹配新定义 | 新增迁移脚本生成缺省 AssociationDef 并回填 def_id；保留 kind 派生字段只读展示 |
| modelId 语义变更影响路由 | 旧 URL 失效 | 前端增加旧路由 redirect，新 API 保留旧 query 参数 alias 一个版本 |
| FieldType 收敛影响历史属性 | 校验变严导致保存/导入失败 | 先审计历史字段类型，迁移不合法类型到 canonical enum，导入预检给出修复建议 |
| 变更历史双写带来统计差异 | 新旧统计短期不一致 | 灰度期 AuditLog 与 `ci_change_record` 双写并跑一致性检查 |
| 权限 action 改名影响角色 | 用户突然失权 | Flyway seed 新旧权限同时授权，前端能力检查支持 alias |

## 7. 下游交接

- Architect 输出技术 Spec: `docs/specs/2026-06-19-cmdb-architecture-debt-spec.md`
- Architect 输出实施计划: `.hermes_company/plans/2026-06-19-cmdb-architecture-debt.md`
- Phase 2 由 engineer 按 AC1–AC10 分批实现，每个 AC 必须独立测试、独立回滚。
