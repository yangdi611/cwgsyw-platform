# 实现计划: 重构 changedoc 数据流

> 基于技术 spec: `.hermes_company/specs/2026-06-10-changedoc-refactor-tech-spec.md`
> 计划日期: 2026-06-10
> 状态: Ready_For_Dev

---

## 概述

本计划将重构拆解为 **5 个 Phase**，每个 Phase 可独立验证和部署。实现顺序从低风险到高风险递进。

---

## Phase 1: CI 代理接口（后端 + 前端解耦）

> 最低风险，独立可验证，无数据迁移依赖。

### Task 1.1: 新增 CiProxyService + DTO
**Files:** 
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/CiProxyService.java` (NEW)
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/CiSearchResultVO.java` (NEW)
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/CiItemVO.java` (NEW)
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/CiTopologyResultVO.java` (NEW)
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/CiNodeVO.java` (NEW)

**Step 1:** 创建 4 个 DTO 类（CiItemVO, CiSearchResultVO, CiNodeVO, CiTopologyResultVO）
**Step 2:** 创建 CiProxyService 类，注入 `CiInstanceService` 和 `CiTopologyService`
**Step 3:** 实现 `searchCis(tenantId, keyword, size) → CiSearchResultVO`
**Step 4:** 实现 `getTopology(tenantId, instanceId, depth) → CiTopologyResultVO`
**Step 5:** 写单元测试: mock cmdb service, 验证 DTO 转换正确性

### Task 1.2: 新增 Controller 代理端点
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocController.java`

**Step 1:** 在 ChangeDocController 中注入 `CiProxyService`
**Step 2:** 添加 `GET /api/change-docs/ci/search` 端点
**Step 3:** 添加 `GET /api/change-docs/ci/topology/{instanceId}` 端点
**Step 4:** 写集成测试: 验证权限控制 `@PreAuthorize("hasAuthority('change_doc:read')")`

### Task 1.3: 前端 ci_selector 改用代理接口
**Files:**
- `frontend/src/app/(dashboard)/change-docs/new/page.tsx`

**Step 1:** 修改 `ciSearchResult` queryFn: `/cmdb/instances/search` → `/change-docs/ci/search`
**Step 2:** 修改 `ciTopoResult` queryFn: `/cmdb/topology/` → `/change-docs/ci/topology/`
**Step 3:** 手动测试: 新建变更文档 → 使用 CI 选择器搜索 → 验证能正常搜索和显示拓扑
**Step 4:** 提交: `phase1: ci proxy — decouple ci_selector from /cmdb/* endpoints`

---

## Phase 2: 双模板前端对齐

> 中风险，UI 改动，无后端数据变更。

### Task 2.1: 更新前端 ChangeDocVO 类型定义
**Files:**
- `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx`
- `frontend/src/app/(dashboard)/change-docs/new/page.tsx`

**Step 1:** 在 `[id]/page.tsx` 中更新 `ChangeDocVO` interface: 
  - 移除 `templateId`, `templateName`, `fieldConfig`（旧单模板字段）
  - 添加 `applicationTemplateId`, `applicationTemplateName`, `planTemplateId`, `planTemplateName`
  - 添加 `applicationFieldConfig: FieldConfigVO[]`, `planFieldConfig: FieldConfigVO[]`

**Step 2:** 确认接口字段名与后端 VO 对齐（`field_key` 用 `fieldKey` 映射）

### Task 2.2: 详情页双模板渲染
**Files:**
- `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx`

**Step 1:** 修改 `visibleFields` 逻辑: 从单一 `doc.fieldConfig` 改为分别读取 `doc.applicationFieldConfig` 和 `doc.planFieldConfig`
**Step 2:** 渲染两个区域:
  - 「申请单」区域: 渲染 `applicationFieldConfig` 字段
  - 「变更方案」区域: 渲染 `planFieldConfig` 字段（如果存在）
