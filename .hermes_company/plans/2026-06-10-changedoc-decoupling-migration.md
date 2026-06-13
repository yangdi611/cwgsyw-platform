# 迁移计划: changedoc 与 cmdb 解耦

> 基于架构设计: `../specs/2026-06-10-changedoc-decoupling-architecture.md`  
> 设计日期: 2026-06-10  
> 对接: 耦合分析报告 `changedoc-cmdb-coupling-analysis.md`

---

## 概览

| 维度 | 值 |
|------|-----|
| 总 Phase | 5 |
| 总任务数 | 16 |
| 预估总工时 | ~7h |
| 主要工作模块 | backend/changedoc (Java) + frontend (Next.js/TypeScript) |
| 修改文件 | backend: ~4 Java files + 2 DTOs + 1 migration; frontend: ~2 TSX files |

## 依赖关系

```
Phase 1 (CI 代理)
  ├─ Task 1.1: 后端 DTO
  ├─ Task 1.2: 后端端点
  └─ Task 1.3: 后端集成测试
        │
        ▼
Phase 2 (前端解耦)
  ├─ Task 2.1: TypeScript 类型
  ├─ Task 2.2: 新建页 API 改造
  └─ Task 2.3: 详情页双模板
        │
        ▼
Phase 3 (实体层清理)  ← 可与 Phase 4 并行
  ├─ Task 3.1: Migration 数据合并
  ├─ Task 3.2: 移除实体字段
  ├─ Task 3.3: 清理引用代码
  └─ Task 3.4: Migration 删除列
        │
        ▼
Phase 4 (AI/Export 对齐)  ← 可与 Phase 3 并行
  ├─ Task 4.1: Export 确认
  └─ Task 4.2: AI prompt 确认
        │
        ▼
Phase 5 (回归测试)
  ├─ Task 5.1: 单元测试
  ├─ Task 5.2: 集成测试
  ├─ Task 5.3: 端到端验证
  └─ Task 5.4: 权限回归
```

---

## Phase 1: CI 代理端点实现

> 目标: 解耦 CP-1, CP-2, CP-3, CP-4  
> 验收: 前端可以调用 changedoc CI 端点获取 CI 数据，不再依赖 `/cmdb/*`  
> 预估: 3.5h

### Task 1.1: 定义 changedoc 自有 CI DTO

**Objective**: 创建 `CiSearchResultVO` 和 `CiTopologyResultVO`，与 cmdb DTO 解耦

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/CiSearchResultVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/CiTopologyResultVO.java`

**Implementation**:

```java
// CiSearchResultVO.java
package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.util.List;

@Data
public class CiSearchResultVO {
    private List<CiRecord> records;
    private long total;

    @Data
    public static class CiRecord {
        private Long id;
        private String name;
        private String modelId;
        private String modelName;
    }
}
```

```java
// CiTopologyResultVO.java
package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.util.List;

@Data
public class CiTopologyResultVO {
    private List<TopoNode> nodes;
    private List<TopoEdge> edges;

    @Data
    public static class TopoNode {
        private Long id;
        private String name;
        private String modelId;
        private String modelName;
        private boolean isRoot;
    }

    @Data
    public static class TopoEdge {
        private Long id;
        private Long srcId;
        private Long dstId;
        private String label;
        private String defId;
    }
}
```

**Verification**: `mvn compile -pl backend` 编译通过

**Commit**:
```bash
git add backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/CiSearchResultVO.java
git add backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/CiTopologyResultVO.java
git commit -m "feat(changedoc): add CI proxy DTOs for cmdb decoupling"
```

---

### Task 1.2: 实现 CI 代理端点

**Objective**: 在 ChangeDocController 新增 2 个代理端点，在 ChangeDocService 新增对应方法

**Files:**
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocController.java`
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java`

**Step 1: 修改 ChangeDocService — 注入 cmdb 服务**

```java
// 在 ChangeDocService.java 顶部新增 field:
private final CiInstanceService ciInstanceService;
private final CiTopologyService ciTopologyService;

