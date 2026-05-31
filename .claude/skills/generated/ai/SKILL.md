---
name: ai
description: "Skill for the Ai area of cwgsyw-platform. 15 symbols across 5 files."
---

# Ai

15 symbols | 5 files | Cohesion: 76%

## When to Use

- Working with code in `backend/`
- Understanding how ChatRequest, ChatMessage, AiCallLog work
- Modifying ai-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `backend/src/main/java/com/cwgsyw/platform/module/ai/AiGatewayService.java` | generate, callWithLogging, callProvider, ChatRequest, ChatMessage (+3) |
| `backend/src/main/java/com/cwgsyw/platform/module/ai/AiConfigController.java` | saveProvider, testProvider, listProviders |
| `backend/src/main/java/com/cwgsyw/platform/module/ai/AiProviderConfigMapper.java` | findByTenantAndProvider, findByTenant |
| `backend/src/main/java/com/cwgsyw/platform/module/ai/entity/AiCallLog.java` | AiCallLog |
| `backend/src/main/java/com/cwgsyw/platform/module/ai/dto/AiProviderConfigVO.java` | AiProviderConfigVO |

## Entry Points

Start here when exploring this area:

- **`ChatRequest`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/ai/AiGatewayService.java:164`
- **`ChatMessage`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/ai/AiGatewayService.java:171`
- **`AiCallLog`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/ai/entity/AiCallLog.java:8`
- **`AiProviderConfigVO`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/ai/dto/AiProviderConfigVO.java:4`
- **`generate`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/ai/AiGatewayService.java:40`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ChatRequest` | Class | `backend/src/main/java/com/cwgsyw/platform/module/ai/AiGatewayService.java` | 164 |
| `ChatMessage` | Class | `backend/src/main/java/com/cwgsyw/platform/module/ai/AiGatewayService.java` | 171 |
| `AiCallLog` | Class | `backend/src/main/java/com/cwgsyw/platform/module/ai/entity/AiCallLog.java` | 8 |
| `AiProviderConfigVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/ai/dto/AiProviderConfigVO.java` | 4 |
| `generate` | Method | `backend/src/main/java/com/cwgsyw/platform/module/ai/AiGatewayService.java` | 40 |
| `callWithLogging` | Method | `backend/src/main/java/com/cwgsyw/platform/module/ai/AiGatewayService.java` | 100 |
| `callProvider` | Method | `backend/src/main/java/com/cwgsyw/platform/module/ai/AiGatewayService.java` | 143 |
| `saveProvider` | Method | `backend/src/main/java/com/cwgsyw/platform/module/ai/AiConfigController.java` | 25 |
| `testProvider` | Method | `backend/src/main/java/com/cwgsyw/platform/module/ai/AiConfigController.java` | 34 |
| `testProvider` | Method | `backend/src/main/java/com/cwgsyw/platform/module/ai/AiGatewayService.java` | 54 |
| `saveProviderConfig` | Method | `backend/src/main/java/com/cwgsyw/platform/module/ai/AiGatewayService.java` | 63 |
| `findByTenantAndProvider` | Method | `backend/src/main/java/com/cwgsyw/platform/module/ai/AiProviderConfigMapper.java` | 14 |
| `listProviders` | Method | `backend/src/main/java/com/cwgsyw/platform/module/ai/AiConfigController.java` | 19 |
| `listProviders` | Method | `backend/src/main/java/com/cwgsyw/platform/module/ai/AiGatewayService.java` | 83 |
| `findByTenant` | Method | `backend/src/main/java/com/cwgsyw/platform/module/ai/AiProviderConfigMapper.java` | 11 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `AiGenerate → ChatMessage` | cross_community | 6 |
| `AiGenerate → ChatRequest` | cross_community | 6 |
| `TestProvider → ChatMessage` | cross_community | 5 |
| `TestProvider → ChatRequest` | cross_community | 5 |
| `AiGenerate → Decrypt` | cross_community | 5 |
| `AiGenerate → AiCallLog` | cross_community | 5 |
| `TestProvider → Decrypt` | cross_community | 4 |
| `TestProvider → AiCallLog` | cross_community | 4 |
| `ListProviders → FindByTenant` | intra_community | 3 |
| `ListProviders → AiProviderConfigVO` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Changedoc | 3 calls |
| Config | 2 calls |

## How to Explore

1. `gitnexus_context({name: "ChatRequest"})` — see callers and callees
2. `gitnexus_query({query: "ai"})` — find related execution flows
3. Read key files listed above for implementation details
