# CMDB Frontend API Audit

Complete inventory of every API call across all CMDB frontend files.
`baseURL = '/api'` (axios), so every path below is prefixed with `/api` on the wire.
All calls go through the shared axios client in `frontend/src/lib/api.ts`.

---

## File: frontend/src/lib/api.ts (API client)

- Shared `axios.create({ baseURL: '/api', timeout: 30000 })` instance.
- Request interceptor: injects `Authorization: Bearer <token>` from `getToken()`.
- Response interceptor: on HTTP 401 → `clearToken()` + redirect to `/login`.
- No per-resource wrappers; every page imports `api` and calls `api.get/post/put/delete` inline.
- State management: pages use `@tanstack/react-query` (`useQuery` / `useMutation` / `useQueryClient`). No Redux/Zustand. UI state via `useState`.

---

## File: instances/by-model/[modelId]/[id]/page.tsx (instance detail)

- Line 91: `GET /cmdb/instances/${modelId}/${id}` → fetch CI instance (queryKey `cmdb-instance`)
- Line 96: `GET /cmdb/meta/models/${modelId}` → fetch model definition for field config (queryKey `cmdb-model`, enabled when inst loaded)
- Line 109: `PUT /cmdb/instances/${modelId}/${id}` body `{ attrs: editAttrs }` → save edited attributes (saveMutation)
- Line 120: `GET /cmdb/rel/${id}` → fetch relations grouped by kind (queryKey `cmdb-rel`, enabled when panel open)
- Line 126: `GET /cmdb/topology/${id}?depth=2` → topology preview nodes/edges (queryKey `cmdb-topology`, enabled when panel open)
- Line 132: `GET /cmdb/meta/association-defs` → all association definitions, filtered client-side by modelId (queryKey `cmdb-assoc-defs`, enabled when add-dialog open)
- Line 147: `GET /cmdb/rel/search?modelId=&keyword=&size=8` → search peer instances for association (queryKey `cmdb-rel-search`, enabled when target model + dialog open)
- Line 154: `DELETE /cmdb/rel/${relId}` → delete a relation (deleteRelMutation)
- Line 163: `POST /cmdb/rel` body `{ def_id, src_id, dst_id }` → create a relation (createRelMutation)

Component structure:
- `useParams` → `{ modelId, id }`. `usePermission` gate (redirect if no `cmdb_instance:read`).
- `useState` for editing toggle, edit attrs, panel open flags, add-dialog state.
- `useQuery` ×5 (instance, model, relations, topology, assoc-defs), `useQuery` for search.
- `useMutation` ×3 (save, deleteRel, createRel). `useQueryClient` for invalidation.
- Inline `renderEditField(attr, value, onChange)` switches on `field_type` (longchar/enum/enummulti/bool/date/int/float).
- Uses `<CiTopologyGraph>` for preview panel.

---

## File: instances/by-model/[modelId]/[id]/associations/page.tsx (associations list)

- Line 50: `GET /cmdb/instances/${modelId}/${id}` → fetch instance name/modelId summary (queryKey `cmdb-instance`)
- Line 58: `GET /cmdb/rel/${id}` → fetch all relations grouped (queryKey `cmdb-rel`)
- Line 62: `DELETE /cmdb/rel/${relId}` → delete relation (deleteMutation)

Component structure:
- `useParams` → `{ modelId, id }`. Permission gate `cmdb_instance:read`.
- `useState(filterKind)` for table filter. Flattens `relGroups` → table rows.
- `useQuery` ×2, `useMutation` ×1. `useQueryClient` invalidates `cmdb-rel`.

---

## File: instances/by-model/[modelId]/[id]/associations/new/page.tsx (new association wizard)

- Line 52: `GET /cmdb/instances/${modelId}/${id}` → instance summary (queryKey `cmdb-instance`)
- Line 60: `GET /cmdb/meta/association-defs` → all defs, filtered client-side (queryKey `cmdb-assoc-defs`)
- Line 75: `GET /cmdb/rel/search?modelId=&keyword=&size=12` → search target instances (queryKey `cmdb-rel-search`, enabled when step===1 && targetModelId)
- Line 85: `POST /cmdb/instances/${id}/relations` body `{ dst_instance_id, association_kind }` → create relation (createMutation)

Component structure:
- 3-step wizard (`step` 0/1/2). `useParams` → `{ modelId, id }`. Permission gate `cmdb_relation:create`.
- `useState` for step, selectedDefId, keyword, selectedPeer, error.
- `useQuery` ×3 (instance, defs, search), `useMutation` ×1.