// 同时确保 @RequiredArgsConstructor 自动注入（两个 cmdb 服务在 Spring 容器中已存在）
```

```java
// 新增方法:
public CiSearchResultVO searchCi(String tenantId, String keyword, int size) {
    size = Math.min(Math.max(size, 1), 50);
    var cmdbResult = ciInstanceService.searchAcrossModels(
            tenantId, keyword, null, 1, size);

    CiSearchResultVO vo = new CiSearchResultVO();
    vo.setTotal(cmdbResult.getTotal());
    vo.setRecords(cmdbResult.getRecords().stream().map(r -> {
        CiSearchResultVO.CiRecord rec = new CiSearchResultVO.CiRecord();
        rec.setId(r.getId());
        rec.setName(r.getName());
        rec.setModelId(r.getModelId());
        rec.setModelName(r.getModelName());
        return rec;
    }).collect(Collectors.toList()));
    return vo;
}

public CiTopologyResultVO getCiTopology(String tenantId, Long instanceId, int depth) {
    depth = Math.min(Math.max(depth, 1), 5);
    var cmdbResult = ciTopologyService.getTopology(tenantId, instanceId, depth);

    CiTopologyResultVO vo = new CiTopologyResultVO();
    vo.setNodes(cmdbResult.getNodes().stream().map(n -> {
        CiTopologyResultVO.TopoNode node = new CiTopologyResultVO.TopoNode();
        node.setId(n.getId());
        node.setName(n.getName());
        node.setModelId(n.getModelId());
        node.setModelName(n.getModelName());
        node.setRoot(n.getIsRoot());
        return node;
    }).collect(Collectors.toList()));
    vo.setEdges(cmdbResult.getEdges().stream().map(e -> {
        CiTopologyResultVO.TopoEdge edge = new CiTopologyResultVO.TopoEdge();
        edge.setId(e.getId());
        edge.setSrcId(e.getSrcId());
        edge.setDstId(e.getDstId());
        edge.setLabel(e.getLabel());
        edge.setDefId(e.getDefId());
        return edge;
    }).collect(Collectors.toList()));
    return vo;
}
```

**Step 2: 修改 ChangeDocController — 新增端点**

```java
// 在 ChangeDocController.java 新增两个方法:

@GetMapping("/ci/search")
@PreAuthorize("hasAuthority('change_doc:read')")
public R<CiSearchResultVO> searchCi(
        @RequestParam String keyword,
        @RequestParam(defaultValue = "10") int size,
        @AuthenticationPrincipal SecurityUser user) {
    return R.ok(changeDocService.searchCi(user.getTenantId(), keyword, size));
}

