---
name: cmdb
description: "Skill for the Cmdb area of cwgsyw-platform. 81 symbols across 30 files."
---

# Cmdb

81 symbols | 30 files | Cohesion: 79%

## When to Use

- Working with code in `backend/`
- Understanding how TopologyPage, CiTopologyGraph, CreateRelRequest work
- Modifying cmdb-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiMetadataService.java` | createKind, createDef, listModels, createModel, toModelVO (+8) |
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceService.java` | getInstance, createInstance, updateInstance, deleteInstance, validateAttrs (+6) |
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiMetadataController.java` | createKind, createDef, listModels, createModel, createAttribute (+3) |
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelService.java` | createRelation, deleteRelation, validateMapping, ciLabel, writeAudit (+1) |
| `frontend/src/components/cmdb/CiTopologyGraph.tsx` | layoutNodes, toRFNodes, toRFEdges, CiTopologyGraph, modelColor (+1) |
| `backend/src/test/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelServiceTest.java` | inst, model, createRelation_1_1_dst_occupied_throws_with_ci_name, createRelation_1_1_src_occupied_throws_with_ci_name, createRelation_nn_no_constraint_passes |
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceController.java` | get, create, update, delete, search |
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelController.java` | create, delete, getRelations |
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelMapper.java` | countBySrcAndDef, countByDstAndDef, findByInstance |
| `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CreateRelRequest.java` | CreateRelRequest |

## Entry Points

Start here when exploring this area:

- **`TopologyPage`** (Function) — `frontend/src/app/(dashboard)/cmdb/topology/[instanceId]/page.tsx:17`
- **`CiTopologyGraph`** (Function) — `frontend/src/components/cmdb/CiTopologyGraph.tsx:146`
- **`CreateRelRequest`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CreateRelRequest.java:7`
- **`CiAssociationDef`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAssociationDef.java:6`
- **`CiAssociationKind`** (Class) — `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAssociationKind.java:6`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `CreateRelRequest` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CreateRelRequest.java` | 7 |
| `CiAssociationDef` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAssociationDef.java` | 6 |
| `CiAssociationKind` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAssociationKind.java` | 6 |
| `CiInstance` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiInstance.java` | 7 |
| `CiInstanceRel` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiInstanceRel.java` | 7 |
| `CiModel` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiModel.java` | 6 |
| `CiInstanceVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiInstanceVO.java` | 7 |
| `CiModelVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiModelVO.java` | 6 |
| `CiAttributeGroup` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAttributeGroup.java` | 6 |
| `CiAttributeVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiAttributeVO.java` | 4 |
| `CiAttribute` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAttribute.java` | 6 |
| `CiAttributeGroupVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiAttributeGroupVO.java` | 4 |
| `CiInstanceRelVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiInstanceRelVO.java` | 6 |
| `CiRelGroupVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiRelGroupVO.java` | 5 |
| `CiInstanceSearchResult` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiInstanceSearchResult.java` | 6 |
| `CiInstanceSearchVO` | Class | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiInstanceSearchVO.java` | 6 |
| `TopologyPage` | Function | `frontend/src/app/(dashboard)/cmdb/topology/[instanceId]/page.tsx` | 17 |
| `CiTopologyGraph` | Function | `frontend/src/components/cmdb/CiTopologyGraph.tsx` | 146 |
| `create` | Method | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelController.java` | 29 |
| `delete` | Method | `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelController.java` | 37 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Export → FindOrThrow` | cross_community | 4 |
| `Export → FindByModel` | cross_community | 4 |
| `Export → Of` | cross_community | 4 |
| `CreateModel → CiModelVO` | intra_community | 4 |
| `CreateAttribute → CiAttributeVO` | intra_community | 4 |
| `List → CiInstanceVO` | cross_community | 4 |
| `Get → CiAttributeVO` | cross_community | 4 |
| `Create → CountByFieldValue` | intra_community | 4 |
| `Create → CountByDstAndDef` | intra_community | 4 |
| `Create → CiLabel` | intra_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Changedoc | 17 calls |
| Rbac | 1 calls |
| [id] | 1 calls |
| Ui | 1 calls |

## How to Explore

1. `gitnexus_context({name: "TopologyPage"})` — see callers and callees
2. `gitnexus_query({query: "cmdb"})` — find related execution flows
3. Read key files listed above for implementation details