**Step 3:** 标题栏显示双模板名: `{doc.applicationTemplateName}` + `{doc.planTemplateName ? ' + ' + doc.planTemplateName : ''}`
**Step 4:** 保留编辑/保存/提交/审批/导出功能不变
**Step 5:** 手动测试: 打开已有变更文档 → 双模板区域正确显示

### Task 2.3: 新建页双模板选择
**Files:**
- `frontend/src/app/(dashboard)/change-docs/new/page.tsx`

**Step 1:** 修改创建请求字段: `{ templateId }` → `{ applicationTemplateId, planTemplateId }`
**Step 2:** 改进模板选择 UI: 
  - Step 1: 必选申请单模板（下拉/选择卡片）
  - Step 2: 可选方案模板（第二步选择或并列选择）
**Step 3:** 分别加载两个模板的字段配置（两个独立的 `useQuery`）
**Step 4:** 渲染两个字段区域:
  - 「申请单字段」: 来自 applicationTemplateId 的 fields
  - 「方案字段」: 来自 planTemplateId 的 fields（如果选择）
**Step 5:** 手动测试: 创建新变更文档 → 选择双模板 → 填写字段 → 创建成功

### Task 2.4: 列表页显示双模板信息
**Files:**
- `frontend/src/app/(dashboard)/change-docs/page.tsx`

**Step 1:** 更新 `ChangeDocListItem` interface: `templateName` → `applicationTemplateName` + `planTemplateName`
**Step 2:** 渲染模板信息为双模板格式

---

## Phase 3: 实体层清理

> 高风险，需要先执行 migration，必须分步执行保证可回滚。

### Task 3.1: 编写 Migration SQL
**Files:**
- `backend/src/main/resources/db/migration/V${timestamp}__cleanup_changedoc_fields.sql` (NEW)

**Step 1:** 编写正向迁移 SQL:
  - `fields_data = COALESCE(fields_data, '{}'::jsonb) || jsonb_build_object('title', title)` 
  - 对所有 11 个冗余字段做同样处理
  - 已有的 fieldsData key 不被覆盖（`COALESCE` + `||` 保证）
**Step 2:** 编写反向回滚 SQL（生成备份表 `change_doc_backup`）
**Step 3:** 在测试 DB 上执行 migration，验证数据完整性
**Step 4:** 验证回滚操作能恢复原始数据

### Task 3.2: 移除 ChangeDoc 实体字段
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDoc.java`

**Step 1:** 移除 `@Deprecated private Long templateId`
**Step 2:** 移除以下字段: `title`, `changeDesc`, `impactScope`, `changeWindow`, `resourceSupport`, `background`, `steps`, `riskAssessment`, `rollbackPlan`, `verifyMethod`, `contacts`
**Step 3:** 编译检查: 所有引用这些字段的代码全部编译失败（预期行为）

### Task 3.3: 修复 ChangeDocService
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java`

**Step 1:** 修改 `create()` 方法:
  - 移除 `doc.setTitle(...)` 同步逻辑（title 完全由 fieldsData 承载）
  - 移除 `doc.setChangeNo(...)` 之外的旧字段 setter
**Step 2:** 修改 `update()` 方法:
  - 移除 `if (merged.containsKey("title")) { doc.setTitle(merged.get("title")); }` 同步逻辑
**Step 3:** 修改 `generateAiContent()` 方法:
  - 确认 key 映射: `fd.getOrDefault("change_desc", "")`, `fd.getOrDefault("impact_scope", "")`, `fd.getOrDefault("change_window", "")`
  - 输出 key 名确认: `background`, `steps`, `risk_assessment`, `rollback_plan`, `verify_method`
  - 移除 `req.getChangeDesc()`, `req.getImpactScope()`, `req.getChangeWindow()` fallback（AiGenerateRequest 简化）
**Step 4:** 运行现有单元测试，修复所有编译错误
**Step 5:** 确认所有测试通过