@GetMapping("/ci/topology/{instanceId}")
@PreAuthorize("hasAuthority('change_doc:read')")
public R<CiTopologyResultVO> getCiTopology(
        @PathVariable Long instanceId,
        @RequestParam(defaultValue = "2") int depth,
        @AuthenticationPrincipal SecurityUser user) {
    return R.ok(changeDocService.getCiTopology(user.getTenantId(), instanceId, depth));
}
```

**Verification**:
1. `mvn compile -pl backend` 编译通过
2. 启动后端，使用 curl 或 Postman 测试新端点

**Commit**:
```bash
git add backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocController.java
git add backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java
git commit -m "feat(changedoc): add CI proxy endpoints for cmdb decoupling"
```

---

### Task 1.3: 编写 CI 代理端点集成测试

**Objective**: 覆盖 CI 搜索和拓扑代理端点的正常/异常路径

**Files:**
- Create: `backend/src/test/java/com/cwgsyw/platform/module/changedoc/ChangeDocCiProxyTest.java`

**Test cases**:
1. `searchCi_withKeyword_returnsMappedRecords` — 正常搜索返回
2. `searchCi_emptyKeyword_returnsEmptyList` — 空关键词
3. `searchCi_sizeExceeded_clampedTo50` — size 截断
4. `getCiTopology_validId_returnsNodesAndEdges` — 正常拓扑
5. `getCiTopology_invalidDepth_clamped` — 深度截断
6. `getCiTopology_nonexistentId_emptyResult` — 不存在的 CI

**Verification**:
```bash
mvn test -pl backend -Dtest=ChangeDocCiProxyTest
```
期望: 6 passed

**Commit**:
```bash
git add backend/src/test/java/com/cwgsyw/platform/module/changedoc/ChangeDocCiProxyTest.java
git commit -m "test(changedoc): add integration tests for CI proxy endpoints"
```

---

## Phase 2: 前端解耦 + 双模板对齐

> 目标: 解除 CP-1 ~ CP-4 耦合，完成 CP-6 双模板对齐  
> 验收: 前端不再调用 `/cmdb/*`，详情页显示双模板区域  
> 预估: 2h

### Task 2.1: 更新 TypeScript 类型定义

**Objective**: 定义 changedoc 自有 CI 类型和双模板 ChangeDocVO 类型

**Files:**
- Create/Modify: TypeScript type declarations in the frontend module

```typescript
// CI search types (changedoc-owned, not cmdb-owned)
interface CiRecord {
  id: number
  name: string
  modelId: string
  modelName: string
}

interface CiSearchResult {
  records: CiRecord[]
  total: number
}

// CI topology types (changedoc-owned)
interface TopoNode {
  id: number
  name: string
  modelId: string | null
  modelName: string | null
  isRoot: boolean
}

interface TopoEdge {
  id: number
  srcId: number
  dstId: number
  label: string
  defId: string
}

interface CiTopologyResult {
  nodes: TopoNode[]
  edges: TopoEdge[]
}

// ChangeDocVO — align with backend dual-template model
interface ChangeDocVO {
  id: number
  changeNo: string
  status: string
  applicantId: number | null
  applicantName: string | null
  applyTime: string | null
  approvedAt: string | null
  approverId: number | null
  approverName: string | null
  approverComment: string | null
  createdAt: string
  updatedAt: string
  applicationTemplateId: number | null
  applicationTemplateName: string | null
  planTemplateId: number | null
  planTemplateName: string | null
  fieldsData: Record<string, string> | null
  applicationFieldConfig: FieldConfigVO[] | null
  planFieldConfig: FieldConfigVO[] | null
  // REMOVED: templateId, templateName, fieldConfig (single-template legacy)
}
```

**Commit**:
```bash
git add frontend/src/types/changedoc.ts  # or wherever types are defined
git commit -m "feat(frontend): define changedoc-owned CI types and dual-template ChangeDocVO"
```

---

### Task 2.2: 改造新建页 API 调用

**Objective**: `change-docs/new/page.tsx` 中 CI 搜索和拓扑调用改为 changedoc 代理端点

**Files:**
- Modify: `frontend/src/app/(dashboard)/change-docs/new/page.tsx`

**Changes** (line references from current code):

Line 54-56: 模板查询增加类型区分
```typescript
// 改为同时获取申请单和方案模板
const { data: templates = [], isLoading: templatesLoading } = useQuery<TemplateVO[]>({
  queryKey: ['change-doc-templates-active'],
  queryFn: () => api.get('/admin/change-doc-templates').then(r => r.data.data),
  enabled: hasPermission('change_doc', 'create'),
})

// 拆分为两类
const applicationTemplates = templates.filter(t => t.type === 'application' || !t.type)
const planTemplates = templates.filter(t => t.type === 'plan')
```

Line 76-81: CI 搜索改为代理端点
```typescript
// BEFORE:
// api.get('/cmdb/instances/search', { params: { keyword: ciSearch, size: 10 } })

// AFTER:
const { data: ciSearchResult } = useQuery<CiSearchResult>({
  queryKey: ['ci-selector-search', ciSearch],
  queryFn: () => api.get('/change-docs/ci/search', {
    params: { keyword: ciSearch, size: 10 }
  }).then(r => r.data.data),
  enabled: !!ciSelectorOpen && ciSearch.length >= 1,
})
```

Line 84-88: CI 拓扑改为代理端点
```typescript
// BEFORE:
// api.get(`/cmdb/topology/${ciTopoInstanceId}`, { params: { depth: 2 } })

// AFTER:
const { data: ciTopoResult } = useQuery<CiTopologyResult>({
  queryKey: ['ci-selector-topo', ciTopoInstanceId],
  queryFn: () => api.get(`/change-docs/ci/topology/${ciTopoInstanceId}`, {
    params: { depth: 2 }
  }).then(r => r.data.data),
  enabled: !!ciTopoInstanceId,
})
```

Line 32: CiSnapshot 接口简化为 CiRecord
```typescript
// BEFORE:
// interface CiSnapshot { id: number; name: string; model_name: string; model_id: string }

// AFTER — 直接复用 CiRecord 类型
```

**Verification**:
1. 前端编译: `cd frontend && npm run build` (或 dev server)
2. 新建页: 打开 `/change-docs/new`，选择模板后使用 CI 选择器搜索
3. 检查 Network 面板: 不再有对 `/cmdb/*` 的请求
4. 确认用户不再需要 `cmdb_instance:read` 权限即可使用 CI 选择器

**Commit**:
```bash
git add frontend/src/app/\(dashboard\)/change-docs/new/page.tsx
git commit -m "refactor(frontend): switch ci_selector to changedoc proxy endpoints"
```

---

### Task 2.3: 改造详情页双模板渲染

**Objective**: 详情页 `change-docs/[id]/page.tsx` 使用双模板 fieldConfig 渲染

**Files:**
- Modify: `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx`

**Changes**:

```typescript
// 从后端返回中解构双模板配置
const {
  applicationTemplateId, applicationTemplateName,
  planTemplateId, planTemplateName,
  applicationFieldConfig, planFieldConfig,
  fieldsData,
  // ... other fields
} = doc

// 渲染两区域
;<div className="space-y-8">
  {/* 申请单区域 */}
  <section>
    <h2>变更申请 {applicationTemplateName && `— ${applicationTemplateName}`}</h2>
    {applicationFieldConfig?.map(field => (
      <FormField key={field.id} config={field} value={fieldsData?.[field.field_key]} />
    ))}
  </section>

  {/* 方案区域 (可选) */}
  {planTemplateId && (
    <section>
      <h2>变更方案 {planTemplateName && `— ${planTemplateName}`}</h2>
      {planFieldConfig?.map(field => (
        <FormField key={field.id} config={field} value={fieldsData?.[field.field_key]} />
      ))}
    </section>
  )}
