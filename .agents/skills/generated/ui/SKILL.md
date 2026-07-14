---
name: ui
description: "Skill for the Ui area of cwgsyw-platform. 56 symbols across 14 files."
---

# Ui

56 symbols | 14 files | Cohesion: 73%

## When to Use

- Working with code in `frontend/`
- Understanding how cn, NotificationsPage, LoginPage work
- Modifying ui-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `frontend/src/components/ui/alert-dialog.tsx` | AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogFooter (+5) |
| `frontend/src/components/ui/dropdown-menu.tsx` | DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSubTrigger, DropdownMenuSubContent (+4) |
| `frontend/src/components/ui/table.tsx` | Table, TableHeader, TableBody, TableFooter, TableRow (+3) |
| `frontend/src/components/ui/card.tsx` | CardDescription, CardAction, CardFooter, Card, CardHeader (+2) |
| `frontend/src/components/ui/dialog.tsx` | DialogPortal, DialogOverlay, DialogContent, DialogHeader, DialogTitle (+1) |
| `frontend/src/components/ui/select.tsx` | SelectGroup, SelectLabel, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton |
| `frontend/src/components/ui/avatar.tsx` | AvatarImage, AvatarBadge, AvatarGroup, AvatarGroupCount |
| `frontend/src/lib/utils.ts` | cn |
| `frontend/src/app/(dashboard)/notifications/page.tsx` | NotificationsPage |
| `frontend/src/components/ui/separator.tsx` | Separator |

## Entry Points

Start here when exploring this area:

- **`cn`** (Function) — `frontend/src/lib/utils.ts:3`
- **`NotificationsPage`** (Function) — `frontend/src/app/(dashboard)/notifications/page.tsx:24`
- **`LoginPage`** (Function) — `frontend/src/app/(auth)/login/page.tsx:8`
- **`DailyReportDetailPage`** (Function) — `frontend/src/app/(dashboard)/daily/[id]/page.tsx:38`
- **`DashboardPage`** (Function) — `frontend/src/app/(dashboard)/page.tsx:2`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `cn` | Function | `frontend/src/lib/utils.ts` | 3 |
| `NotificationsPage` | Function | `frontend/src/app/(dashboard)/notifications/page.tsx` | 24 |
| `LoginPage` | Function | `frontend/src/app/(auth)/login/page.tsx` | 8 |
| `DailyReportDetailPage` | Function | `frontend/src/app/(dashboard)/daily/[id]/page.tsx` | 38 |
| `DashboardPage` | Function | `frontend/src/app/(dashboard)/page.tsx` | 2 |
| `AlertDialogPortal` | Function | `frontend/src/components/ui/alert-dialog.tsx` | 18 |
| `AlertDialogOverlay` | Function | `frontend/src/components/ui/alert-dialog.tsx` | 24 |
| `AlertDialogContent` | Function | `frontend/src/components/ui/alert-dialog.tsx` | 40 |
| `AlertDialogHeader` | Function | `frontend/src/components/ui/alert-dialog.tsx` | 63 |
| `AlertDialogFooter` | Function | `frontend/src/components/ui/alert-dialog.tsx` | 79 |
| `AlertDialogMedia` | Function | `frontend/src/components/ui/alert-dialog.tsx` | 95 |
| `AlertDialogTitle` | Function | `frontend/src/components/ui/alert-dialog.tsx` | 111 |
| `AlertDialogDescription` | Function | `frontend/src/components/ui/alert-dialog.tsx` | 127 |
| `AlertDialogAction` | Function | `frontend/src/components/ui/alert-dialog.tsx` | 143 |
| `AlertDialogCancel` | Function | `frontend/src/components/ui/alert-dialog.tsx` | 156 |
| `AvatarImage` | Function | `frontend/src/components/ui/avatar.tsx` | 27 |
| `AvatarBadge` | Function | `frontend/src/components/ui/avatar.tsx` | 56 |
| `AvatarGroup` | Function | `frontend/src/components/ui/avatar.tsx` | 72 |
| `AvatarGroupCount` | Function | `frontend/src/components/ui/avatar.tsx` | 85 |
| `CardDescription` | Function | `frontend/src/components/ui/card.tsx` | 48 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `InstanceDetailPage → Cn` | cross_community | 5 |
| `NewInstancePage → Cn` | cross_community | 5 |
| `NewDailyReportPage → Cn` | cross_community | 5 |
| `AssociationsPage → Cn` | cross_community | 4 |
| `AdminPage → Cn` | cross_community | 4 |
| `AdminAiPage → Cn` | cross_community | 4 |
| `DashboardLayout → Cn` | cross_community | 4 |
| `WorkflowTasksPage → Cn` | cross_community | 4 |
| `PermissionsPage → Cn` | cross_community | 4 |
| `CredentialSection → Cn` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| [id] | 11 calls |
| Layout | 1 calls |

## How to Explore

1. `gitnexus_context({name: "cn"})` — see callers and callees
2. `gitnexus_query({query: "ui"})` — find related execution flows
3. Read key files listed above for implementation details