### Task 3.4: 修复 ExportService
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ExportService.java`

**Step 1:** 确认 `fieldOf(doc, key)` 方法中所有 key 名与 migration 后 fieldsData 一致:
  - `title`, `change_desc`, `impact_scope`, `change_window`, `resource_support`
  - `background`, `steps`, `risk_assessment`, `rollback_plan`, `verify_method`, `contacts`
**Step 2:** 确认 `exportDocx()` 中 `templateIdForExport` 逻辑正确（applicationTemplateId 优先，fallback planTemplateId）
**Step 3:** 写测试: mock ChangeDocVO，验证导出 PDF/Word 内容正确

### Task 3.5: 删除 DB 列
**Files:**
- Migration SQL 追加 DDL

**Step 1:** 在 migration 文件中追加:
```sql
ALTER TABLE change_doc 
  DROP COLUMN IF EXISTS template_id,
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS change_desc,
  DROP COLUMN IF EXISTS impact_scope,
  DROP COLUMN IF EXISTS change_window,
  DROP COLUMN IF EXISTS resource_support,
  DROP COLUMN IF EXISTS background,
  DROP COLUMN IF EXISTS steps,
  DROP COLUMN IF EXISTS risk_assessment,
  DROP COLUMN IF EXISTS rollback_plan,
  DROP COLUMN IF EXISTS verify_method,
  DROP COLUMN IF EXISTS contacts;
```
**Step 2:** 验证 DB schema 更新后应用启动正常

---

## Phase 4: AI 生成对齐 & 完善

> 低风险，独立的 AI 生成逻辑调整。

### Task 4.1: 重构 AiGenerateRequest
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/AiGenerateRequest.java`

**Step 1:** 简化 DTO: 改为 `fieldKey: String`（用户选中哪个字段请求 AI 生成）
**Step 2:** 更新 `generateAiContent()`: 根据 `fieldKey` 返回对应生成内容

### Task 4.2: AI prompt 重构
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java`

**Step 1:** 从 fieldsData 构建上下文:
```java
Map<String, String> fd = doc.getFieldsData() != null ? doc.getFieldsData() : Map.of();
String changeDesc = fd.getOrDefault("change_desc", "");
String impactScope = fd.getOrDefault("impact_scope", "");
String changeWindow = fd.getOrDefault("change_window", "");
```
**Step 2:** 调整 prompt 模板（保持不变）
**Step 3:** 写集成测试: 验证 AI 生成返回内容写入正确的 fieldsData key

---

## Phase 5: 回归测试 & 向后兼容验证

> 收尾阶段，全量回归。

### Task 5.1: 全量回归测试
**Step 1:** 运行全部后端单元测试和集成测试
**Step 2:** 手动测试全流程:
  - 新建变更文档（双模板 + CI 选择器）
  - 编辑 → 保存 → 提交 → 审批 → 导出 PDF/Word
  - AI 生成填写字段
  - 旧数据查看（migration 后）
**Step 3:** 权限测试: 验证 CI 代理接口权限控制

### Task 5.2: 文档更新
**Files:**
- `AGENTS.md` → 更新 changedoc 模块说明
- `ARCHITECTURE.md` → 追加 changedoc 模块解耦架构

---

## 依赖关系图

```
Phase 1 (CI 代理) ──────┐
                         ├──→ Phase 3 (实体层清理)
Phase 2 (双模板前端) ────┘        │
                                  ├──→ Phase 4 (AI 对齐)
                                  │        │
                                  └────────┼──→ Phase 5 (回归测试)
                                           │
Phase 1 + Phase 2 无相互依赖，可并行 ──────┘
```

---

## 预计工时

| Phase | 任务数 | 预计 |
|-------|--------|------|
| Phase 1 | 3 | 1h |
| Phase 2 | 4 | 2h |
| Phase 3 | 5 | 2.5h |
| Phase 4 | 2 | 0.5h |
| Phase 5 | 2 | 1h |
| **合计** | **16** | **~7h** |
