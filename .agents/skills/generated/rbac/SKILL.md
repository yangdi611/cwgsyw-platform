---
name: rbac
description: "Skill for the Rbac area of cwgsyw-platform. 27 symbols across 20 files."
---

# Rbac

27 symbols | 20 files | Cohesion: 66%

## When to Use

- Working with code in `backend/`
- Understanding how InstanceSearchVO, SysRolePermission, LoginResponse work
- Modifying rbac-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `backend/src/main/java/com/cwgsyw/platform/module/rbac/RbacService.java` | getPermissionsByRoleId, assignPermissionsToRole, getUserPermissions, getHighestScope |
| `backend/src/main/java/com/cwgsyw/platform/module/rbac/RoleController.java` | listRoles, getRolePermissions, assignPermissions |
| `backend/src/main/java/com/cwgsyw/platform/module/user/UserController.java` | list, delete |
| `backend/src/main/java/com/cwgsyw/platform/module/user/UserService.java` | list, delete |
| `backend/src/main/java/com/cwgsyw/platform/common/PageResult.java` | of |
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelController.java` | search |
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelService.java` | searchInstances |
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/InstanceSearchVO.java` | InstanceSearchVO |
| `backend/src/main/java/com/cwgsyw/platform/module/rbac/SysRolePermissionMapper.java` | findPermissionIdsByRoleIds |
| `backend/src/main/java/com/cwgsyw/platform/common/R.java` | ok |

## Entry Points

Start here when exploring this area:

- **`InstanceSearchVO`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/InstanceSearchVO.java:4`
- **`SysRolePermission`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/rbac/entity/SysRolePermission.java:5`
- **`LoginResponse`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/auth/dto/LoginResponse.java:6`
- **`of`** (Method) — `backend/src/main/java/com/cwgsyw/platform/common/PageResult.java:13`
- **`search`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelController.java:46`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `InstanceSearchVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/InstanceSearchVO.java` | 4 |
| `SysRolePermission` | Class | `backend/src/main/java/com/cwgsyw/platform/module/rbac/entity/SysRolePermission.java` | 5 |
| `LoginResponse` | Class | `backend/src/main/java/com/cwgsyw/platform/module/auth/dto/LoginResponse.java` | 6 |
| `of` | Method | `backend/src/main/java/com/cwgsyw/platform/common/PageResult.java` | 13 |
| `search` | Method | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelController.java` | 46 |
| `searchInstances` | Method | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelService.java` | 172 |
| `getPermissionsByRoleId` | Method | `backend/src/main/java/com/cwgsyw/platform/module/rbac/RbacService.java` | 43 |
| `listRoles` | Method | `backend/src/main/java/com/cwgsyw/platform/module/rbac/RoleController.java` | 20 |
| `getRolePermissions` | Method | `backend/src/main/java/com/cwgsyw/platform/module/rbac/RoleController.java` | 40 |
| `findPermissionIdsByRoleIds` | Method | `backend/src/main/java/com/cwgsyw/platform/module/rbac/SysRolePermissionMapper.java` | 9 |
| `list` | Method | `backend/src/main/java/com/cwgsyw/platform/module/user/UserController.java` | 18 |
| `list` | Method | `backend/src/main/java/com/cwgsyw/platform/module/user/UserService.java` | 21 |
| `ok` | Method | `backend/src/main/java/com/cwgsyw/platform/common/R.java` | 18 |
| `update` | Method | `backend/src/main/java/com/cwgsyw/platform/module/org/GroupController.java` | 34 |
| `assignPermissionsToRole` | Method | `backend/src/main/java/com/cwgsyw/platform/module/rbac/RbacService.java` | 48 |
| `assignPermissions` | Method | `backend/src/main/java/com/cwgsyw/platform/module/rbac/RoleController.java` | 46 |
| `delete` | Method | `backend/src/main/java/com/cwgsyw/platform/module/user/UserController.java` | 41 |
| `delete` | Method | `backend/src/main/java/com/cwgsyw/platform/module/user/UserService.java` | 62 |
| `approve` | Method | `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowController.java` | 30 |
| `approve` | Method | `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowService.java` | 35 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Export → Of` | cross_community | 4 |
| `Login → FindRoleIdsByUserId` | intra_community | 4 |
| `Login → FindPermissionIdsByRoleIds` | cross_community | 4 |
| `DoFilterInternal → FindRoleIdsByUserId` | cross_community | 4 |
| `DoFilterInternal → FindPermissionIdsByRoleIds` | cross_community | 4 |
| `Export → Ok` | cross_community | 3 |
| `Login → FindByUsername` | intra_community | 3 |
| `Login → GenerateToken` | cross_community | 3 |
| `List → Of` | cross_community | 3 |
| `Get → Of` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Changedoc | 6 calls |
| Security | 1 calls |

## How to Explore

1. `gitnexus_context({name: "InstanceSearchVO"})` — see callers and callees
2. `gitnexus_query({query: "rbac"})` — find related execution flows
3. Read key files listed above for implementation details
