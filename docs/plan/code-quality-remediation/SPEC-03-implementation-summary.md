# SPEC-03 Implementation Summary

**Date:** 2026-07-09  
**Status:** ✅ Complete

---

## Objective

Reduce weak frontend/backend API contracts without changing behavior. Introduce shared types and safer error handling to prevent `any` proliferation.

---

## Deliverables

### 1. Core API Types (`frontend/src/types/api.ts`)

**Added:**
- `ApiResponse<T>` - Generic wrapper for backend responses
- `PaginatedResponse<T>` - Paginated list structure
- `ApiError` - Error response shape
- `extractData<T>()` - Helper to unwrap `r.data.data`
- `extractPaginated<T>()` - Helper to unwrap paginated responses

**Usage Pattern:**
```typescript
// Before
const { data } = useQuery({
  queryFn: () => api.get('/endpoint').then((r) => ({
    records: (r.data.data?.records ?? []) as Type[],
    total: r.data.data?.total ?? 0,
  })),
})

// After
const { data } = useQuery({
  queryFn: () => api.get('/endpoint').then((r) => extractPaginated<Type>(r)),
})
```

---

### 2. Safe Error Handler (`frontend/src/lib/api-error.ts`)

**Added:**
- `getApiErrorMessage(error: unknown, fallback: string): string`
  - Handles Axios errors
  - Handles Error objects
  - Handles string errors
  - Returns fallback for unknown shapes
- `getApiErrorCode(error: unknown): string | undefined`
  - Extracts backend error codes

**Usage Pattern:**
```typescript
// Before
catch (err: any) {
  toast.error(err.response?.data?.message || '操作失败')
}

// After
catch (err: unknown) {
  toast.error(getApiErrorMessage(err, '操作失败'))
}
```

---

### 3. CMDB Types (`frontend/src/types/cmdb.ts`)

**Added:**
- `CmdbFieldValue` - Union type for dynamic field values
- `CmdbFieldsData` - Record type for dynamic fields
- `CmdbModel` - Model definition
- `CmdbModelGroup` - Model grouping
- `CmdbAttribute` - Attribute definition
- `CmdbAttributeGroup` - Attribute grouping
- `CmdbAssociationKind` - Association type (e.g., "部署于")
- `CmdbAssociationDefinition` - Association between models
- `CmdbInstance` - CI record with dynamic fields
- `CmdbInstanceWithModel` - Instance with model metadata

**Design Principles:**
- `fieldsData` remains `Record<string, CmdbFieldValue>` (flexible)
- Built-in fields like `modelId`, `tenantId`, `isBuiltIn` are typed
- Metadata fields remain `unknown` where shape is unstable

---

### 4. Workflow Types (`frontend/src/types/workflow.ts`)

**Added:**
- `ProcessDefinition` - Workflow template
- `ProcessDefinitionVersion` - Version history record
- `ProcessInstance` - Running workflow
- `WorkflowTask` - Workflow step
- `AdminConfigItem` - Configuration key-value

**Design Principles:**
- Based on Flowable engine response shapes
- Optional fields marked with `?`
- Third-party BPMN types not included (kept at adapter boundary)

---

## Consumer Adoption

### workflow/admin/page.tsx ✅

**Before:**
- Local `ProcessDef` interface (duplicated type)
- 5 `catch (err: any)` patterns
- 3 `any` type annotations
- Manual response unwrapping

**After:**
- Uses `ProcessDefWithMeta extends ProcessDefinition`
- Uses `ProcessDefinitionVersion` for version arrays
- Uses `getApiErrorMessage(err: unknown, fallback)` (5 replacements)
- Uses `extractPaginated<ProcessDefWithMeta>(r)`

**Impact:**
- **Lint problems:** 10 → 1 (-9, -90%)
- **Type safety:** Local interface eliminated, shared types adopted
- **Error handling:** 5 `any` → `unknown` with safe parser

---

## Overall Impact

**Lint Improvement:**
- **Repository total:** 185 → 176 problems (-9, -4.9%)
- **Target file (workflow/admin):** 10 → 1 (-9, -90%)

**Type Safety:**
- ✅ 4 new type definition files
- ✅ Shared API response types
- ✅ Paginated response helpers
- ✅ Safe error message extraction
- ✅ CMDB stable shapes defined
- ✅ Workflow stable shapes defined

**Code Quality:**
- ✅ `any` replaced with typed alternatives (9 instances in workflow/admin)
- ✅ Error handling standardized (5 catch blocks)
- ✅ Manual response unwrapping replaced with helpers

---

## Validation

### Automated Checks ✅
```bash
cd frontend && npm run typecheck  # ✅ Pass
cd frontend && npm run lint       # ✅ 176 problems (down from 185)
```

