---
name: notification
description: "Skill for the Notification area of cwgsyw-platform. 4 symbols across 3 files."
---

# Notification

4 symbols | 3 files | Cohesion: 75%

## When to Use

- Working with code in `backend/`
- Understanding how NotificationVO, list, listByUser work
- Modifying notification-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `backend/src/main/java/com/cwgsyw/platform/module/notification/NotificationService.java` | listByUser, toVO |
| `backend/src/main/java/com/cwgsyw/platform/module/notification/NotificationController.java` | list |
| `backend/src/main/java/com/cwgsyw/platform/module/notification/dto/NotificationVO.java` | NotificationVO |

## Entry Points

Start here when exploring this area:

- **`NotificationVO`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/notification/dto/NotificationVO.java:5`
- **`list`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/notification/NotificationController.java:17`
- **`listByUser`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/notification/NotificationService.java:51`
- **`toVO`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/notification/NotificationService.java:77`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `NotificationVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/notification/dto/NotificationVO.java` | 5 |
| `list` | Method | `backend/src/main/java/com/cwgsyw/platform/module/notification/NotificationController.java` | 17 |
| `listByUser` | Method | `backend/src/main/java/com/cwgsyw/platform/module/notification/NotificationService.java` | 51 |
| `toVO` | Method | `backend/src/main/java/com/cwgsyw/platform/module/notification/NotificationService.java` | 77 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `List → NotificationVO` | intra_community | 4 |
| `List → Of` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Changedoc | 1 calls |
| Rbac | 1 calls |

## How to Explore

1. `gitnexus_context({name: "NotificationVO"})` — see callers and callees
2. `gitnexus_query({query: "notification"})` — find related execution flows
3. Read key files listed above for implementation details
