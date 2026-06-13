# 技术方案: 重构 changedoc 数据流，降低与 cmdb 的耦合

> 基于 PRD: `specs/2026-06-10-changedoc-refactor-prd.md`
> 状态: DRAFT

---

## 1. 架构决策

### 决策 1: 实体层清理策略

**方案**: 分阶段删除 — migration 先行，代码修改在后。

| 阶段 | 内容 | 回滚方式 |
|------|------|----------|
| Phase 1 | 执行 DB migration: 将 `changeDesc`, `impactScope`, `changeWindow`, `resourceSupport`, `background`, `steps`, `riskAssessment`, `rollbackPlan`, `verifyMethod`, `contacts`, `title` 合并到 `fields_data` JSONB | migration 脚本提供反向操作 |
| Phase 2 | 删除实体类中对应字段，移除所有 Mapper/Service 中对这些字段的直接引用 | 代码回滚 + migration 回滚 |
| Phase 3 | 删除 `@Deprecated templateId` 字段和列 | 同上 |

**替代方案**: 一次全部删除 → 风险高，数据丢失恢复困难。

**影响模块**: `ChangeDoc.java`, `ChangeDocService.java`, `ExportService.java`, `ChangeDocMapper.java`, 前端所有 changedoc 页面

---

### 决策 2: CI 代理接口设计

**方案**: 在 changedoc Controller 中新增两个代理端点，内部注入 cmdb 服务。

```
GET  /api/change-docs/ci/search?keyword=xxx
GET  /api/change-docs/ci/topology/{instanceId}?depth=2
```

**替代方案**: 
- 前端 BFF 层代理 → 引入额外复杂度
- changedoc Service 直接暴露 cmdb Service Bean → 方案可行但不封装

**为什么选 Controller 代理**:
- 最小修改面（只加两个方法，注入 cmdb 服务）
- 权限控制一致（沿用 `change_doc:read`）
- DTO 隔离清晰（changedoc 定义自己的 CI DTO）

---

### 决策 3: 双模板前端策略

**方案**: 新建页支持"申请单模板 + 方案模板"并列选择（两步走）。

Step 1: 选择申请单模板（必选）
Step 2: 选择方案模板（可选）
Step 3: 分别渲染 applicationFieldConfig 和 planFieldConfig 区域

**影响**: `new/page.tsx` 重构，`[id]/page.tsx` 模板渲染逻辑调整，前端 API 类型定义更新

---

### 决策 4: ExportService 对齐策略

**方案**: 保持 `fieldOf(doc, key)` 模式（已从 fieldsData 读取），移除对旧实体字段的引用。

Export 逻辑已通过 `fieldOf()` 间接从 fieldsData 读取值 — 无需大幅改动。只需：
1. 确认所有 key 名与 migration 后 fieldsData 一致
2. 双模板 Word 导出正确选择模板文件（applicationTemplateId vs planTemplateId）

---

### 决策 5: AI 生成对齐策略

**方案**: 重构 `generateAiContent()` 的 prompt 构建，完全从 fieldsData 读取。

当前 `generateAiContent` 已有 fallback 逻辑（`req.getXxx() != null ? req : fd.getOrDefault(...)`），但 key 映射关系和 PRD 有出入。重构为：
- 从 fieldsData 读取 `change_desc`, `impact_scope`, `change_window` 作为 prompt 输入
- 输出 key 对齐 fieldsData 约定：`background`, `steps`, `risk_assessment`, `rollback_plan`, `verify_method`

---

## 2. 接口契约

### 2.1 CI 搜索代理接口（新增）

```
GET /api/change-docs/ci/search?keyword={keyword}&size={size}
```

**权限**: `change_doc:read`

**Response**:
```json
{
  "code": 0,
  "data": {
    "records": [
      {
        "id": 1,
        "name": "prod-web-server-01",
        "modelId": "server",
        "modelName": "服务器"
      }
    ],
    "total": 5
  },
  "message": "ok"
}
```

**DTO**: `CiSearchResultVO` (changedoc 自定义)
```java
@Data
public class CiSearchResultVO {
    private List<CiItemVO> records;
    private long total;
}

@Data
public class CiItemVO {
    private Long id;
    private String name;
    private String modelId;
    private String modelName;
}
```

### 2.2 CI 拓扑代理接口（新增）