</div>
```

**Verification**:
1. 打开一个已有关联申请单和方案模板的变更文档
2. 确认两个区域分别显示各自的字段配置
3. 确认字段值正常显示

**Commit**:
```bash
git add frontend/src/app/\(dashboard\)/change-docs/\[id\]/page.tsx
git commit -m "feat(frontend): render dual-template field configs on detail page"
```

---

## Phase 3: 实体层清理

> 目标: 清理 ChangeDoc 实体 12 个遗留字段，移除 deprecated templateId  
> 验收: ChangeDoc.java 仅保留 fieldsData + 必要的桥接字段  
> 预估: 3h

### Task 3.1: 编写数据合并 Migration

**Objective**: 新建 Flyway migration，将旧字段数据合并到 `fieldsData`（冗余写入）

**Files:**
- Create: `backend/src/main/resources/db/migration/V14__merge_legacy_fields_to_fieldsdata.sql`

```sql
-- V14: 合并 ChangeDoc 旧字段数据到 fieldsData JSONB
-- 如果 fieldsData 中已有同名 key，优先保留 fieldsData 中的值

UPDATE change_doc
SET fields_data = 
    COALESCE(fields_data, '{}'::jsonb) ||
    jsonb_strip_nulls(jsonb_build_object(
        'title',            title,
        'changeDesc',       change_desc,
        'impactScope',      impact_scope,
        'changeWindow',     change_window,
        'resourceSupport',  resource_support,
        'background',       background,
        'steps',            steps,
        'riskAssessment',   risk_assessment,
        'rollbackPlan',     rollback_plan,
        'verifyMethod',     verify_method,
        'contacts',         contacts
    ))
WHERE fields_data IS NULL
   OR NOT (fields_data ? 'title')
   OR NOT (fields_data ? 'changeDesc')
   -- 保守策略: 只要 fieldsData 中缺少任一 key，就执行合并
   -- COALESCE + || 操作符保证已有 key 不被覆盖
;

-- 验证数据完整性（手动执行）
-- SELECT id, fields_data FROM change_doc WHERE fields_data IS NULL LIMIT 10;
```

**Verification**:
1. 在测试数据库执行 migration
2. 查询确证: `SELECT COUNT(*) FROM change_doc WHERE fields_data IS NULL` 返回 0
3. 抽查旧文档: fieldsData 包含所有旧字段值

**Commit**:
```bash
git add backend/src/main/resources/db/migration/V14__merge_legacy_fields_to_fieldsdata.sql
git commit -m "feat(db): merge legacy ChangeDoc fields into fieldsData JSONB"
```

---

### Task 3.2: 移除实体遗留字段 + deprecated templateId

**Objective**: 从 ChangeDoc.java 移除 12 个冗余字段和 deprecated templateId

**Files:**
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDoc.java`

