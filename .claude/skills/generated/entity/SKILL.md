---
name: entity
description: "Skill for the Entity area of cwgsyw-platform. 6 symbols across 6 files."
---

# Entity

6 symbols | 6 files | Cohesion: 63%

## When to Use

- Working with code in `backend/`
- Understanding how BaseEntity, DeviceCredential, Group work
- Modifying entity-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `backend/src/main/java/com/cwgsyw/platform/common/BaseEntity.java` | BaseEntity |
| `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceController.java` | addCredential |
| `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceService.java` | addCredential |
| `backend/src/main/java/com/cwgsyw/platform/module/device/entity/DeviceCredential.java` | DeviceCredential |
| `backend/src/main/java/com/cwgsyw/platform/module/org/entity/Group.java` | Group |
| `backend/src/main/java/com/cwgsyw/platform/module/rbac/entity/SysRole.java` | SysRole |

## Entry Points

Start here when exploring this area:

- **`BaseEntity`** (Class) — `backend/src/main/java/com/cwgsyw/platform/common/BaseEntity.java:6`
- **`DeviceCredential`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/device/entity/DeviceCredential.java:7`
- **`Group`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/org/entity/Group.java:7`
- **`SysRole`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/rbac/entity/SysRole.java:7`
- **`addCredential`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceController.java:63`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `BaseEntity` | Class | `backend/src/main/java/com/cwgsyw/platform/common/BaseEntity.java` | 6 |
| `DeviceCredential` | Class | `backend/src/main/java/com/cwgsyw/platform/module/device/entity/DeviceCredential.java` | 7 |
| `Group` | Class | `backend/src/main/java/com/cwgsyw/platform/module/org/entity/Group.java` | 7 |
| `SysRole` | Class | `backend/src/main/java/com/cwgsyw/platform/module/rbac/entity/SysRole.java` | 7 |
| `addCredential` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceController.java` | 63 |
| `addCredential` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceService.java` | 114 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `AddCredential → DeviceCredential` | intra_community | 3 |
| `AddCredential → Encrypt` | cross_community | 3 |
| `AddCredential → WriteAudit` | cross_community | 3 |
| `AddCredential → Ok` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Rbac | 1 calls |
| Config | 1 calls |
| Device | 1 calls |

## How to Explore

1. `gitnexus_context({name: "BaseEntity"})` — see callers and callees
2. `gitnexus_query({query: "entity"})` — find related execution flows
3. Read key files listed above for implementation details
