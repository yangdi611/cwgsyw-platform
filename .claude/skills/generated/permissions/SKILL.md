---
name: permissions
description: "Skill for the Permissions area of cwgsyw-platform. 4 symbols across 2 files."
---

# Permissions

4 symbols | 2 files | Cohesion: 75%

## When to Use

- Working with code in `frontend/`
- Understanding how PermissionsPage work
- Modifying permissions-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/app/(dashboard)/rbac/permissions/page.tsx` | PermissionsContent, toggle, PermissionsPage |
| `frontend/src/components/ui/checkbox.tsx` | Checkbox |

## Entry Points

Start here when exploring this area:

- **`PermissionsPage`** (Function) — `frontend/src/app/(dashboard)/rbac/permissions/page.tsx:122`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `PermissionsPage` | Function | `frontend/src/app/(dashboard)/rbac/permissions/page.tsx` | 122 |
| `PermissionsContent` | Function | `frontend/src/app/(dashboard)/rbac/permissions/page.tsx` | 24 |
| `toggle` | Function | `frontend/src/app/(dashboard)/rbac/permissions/page.tsx` | 68 |
| `Checkbox` | Function | `frontend/src/components/ui/checkbox.tsx` | 7 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `PermissionsPage → Cn` | cross_community | 4 |
| `PermissionsPage → Toggle` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Ui | 1 calls |
| [id] | 1 calls |

## How to Explore

1. `gitnexus_context({name: "PermissionsPage"})` — see callers and callees
2. `gitnexus_query({query: "permissions"})` — find related execution flows
3. Read key files listed above for implementation details