NOTE: create uses `POST /cmdb/instances/${id}/relations` — DIFFERENT endpoint than the inline add-dialog in the detail page, which uses `POST /cmdb/rel`. This is an inconsistency.

---

## File: instances/by-model/[modelId]/page.tsx (instance list by model)

- Line 47: `GET /cmdb/meta/models/${modelId}` → model def for column config (queryKey `cmdb-model`)
- Line 52: `GET /cmdb/instances/${modelId}` → list instances (queryKey `cmdb-instances`, enabled when read perm)
- Line 57: `DELETE /cmdb/instances/${modelId}/${id}` → delete instance (deleteMutation)

Component structure:
- `useParams` → `{ modelId }`. Permission gate `cmdb_instance:read`.
- No pagination params passed — fetches all instances for the model (no page/size).
- `useQuery` ×2, `useMutation` ×1. `useQueryClient` invalidates `cmdb-instances`.

NOTE: list endpoint is `/cmdb/instances/${modelId}` (modelId in path), but the flat instance list page uses `/cmdb/instances?model=` (model in query). Two different list patterns.

---

## File: instances/by-model/[modelId]/new/page.tsx (new instance)

- Line 41: `GET /cmdb/meta/models/${modelId}` → model def + attributes + groups (queryKey `cmdb-model`)
- Line 45: `POST /cmdb/instances` body `{ modelId, name, fieldsData }` → create instance (createMutation)

Component structure:
- `useParams` → `{ modelId }`. Permission gate `cmdb_instance:create`.
- `useState` for `attrs` (Record<string,string>) and `name`. Renders attributes grouped by `attribute_groups`.
- `useQuery` ×1, `useMutation` ×1.
- Inline `renderField(attr, value, onChange)` switches on `field_type`.

NOTE: create body uses `{ modelId, name, fieldsData }` — but the flat instances page uses `{ model, name, status, owner, description, fieldsData }`. Inconsistent create payload shapes.

---

## File: admin/models/[modelId]/page.tsx (model detail)

- Line 47: `GET /cmdb/meta/models/${modelId}` → model with attributes + groups (queryKey `cmdb-model`)
- Line 51: `POST /cmdb/meta/models/${modelId}/attributes` body `{ field_key, name, field_type, group_id, is_required, is_unique, is_list_show, placeholder?, unit? }` → add attribute (addAttrMutation)
- Line 68: `DELETE /cmdb/meta/attributes/${attrId}` → delete attribute (deleteAttrMutation)

Component structure:
- `useParams` → `{ modelId }`. `usePermission` → `cmdb_model:write`.
- `useState` for adding-attr toggle and `newAttr` form object.
- `useQuery` ×1, `useMutation` ×2. `useQueryClient` invalidates `cmdb-model`.

---

## File: admin/page.tsx (config / admin)

This page has two sub-components (ModelsTab, AssociationsTab) plus the shell.

### AdminPage (shell)
- No API calls. Tab switcher `useState('models'|'associations')`. Permission gate `cmdb_model:write`.

### ModelsTab
- Line 89: `GET /cmdb/meta/models` → list all models (queryKey `cmdb-models`)
- Line 93: `POST /cmdb/meta/models` body `{ model_id, name, icon, group_code?, description? }` → create model (createMutation)

### AssociationsTab
- Line 198: `GET /cmdb/meta/association-kinds` → list kinds (queryKey `cmdb-asst-kinds`)
- Line 199: `GET /cmdb/meta/association-defs` → list defs (queryKey `cmdb-asst-defs`)
- Line 200: `GET /cmdb/meta/models` → list models for select dropdowns (queryKey `cmdb-models`)
- Line 203: `POST /cmdb/meta/association-kinds` body `{ kind_id, name, src_to_dst?, dst_to_src? }` → create kind (createKindMutation)
- Line 209: `POST /cmdb/meta/association-defs` body `{ kind_id, src_model_id, dst_model_id, name?, mapping }` → create def (createDefMutation)
- Line 215: `DELETE /cmdb/meta/association-defs/${id}` → delete def (deleteDefMutation)

Component structure:
- Two functional sub-components. Each uses `usePermission`, `useState` for add-form toggles, `useQuery`/`useMutation`, `useQueryClient`.
- Models grouped client-side by `group_code`.

---

## File: changes/page.tsx (changes list)

- Line 81: `GET /cmdb/models?size=100` → list models for filter dropdown (queryKey `cmdb-models-all`)
- Line 90: `GET /cmdb/changes?entityType=ci_instance&modelId=&from=&to=&operatorId=&action=&page=&size=` → paginated change history (queryKey `cmdb-changes-v2`)

