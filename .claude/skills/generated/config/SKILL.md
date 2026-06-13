---
name: config
description: "Skill for the Config area of cwgsyw-platform. 23 symbols across 12 files."
---

# Config

23 symbols | 12 files | Cohesion: 85%

## When to Use

- Working with code in `backend/`
- Understanding how send, buildSender, findValue work
- Modifying config-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `backend/src/main/java/com/cwgsyw/platform/scheduler/DailyReportReminderScheduler.java` | checkAndSendReminders, matchesCurrentMinute, matchDow, parseDow |
| `backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigService.java` | get, getBoolean, set |
| `backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigController.java` | updateSmtp, updateNotification, updateWatermark |
| `backend/src/main/java/com/cwgsyw/platform/config/EmailService.java` | send, buildSender |
| `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportService.java` | updateStatusByProcessInstAndReturn, updateStatusByProcessInst |
| `backend/src/main/java/com/cwgsyw/platform/config/CryptoService.java` | encrypt, decrypt |
| `backend/src/test/java/com/cwgsyw/platform/config/CryptoServiceTest.java` | encryptAndDecrypt, sameInputProducesDifferentCiphertext |
| `backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigMapper.java` | findValue |
| `backend/src/main/java/com/cwgsyw/platform/module/notification/NotificationService.java` | notify |
| `backend/src/main/java/com/cwgsyw/platform/module/workflow/DailyReportApprovalListener.java` | notify |

## Entry Points

Start here when exploring this area:

- **`send`** (Method) — `backend/src/main/java/com/cwgsyw/platform/config/EmailService.java:17`
- **`buildSender`** (Method) — `backend/src/main/java/com/cwgsyw/platform/config/EmailService.java:43`
- **`findValue`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigMapper.java:14`
- **`get`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigService.java:20`
- **`getBoolean`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigService.java:25`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `send` | Method | `backend/src/main/java/com/cwgsyw/platform/config/EmailService.java` | 17 |
| `buildSender` | Method | `backend/src/main/java/com/cwgsyw/platform/config/EmailService.java` | 43 |
| `findValue` | Method | `backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigMapper.java` | 14 |
| `get` | Method | `backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigService.java` | 20 |
| `getBoolean` | Method | `backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigService.java` | 25 |
| `updateStatusByProcessInstAndReturn` | Method | `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportService.java` | 118 |
| `updateStatusByProcessInst` | Method | `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportService.java` | 140 |
| `notify` | Method | `backend/src/main/java/com/cwgsyw/platform/module/notification/NotificationService.java` | 24 |
| `notify` | Method | `backend/src/main/java/com/cwgsyw/platform/module/workflow/DailyReportApprovalListener.java` | 18 |
| `checkAndSendReminders` | Method | `backend/src/main/java/com/cwgsyw/platform/scheduler/DailyReportReminderScheduler.java` | 29 |
| `matchesCurrentMinute` | Method | `backend/src/main/java/com/cwgsyw/platform/scheduler/DailyReportReminderScheduler.java` | 69 |
| `matchDow` | Method | `backend/src/main/java/com/cwgsyw/platform/scheduler/DailyReportReminderScheduler.java` | 89 |
| `parseDow` | Method | `backend/src/main/java/com/cwgsyw/platform/scheduler/DailyReportReminderScheduler.java` | 104 |
| `encrypt` | Method | `backend/src/main/java/com/cwgsyw/platform/config/CryptoService.java` | 23 |
| `decrypt` | Method | `backend/src/main/java/com/cwgsyw/platform/config/CryptoService.java` | 39 |
| `revealPassword` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceController.java` | 80 |
| `revealPassword` | Method | `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceService.java` | 152 |
| `updateSmtp` | Method | `backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigController.java` | 29 |
| `updateNotification` | Method | `backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigController.java` | 47 |
| `updateWatermark` | Method | `backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigController.java` | 61 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Submit → FindValue` | cross_community | 8 |
| `CheckAndSendReminders → FindValue` | intra_community | 7 |
| `Notify → FindValue` | intra_community | 7 |
| `AiGenerate → Decrypt` | cross_community | 5 |
| `Export → FindValue` | cross_community | 4 |
| `TestProvider → Decrypt` | cross_community | 4 |
| `CheckAndSendReminders → ParseDow` | intra_community | 4 |
| `AddCredential → Encrypt` | cross_community | 3 |
| `RevealPassword → Decrypt` | intra_community | 3 |
| `SaveProvider → Encrypt` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Changedoc | 4 calls |

## How to Explore

1. `gitnexus_context({name: "send"})` — see callers and callees
2. `gitnexus_query({query: "config"})` — find related execution flows
3. Read key files listed above for implementation details
