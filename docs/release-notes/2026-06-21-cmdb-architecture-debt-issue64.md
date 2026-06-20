# CMDB Architecture Debt Cleanup — Issue #64 Release Notes

> **Branch**: `feature/cmdb-architecture-debt-phase2`
> **Date**: 2026-06-21
> **Spec**: `docs/specs/2026-06-19-cmdb-architecture-debt-spec-glm52.md`
> **PRD**: `docs/specs/2026-06-19-cmdb-architecture-debt-prd-gaccode.md`
> **Verification**: `docs/specs/verification-report-t_6aee0702.md`
> **Docs**: `docs/cmdb/schema-current.md`, `docs/cmdb/api-contract.md`

---

## Summary

Resolved 8 architectural debt items across 10 acceptance criteria (AC1–AC10), spanning DTO contract alignment, topology SQL fixes, association definition entity completion, naming convergence, field type unification, change record decoupling, permission convergence, documentation, service refactoring, and frontend route boundary.

---

## AC1: DTO Contract Alignment (snake_case → camelCase)

**P1-1, P1-1b, P1-2** — Frontend DTO interfaces aligned to backend camelCase output.

- `CiInstanceDetailVO` / `CiAttributeVO` frontend interfaces → camelCase (`modelCode`, `fieldKey`, `isRequired`, `fieldsData`)
- `InstanceBasicInfoTab` save payload → `fieldsData` (was `attrs`)
- Backend: zero changes (already camelCase via `@JsonNaming(LowerCamelCase)`)

> ⚠️ **Known gap (MEDIUM)**: `CiInstanceDetailVO.attributes` vs frontend `fieldConfig` interface mismatch. Fix pending in t_61bbf8c1.

---

## AC2: Topology SQL Column Names

**P1-3 (CRITICAL)** — Fixed `findTopologyEdges` and `ImpactAnalysisService` SQL to use real column names `def_id/src_id/dst_id` instead of non-existent `src_instance_id/dst_instance_id/association_kind`. Topology and impact analysis no longer throw `PSQLException`.

---

## AC3: AssociationDef-Driven Relationship Creation

**P1-4, P1-4b** — Completed `CiAssociationDef` entity (7 columns mapped: `defId`, `kindId`, `srcModelId`, `dstModelId`, `name`, `mapping`, `onDelete`). `CiInstanceRel` field renamed `associationKind` → `defId`. Relationship creation now validates against `defId`, `srcModelId`/`dstModelId` match, and mapping cardinality.

- **V41 migration**: Backfill `ci_instance_rel.def_id` from kind codes to legal `defId` values.
- **Compat**: `associationKind` accepted as alias for 1 version (AD-3).

---

## AC4: modelCode / id / displayName Naming Convergence

**P1-5** — `CiModel.name` now canonical `modelCode`. `model_id` column deprecated (preserved for Flyway history). 

- `CiInstanceDetailVO` returns both `modelCode` (canonical) and `modelId` (alias, = modelCode) for 1-version compat window.
- Frontend routes: `[modelId]` → `[modelCode]`, legacy `[modelId]` redirects active.
- `CiModel.getModelCode()` added; old `getModelId()` removed.

> ⚠️ **Known gap (HIGH)**: `GET /api/cmdb/models/{id}` only accepts `Long id`, but frontend passes String modelCode. Fix pending in t_c82df65a.

---

## AC5: FieldType Enum & enumOptions Unification

**P1-6** — Canonical FieldType enum defined: `singlechar/longchar/int/float/bool/date/enum/enummulti/objuser`. 

- `ci_attribute.option` (JSONB) now canonical for enum options (`[{"id","name","isDefault"}]`).
- `CiAttribute.option` entity field mapped via `JacksonTypeHandler`.
- Old `enumOptions` (String) field deprecated.
- Frontend `renderEditField` branches aligned to canonical FieldType.
- **V42 migration**: Validated `ci_attribute.option` JSONB integrity.

> ⚠️ **Known gap (MEDIUM)**: `CiAttribute.enumOptions` field lacks `@TableField(exist=false)`, writes may throw `PSQLException`. Fix pending in t_34efb87e.

---

## AC6: CMDB Change Record — AuditLog Decoupling

**P1-7** — New `ci_change_record` table (append-only, not BaseEntity) as CMDB domain change history authority.

