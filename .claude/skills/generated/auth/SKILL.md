---
name: auth
description: "Skill for the Auth area of cwgsyw-platform. 7 symbols across 3 files."
---

# Auth

7 symbols | 3 files | Cohesion: 100%

## When to Use

- Working with code in `backend/`
- Understanding how handleValidation, handleAccessDenied, handleIllegalArg work
- Modifying auth-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `backend/src/main/java/com/cwgsyw/platform/common/GlobalExceptionHandler.java` | handleValidation, handleAccessDenied, handleIllegalArg, handleGeneral |
| `backend/src/main/java/com/cwgsyw/platform/common/R.java` | fail, fail |
| `backend/src/main/java/com/cwgsyw/platform/module/auth/AuthController.java` | handleBadCredentials |

## Entry Points

Start here when exploring this area:

- **`handleValidation`** (Method) — `backend/src/main/java/com/cwgsyw/platform/common/GlobalExceptionHandler.java:14`
- **`handleAccessDenied`** (Method) — `backend/src/main/java/com/cwgsyw/platform/common/GlobalExceptionHandler.java:23`
- **`handleIllegalArg`** (Method) — `backend/src/main/java/com/cwgsyw/platform/common/GlobalExceptionHandler.java:29`
- **`handleGeneral`** (Method) — `backend/src/main/java/com/cwgsyw/platform/common/GlobalExceptionHandler.java:35`
- **`fail`** (Method) — `backend/src/main/java/com/cwgsyw/platform/common/R.java:22`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `handleValidation` | Method | `backend/src/main/java/com/cwgsyw/platform/common/GlobalExceptionHandler.java` | 14 |
| `handleAccessDenied` | Method | `backend/src/main/java/com/cwgsyw/platform/common/GlobalExceptionHandler.java` | 23 |
| `handleIllegalArg` | Method | `backend/src/main/java/com/cwgsyw/platform/common/GlobalExceptionHandler.java` | 29 |
| `handleGeneral` | Method | `backend/src/main/java/com/cwgsyw/platform/common/GlobalExceptionHandler.java` | 35 |
| `fail` | Method | `backend/src/main/java/com/cwgsyw/platform/common/R.java` | 22 |
| `fail` | Method | `backend/src/main/java/com/cwgsyw/platform/common/R.java` | 29 |
| `handleBadCredentials` | Method | `backend/src/main/java/com/cwgsyw/platform/module/auth/AuthController.java` | 21 |

## How to Explore

1. `gitnexus_context({name: "handleValidation"})` — see callers and callees
2. `gitnexus_query({query: "auth"})` — find related execution flows
3. Read key files listed above for implementation details