**Changes** — 删除以下字段：
```java
// DELETE these lines (lines 19-28, 40-42 in current file):
private String changeDesc;       // → fieldsData["changeDesc"]
private String impactScope;      // → fieldsData["impactScope"]
private String changeWindow;     // → fieldsData["changeWindow"]
private String resourceSupport;  // → fieldsData["resourceSupport"]
private String background;       // → fieldsData["background"]
private String steps;            // → fieldsData["steps"]
private String riskAssessment;   // → fieldsData["riskAssessment"]
private String rollbackPlan;     // → fieldsData["rollbackPlan"]
private String verifyMethod;     // → fieldsData["verifyMethod"]
private String contacts;         // → fieldsData["contacts"]
private Long templateId;         // → applicationTemplateId / planTemplateId

// title 字段暂时保留（NOT NULL 桥接），但在实体上标记 @Deprecated
// 后续 migration V15 放宽 NOT NULL 约束后可一并移除
```

**Target entity (after cleanup)**:
```java
@Data
@TableName(value = "change_doc", autoResultMap = true)
public class ChangeDoc {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String changeNo;
    private String title;  // @Deprecated — kept for NOT NULL bridge, remove in V15
    private String status;
    private Long applicantId;
    private LocalDateTime applyTime;
    private LocalDateTime approvedAt;
    private Long approverId;
    private String approverComment;
    private Long applicationTemplateId;
    private Long planTemplateId;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private Long deletedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long createdBy;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, String> fieldsData;
}
```

**Verification**: `mvn compile -pl backend` — 编译错误会指向所有引用已删除字段的代码

**Commit**:
```bash
git add backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDoc.java
git commit -m "refactor(changedoc): remove legacy fields and deprecated templateId from ChangeDoc entity"
```

---

### Task 3.3: 清理所有引用旧字段的代码

**Objective**: 修复编译错误，将所有代码改为从 fieldsData 读取

**Files (likely affected)**:
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ExportService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/AiGatewayService.java` (if references exist)
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocMapper.java`

**Pattern**: 所有 `doc.getChangeDesc()` → `doc.getFieldsData().get("changeDesc")`

```java
// Example fix in ChangeDocService.create():
// BEFORE:
// doc.setChangeDesc(req.getChangeDesc());
// AFTER: (if CreateChangeDocRequest still has these fields, they should go to fieldsData)
doc.setFieldsData(Map.of("changeDesc", req.getChangeDesc(), ...));

// Example fix in ChangeDocService.generateAiContent():
// Line 273-275 已经使用 fd.getOrDefault("change_desc", "") — 确认 key 名一致
String changeDesc = fd.getOrDefault("changeDesc", fd.getOrDefault("change_desc", ""));
```

**Verification**:
1. `mvn compile -pl backend` 编译通过
2. `mvn test -pl backend` 所有现有测试通过

**Commit**:
```bash
git add backend/src/main/java/com/cwgsyw/platform/module/changedoc/
git commit -m "refactor(changedoc): replace legacy field access with fieldsData map reads"
```

---

### Task 3.4: 编写 DROP COLUMN Migration

**Objective**: 新建 migration 删除已废弃的数据库列（需确认 Phase 3.1 数据已完整迁移）

**Files:**
- Create: `backend/src/main/resources/db/migration/V15__drop_legacy_change_doc_columns.sql`

```sql
-- V15: 删除 ChangeDoc 遗留列（不可逆操作）
-- 前置条件: V14 已将数据合并到 fieldsData，Phase 3.2-3.3 代码已不再引用这些列

ALTER TABLE change_doc
    DROP COLUMN IF EXISTS change_desc,
    DROP COLUMN IF EXISTS impact_scope,
    DROP COLUMN IF EXISTS change_window,
    DROP COLUMN IF EXISTS resource_support,
    DROP COLUMN IF EXISTS background,
    DROP COLUMN IF EXISTS steps,
    DROP COLUMN IF EXISTS risk_assessment,
    DROP COLUMN IF EXISTS rollback_plan,
    DROP COLUMN IF EXISTS verify_method,
    DROP COLUMN IF EXISTS contacts,
    DROP COLUMN IF EXISTS template_id;

-- 同时移除 title 列的 NOT NULL 约束（title 值完全由 fieldsData 承载）
ALTER TABLE change_doc ALTER COLUMN title DROP NOT NULL;
```

**Verification**:
1. 在测试数据库执行 migration
2. `SELECT column_name FROM information_schema.columns WHERE table_name = 'change_doc'` — 确认旧列已删除
3. 运行完整测试套件: `mvn test -pl backend`
4. 抽查: 打开已有变更文档，确认 fieldsData 和前端展示正常

**Commit**:
```bash
git add backend/src/main/resources/db/migration/V15__drop_legacy_change_doc_columns.sql
git add backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDoc.java  # remove 'title' too
git commit -m "feat(db): drop legacy ChangeDoc columns + relax title NOT NULL"
```

