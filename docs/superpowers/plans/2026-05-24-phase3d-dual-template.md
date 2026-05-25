# Phase 3d: Dual-Template Change Document Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split a single change document into two independently-templated sections — "变更申请单" (application) and "变更方案" (plan) — each backed by its own `change_doc_template`, displayed as tabs on the edit page, and exported as separate files.

**Architecture:** Add `application_template_id` and `plan_template_id` columns to `change_doc` (replacing `template_id`). `fields_data` remains a single merged JSON map — fields from both templates coexist because their `field_key` values don't overlap. `ExportService` routes export calls by template type. The frontend edit page shows two tabs; each tab renders fields from the corresponding template's `field_config`. A new `doc_type` column on `change_doc_template` (`application` | `plan`) lets admins know which template type to configure.

**Tech Stack:** Spring Boot 3.4.5, MyBatis-Plus, Flyway V13, Next.js 15, shadcn/ui Tabs, TanStack Query v5

---

## File Map

**Backend — new:**
- `backend/src/main/resources/db/migration/V13__dual_template.sql` — add columns, seed doc_type on existing templates, migrate existing template_id

**Backend — modified:**
- `entity/ChangeDoc.java` — replace `templateId` with `applicationTemplateId` + `planTemplateId`
- `entity/ChangeDocTemplate.java` — add `docType` field (`application` | `plan` | `general`)
- `dto/ChangeDocVO.java` — replace `templateId`/`templateName` with `applicationTemplateId`/`applicationTemplateName`/`planTemplateId`/`planTemplateName`; add `applicationFieldConfig`/`planFieldConfig`
- `dto/TemplateVO.java` — add `doc_type` field
- `dto/CreateChangeDocRequest.java` — replace `templateId` with `applicationTemplateId` + `planTemplateId`
- `dto/UpdateChangeDocRequest.java` — already uses `fieldsData` only, no change needed
- `ChangeDocService.java` — update `create()`, `toVO()`, `get()`, `generateAiContent()`
- `ExportService.java` — `exportDocx(doc, templateType, tenantId)` routes to application or plan template
- `ChangeDocController.java` — update export endpoints to accept `type` param

**Frontend — modified:**
- `frontend/src/app/(dashboard)/change-docs/new/page.tsx` — two template selectors (application + plan)
- `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx` — Tabs with "申请单" and "变更方案" tabs
- `frontend/src/app/(dashboard)/admin/change-doc-templates/page.tsx` — show `doc_type` badge per template

---

## Task 1: V13 Database Migration

**Files:**
- Create: `backend/src/main/resources/db/migration/V13__dual_template.sql`

- [ ] **Step 1: Write the migration**

```sql
-- V13: dual-template support for change_doc

-- 1. Add doc_type to change_doc_template
ALTER TABLE change_doc_template ADD COLUMN IF NOT EXISTS doc_type VARCHAR(32) NOT NULL DEFAULT 'general';

-- Seed existing templates with doc_type based on name heuristic
UPDATE change_doc_template SET doc_type = 'application' WHERE name LIKE '%申请%';
UPDATE change_doc_template SET doc_type = 'plan' WHERE name LIKE '%方案%';
-- Default template gets doc_type = general (shows in both selectors)

-- 2. Add application_template_id and plan_template_id to change_doc
ALTER TABLE change_doc ADD COLUMN IF NOT EXISTS application_template_id BIGINT REFERENCES change_doc_template(id);
ALTER TABLE change_doc ADD COLUMN IF NOT EXISTS plan_template_id BIGINT REFERENCES change_doc_template(id);

-- 3. Migrate existing template_id → application_template_id (best-effort)
UPDATE change_doc SET application_template_id = template_id WHERE template_id IS NOT NULL;

-- Note: template_id column is kept for now (backward compat), not dropped in this migration
```

- [ ] **Step 2: Rebuild backend to apply migration**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | tail -5
docker compose up -d backend
sleep 20
docker compose logs backend --tail=20 2>&1 | grep -E "migration|V13|ERROR|started"
```

Expected: `Successfully applied 1 migration to schema "public", now at version v13`

- [ ] **Step 3: Verify columns exist**

```bash
docker compose exec postgres psql -U platform_user -d cwgsyw_platform \
  -c "\d change_doc" | grep -E "template|doc_type" \
  -c "\d change_doc_template" | grep doc_type
