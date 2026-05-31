---
name: user
description: "Skill for the User area of cwgsyw-platform. 7 symbols across 5 files."
---

# User

7 symbols | 5 files | Cohesion: 75%

## When to Use

- Working with code in `backend/`
- Understanding how SysUserRole, User, assignRolesToUser work
- Modifying user-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `backend/src/main/java/com/cwgsyw/platform/module/user/UserController.java` | create, update |
| `backend/src/main/java/com/cwgsyw/platform/module/user/UserService.java` | create, update |
| `backend/src/main/java/com/cwgsyw/platform/module/rbac/RbacService.java` | assignRolesToUser |
| `backend/src/main/java/com/cwgsyw/platform/module/rbac/entity/SysUserRole.java` | SysUserRole |
| `backend/src/main/java/com/cwgsyw/platform/module/user/entity/User.java` | User |

## Entry Points

Start here when exploring this area:

- **`SysUserRole`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/rbac/entity/SysUserRole.java:5`
- **`User`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/user/entity/User.java:7`
- **`assignRolesToUser`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/rbac/RbacService.java:60`
- **`create`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/user/UserController.java:27`
- **`update`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/user/UserController.java:34`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `SysUserRole` | Class | `backend/src/main/java/com/cwgsyw/platform/module/rbac/entity/SysUserRole.java` | 5 |
| `User` | Class | `backend/src/main/java/com/cwgsyw/platform/module/user/entity/User.java` | 7 |
| `assignRolesToUser` | Method | `backend/src/main/java/com/cwgsyw/platform/module/rbac/RbacService.java` | 60 |
| `create` | Method | `backend/src/main/java/com/cwgsyw/platform/module/user/UserController.java` | 27 |
| `update` | Method | `backend/src/main/java/com/cwgsyw/platform/module/user/UserController.java` | 34 |
| `create` | Method | `backend/src/main/java/com/cwgsyw/platform/module/user/UserService.java` | 27 |
| `update` | Method | `backend/src/main/java/com/cwgsyw/platform/module/user/UserService.java` | 47 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Create → SysUserRole` | intra_community | 4 |
| `Update → SysUserRole` | intra_community | 4 |
| `Create → FindByUsername` | cross_community | 3 |
| `Create → User` | intra_community | 3 |
| `Update → Ok` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Rbac | 2 calls |
| Changedoc | 1 calls |

## How to Explore

1. `gitnexus_context({name: "SysUserRole"})` — see callers and callees
2. `gitnexus_query({query: "user"})` — find related execution flows
3. Read key files listed above for implementation details
