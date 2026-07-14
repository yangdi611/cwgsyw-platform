---
name: layout
description: "Skill for the Layout area of cwgsyw-platform. 11 symbols across 7 files."
---

# Layout

11 symbols | 7 files | Cohesion: 65%

## When to Use

- Working with code in `frontend/`
- Understanding how getToken, DashboardLayout, Sidebar work
- Modifying layout-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/components/layout/Sidebar.tsx` | isGroup, usePersistState, NavGroupItem, Sidebar |
| `frontend/src/components/ui/avatar.tsx` | Avatar, AvatarFallback |
| `frontend/src/lib/auth.ts` | getToken |
| `frontend/src/app/(dashboard)/layout.tsx` | DashboardLayout |
| `frontend/src/hooks/useAuth.ts` | useAuth |
| `frontend/src/components/layout/Header.tsx` | Header |
| `frontend/src/components/layout/NotificationBell.tsx` | NotificationBell |

## Entry Points

Start here when exploring this area:

- **`getToken`** (Function) — `frontend/src/lib/auth.ts:3`
- **`DashboardLayout`** (Function) — `frontend/src/app/(dashboard)/layout.tsx:8`
- **`Sidebar`** (Function) — `frontend/src/components/layout/Sidebar.tsx:128`
- **`useAuth`** (Function) — `frontend/src/hooks/useAuth.ts:6`
- **`Header`** (Function) — `frontend/src/components/layout/Header.tsx:6`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getToken` | Function | `frontend/src/lib/auth.ts` | 3 |
| `DashboardLayout` | Function | `frontend/src/app/(dashboard)/layout.tsx` | 8 |
| `Sidebar` | Function | `frontend/src/components/layout/Sidebar.tsx` | 128 |
| `useAuth` | Function | `frontend/src/hooks/useAuth.ts` | 6 |
| `Header` | Function | `frontend/src/components/layout/Header.tsx` | 6 |
| `NotificationBell` | Function | `frontend/src/components/layout/NotificationBell.tsx` | 7 |
| `isGroup` | Function | `frontend/src/components/layout/Sidebar.tsx` | 31 |
| `usePersistState` | Function | `frontend/src/components/layout/Sidebar.tsx` | 63 |
| `NavGroupItem` | Function | `frontend/src/components/layout/Sidebar.tsx` | 76 |
| `Avatar` | Function | `frontend/src/components/ui/avatar.tsx` | 7 |
| `AvatarFallback` | Function | `frontend/src/components/ui/avatar.tsx` | 40 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `DashboardLayout → UsePersistState` | intra_community | 4 |
| `DashboardLayout → Cn` | cross_community | 4 |
| `DashboardLayout → UsePermission` | cross_community | 3 |
| `DashboardLayout → IsGroup` | intra_community | 3 |
| `DashboardLayout → UseAuth` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Ui | 5 calls |
| [id] | 2 calls |

## How to Explore

1. `gitnexus_context({name: "getToken"})` — see callers and callees
2. `gitnexus_query({query: "layout"})` — find related execution flows
3. Read key files listed above for implementation details