```

Expected: `application_template_id`, `plan_template_id` in `change_doc`; `doc_type` in `change_doc_template`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/migration/V13__dual_template.sql
git commit -m "feat: V13 migration - dual template columns on change_doc"
```

---

## Task 2: Backend Entity + DTO Updates

**Files:**
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDoc.java`
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocTemplate.java`
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/ChangeDocVO.java`
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/TemplateVO.java`
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/CreateChangeDocRequest.java`

- [ ] **Step 1: Update ChangeDoc entity**

Replace the `templateId` field with dual fields in `ChangeDoc.java`:

```java
// Remove:
//     private Long templateId;
// Add after fieldsData:

    private Long applicationTemplateId;
    private Long planTemplateId;
    // Keep templateId for backward compat (existing rows), mark as deprecated
    @Deprecated
    private Long templateId;
```

Full file `/Volumes/Work/AI/cwgsyw-platform/backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDoc.java`:

```java
package com.cwgsyw.platform.module.changedoc.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName(value = "change_doc", autoResultMap = true)
public class ChangeDoc {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String changeNo;
    private String title;
    private String status;
    private Long applicantId;
    private LocalDateTime applyTime;
    private String changeDesc;
    private String impactScope;
    private String changeWindow;
    private String resourceSupport;
    private String background;
    private String steps;
    private String riskAssessment;
    private String rollbackPlan;
    private String verifyMethod;
    private String contacts;
    private LocalDateTime approvedAt;
    private Long approverId;
    private String approverComment;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private Long deletedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long createdBy;

    /** @deprecated use applicationTemplateId / planTemplateId */
    @Deprecated
    private Long templateId;

    private Long applicationTemplateId;
    private Long planTemplateId;

    @TableField(typeHandler = com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler.class)
    private java.util.Map<String, String> fieldsData;
}
```

- [ ] **Step 2: Update ChangeDocTemplate entity — add docType**

```java
// In ChangeDocTemplate.java, add after isActive:
    private String docType;   // "application" | "plan" | "general"