### Behavior Preservation ✅

**workflow/admin/page.tsx:**
- ✅ API endpoints unchanged
- ✅ Request payloads unchanged
- ✅ Toast messages equivalent (backend message prioritized)
- ✅ Response data access patterns preserved
- ✅ UI logic unchanged

**Type narrowing only:**
- `ProcessDef` → `ProcessDefWithMeta` (same fields)
- `any[]` → `ProcessDefinitionVersion[]` (runtime shape matches)
- `any` error → `unknown` (safer, no behavior change)

---

## Modified Files

1. **New Type Files:**
   - `frontend/src/types/api.ts` (core API types)
   - `frontend/src/lib/api-error.ts` (error handling)
   - `frontend/src/types/cmdb.ts` (CMDB types)
   - `frontend/src/types/workflow.ts` (workflow types)

2. **Updated Consumer:**
   - `frontend/src/app/(dashboard)/workflow/admin/page.tsx`
     - Imported shared types
     - Replaced local `ProcessDef` with `ProcessDefWithMeta`
     - Replaced 5 `catch (err: any)` with `catch (err: unknown)`
     - Applied `getApiErrorMessage()` in all error handlers
     - Applied `extractPaginated()` in query function

---

## Non-Goals Achieved ✅

Per SPEC-03, this phase explicitly **did not**:
- ❌ Change backend response JSON
- ❌ Rename fields
- ❌ Force dynamic CMDB `fieldsData` into rigid types
- ❌ Introduce OpenAPI/codegen
- ❌ Clean every `any` in BPMN third-party definitions
- ❌ Change backend DTO structure

---

## Key Design Decisions

### 1. Dynamic vs. Typed Fields

**CMDB `fieldsData`:**
- Kept as `Record<string, CmdbFieldValue>` (flexible)
- Allows custom fields without schema changes
- Validates at runtime via field definitions

**Type Choice:**
```typescript
type CmdbFieldValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | Record<string, unknown>  // Nested objects
```

### 2. Error Handling Strategy

**Unified Error Parser:**
- Checks for Axios error structure first
- Falls back to Error.message
- Returns fallback for unknown shapes
- Preserves backend error messages

**Type Safety:**
- `catch (err: unknown)` instead of `any`
- Forces explicit error handling
- Prevents accidental property access

### 3. Helper Functions

**`extractData<T>()` and `extractPaginated<T>()`:**
- Reduce boilerplate (`r.data.data` → helper call)
- Type-safe extraction
- Consistent error handling point (future enhancement)

---

## Future Enhancements (Post-SPEC-03)

1. **Adopt in More Consumers:**
   - Apply to CMDB pages (models, instances, associations)
   - Apply to admin config page
   - Apply to RBAC pages

2. **Extend Error Handling:**
   - Add retry logic in `extractPaginated()`
   - Add toast integration option
   - Add error code-specific handling

3. **CMDB Type Refinement:**
   - Add instance validation helpers
   - Add field type guards
   - Add association helpers

4. **OpenAPI Integration (Future):**
   - Generate types from backend OpenAPI spec
   - Validate consistency with manual types
   - Migrate to codegen if stable

---

## Rollback Plan

**If behavior changes detected:**

1. **Revert consumer changes:**
   ```bash
   git checkout HEAD~1 frontend/src/app/(dashboard)/workflow/admin/page.tsx
   ```

2. **Keep type files:**
   - Type definition files are harmless if unused
   - Can remain for future adoption

3. **Per-file rollback:**
   - Each consumer is independent
   - Reverting one doesn't affect others

---

## Manual Testing Checklist (Pending User Validation)

### Workflow Admin Page
- [ ] Process definitions list loads correctly
- [ ] Pagination works
- [ ] Expand versions shows version history
- [ ] Activate/suspend actions work
- [ ] Rename dialog works
- [ ] Delete version works
- [ ] Error toasts show backend messages (test with network error)
- [ ] No console errors

---

## Completion Criteria ✅

- [x] Shared API/error types exist
- [x] At least one consumer uses them without behavior changes (workflow/admin)
- [x] New code has a clear typed path instead of copying `any` patterns
- [x] Typecheck passes
- [x] Lint improves (185 → 176, -9 problems)

---

## Next Steps (SPEC-04+)

Per PLAN.md, consider:
1. **Adopt types in CMDB pages** (high `any` count area)
2. **Adopt types in admin config** (already partially typed in SPEC-02)
3. **CMDB page splitting** (separate concern, deferred)
4. **Remaining `any` cleanup** (targeted, per-module basis)

---

**Status:** ✅ **Complete - Ready for Manual Validation**
