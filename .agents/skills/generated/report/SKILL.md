---
name: report
description: "Skill for the Report area of cwgsyw-platform. 10 symbols across 2 files."
---

# Report

10 symbols | 2 files | Cohesion: 67%

## When to Use

- Working with code in `backend/`
- Understanding how export, exportExcel, titleStyle work
- Modifying report-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `backend/src/main/java/com/cwgsyw/platform/module/report/ReportExportService.java` | exportExcel, titleStyle, cell, nvl, batchGroupNames (+4) |
| `backend/src/main/java/com/cwgsyw/platform/module/report/ReportController.java` | export |

## Entry Points

Start here when exploring this area:

- **`export`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/report/ReportController.java:19`
- **`exportExcel`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/report/ReportExportService.java:28`
- **`titleStyle`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/report/ReportExportService.java:103`
- **`cell`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/report/ReportExportService.java:149`
- **`nvl`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/report/ReportExportService.java:155`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `export` | Method | `backend/src/main/java/com/cwgsyw/platform/module/report/ReportController.java` | 19 |
| `exportExcel` | Method | `backend/src/main/java/com/cwgsyw/platform/module/report/ReportExportService.java` | 28 |
| `titleStyle` | Method | `backend/src/main/java/com/cwgsyw/platform/module/report/ReportExportService.java` | 103 |
| `cell` | Method | `backend/src/main/java/com/cwgsyw/platform/module/report/ReportExportService.java` | 149 |
| `nvl` | Method | `backend/src/main/java/com/cwgsyw/platform/module/report/ReportExportService.java` | 155 |
| `batchGroupNames` | Method | `backend/src/main/java/com/cwgsyw/platform/module/report/ReportExportService.java` | 165 |
| `headerStyle` | Method | `backend/src/main/java/com/cwgsyw/platform/module/report/ReportExportService.java` | 114 |
| `bodyStyle` | Method | `backend/src/main/java/com/cwgsyw/platform/module/report/ReportExportService.java` | 126 |
| `wrapStyle` | Method | `backend/src/main/java/com/cwgsyw/platform/module/report/ReportExportService.java` | 134 |
| `setBorder` | Method | `backend/src/main/java/com/cwgsyw/platform/module/report/ReportExportService.java` | 142 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Export → GetUsername` | cross_community | 4 |
| `Export → SetBorder` | cross_community | 4 |
| `Export → BatchGroupNames` | intra_community | 3 |
| `Export → TitleStyle` | intra_community | 3 |
| `Export → Ok` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Rbac | 1 calls |
| Changedoc | 1 calls |

## How to Explore

1. `gitnexus_context({name: "export"})` — see callers and callees
2. `gitnexus_query({query: "report"})` — find related execution flows
3. Read key files listed above for implementation details