```

Full file `/Volumes/Work/AI/cwgsyw-platform/backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocTemplate.java`:

```java
package com.cwgsyw.platform.module.changedoc.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("change_doc_template")
public class ChangeDocTemplate {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String name;
    private String description;
    private Integer version;
    private Boolean isActive;
    private String docxKey;
    private String docType;   // application | plan | general
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

- [ ] **Step 3: Update TemplateVO — add doc_type**

Full file `/Volumes/Work/AI/cwgsyw-platform/backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/TemplateVO.java`:

```java
package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.util.List;

@Data
public class TemplateVO {
    private Long id;
    private String name;
    private String description;
    private Integer version;
    private boolean isActive;
    private boolean hasDocx;
    private String docType;
    private List<FieldConfigVO> fields;
    private String createdAt;
}
```

- [ ] **Step 4: Update ChangeDocVO — dual template fields**

Full file `/Volumes/Work/AI/cwgsyw-platform/backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/ChangeDocVO.java`:

```java
package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
public class ChangeDocVO {
    private Long id;
    private String changeNo;
    private String status;
    private Long applicantId;
    private String applicantName;
    private LocalDateTime applyTime;
    private LocalDateTime approvedAt;
    private Long approverId;
    private String approverName;
    private String approverComment;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // dual template
    private Long applicationTemplateId;
    private String applicationTemplateName;
    private Long planTemplateId;
    private String planTemplateName;

    // dynamic field data and config
    private Map<String, String> fieldsData;
    private List<FieldConfigVO> applicationFieldConfig;
    private List<FieldConfigVO> planFieldConfig;
}
```

- [ ] **Step 5: Update CreateChangeDocRequest**

Full file `/Volumes/Work/AI/cwgsyw-platform/backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/CreateChangeDocRequest.java`:

```java
package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.util.Map;

@Data
public class CreateChangeDocRequest {
    private String changeNo;
    private Long applicationTemplateId;
    private Long planTemplateId;
    private Map<String, String> fieldsData;
}
```

- [ ] **Step 6: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/backend && ./mvnw compile -q 2>&1 | tail -20
```

Expected: BUILD SUCCESS (there will be compilation errors in ChangeDocService until Task 3 — that's OK, fix in next task)

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/changedoc/
git commit -m "feat: dual-template entity and DTO changes"
```

---

## Task 3: ChangeDocService Updates

**Files:**
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java`

The key changes:
1. `create()` — use `applicationTemplateId` + `planTemplateId` instead of `templateId`
2. `toVO()` — populate `applicationTemplateName`, `planTemplateName` (need template name lookup)
3. `get()` — populate `applicationFieldConfig` + `planFieldConfig` separately
4. `generateAiContent()` — look up field from either template

- [ ] **Step 1: Read current ChangeDocService to understand what needs changing**

```bash
cat /Volumes/Work/AI/cwgsyw-platform/backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java
```

- [ ] **Step 2: Update the `create()` method**

Find this block in `create()` (around line 154–175):
```java
doc.setTemplateId(req.getTemplateId());
doc.setFieldsData(req.getFieldsData());

// Derive legacy title column from fieldsData; fall back to changeNo to satisfy NOT NULL
Map<String, String> fd = req.getFieldsData();
String derivedTitle = (fd != null && fd.containsKey("title")) ? fd.get("title") : doc.getChangeNo();
doc.setTitle(derivedTitle);
```

Replace with:
```java
doc.setApplicationTemplateId(req.getApplicationTemplateId());
doc.setPlanTemplateId(req.getPlanTemplateId());
doc.setFieldsData(req.getFieldsData());

Map<String, String> fd = req.getFieldsData();
String derivedTitle = (fd != null && fd.containsKey("title")) ? fd.get("title") : doc.getChangeNo();
doc.setTitle(derivedTitle);
```

- [ ] **Step 3: Update `toVO()` — add template name lookup**

`toVO()` currently sets `templateId` and `templateName`. Replace with dual template fields. The method needs `ChangeDocTemplateMapper` to look up names — it's already injected as `changeDocTemplateMapper`.

Find the block in `toVO()` that sets template fields (around line 68–80):
```java
vo.setTemplateId(doc.getTemplateId());
// ...
vo.setTemplateName(...);
```

Replace with:
```java
vo.setApplicationTemplateId(doc.getApplicationTemplateId());
vo.setPlanTemplateId(doc.getPlanTemplateId());
if (doc.getApplicationTemplateId() != null) {
    ChangeDocTemplate appTpl = changeDocTemplateMapper.selectById(doc.getApplicationTemplateId());
    vo.setApplicationTemplateName(appTpl != null ? appTpl.getName() : null);
}
if (doc.getPlanTemplateId() != null) {
    ChangeDocTemplate planTpl = changeDocTemplateMapper.selectById(doc.getPlanTemplateId());
    vo.setPlanTemplateName(planTpl != null ? planTpl.getName() : null);
}
```

- [ ] **Step 4: Update `get()` — populate dual fieldConfig**

Find the block in `get()` that sets `fieldConfig` (around line 340–365):
```java
if (doc.getTemplateId() != null) {
    List<FieldConfigVO> fieldConfig = changeDocFieldMapper.findByTemplate(doc.getTemplateId())
    ...
    vo.setFieldConfig(fieldConfig);
}
```

Replace with:
```java
if (doc.getApplicationTemplateId() != null) {
    List<ChangeDocField> appFields = changeDocFieldMapper.findByTemplate(doc.getApplicationTemplateId());
    List<FieldConfigVO> appFieldVOs = appFields.stream().map(f -> {
        FieldConfigVO fvo = new FieldConfigVO();
        fvo.setId(f.getId());
        fvo.setFieldKey(f.getFieldKey());
        fvo.setLabel(f.getLabel());
        fvo.setFieldType(f.getFieldType());
        fvo.setRequired(f.getRequired());
        fvo.setInForm(f.getInForm());
        fvo.setPlaceholder(f.getPlaceholder());
        fvo.setSortOrder(f.getSortOrder());
        return fvo;
    }).collect(java.util.stream.Collectors.toList());
    vo.setApplicationFieldConfig(appFieldVOs);
}
if (doc.getPlanTemplateId() != null) {
    List<ChangeDocField> planFields = changeDocFieldMapper.findByTemplate(doc.getPlanTemplateId());
    List<FieldConfigVO> planFieldVOs = planFields.stream().map(f -> {
        FieldConfigVO fvo = new FieldConfigVO();
        fvo.setId(f.getId());
        fvo.setFieldKey(f.getFieldKey());
        fvo.setLabel(f.getLabel());
        fvo.setFieldType(f.getFieldType());
        fvo.setRequired(f.getRequired());
        fvo.setInForm(f.getInForm());
        fvo.setPlaceholder(f.getPlaceholder());
        fvo.setSortOrder(f.getSortOrder());
        return fvo;
    }).collect(java.util.stream.Collectors.toList());
    vo.setPlanFieldConfig(planFieldVOs);
}
```

- [ ] **Step 5: Update `generateAiContent()` — search both templates**

Find the block that looks up `fieldConfig` by `templateId` (around line 265):
```java
List<ChangeDocField> fields = changeDocFieldMapper.findByTemplate(doc.getTemplateId());
```

Replace with:
```java
List<ChangeDocField> fields = new java.util.ArrayList<>();
if (doc.getApplicationTemplateId() != null) {
    fields.addAll(changeDocFieldMapper.findByTemplate(doc.getApplicationTemplateId()));
}
if (doc.getPlanTemplateId() != null) {
    fields.addAll(changeDocFieldMapper.findByTemplate(doc.getPlanTemplateId()));
}
```

- [ ] **Step 6: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/backend && ./mvnw compile -q 2>&1 | tail -20
```

Expected: BUILD SUCCESS

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java
git commit -m "feat: ChangeDocService dual-template support"
```

---

## Task 4: ExportService + ChangeDocController Updates

**Files:**
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ExportService.java`
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocController.java`

Export now takes a `type` parameter: `application` or `plan`, and routes to the appropriate template.

- [ ] **Step 1: Update ExportService.exportDocx() to accept template type**

Change the signature from:
```java
public byte[] exportDocx(ChangeDocVO doc, String tenantId)
```
to:
```java
public byte[] exportDocx(ChangeDocVO doc, String templateType, String tenantId)
```

Inside `exportDocx`, route by `templateType`:
```java
public byte[] exportDocx(ChangeDocVO doc, String templateType, String tenantId) {
    Long templateId = "plan".equals(templateType) ? doc.getPlanTemplateId() : doc.getApplicationTemplateId();
    if (templateId != null) {
        try {
            return templateService.fillDocx(templateId, doc.getFieldsData());
        } catch (IllegalStateException e) {
            // no .docx uploaded yet, fall through to programmatic
        }
    }
    try (XWPFDocument xdoc = "plan".equals(templateType) ? buildPlanDocument(doc) : buildApplicationDocument(doc);
         ByteArrayOutputStream out = new ByteArrayOutputStream()) {
        xdoc.write(out);
        return out.toByteArray();
    } catch (Exception e) {
        throw new RuntimeException("生成 Word 文档失败: " + e.getMessage(), e);
    }
}
```

- [ ] **Step 2: Split buildDocument() into buildApplicationDocument() and buildPlanDocument()**

Rename the current `buildDocument()` to `buildApplicationDocument()` (it already contains the application fields). Add a new `buildPlanDocument()`:

```java
private XWPFDocument buildApplicationDocument(ChangeDocVO doc) {
    XWPFDocument xdoc = new XWPFDocument();
    setPageMargins(xdoc);
    addTitle(xdoc, "变更申请单");
    addField(xdoc, "变更编号", doc.getChangeNo());
    addField(xdoc, "申请人",   doc.getApplicantName());
    addField(xdoc, "申请时间", doc.getApplyTime() != null ? doc.getApplyTime().format(FMT) : "");
    addField(xdoc, "变更标题", fieldOf(doc, "title"));
    addField(xdoc, "变更内容描述", fieldOf(doc, "change_desc"));
    addField(xdoc, "影响范围",     fieldOf(doc, "impact_scope"));
    addField(xdoc, "变更时间窗口", fieldOf(doc, "change_window"));
    addField(xdoc, "资源支持说明", fieldOf(doc, "resource_support"));
    if ("approved".equals(doc.getStatus())) {
        addField(xdoc, "审批人",   doc.getApproverName());
        addField(xdoc, "审批时间", doc.getApprovedAt() != null ? doc.getApprovedAt().format(FMT) : "");
        addField(xdoc, "审批意见", doc.getApproverComment());
    } else {
        addField(xdoc, "审批签字", "");
        addField(xdoc, "审批日期", "");
    }
    return xdoc;
}

private XWPFDocument buildPlanDocument(ChangeDocVO doc) {
    XWPFDocument xdoc = new XWPFDocument();
    setPageMargins(xdoc);
    addTitle(xdoc, "变更方案");
    addSection(xdoc, "一、背景与目的",         fieldOf(doc, "background"));
    addSection(xdoc, "二、详细操作步骤",       fieldOf(doc, "steps"));
    addSection(xdoc, "三、风险评估与应对措施", fieldOf(doc, "risk_assessment"));
    addSection(xdoc, "四、回滚计划",           fieldOf(doc, "rollback_plan"));
    addSection(xdoc, "五、验证方法",           fieldOf(doc, "verify_method"));
    addSection(xdoc, "六、相关人员联系方式",   fieldOf(doc, "contacts"));
    return xdoc;
}
```

Also update `exportPdfDirect()` to accept `templateType` and render only the relevant sections.

- [ ] **Step 3: Update ChangeDocController export endpoints**

Current endpoint:
```java
@GetMapping("/{id}/export/{format}")
public ResponseEntity<byte[]> export(@PathVariable Long id, @PathVariable String format, ...)
```

Change to accept `type` query param:
```java
@GetMapping("/{id}/export/{format}")
public ResponseEntity<byte[]> export(
    @PathVariable Long id,
    @PathVariable String format,
    @RequestParam(defaultValue = "application") String type,
    @AuthenticationPrincipal SecurityUser user) {
    ChangeDocVO doc = changeDocService.get(user.getTenantId(), id);
    byte[] bytes;
    String filename;
    String suffix = "application".equals(type) ? "变更申请单" : "变更方案";
    if ("pdf".equals(format)) {
        bytes = exportService.exportPdfDirect(doc, type, user.getTenantId());
        filename = doc.getChangeNo() + "-" + suffix + ".pdf";
        return ResponseEntity.ok()
            .header("Content-Disposition", "attachment; filename*=UTF-8''" + java.net.URLEncoder.encode(filename, java.nio.charset.StandardCharsets.UTF_8))
            .contentType(org.springframework.http.MediaType.APPLICATION_PDF)
            .body(bytes);
    } else {
        bytes = exportService.exportDocx(doc, type, user.getTenantId());
        filename = doc.getChangeNo() + "-" + suffix + ".docx";
        return ResponseEntity.ok()
            .header("Content-Disposition", "attachment; filename*=UTF-8''" + java.net.URLEncoder.encode(filename, java.nio.charset.StandardCharsets.UTF_8))
            .contentType(org.springframework.http.MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
            .body(bytes);
    }
}
```

- [ ] **Step 4: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/backend && ./mvnw compile -q 2>&1 | tail -20
```

Expected: BUILD SUCCESS

- [ ] **Step 5: Update ChangeDocTemplateService.listByDocType()**

Add a new query method to `ChangeDocTemplateService` so the frontend can filter templates by type:

```java
// In ChangeDocTemplateService.java, add:
public List<TemplateVO> listByDocType(String tenantId, String docType) {
    // returns templates where doc_type = docType OR doc_type = 'general', active only
    List<ChangeDocTemplate> templates = changeDocTemplateMapper.findByTenantAndDocType(tenantId, docType);
    return templates.stream().map(this::toVO).collect(java.util.stream.Collectors.toList());
}
```

Add to `ChangeDocTemplateMapper.java`:
```java
@Select("SELECT * FROM change_doc_template WHERE tenant_id = #{tenantId} AND is_active = true AND (doc_type = #{docType} OR doc_type = 'general') ORDER BY id")
List<ChangeDocTemplate> findByTenantAndDocType(@Param("tenantId") String tenantId, @Param("docType") String docType);
```

Add to `ChangeDocTemplateController.java`:
```java
@GetMapping("/by-type")
@PreAuthorize("hasAuthority('change_doc_template:read') or hasAuthority('change_doc:create')")
public R<List<TemplateVO>> listByType(@RequestParam String docType, @AuthenticationPrincipal SecurityUser user) {
    return R.ok(templateService.listByDocType(user.getTenantId(), docType));
}
```

- [ ] **Step 6: Build and restart**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | tail -5
docker compose up -d backend
sleep 20
docker compose logs backend --tail=15 2>&1 | grep -E "Started|ERROR"
```

Expected: `Started PlatformApplication`

- [ ] **Step 7: Smoke test**

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | jq -r '.data.token')

# Test list by type
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost/api/admin/change-doc-templates/by-type?docType=application" | jq '.data | length'
```

Expected: at least 1 (the default template has `doc_type = general` so it appears in all queries)

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/changedoc/
git commit -m "feat: ExportService dual-template routing + ChangeDocTemplateController by-type endpoint"
```

---

## Task 5: Frontend — New Document Page (Dual Template Selection)

**Files:**
- Modify: `frontend/src/app/(dashboard)/change-docs/new/page.tsx`

The new page shows two template selectors: one for 申请单 (application), one for 变更方案 (plan). Both are optional — user can select none, one, or both.

- [ ] **Step 1: Update TemplateVO interface and template queries**

Replace the existing single template query with two queries in `new/page.tsx`:

```tsx
interface TemplateVO {
  id: number
  name: string
  description: string
  has_docx: boolean
  is_active: boolean
  doc_type: string
}

// Two queries — one per doc type
const { data: appTemplates = [] } = useQuery<TemplateVO[]>({
  queryKey: ['change-doc-templates-application'],
  queryFn: () => api.get('/admin/change-doc-templates/by-type?docType=application').then(r => r.data.data),
})

const { data: planTemplates = [] } = useQuery<TemplateVO[]>({
  queryKey: ['change-doc-templates-plan'],
  queryFn: () => api.get('/admin/change-doc-templates/by-type?docType=plan').then(r => r.data.data),
})
```

- [ ] **Step 2: Update form state and submit**

```tsx
const [selectedAppTemplate, setSelectedAppTemplate] = useState<TemplateVO | null>(null)
const [selectedPlanTemplate, setSelectedPlanTemplate] = useState<TemplateVO | null>(null)

// When submitting:
const submitDoc = async () => {
  const res = await api.post('/change-docs', {
    application_template_id: selectedAppTemplate?.id ?? null,
    plan_template_id: selectedPlanTemplate?.id ?? null,
    fields_data: fieldsData,
  })
  router.push(`/change-docs/${res.data.data.id}`)
}
```

- [ ] **Step 3: Render two template selectors**

```tsx
<div className="space-y-4">
  <div>
    <Label className="text-sm font-medium">变更申请单模板</Label>
    <p className="text-xs text-muted-foreground mb-2">用于生成变更申请单文档</p>
    <div className="grid grid-cols-1 gap-2">
      {appTemplates.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => setSelectedAppTemplate(t)}
          className={`text-left p-3 border rounded-lg transition-colors ${selectedAppTemplate?.id === t.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
        >
          <p className="font-medium text-sm">{t.name}</p>
          {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">{t.has_docx ? '支持 Word 模板导出' : '纯文字模板'}</p>
        </button>
      ))}
    </div>
  </div>

  <div>
    <Label className="text-sm font-medium">变更方案模板</Label>
    <p className="text-xs text-muted-foreground mb-2">用于生成变更方案文档</p>
    <div className="grid grid-cols-1 gap-2">
      {planTemplates.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => setSelectedPlanTemplate(t)}
          className={`text-left p-3 border rounded-lg transition-colors ${selectedPlanTemplate?.id === t.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
        >
          <p className="font-medium text-sm">{t.name}</p>
          {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">{t.has_docx ? '支持 Word 模板导出' : '纯文字模板'}</p>
        </button>
      ))}
    </div>
  </div>
</div>
```

- [ ] **Step 4: Show fields for both templates combined (when templates are selected)**

After both templates are selected, fetch their field configs and render combined fields:

```tsx
const { data: appDetail } = useQuery({
  queryKey: ['template-detail', selectedAppTemplate?.id],
  queryFn: () => api.get(`/admin/change-doc-templates/${selectedAppTemplate!.id}`).then(r => r.data.data),
  enabled: !!selectedAppTemplate,
})

const { data: planDetail } = useQuery({
  queryKey: ['template-detail', selectedPlanTemplate?.id],
  queryFn: () => api.get(`/admin/change-doc-templates/${selectedPlanTemplate!.id}`).then(r => r.data.data),
  enabled: !!selectedPlanTemplate,
})

const appFields: FieldConfigVO[] = (appDetail?.fields ?? []).filter((f: FieldConfigVO) => f.in_form)
const planFields: FieldConfigVO[] = (planDetail?.fields ?? []).filter((f: FieldConfigVO) => f.in_form)
```

Show in two separate sections (or allow proceed with just one set of fields).

- [ ] **Step 5: TypeScript check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | tail -15
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add "frontend/src/app/(dashboard)/change-docs/new/page.tsx"
git commit -m "feat: dual template selection on new change doc page"
```

---

## Task 6: Frontend — Edit Page with Tabs

**Files:**
- Modify: `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx`

Replace the current single-form view with a tabbed layout. shadcn/ui `Tabs` component already available.

- [ ] **Step 1: Add Tabs import**

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
```

- [ ] **Step 2: Update ChangeDocVO interface**

```tsx
interface ChangeDocVO {
  id: number
  changeNo: string
  status: string
  applicantId: number
  applicantName: string
  applyTime: string
  approvedAt: string | null
  approverId: number | null
  approverName: string | null
  approverComment: string | null
  createdAt: string
  updatedAt: string
  fieldsData: Record<string, string>
  applicationTemplateId: number | null
  applicationTemplateName: string | null
  planTemplateId: number | null
  planTemplateName: string | null
  applicationFieldConfig: FieldConfigVO[]
  planFieldConfig: FieldConfigVO[]
}
```

- [ ] **Step 3: Render tabs**

Replace the current `{/* Dynamic fields */}` section with:

```tsx
<Tabs defaultValue="application">
  <TabsList className="mb-4">
    {doc.applicationTemplateId && (
      <TabsTrigger value="application">
        申请单 {doc.applicationTemplateName && <span className="ml-1 text-xs text-muted-foreground">({doc.applicationTemplateName})</span>}
      </TabsTrigger>
    )}
    {doc.planTemplateId && (
      <TabsTrigger value="plan">
        变更方案 {doc.planTemplateName && <span className="ml-1 text-xs text-muted-foreground">({doc.planTemplateName})</span>}
      </TabsTrigger>
    )}
    {!doc.applicationTemplateId && !doc.planTemplateId && (
      <TabsTrigger value="fields">变更内容</TabsTrigger>
    )}
  </TabsList>

  {/* Application tab */}
  {doc.applicationTemplateId ? (
    <TabsContent value="application">
      <section className="border rounded-lg p-5">
        <div className="space-y-4">
          {(doc.applicationFieldConfig ?? [])
            .filter(f => f.in_form)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(field => renderField(field))}
        </div>
      </section>
    </TabsContent>
  ) : null}

  {/* Plan tab */}
  {doc.planTemplateId ? (
    <TabsContent value="plan">
      <section className="border rounded-lg p-5">
        <div className="space-y-4">
          {(doc.planFieldConfig ?? [])
            .filter(f => f.in_form)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(field => renderField(field))}
        </div>
      </section>
    </TabsContent>
  ) : null}

  {/* Fallback: no template selected */}
  {!doc.applicationTemplateId && !doc.planTemplateId && (
    <TabsContent value="fields">
      <p className="text-sm text-muted-foreground py-4">该变更单未绑定模板，无可编辑字段。</p>
    </TabsContent>
  )}
</Tabs>
```

Where `renderField` is a helper:

```tsx
const renderField = (field: FieldConfigVO) => {
  const value = fieldsData[field.field_key] ?? ''
  const isTextarea = field.field_type === 'textarea'
  return (
    <div key={field.field_key} className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
        {isDraft && isTextarea && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
            onClick={() => handleAiGenerate(field.field_key)}
            disabled={aiLoadingField === field.field_key}>
            <Sparkles className="h-3 w-3" />
            {aiLoadingField === field.field_key ? 'AI 生成中...' : 'AI 生成'}
          </Button>
        )}
      </div>
      {isDraft ? (
        isTextarea
          ? <Textarea value={value} onChange={e => setFieldsData(f => ({ ...f, [field.field_key]: e.target.value }))} rows={4} placeholder={field.placeholder ?? ''} />
          : <Input value={value} onChange={e => setFieldsData(f => ({ ...f, [field.field_key]: e.target.value }))} placeholder={field.placeholder ?? ''} />
      ) : (
        <p className="text-sm whitespace-pre-wrap">{value || <span className="text-muted-foreground italic">（空）</span>}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update export buttons**

Replace the current single export button with two:

```tsx
<div className="flex gap-2">
  <Button variant="outline" size="sm" onClick={() => handleExport('docx', 'application')} disabled={exporting || !doc.applicationTemplateId}>
    <Download className="h-4 w-4 mr-1" />申请单 .docx
  </Button>
  <Button variant="outline" size="sm" onClick={() => handleExport('docx', 'plan')} disabled={exporting || !doc.planTemplateId}>
    <Download className="h-4 w-4 mr-1" />方案 .docx
  </Button>
  <Button variant="outline" size="sm" onClick={() => handleExport('pdf', 'application')} disabled={exporting || !doc.applicationTemplateId}>
    <Download className="h-4 w-4 mr-1" />申请单 .pdf
  </Button>
  <Button variant="outline" size="sm" onClick={() => handleExport('pdf', 'plan')} disabled={exporting || !doc.planTemplateId}>
    <Download className="h-4 w-4 mr-1" />方案 .pdf
  </Button>
</div>
```

Update `handleExport` to pass type:

```tsx
const handleExport = async (format: 'pdf' | 'docx', type: 'application' | 'plan') => {
  setExporting(true)
  try {
    const res = await api.get(`/change-docs/${id}/export/${format}?type=${type}`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    const suffix = type === 'application' ? '变更申请单' : '变更方案'
    a.download = `${doc?.changeNo ?? 'change-doc'}-${suffix}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.error('导出失败')
  } finally {
    setExporting(false)
  }
}
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | tail -15
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add "frontend/src/app/(dashboard)/change-docs/[id]/page.tsx"
git commit -m "feat: tabbed edit view for dual-template change docs + per-type export"
```

---

## Task 7: Final Build + Integration Test

- [ ] **Step 1: Rebuild everything**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build 2>&1 | tail -10
docker compose up -d
sleep 25
docker compose ps
```

Expected: all 6 containers Up.

- [ ] **Step 2: Smoke test — create doc with dual templates**

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | jq -r '.data.token')

# Get template id (the default one)
TPL_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost/api/admin/change-doc-templates | jq -r '.data[0].id')

# Create doc with both templates pointing to the same template (for testing)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  http://localhost/api/change-docs \
  -d "{\"application_template_id\":$TPL_ID,\"plan_template_id\":$TPL_ID,\"fields_data\":{\"title\":\"测试双模板\",\"change_desc\":\"描述\"}}" | jq '{id:.data.id,changeNo:.data.change_no,appTplId:.data.application_template_id,planTplId:.data.plan_template_id}'
```

Expected: `id` present, both `application_template_id` and `plan_template_id` set.

- [ ] **Step 3: Smoke test — GET doc returns dual fieldConfig**

```bash
DOC_ID=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  http://localhost/api/change-docs \
  -d "{\"application_template_id\":$TPL_ID,\"plan_template_id\":$TPL_ID,\"fields_data\":{\"title\":\"dual test\"}}" | jq -r '.data.id')

curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/change-docs/$DOC_ID | \
  jq '{applicationFieldConfigCount:(.data.application_field_config|length), planFieldConfigCount:(.data.plan_field_config|length)}'
```

Expected: both counts > 0.

- [ ] **Step 4: Smoke test — export by type**

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost/api/change-docs/$DOC_ID/export/docx?type=application" -o /tmp/application.docx && echo "application.docx OK ($(wc -c < /tmp/application.docx) bytes)"

curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost/api/change-docs/$DOC_ID/export/docx?type=plan" -o /tmp/plan.docx && echo "plan.docx OK ($(wc -c < /tmp/plan.docx) bytes)"
```

Expected: both files > 1000 bytes.

- [ ] **Step 5: Tag release**

```bash
git tag v0.7.1-dual-template
echo "Tagged v0.7.1-dual-template"
```

---

## Self-Review

### Spec coverage
- ✅ Two documents per change: application (`application_template_id`) + plan (`plan_template_id`)
- ✅ Tab UI on edit page: "申请单" tab and "变更方案" tab
- ✅ Separate export per type (`?type=application` / `?type=plan`)
- ✅ Template admin: `doc_type` field distinguishes template purpose
- ✅ `fields_data` remains a single map (no key conflicts between application and plan fields)
- ✅ Backward compat: old `template_id` column retained, migrated to `application_template_id`

### No placeholders found.

### Type consistency
- `applicationTemplateId` / `planTemplateId` — consistent across `ChangeDoc`, `ChangeDocVO`, `CreateChangeDocRequest`
- `applicationFieldConfig` / `planFieldConfig` — consistent in `ChangeDocVO` (Java) and `ChangeDocVO` (TypeScript interface)
- Export endpoint: `?type=application` or `?type=plan` — used in both `ExportService.exportDocx(doc, templateType, tenantId)` and frontend `handleExport(format, type)`
- `doc_type` — snake_case in frontend VO (consistent with global Jackson `SNAKE_CASE`)