- Fields: `instance_id, model_code, action(create/update/delete/relate), field_changes(JSONB), operator_id`.
- `CiInstanceService` dual-writes to `audit_log` + `ci_change_record` (dual-write period).
- `CiChangeService` queries `ci_change_record` for stats and history.
- `audit_log` CMDB queries preserved for cross-module audit compatibility.

---

## AC7: Permission Resource/Action Convergence

**P2-3** — AD-7 canonical permission matrix implemented via V44 migration.

- New independent resources: `cmdb_attribute`, `cmdb_topology`, `cmdb_import`, `cmdb_impact`.
- `cmdb_model:write` deprecated → `cmdb_model:update` (alias migration for existing roles).
- `cmdb_relation` added `update` action.
- `cmdb_model` added `manage` action.
- Role grants: `super_admin/admin` full, `group_leader/member/viewer` scoped.

> Note: Some controllers still use old resource gates (`cmdb_model:read` for attribute endpoints, `cmdb_instance:read` for topology). New resources are seeded but controller migration is deferred.

---

## AC8: Current Schema & API Contract Documentation

`docs/cmdb/schema-current.md` (374 lines) — All CMDB tables (V14–V44 final state) with canonical/alias/deprecated/unmapped column status.

`docs/cmdb/api-contract.md` (609 lines) — Full API route table, DTO schemas with actual JSON keys, AD-7 permission matrix, and compatibility window plan.

---

## AC9: CiInstanceService Responsibility Split

**P2-1** — 571-line monolith split into 5 focused components (zero behavior change):

| Service | Responsibility |
|---|---|
| `CiInstanceQueryService` | list, detail, search, history reads |
| `CiInstanceCommandService` | create, update, delete + audit/change dual-write |
| `CiRelatedResourceService` | device, changeDoc, dailyReport lookups |
| `CiFieldSchemaValidator` | attribute schema validation (AD-5) |
| `CiInstanceUniquenessValidator` | unique field validation |

Original `CiInstanceService` reduced to `@Deprecated` placeholder.

---

## AC10: Frontend Route Boundary & Legacy Redirect

**P2-2** — Route re-organization with clear admin/browse separation.

- `/cmdb/admin` — sole admin entry (model CRUD, attribute management)
- `/cmdb/models`, `/cmdb/instances` — browse-only (CRUD removed, links to admin)
- `/cmdb/topology/[instanceId]/compare` — dedicated compare page (split from `?compare=1` on topology page)
- Legacy redirects: `?compare=1` → `/compare` (307), `/cmdb/models/:code` → `/cmdb/admin/models/:code`
- Sidebar labels: "browse" not "manage" for model/instance nav items

---

## Migration Summary

| Migration | Purpose |
|---|---|
| V41 | `ci_instance_rel.def_id` backfill (kind → defId) |
| V42 | `ci_attribute.option` JSONB validation + comment |
| V43 | `ci_change_record` table creation |
| V44 | CMDB permissions normalize (new resources, write→update alias) |

All migrations are idempotent (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`).

---

## Compatibility Windows

| Change | Window | Status |
|---|---|---|
| Frontend snake_case → camelCase | 1 version (type union fallback) | Active |
| `modelId` → `modelCode` (DTO) | 1 version (dual field return) | Active |
| `[modelId]` → `[modelCode]` (routes) | 1 version (redirect component) | Active |
| `associationKind` → `defId` | 1 version (alias accepted) | Active |
| `write` → `update` (permissions) | Alias migration (V44) | Done |

---

## Known Issues (Post-QA Gaps)

| Priority | Issue | Fix Task |
|---|---|---|
| HIGH | `GET /api/cmdb/models/{id}` rejects String modelCode (5 frontend callers get 400) | t_c82df65a |
| MEDIUM | `CiInstanceDetailVO.attributes` vs frontend `fieldConfig` | t_61bbf8c1 |
| MEDIUM | `CiAttribute.enumOptions` missing `@TableField(exist=false)` | t_34efb87e |

---

## Verification

- **QA Report**: `docs/specs/verification-report-t_6aee0702.md` — 7/10 ACs fully passed, 3 partial (gaps identified and fix tasks created)
- **Build**: `mvn compile` PASS, `tsc --noEmit` PASS
