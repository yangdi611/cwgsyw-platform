---
name: id
description: "Skill for the [id] area of cwgsyw-platform. 66 symbols across 38 files."
---

# [id]

66 symbols | 38 files | Cohesion: 93%

## When to Use

- Working with code in `frontend/`
- Understanding how usePermission, AdminAiPage, AuditLogPage work
- Modifying [id]-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx` | ChangeDocDetailPage, setField, handleAiGenerate, handleExport |
| `frontend/src/app/(dashboard)/change-docs/new/page.tsx` | NewChangeDocPage, toggleCiSelection, handleSelectTemplate, renderField |
| `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/new/page.tsx` | NewInstancePage, set, renderField, toggle |
| `frontend/src/app/(dashboard)/reports/page.tsx` | getMonthRange, getQuarterRange, ReportsPage, applyPreset |
| `frontend/src/components/ui/select.tsx` | SelectValue, SelectTrigger, SelectContent, SelectItem |
| `frontend/src/app/(dashboard)/admin/change-doc-templates/[id]/page.tsx` | TemplateFieldsPage, update, removeField |
| `frontend/src/app/(dashboard)/cmdb/admin/page.tsx` | AdminPage, ModelsTab, AssociationsTab |
| `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/page.tsx` | InstanceDetailPage, renderEditField, toggle |
| `frontend/src/app/(dashboard)/admin/ai/page.tsx` | ProviderCard, AdminAiPage |
| `frontend/src/app/(dashboard)/admin/change-doc-templates/page.tsx` | ChangeDocTemplatesPage, handleUpload |

## Entry Points

Start here when exploring this area:

- **`usePermission`** (Function) — `frontend/src/hooks/usePermission.ts:2`
- **`AdminAiPage`** (Function) — `frontend/src/app/(dashboard)/admin/ai/page.tsx:154`
- **`AuditLogPage`** (Function) — `frontend/src/app/(dashboard)/admin/audit/page.tsx:51`
- **`TemplateFieldsPage`** (Function) — `frontend/src/app/(dashboard)/admin/change-doc-templates/[id]/page.tsx:40`
- **`update`** (Function) — `frontend/src/app/(dashboard)/admin/change-doc-templates/[id]/page.tsx:76`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `usePermission` | Function | `frontend/src/hooks/usePermission.ts` | 2 |
| `AdminAiPage` | Function | `frontend/src/app/(dashboard)/admin/ai/page.tsx` | 154 |
| `AuditLogPage` | Function | `frontend/src/app/(dashboard)/admin/audit/page.tsx` | 51 |
| `TemplateFieldsPage` | Function | `frontend/src/app/(dashboard)/admin/change-doc-templates/[id]/page.tsx` | 40 |
| `update` | Function | `frontend/src/app/(dashboard)/admin/change-doc-templates/[id]/page.tsx` | 76 |
| `removeField` | Function | `frontend/src/app/(dashboard)/admin/change-doc-templates/[id]/page.tsx` | 96 |
| `ChangeDocTemplatesPage` | Function | `frontend/src/app/(dashboard)/admin/change-doc-templates/page.tsx` | 25 |
| `handleUpload` | Function | `frontend/src/app/(dashboard)/admin/change-doc-templates/page.tsx` | 63 |
| `AdminConfigPage` | Function | `frontend/src/app/(dashboard)/admin/config/page.tsx` | 16 |
| `ChangeDocDetailPage` | Function | `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx` | 51 |
| `setField` | Function | `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx` | 80 |
| `handleAiGenerate` | Function | `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx` | 112 |
| `handleExport` | Function | `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx` | 127 |
| `NewChangeDocPage` | Function | `frontend/src/app/(dashboard)/change-docs/new/page.tsx` | 33 |
| `toggleCiSelection` | Function | `frontend/src/app/(dashboard)/change-docs/new/page.tsx` | 88 |
| `handleSelectTemplate` | Function | `frontend/src/app/(dashboard)/change-docs/new/page.tsx` | 98 |
| `renderField` | Function | `frontend/src/app/(dashboard)/change-docs/new/page.tsx` | 129 |
| `ChangeDocsPage` | Function | `frontend/src/app/(dashboard)/change-docs/page.tsx` | 25 |
| `ModelDetailPage` | Function | `frontend/src/app/(dashboard)/cmdb/admin/models/[modelId]/page.tsx` | 33 |
| `AdminPage` | Function | `frontend/src/app/(dashboard)/cmdb/admin/page.tsx` | 33 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `InstanceDetailPage → Cn` | cross_community | 5 |
| `NewInstancePage → Cn` | cross_community | 5 |
| `NewDailyReportPage → Cn` | cross_community | 5 |
| `AssociationsPage → Cn` | cross_community | 4 |
| `AdminPage → Cn` | cross_community | 4 |
| `AdminAiPage → Cn` | cross_community | 4 |
| `WorkflowTasksPage → Cn` | cross_community | 4 |
| `PermissionsPage → Cn` | cross_community | 4 |
| `CredentialSection → Cn` | cross_community | 4 |
| `InstanceDetailPage → LayoutNodes` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Ui | 22 calls |
| Instances | 1 calls |
| Cmdb | 1 calls |

## How to Explore

1. `gitnexus_context({name: "usePermission"})` — see callers and callees
2. `gitnexus_query({query: "[id]"})` — find related execution flows
3. Read key files listed above for implementation details
