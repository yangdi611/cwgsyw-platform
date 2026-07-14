---
name: instances
description: "Skill for the Instances area of cwgsyw-platform. 4 symbols across 2 files."
---

# Instances

4 symbols | 2 files | Cohesion: 55%

## When to Use

- Working with code in `frontend/`
- Understanding how useColumnConfig, CiResourcesPage work
- Modifying instances-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/app/(dashboard)/cmdb/instances/page.tsx` | CiResourcesInner, toggleGroup, CiResourcesPage |
| `frontend/src/hooks/useColumnConfig.ts` | useColumnConfig |

## Entry Points

Start here when exploring this area:

- **`useColumnConfig`** (Function) — `frontend/src/hooks/useColumnConfig.ts:2`
- **`CiResourcesPage`** (Function) — `frontend/src/app/(dashboard)/cmdb/instances/page.tsx:284`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `useColumnConfig` | Function | `frontend/src/hooks/useColumnConfig.ts` | 2 |
| `CiResourcesPage` | Function | `frontend/src/app/(dashboard)/cmdb/instances/page.tsx` | 284 |
| `CiResourcesInner` | Function | `frontend/src/app/(dashboard)/cmdb/instances/page.tsx` | 47 |
| `toggleGroup` | Function | `frontend/src/app/(dashboard)/cmdb/instances/page.tsx` | 110 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CiResourcesPage → UsePermission` | cross_community | 3 |
| `CiResourcesPage → UseColumnConfig` | intra_community | 3 |
| `CiResourcesPage → ToggleGroup` | intra_community | 3 |
| `CiResourcesPage → Cn` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| [id] | 3 calls |
| Ui | 1 calls |

## How to Explore

1. `gitnexus_context({name: "useColumnConfig"})` — see callers and callees
2. `gitnexus_query({query: "instances"})` — find related execution flows
3. Read key files listed above for implementation details
