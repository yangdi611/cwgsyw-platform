---
name: dto
description: "Skill for the Dto area of cwgsyw-platform. 5 symbols across 5 files."
---

# Dto

5 symbols | 5 files | Cohesion: 80%

## When to Use

- Working with code in `backend/`
- Understanding how CiTopologyResult, TopologyEdgeVO, TopologyNodeVO work
- Modifying dto-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiTopologyController.java` | getTopology |
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiTopologyService.java` | getTopology |
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiTopologyResult.java` | CiTopologyResult |
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/TopologyEdgeVO.java` | TopologyEdgeVO |
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/TopologyNodeVO.java` | TopologyNodeVO |

## Entry Points

Start here when exploring this area:

- **`CiTopologyResult`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiTopologyResult.java:5`
- **`TopologyEdgeVO`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/TopologyEdgeVO.java:4`
- **`TopologyNodeVO`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/TopologyNodeVO.java:4`
- **`getTopology`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiTopologyController.java:17`
- **`getTopology`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiTopologyService.java:21`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `CiTopologyResult` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiTopologyResult.java` | 5 |
| `TopologyEdgeVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/TopologyEdgeVO.java` | 4 |
| `TopologyNodeVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/TopologyNodeVO.java` | 4 |
| `getTopology` | Method | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiTopologyController.java` | 17 |
| `getTopology` | Method | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiTopologyService.java` | 21 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `GetTopology → FindByInstance` | cross_community | 3 |
| `GetTopology → TopologyNodeVO` | intra_community | 3 |
| `GetTopology → TopologyEdgeVO` | intra_community | 3 |
| `GetTopology → CiTopologyResult` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Changedoc | 1 calls |
| Cmdb | 1 calls |

## How to Explore

1. `gitnexus_context({name: "CiTopologyResult"})` — see callers and callees
2. `gitnexus_query({query: "dto"})` — find related execution flows
3. Read key files listed above for implementation details
