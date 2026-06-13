---
name: security
description: "Skill for the Security area of cwgsyw-platform. 14 symbols across 5 files."
---

# Security

14 symbols | 5 files | Cohesion: 78%

## When to Use

- Working with code in `backend/`
- Understanding how doFilterInternal, extractToken, generateToken work
- Modifying security-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `backend/src/main/java/com/cwgsyw/platform/security/JwtUtil.java` | generateToken, validateToken, claims, getUserId, getUsername (+1) |
| `backend/src/test/java/com/cwgsyw/platform/security/JwtUtilTest.java` | expiredTokenIsInvalid, invalidTokenReturnsFalse, generateAndValidateToken |
| `backend/src/main/java/com/cwgsyw/platform/security/JwtAuthFilter.java` | doFilterInternal, extractToken |
| `backend/src/main/java/com/cwgsyw/platform/security/CustomPermissionEvaluator.java` | hasPermission, hasPermission |
| `backend/src/main/java/com/cwgsyw/platform/security/SecurityUser.java` | getAuthorities |

## Entry Points

Start here when exploring this area:

- **`doFilterInternal`** (Method) — `backend/src/main/java/com/cwgsyw/platform/security/JwtAuthFilter.java:18`
- **`extractToken`** (Method) — `backend/src/main/java/com/cwgsyw/platform/security/JwtAuthFilter.java:32`
- **`generateToken`** (Method) — `backend/src/main/java/com/cwgsyw/platform/security/JwtUtil.java:23`
- **`validateToken`** (Method) — `backend/src/main/java/com/cwgsyw/platform/security/JwtUtil.java:34`
- **`getAuthorities`** (Method) — `backend/src/main/java/com/cwgsyw/platform/security/SecurityUser.java:35`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `doFilterInternal` | Method | `backend/src/main/java/com/cwgsyw/platform/security/JwtAuthFilter.java` | 18 |
| `extractToken` | Method | `backend/src/main/java/com/cwgsyw/platform/security/JwtAuthFilter.java` | 32 |
| `generateToken` | Method | `backend/src/main/java/com/cwgsyw/platform/security/JwtUtil.java` | 23 |
| `validateToken` | Method | `backend/src/main/java/com/cwgsyw/platform/security/JwtUtil.java` | 34 |
| `getAuthorities` | Method | `backend/src/main/java/com/cwgsyw/platform/security/SecurityUser.java` | 35 |
| `claims` | Method | `backend/src/main/java/com/cwgsyw/platform/security/JwtUtil.java` | 44 |
| `getUserId` | Method | `backend/src/main/java/com/cwgsyw/platform/security/JwtUtil.java` | 49 |
| `getUsername` | Method | `backend/src/main/java/com/cwgsyw/platform/security/JwtUtil.java` | 50 |
| `getTenantId` | Method | `backend/src/main/java/com/cwgsyw/platform/security/JwtUtil.java` | 51 |
| `hasPermission` | Method | `backend/src/main/java/com/cwgsyw/platform/security/CustomPermissionEvaluator.java` | 10 |
| `hasPermission` | Method | `backend/src/main/java/com/cwgsyw/platform/security/CustomPermissionEvaluator.java` | 17 |
| `expiredTokenIsInvalid` | Method | `backend/src/test/java/com/cwgsyw/platform/security/JwtUtilTest.java` | 27 |
| `invalidTokenReturnsFalse` | Method | `backend/src/test/java/com/cwgsyw/platform/security/JwtUtilTest.java` | 35 |
| `generateAndValidateToken` | Method | `backend/src/test/java/com/cwgsyw/platform/security/JwtUtilTest.java` | 17 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `DoFilterInternal → FindRoleIdsByUserId` | cross_community | 4 |
| `DoFilterInternal → FindPermissionIdsByRoleIds` | cross_community | 4 |
| `Login → GenerateToken` | cross_community | 3 |
| `DoFilterInternal → Claims` | cross_community | 3 |
| `DoFilterInternal → FindByUsername` | cross_community | 3 |
| `DoFilterInternal → SecurityUser` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Rbac | 1 calls |

## How to Explore

1. `gitnexus_context({name: "doFilterInternal"})` — see callers and callees
2. `gitnexus_query({query: "security"})` — find related execution flows
3. Read key files listed above for implementation details