Component structure:
- No mutations. Pure read page with filters.
- `useState` for model, startDate, endDate, operatorId, action, page, size, expanded(Set).
- `useQuery` ×2. Uses `<JsonDiffView>` for expandable diff rows.

NOTE: model list here uses `/cmdb/models` (NOT `/cmdb/meta/models`). Different model-listing endpoint than admin page.

---

## File: topology/[instanceId]/page.tsx (topology)

- Line 110: `GET /cmdb/topology/${instanceId}?depth=N` → normal topology (queryKey `cmdb-topology`, enabled when !compareMode)
- Line 118: `GET /cmdb/topology/${instanceId}/compare?fromTime=&toTime=&depth=N` → topology diff/compare (queryKey `cmdb-topology-compare`, enabled when compareMode && nonce>0)

Component structure:
- `useParams` → `{ instanceId }`. Permission gate `cmdb_instance:read`.
- `useState` for depth, selectedNode, compareMode, fromTime, toTime, compareDepth, compareNonce, filter Sets.
- `useQuery` ×2 (normal + compare). `useMemo` for merged graph input, filter option lists.
- `useRef(graphRef)` for PNG export via `html-to-image`.
- Uses `<CiTopologyGraph>` with diff maps (nodeDiffMap/edgeDiffMap).

---

## File: components/cmdb/CsvImportDialog.tsx (CSV import)

- Line 60: `GET /cmdb/instances/import/template?model=` (responseType blob) → download CSV template
- Line 81: `POST /cmdb/instances/import/preview` (multipart/form-data: file, model, conflictStrategy, encoding?) → preview parse (previewMutation)
- Line 96: `POST /cmdb/instances/import/execute` body `{ batchId }` → run import (executeMutation)
- Line 109: `GET /cmdb/instances/import/${batchId}/progress` → poll progress (queryKey `csv-import-progress`, refetchInterval 1500ms, enabled when step===2 && execute pending)
- Line 116: `GET /cmdb/instances/import/${batchId}/failed-rows` (responseType blob) → download failed rows CSV

Component structure:
- 3-step dialog (upload → preview → progress/result). `useState` for step, file, conflictStrategy, encoding, batchId, preview, result.
- `useMutation` ×2 (preview, execute), `useQuery` ×1 (progress polling).

---

# ADDITIONAL FILES (not in original list but contain CMDB API calls)

## File: cmdb/impact/[instanceId]/page.tsx (impact analysis)

- Line 76: `POST /cmdb/instances/${instanceId}/impact` body `{ direction, max_depth }` → impact analysis (queryKey `cmdb-impact`)

Component structure: `useParams` → `{ instanceId }`. Permission gate `cmdb_instance:read` + `cmdb_instance:impact`. `useState` for direction, maxDepth, collapsed Set. `useQuery` ×1, `useMemo` for depth map and edge attribution. Pure read.

---

## File: cmdb/changes/stats/page.tsx (change statistics)

- Line 149: `GET /cmdb/changes/stats` → aggregate stats (today/week/month, daily breakdown, top10) (queryKey `cmdb-changes-stats`)

Component structure: Permission gate `cmdb_change:read`. `useQuery` ×1. Pure read — cards + custom bar chart + table.

---

## File: cmdb/models/page.tsx (models management — NEW UI)

- Line 59: `GET /cmdb/models?keyword=&group=&page=&size=` → paginated models (queryKey `cmdb-models`)
- Line 71: `POST /cmdb/models` body `{ name, displayName, group }` → create model (createMutation)
- Line 82: `PUT /cmdb/models/${id}` body `{ displayName, group }` → update model (updateMutation)
- Line 92: `DELETE /cmdb/models/${id}` → delete model (deleteMutation)

Component structure: Permission gate `cmdb_model:read`. `useState` for groupFilter, search, page, dialog form, deleteTarget. `useQuery` ×1, `useMutation` ×3. Uses `<PermissionGuard>` wrapper.

NOTE: This uses `/cmdb/models` (CRUD by numeric `id`), DIFFERENT from admin page which uses `/cmdb/meta/models` (CRUD by `model_id` string). Two parallel model-management APIs.

---

## File: cmdb/instances/page.tsx (flat instances list — NEW UI)