```
GET /api/change-docs/ci/topology/{instanceId}?depth=2
```

**权限**: `change_doc:read`

**Response**:
```json
{
  "code": 0,
  "data": {
    "nodes": [
      {
        "id": 1,
        "name": "prod-web-server-01",
        "modelId": "server",
        "modelName": "服务器",
        "isRoot": true
      }
    ]
  },
  "message": "ok"
}
```

**DTO**: `CiTopologyResultVO` (changedoc 自定义)
```java
@Data
public class CiTopologyResultVO {
    private List<CiNodeVO> nodes;
}

@Data
public class CiNodeVO {
    private Long id;
    private String name;
    private String modelId;
    private String modelName;
    private Boolean isRoot;
}
```

### 2.3 ChangeDocVO（修改）

后端 VO 当前已正确支持双模板（`applicationTemplateId`, `applicationTemplateName`, `planTemplateId`, `planTemplateName`, `applicationFieldConfig`, `planFieldConfig`）— 无需修改后端 VO。前端接口定义需对齐。

### 2.4 CreateChangeDocRequest（不变）

当前已使用 `applicationTemplateId` 和 `planTemplateId` — 无需修改。前端需从 `templateId`（旧）改为 `applicationTemplateId` + `planTemplateId`。

---

## 3. 数据模型

### 3.1 Migration: 旧字段 → fieldsData

```sql
-- 正向迁移
UPDATE change_doc SET fields_data = 
  COALESCE(fields_data, '{}'::jsonb)
  || CASE WHEN title IS NOT NULL AND title != '' 
     THEN jsonb_build_object('title', title) ELSE '{}'::jsonb END
  || CASE WHEN change_desc IS NOT NULL AND change_desc != '' 
     THEN jsonb_build_object('change_desc', change_desc) ELSE '{}'::jsonb END
  || CASE WHEN impact_scope IS NOT NULL AND impact_scope != '' 
     THEN jsonb_build_object('impact_scope', impact_scope) ELSE '{}'::jsonb END
  -- ... 其余字段同理
WHERE 
  change_desc IS NOT NULL OR impact_scope IS NOT NULL OR 
  change_window IS NOT NULL OR resource_support IS NOT NULL OR
  background IS NOT NULL OR steps IS NOT NULL OR 
  risk_assessment IS NOT NULL OR rollback_plan IS NOT NULL OR
  verify_method IS NOT NULL OR contacts IS NOT NULL;

-- 删除列（Phase 2 执行）
ALTER TABLE change_doc 
  DROP COLUMN IF EXISTS template_id,
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

### 3.2 fieldsData Key 约定

| Key | 含义 | 来源 |
|-----|------|------|
| `title` | 变更标题 | 旧 title 列 |
| `change_desc` | 变更描述 | 旧 changeDesc 列 |
| `impact_scope` | 影响范围 | 旧 impactScope 列 |
| `change_window` | 变更时间窗口 | 旧 changeWindow 列 |
| `resource_support` | 资源支持说明 | 旧 resourceSupport 列 |
| `background` | 背景与目的 | AI 生成 / 旧 background 列 |
| `steps` | 详细操作步骤 | AI 生成 / 旧 steps 列 |
| `risk_assessment` | 风险评估 | AI 生成 / 旧 riskAssessment 列 |
| `rollback_plan` | 回滚计划 | AI 生成 / 旧 rollbackPlan 列 |
| `verify_method` | 验证方法 | AI 生成 / 旧 verifyMethod 列 |
| `contacts` | 相关人员联系方式 | 旧 contacts 列 |
| `affected_cis` | 影响的 CI 列表 (JSON) | CI 选择器 |

---

## 4. 数据流

### 4.1 CI 选择器（解耦后）

```
 User                 Frontend                changedoc                  cmdb
  │                      │                       │                        │
  │  点击"添加 CI"       │                       │                        │
  │──────────────────────▶                       │                        │
  │                      │  GET /change-docs/ci/ │                        │
  │                      │  search?keyword=web   │                        │
  │                      │──────────────────────▶│                        │
  │                      │                       │  CiInstanceService     │
  │                      │                       │  .searchAcrossModels() │
  │                      │                       │───────────────────────▶│
  │                      │                       │◀───────────────────────│
  │                      │  CiSearchResultVO     │                        │
  │                      │◀──────────────────────│                        │
  │  展示搜索结果        │                       │                        │
  │◀──────────────────────                       │                        │
  │                      │                       │                        │
  │  选中 CI             │  GET /change-docs/ci/ │                        │
  │                      │  topology/{id}        │                        │
  │                      │──────────────────────▶│                        │
  │                      │                       │  CiTopologyService     │
  │                      │                       │  .getTopology()        │
  │                      │                       │───────────────────────▶│
  │                      │  CiTopologyResultVO   │◀───────────────────────│
  │                      │◀──────────────────────│                        │
  │  展示拓扑关联建议    │                       │                        │
  │◀──────────────────────                       │                        │
