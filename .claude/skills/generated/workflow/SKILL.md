---
name: workflow
description: "Skill for the Workflow area of cwgsyw-platform. 7 symbols across 3 files."
---

# Workflow

7 symbols | 3 files | Cohesion: 86%

## When to Use

- Working with code in `backend/`
- Understanding how TaskVO, myTasks, groupTasks work
- Modifying workflow-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowService.java` | getPendingTasksByGroup, getPendingTasksByUser, toVOList, toVO |
| `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowController.java` | myTasks, groupTasks |
| `backend/src/main/java/com/cwgsyw/platform/module/workflow/dto/TaskVO.java` | TaskVO |

## Entry Points

Start here when exploring this area:

- **`TaskVO`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/workflow/dto/TaskVO.java:5`
- **`myTasks`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowController.java:18`
- **`groupTasks`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowController.java:24`
- **`getPendingTasksByGroup`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowService.java:58`
- **`getPendingTasksByUser`** (Method) — `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowService.java:67`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `TaskVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/workflow/dto/TaskVO.java` | 5 |
| `myTasks` | Method | `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowController.java` | 18 |
| `groupTasks` | Method | `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowController.java` | 24 |
| `getPendingTasksByGroup` | Method | `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowService.java` | 58 |
| `getPendingTasksByUser` | Method | `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowService.java` | 67 |
| `toVOList` | Method | `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowService.java` | 75 |
| `toVO` | Method | `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowService.java` | 94 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `MyTasks → TaskVO` | intra_community | 5 |
| `GroupTasks → TaskVO` | intra_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Changedoc | 2 calls |

## How to Explore

1. `gitnexus_context({name: "TaskVO"})` — see callers and callees
2. `gitnexus_query({query: "workflow"})` — find related execution flows
3. Read key files listed above for implementation details