- Line 88: `GET /cmdb/models?size=100` → models for filter (queryKey `cmdb-models-all`)
- Line 94: `GET /cmdb/instances?model=&keyword=&status=&page=&size=` → paginated instances (queryKey `cmdb-instances`)
- Line 112: `GET /cmdb/models/${createForm.modelId}/attributes` → model attributes for create form (queryKey `cmdb-model-attrs`)
- Line 122: `POST /cmdb/instances` body `{ model, name, status, owner, description, fieldsData }` → create instance (createMutation)
- Line 134: `DELETE /cmdb/instances/${instId}` → delete instance (deleteMutation)

Component structure: Permission gate `cmdb_instance:read`. `useState` for model, keyword, status, page, createForm, deleteTarget, csvOpen. `useQuery` ×3, `useMutation` ×2. Integrates `<CsvImportDialog>`.

NOTE: instance delete here is `/cmdb/instances/${instId}` (just id), but the by-model page deletes `/cmdb/instances/${modelId}/${id}` (modelId + id). Two different delete patterns.
NOTE: create payload uses `{ model, ... }` (string name), but by-model/new uses `{ modelId, name, fieldsData }`.

---

## File: cmdb/instances/2d-view/page.tsx (2D grouped view)

- Line 69: `GET /cmdb/models?size=100` → models for selector (queryKey `cmdb-models-all`)
- Line 76: `GET /cmdb/models/${selectedModel.id}/attributes` → model attributes (queryKey `cmdb-model-attrs`)
- Line 97: `GET /cmdb/instances/2d-view?modelId=&groupBy=` → grouped 2D view data (queryKey `cmdb-2d-view`)

Component structure: Permission gate `cmdb_instance:read`. `useState` for model, groupBy. `useQuery` ×3. Pure read.

---

## File: cmdb/page.tsx (root redirect)
- No API calls. `router.replace('/cmdb/models')`.

---

## File: cmdb/associations/page.tsx (old associations)
- No API calls. `redirect('/cmdb/admin')` (server-side).

---

## File: components/cmdb/CiInstanceSelect.tsx (single-select)

- Line 29: `GET /cmdb/instances/search?keyword=&size=10` → search instances (queryKey `cmdb-instance-select`)
- Line 39: `GET /cmdb/instances/search?keyword=&size=1` → resolve selected label (queryKey `cmdb-instance-selected`)

Component structure: `useState` keyword, open. `useQuery` ×2. Controlled component (value/onChange).

---

## File: components/cmdb/CiLinkSelector.tsx (multi-select with impact level)

- Line 43: `GET /cmdb/instances/search?keyword=&size=10` → search instances (queryKey `cmdb-instance-search`, debounced 300ms)

Component structure: `useState` keyword, debouncedKeyword, open. `useQuery` ×1. Controlled component with impact-level selector per selected item.

---

## File: components/daily/CiInstanceMultiSelect.tsx (multi-select)

- Line 35: `GET /cmdb/instances/search?keyword=&size=10` → search instances (queryKey `cmdb-instance-search`, debounced 300ms)

Component structure: `useState` keyword, debouncedKeyword, open. `useQuery` ×1. Controlled component.

---

## File: components/cmdb/JsonDiffView.tsx
- No API calls. Pure presentational diff renderer (computeDiff utility + React table).

---

# SUMMARY: Unique API Endpoint Inventory

## Instance CRUD
| Method | Path | Used in |
|--------|------|---------|
| GET | `/cmdb/instances/${modelId}/${id}` | instance detail, associations pages |
| GET | `/cmdb/instances/${modelId}` | by-model list (path param) |
| GET | `/cmdb/instances?model=&keyword=&status=&page=&size=` | flat instances list (query param) |
| GET | `/cmdb/instances/search?keyword=&size=` | CiInstanceSelect, CiLinkSelector, CiInstanceMultiSelect |
| GET | `/cmdb/instances/2d-view?modelId=&groupBy=` | 2D view |
| POST | `/cmdb/instances` (body `{modelId,name,fieldsData}`) | by-model/new |
| POST | `/cmdb/instances` (body `{model,name,status,owner,description,fieldsData}`) | flat instances page |
| PUT | `/cmdb/instances/${modelId}/${id}` (body `{attrs}`) | instance detail |
| DELETE | `/cmdb/instances/${modelId}/${id}` | by-model list |
| DELETE | `/cmdb/instances/${instId}` | flat instances page |

## Instance import
| Method | Path | Used in |
|--------|------|---------|
| GET | `/cmdb/instances/import/template?model=` | CsvImportDialog |
| POST | `/cmdb/instances/import/preview` | CsvImportDialog |
| POST | `/cmdb/instances/import/execute` | CsvImportDialog |
| GET | `/cmdb/instances/import/${batchId}/progress` | CsvImportDialog |
| GET | `/cmdb/instances/import/${batchId}/failed-rows` | CsvImportDialog |