```

### 4.2 新建变更文档（重构后）

```
 User                 Frontend                    Backend (changedoc)
  │                      │                           │
  │  选择模板            │                           │
  │──────────────────────▶                           │
  │                      │  GET /admin/              │
  │                      │  change-doc-templates     │
  │                      │──────────────────────────▶│
  │                      │  [TemplateVO[], TemplateVO[]]
  │                      │◀──────────────────────────│
  │                      │  (frontend 区分申请单/方案) │
  │                      │                           │
  │  填写申请单字段      │                           │
  │──────────────────────▶                           │
  │                      │                           │
  │  选择方案模板(可选)  │  GET /admin/              │
  │──────────────────────▶  change-doc-templates/{id} │
  │                      │──────────────────────────▶│
  │                      │  TemplateVO (含 fields)   │
  │                      │◀──────────────────────────│
  │                      │                           │
  │  填写方案字段        │                           │
  │──────────────────────▶                           │
  │                      │                           │
  │  创建                │  POST /change-docs        │
  │──────────────────────▶ {applicationTemplateId,   │
  │                      │  planTemplateId,          │
  │                      │  fieldsData}              │
  │                      │──────────────────────────▶│
  │                      │  ChangeDocVO              │
  │                      │◀──────────────────────────│
  │  跳转详情页          │                           │
  │◀──────────────────────                           │
```

---

## 5. 文件改动范围

### Backend (Java)
| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `ChangeDoc.java` | MODIFY | Phase 2: 移除 11 个冗余字段 + @Deprecated templateId |
| `ChangeDocService.java` | MODIFY | create(): 移除 setTitle() 同步逻辑; generateAiContent(): refactor prompt构建 |
| `ChangeDocController.java` | MODIFY | 新增 ci/search, ci/topology 两个代理端点 |
| `ExportService.java` | REVIEW | 确认 fieldOf() key 名正确（当前已正确） |
| `ChangeDocMapper.java` | MODIFY | 可能需要移除旧字段的条件查询 |
| `CiProxyService.java` | NEW | 封装 cmdb 服务调用，提供 changedoc DTO 转换 |
| Migration SQL | NEW | Phase 1: 数据迁移脚本 |

### Frontend (TypeScript/TSX)
| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `change-docs/[id]/page.tsx` | MODIFY | 双字段配置渲染 (applicationFieldConfig + planFieldConfig) |
| `change-docs/new/page.tsx` | MODIFY | 双模板选择 + ci_selector 改用代理接口 |
| `change-docs/page.tsx` | MODIFY | 列表显示双模板信息 |

---

## 6. 测试策略

| 维度 | 覆盖 |
|------|------|
| 单元测试 | `ChangeDocService.create()` 不写旧字段; `CiProxyService` 正确转换 DTO |
| 集成测试 | CI 代理接口权限控制、返回格式、cmdb 服务调用链 |
| 前端测试 | 双模板选择交互、CI 选择器数据流、详情页双区域渲染 |
| 迁移测试 | 旧数据 → fieldsData 完整性、回滚操作验证 |
| 兼容性测试 | 已有变更文档在迁移后正常查看/导出/审批 |

---

## 7. 风险与缓解

| 风险 | 级别 | 缓解 |
|------|------|------|
| 数据迁移失败导致字段数据丢失 | HIGH | migration 脚本先做备份表; 支持回滚 |
| 前端 API 类型不一致导致渲染空白 | MEDIUM | 后端 VO 接口测试先行; 前端渐进式对齐 |
| CI 代理接口增加延迟 | LOW | 代理仅做 DTO 转换,无额外 IO; 保持 < 500ms |
| 双模板选择 UX 复杂化 | MEDIUM | 两步走设计,方案模板可选,回退体验平滑 |
