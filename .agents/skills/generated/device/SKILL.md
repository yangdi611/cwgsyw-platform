---
name: device
description: "Skill for the Device area of cwgsyw-platform. 19 symbols across 6 files."
---

# Device

19 symbols | 6 files | Cohesion: 70%

## When to Use

- Working with code in `backend/`
- Understanding how CredentialVO, DeviceVO, Device work
- Modifying device-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceService.java` | list, toVO, toVO, update, delete (+4) |
| `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceController.java` | list, update, delete, deleteCredential, getById (+1) |
| `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceCredentialMapper.java` | findByDeviceId |
| `backend/src/main/java/com/cwgsyw/platform/module/device/dto/CredentialVO.java` | CredentialVO |
| `backend/src/main/java/com/cwgsyw/platform/module/device/dto/DeviceVO.java` | DeviceVO |
| `backend/src/main/java/com/cwgsyw/platform/module/device/entity/Device.java` | Device |

## Entry Points

Start here when exploring this area:

- **`CredentialVO`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/device/dto/CredentialVO.java:5`
- **`DeviceVO`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/device/dto/DeviceVO.java:6`
- **`Device`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/device/entity/Device.java:7`
- **`list`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceController.java:18`
- **`findByDeviceId`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceCredentialMapper.java:10`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `CredentialVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/device/dto/CredentialVO.java` | 5 |
| `DeviceVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/device/dto/DeviceVO.java` | 6 |
| `Device` | Class | `backend/src/main/java/com/cwgsyw/platform/module/device/entity/Device.java` | 7 |
| `list` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceController.java` | 18 |
| `findByDeviceId` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceCredentialMapper.java` | 10 |
| `list` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceService.java` | 30 |
| `toVO` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceService.java` | 176 |
| `toVO` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceService.java` | 181 |
| `update` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceController.java` | 46 |
| `delete` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceController.java` | 55 |
| `deleteCredential` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceController.java` | 72 |
| `update` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceService.java` | 85 |
| `delete` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceService.java` | 101 |
| `deleteCredential` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceService.java` | 134 |
| `writeAudit` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceService.java` | 230 |
| `getById` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceController.java` | 31 |
| `create` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceController.java` | 38 |
| `getById` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceService.java` | 60 |
| `create` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceService.java` | 70 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `List → DeviceVO` | intra_community | 5 |
| `List → FindByDeviceId` | intra_community | 5 |
| `List → CredentialVO` | intra_community | 5 |
| `List → GetUsername` | cross_community | 5 |
| `Create → DeviceVO` | cross_community | 4 |
| `Create → FindByDeviceId` | cross_community | 4 |
| `Create → CredentialVO` | cross_community | 4 |
| `Create → GetUsername` | cross_community | 4 |
| `GetById → DeviceVO` | cross_community | 4 |
| `GetById → FindByDeviceId` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Changedoc | 4 calls |
| Rbac | 4 calls |

## How to Explore

1. `gitnexus_context({name: "CredentialVO"})` — see callers and callees
2. `gitnexus_query({query: "device"})` — find related execution flows
3. Read key files listed above for implementation details
