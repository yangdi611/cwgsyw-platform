---
name: daily
description: "Skill for the Daily area of cwgsyw-platform. 18 symbols across 6 files."
---

# Daily

18 symbols | 6 files | Cohesion: 68%

## When to Use

- Working with code in `backend/`
- Understanding how DailyReportVO, DailyReport, myReports work
- Modifying daily-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportService.java` | listMyReports, listGroupReports, toVO, create, getById (+3) |
| `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportController.java` | myReports, groupReports, getById, create, update (+1) |
| `backend/src/main/java/com/cwgsyw/platform/module/daily/dto/DailyReportVO.java` | DailyReportVO |
| `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportMapper.java` | findByReporterAndDate |
| `backend/src/main/java/com/cwgsyw/platform/module/daily/entity/DailyReport.java` | DailyReport |
| `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowService.java` | startDailyReportApproval |

## Entry Points

Start here when exploring this area:

- **`DailyReportVO`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/daily/dto/DailyReportVO.java:7`
- **`DailyReport`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/daily/entity/DailyReport.java:9`
- **`myReports`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportController.java:17`
- **`groupReports`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportController.java:27`
- **`listMyReports`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportService.java:28`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `DailyReportVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/daily/dto/DailyReportVO.java` | 7 |
| `DailyReport` | Class | `backend/src/main/java/com/cwgsyw/platform/module/daily/entity/DailyReport.java` | 9 |
| `myReports` | Method | `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportController.java` | 17 |
| `groupReports` | Method | `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportController.java` | 27 |
| `listMyReports` | Method | `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportService.java` | 28 |
| `listGroupReports` | Method | `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportService.java` | 43 |
| `toVO` | Method | `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportService.java` | 163 |
| `getById` | Method | `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportController.java` | 40 |
| `create` | Method | `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportController.java` | 47 |
| `findByReporterAndDate` | Method | `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportMapper.java` | 11 |
| `create` | Method | `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportService.java` | 57 |
| `getById` | Method | `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportService.java` | 145 |
| `update` | Method | `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportController.java` | 59 |
| `submit` | Method | `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportController.java` | 68 |
| `update` | Method | `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportService.java` | 76 |
| `submit` | Method | `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportService.java` | 89 |
| `getAndCheckOwner` | Method | `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportService.java` | 156 |
| `startDailyReportApproval` | Method | `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowService.java` | 20 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Submit → FindValue` | cross_community | 8 |
| `Create → DailyReportVO` | cross_community | 4 |
| `Create → GetUsername` | cross_community | 4 |
| `MyReports → DailyReportVO` | intra_community | 4 |
| `MyReports → GetUsername` | cross_community | 4 |
| `GroupReports → DailyReportVO` | intra_community | 4 |
| `GroupReports → GetUsername` | cross_community | 4 |
| `GetById → DailyReportVO` | cross_community | 4 |
| `GetById → GetUsername` | cross_community | 4 |
| `Create → FindByReporterAndDate` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Changedoc | 6 calls |
| Rbac | 4 calls |
| Config | 1 calls |

## How to Explore

1. `gitnexus_context({name: "DailyReportVO"})` — see callers and callees
2. `gitnexus_query({query: "daily"})` — find related execution flows
3. Read key files listed above for implementation details