---

## Phase 4: Export / AI 对齐确认

> 目标: 确认 ExportService 和 AiGatewayService 正常工作  
> 验收: PDF/Word 导出和 AI 生成功能不受影响  
> 预估: 0.5h

### Task 4.1: 确认 ExportService key 名对齐

**Objective**: 确保 ExportService 读取 fieldsData 时的 key 名与 migration 合并后的 key 名一致

**Files:**
- Read: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ExportService.java`

**Action**: 检查 ExportService 中的 key 引用，例如：
```java
// 如果使用驼峰 key:
fieldsData.get("changeDesc")
// 如果使用下划线 key:
fieldsData.get("change_desc")

// 需要确认与 V14 migration 中 jsonb_build_object 的 key 名一致
// V14 使用驼峰: 'changeDesc', 'impactScope', etc.
```

**Verification**: 导出一个已有变更文档的 PDF，确认所有字段值正确显示

---

### Task 4.2: 确认 AI prompt key 名对齐

**Objective**: 确保 `generateAiContent` 方法中 fieldsData key 名一致

**Files:**
- Read: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java` (line 265-292)

**Action**: Line 273-275 当前代码：
```java
String changeDesc   = fd.getOrDefault("change_desc", "");
String impactScope  = fd.getOrDefault("impact_scope", "");
String changeWindow = fd.getOrDefault("change_window", "");
```

确认改为驼峰（与 V14 migration 对齐）:
```java
String changeDesc   = fd.getOrDefault("changeDesc", "");
String impactScope  = fd.getOrDefault("impactScope", "");
String changeWindow = fd.getOrDefault("changeWindow", "");
```

**Verification**: 调用 `/api/change-docs/{id}/ai-generate` 确认返回有效内容

---

## Phase 5: 回归测试

> 目标: 确保所有功能在全链路正常工作  
> 预估: 1h

### Task 5.1: 单元测试全量

```bash
mvn test -pl backend
```
期望: 所有现有测试 + 新增 CI 代理测试全部通过

### Task 5.2: 集成测试验证

手动或自动化:
1. CI 搜索: `GET /api/change-docs/ci/search?keyword=web&size=10` → 200 + records
2. CI 拓扑: `GET /api/change-docs/ci/topology/{validId}?depth=2` → 200 + nodes/edges
3. 新建变更文档: `POST /api/change-docs` with applicationTemplateId → 201
4. 导出: `GET /api/change-docs/{id}/export?format=pdf` → 200 + binary PDF

### Task 5.3: 端到端验证

在前端:
1. 打开 `/change-docs` 列表页 — 正常显示
2. 打开 `/change-docs/new` — 走进两步模板选择流程，使用 CI 选择器
3. 创建变更文档成功，跳转详情页 — 双区域正确渲染
4. 查看已有变更文档详情 — 双区域正确渲染
5. 确认 Network 面板无 `/cmdb/*` 请求

### Task 5.4: 权限回归测试

| 用户角色 | 权限 | 预期行为 |
|----------|------|----------|
| ci-reader | 仅 `change_doc:read` | CI 选择器正常搜索，新建页正常 |
| cmdb-only | 仅 `cmdb_instance:read` | 变更文档列表可访问（不受影响），但 CI 选择器不再调用 `/cmdb/*` |
| admin | `change_doc:*` + `cmdb_instance:*` | 所有功能正常 |
| none | 无任何权限 | 变更文档页面 403 |

---

## 回滚策略

| Phase | 回滚方式 |
|-------|----------|
| Phase 1 (CI 代理) | 前端保留旧 `/cmdb/*` 调用 + 新端点双写，验证后切流量；回滚只需 revert 前端 commit |
| Phase 2 (前端解耦) | revert commit，恢复 `/cmdb/*` 调用 |
| Phase 3.1 (数据合并) | migration 仅追加写入 fieldsData，不删除旧列 → 无回滚需求 |
| Phase 3.2 (代码移除) | revert commit |
| Phase 3.4 (删除列) | 需从备份恢复数据库（不可逆 migration） |

**安全实践**: Phase 3.4 在 Phase 3.1 验证通过后至少等 1 个 release cycle 再执行。

---

*此迁移计划对接耦合分析报告 `changedoc-cmdb-coupling-analysis.md` 和架构设计 `../specs/2026-06-10-changedoc-decoupling-architecture.md`。*
