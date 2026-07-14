---
name: changedoc
description: "Skill for the Changedoc area of cwgsyw-platform. 127 symbols across 39 files."
---

# Changedoc

127 symbols | 39 files | Cohesion: 74%

## When to Use

- Working with code in `backend/`
- Understanding how exists, FieldConfigVO, TemplateVO work
- Modifying changedoc-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ExportService.java` | exportDocx, exportDocxProgrammatic, buildDocument, setPageMargins, addTitle (+12) |
| `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java` | listSnapshots, get, generateChangeNo, toVO, toVO (+10) |
| `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocTemplateService.java` | createTemplate, listTemplates, getTemplate, getFields, uploadDocx (+10) |
| `backend/src/main/java/com/cwgsyw/platform/module/changedoc/EmailTemplateService.java` | buildEmailBody, buildSubmittedEmail, buildApprovedEmail, buildRejectedEmail, buildExportedEmail (+7) |
| `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocController.java` | get, snapshots, emailTemplate, create, update (+6) |
| `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocTemplateController.java` | list, get, create, uploadDocx, parseBookmarks (+3) |
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiMetadataController.java` | updateAttribute, deleteAttribute, listKinds, listDefs, deleteDef |
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiMetadataService.java` | updateAttribute, deleteAttribute, listKinds, listDefs, deleteDef |
| `backend/src/main/java/com/cwgsyw/platform/module/changedoc/MinioStorageService.java` | upload, download, ensureBucket |
| `backend/src/main/java/com/cwgsyw/platform/module/notification/NotificationController.java` | unreadCount, markRead, markAllRead |

## Entry Points

Start here when exploring this area:

- **`exists`** (Function) — `frontend/src/app/(dashboard)/change-docs/new/page.tsx:91`
- **`FieldConfigVO`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/FieldConfigVO.java:4`
- **`TemplateVO`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/TemplateVO.java:5`
- **`ChangeDocField`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocField.java:5`
- **`ChangeDocTemplate`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocTemplate.java:6`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `FieldConfigVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/FieldConfigVO.java` | 4 |
| `TemplateVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/TemplateVO.java` | 5 |
| `ChangeDocField` | Class | `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocField.java` | 5 |
| `ChangeDocTemplate` | Class | `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocTemplate.java` | 6 |
| `ChangeDocVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/ChangeDocVO.java` | 7 |
| `ChangeDoc` | Class | `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDoc.java` | 7 |
| `ChangeDocSnapshot` | Class | `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocSnapshot.java` | 6 |
| `AuditLogVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/audit/dto/AuditLogVO.java` | 5 |
| `exists` | Function | `frontend/src/app/(dashboard)/change-docs/new/page.tsx` | 91 |
| `ok` | Method | `backend/src/main/java/com/cwgsyw/platform/common/R.java` | 10 |
| `get` | Method | `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocController.java` | 34 |
| `snapshots` | Method | `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocController.java` | 78 |
| `emailTemplate` | Method | `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocController.java` | 114 |
| `findByTemplate` | Method | `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocFieldMapper.java` | 11 |
| `listSnapshots` | Method | `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java` | 331 |
| `get` | Method | `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java` | 342 |
| `list` | Method | `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocTemplateController.java` | 21 |
| `get` | Method | `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocTemplateController.java` | 27 |
| `create` | Method | `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocTemplateController.java` | 33 |
| `uploadDocx` | Method | `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocTemplateController.java` | 42 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `AiGenerate → ChatMessage` | cross_community | 6 |
| `AiGenerate → ChatRequest` | cross_community | 6 |
| `EmailTemplate → ChangeDocVO` | cross_community | 5 |
| `EmailTemplate → Esc` | cross_community | 5 |
| `EmailTemplate → FieldOf` | cross_community | 5 |
| `Get → ChangeDocVO` | cross_community | 5 |
| `Submit → ChangeDocVO` | intra_community | 5 |
| `Approve → ChangeDocVO` | intra_community | 5 |
| `AiGenerate → Decrypt` | cross_community | 5 |
| `AiGenerate → AiCallLog` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Rbac | 3 calls |
| Cmdb | 2 calls |
| Ai | 1 calls |
| Config | 1 calls |

## How to Explore

1. `gitnexus_context({name: "exists"})` — see callers and callees
2. `gitnexus_query({query: "changedoc"})` — find related execution flows
3. Read key files listed above for implementation details