## Instance impact / topology
| Method | Path | Used in |
|--------|------|---------|
| POST | `/cmdb/instances/${instanceId}/impact` | impact page |
| GET | `/cmdb/topology/${instanceId}?depth=` | topology page, instance detail preview |
| GET | `/cmdb/topology/${instanceId}/compare?fromTime=&toTime=&depth=` | topology page |

## Relations (legacy `cmdb/rel` API)
| Method | Path | Used in |
|--------|------|---------|
| GET | `/cmdb/rel/${id}` | instance detail, associations list |
| GET | `/cmdb/rel/search?modelId=&keyword=&size=` | instance detail add-dialog, new-association wizard |
| POST | `/cmdb/rel` (body `{def_id,src_id,dst_id}`) | instance detail add-dialog |
| DELETE | `/cmdb/rel/${relId}` | instance detail, associations list |

## Relations (newer `cmdb/instances/:id/relations` API)
| Method | Path | Used in |
|--------|------|---------|
| POST | `/cmdb/instances/${id}/relations` (body `{dst_instance_id,association_kind}`) | new-association wizard |

## Model CRUD (legacy `cmdb/meta/models` API — by model_id string)
| Method | Path | Used in |
|--------|------|---------|
| GET | `/cmdb/meta/models` | admin ModelsTab, AssociationsTab |
| GET | `/cmdb/meta/models/${modelId}` | instance detail, by-model list, by-model/new, model detail |
| POST | `/cmdb/meta/models` (body `{model_id,name,icon,group_code,description}`) | admin ModelsTab |
| POST | `/cmdb/meta/models/${modelId}/attributes` | model detail (add attr) |
| DELETE | `/cmdb/meta/attributes/${attrId}` | model detail (delete attr) |

## Model CRUD (newer `cmdb/models` API — by numeric id)
| Method | Path | Used in |
|--------|------|---------|
| GET | `/cmdb/models?keyword=&group=&page=&size=` | models page, changes page, instances page, 2d-view |
| POST | `/cmdb/models` (body `{name,displayName,group}`) | models page |
| PUT | `/cmdb/models/${id}` (body `{displayName,group}`) | models page |
| DELETE | `/cmdb/models/${id}` | models page |
| GET | `/cmdb/models/${id}/attributes` | instances page (create form), 2d-view |

## Association meta
| Method | Path | Used in |
|--------|------|---------|
| GET | `/cmdb/meta/association-kinds` | admin AssociationsTab |
| POST | `/cmdb/meta/association-kinds` | admin AssociationsTab |
| GET | `/cmdb/meta/association-defs` | admin AssociationsTab, instance detail, new-association |
| POST | `/cmdb/meta/association-defs` | admin AssociationsTab |
| DELETE | `/cmdb/meta/association-defs/${id}` | admin AssociationsTab |

## Change history
| Method | Path | Used in |
|--------|------|---------|
| GET | `/cmdb/changes?entityType=&modelId=&from=&to=&operatorId=&action=&page=&size=` | changes page |
| GET | `/cmdb/changes/stats` | changes/stats page |

---

# KEY INCONSISTENCIES (for correction mapping)

1. **Two model APIs**: `/cmdb/meta/models` (by `model_id` string, used by admin/model-detail) vs `/cmdb/models` (by numeric `id`, used by new models/instances/changes pages). These appear to be two generations of the same resource.

2. **Two instance list patterns**: `/cmdb/instances/${modelId}` (path param) vs `/cmdb/instances?model=` (query param).

3. **Two instance delete patterns**: `/cmdb/instances/${modelId}/${id}` vs `/cmdb/instances/${instId}`.

4. **Two instance create payloads**: `{modelId, name, fieldsData}` vs `{model, name, status, owner, description, fieldsData}`.

5. **Two relation create APIs**: `POST /cmdb/rel {def_id,src_id,dst_id}` (instance detail dialog) vs `POST /cmdb/instances/:id/relations {dst_instance_id, association_kind}` (new-association wizard).

6. **Two instance search APIs**: `/cmdb/rel/search` (relations context) vs `/cmdb/instances/search` (general autocomplete).

7. **Association defs fetched from `/cmdb/meta/association-defs`** in detail/new-association pages, but relation creation in the wizard uses `association_kind` (the kind_id), not `def_id` — the def is selected but its kind_id is sent.
