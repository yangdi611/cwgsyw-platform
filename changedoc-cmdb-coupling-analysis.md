# changedoc ↔ cmdb 耦合点分析报告

> 基于 PRD: `specs/2026-06-10-changedoc-refactor-prd.md`  
> 分析日期: 2026-06-10  
> 分析方法: 全文代码审查 (全量扫描 backend + frontend 源代码)

---

## 一、耦合点清单

### CP-1: 前端 ci_selector 直接调用 CMDB 搜索 API [CRITICAL · 直接调用]

| 维度 | 详情 |
|------|------|
| **位置** | `frontend/src/app/(dashboard)/change-docs/new/page.tsx` Line 78 |
| **调用代码** | `api.get('/cmdb/instances/search', { params: { keyword: ciSearch, size: 10 } })` |
| **目标** | `CiInstanceController.search()` → `GET /api/cmdb/instances/search` |
| **前端消费** | `res.data.data.records[]` → 每条取 `ci.id`, `ci.name`, `ci.model_id`, `ci.model_name` |
| **权限要求** | `@PreAuthorize("hasAuthority('cmdb_instance:read')")` — 用户必须同时拥有 cmdb 读权限 |
| **影响范围** | 新建变更文档页面的 CI 选择器功能，任何 CMDB API 的内部重构都可能破坏前端 |
| **变更成本** | **中** — 需在 changedoc Controller 新增 2 个代理端点，修改前端 2 处 API 调用，定义 changedoc 自有 DTO |

### CP-2: 前端 ci_selector 直接调用 CMDB 拓扑 API [CRITICAL · 直接调用]

| 维度 | 详情 |
|------|------|
| **位置** | `frontend/src/app/(dashboard)/change-docs/new/page.tsx` Line 86 |
| **调用代码** | `api.get(`/cmdb/topology/${ciTopoInstanceId}`, { params: { depth: 2 } })` |
| **目标** | `CiTopologyController.getTopology()` → `GET /api/cmdb/topology/{instanceId}` |
| **前端消费** | `res.data.data.nodes[]` → 每条取 `n.id`, `n.name`, `n.model_id`, `n.model_name`, `n.is_root` |
| **权限要求** | `@PreAuthorize("hasAuthority('cmdb_instance:read')")` — 同 CP-1 |
| **影响范围** | 关联 CI 建议功能（2层内拓扑扩散建议），依赖 CMDB 拓扑数据结构不变 |
| **变更成本** | **低**（与 CP-1 绑定实现，同为代理端点） |

### CP-3: 前端 DTO 类型耦合 [MEDIUM · 数据共享/类型依赖]

| 维度 | 详情 |
|------|------|
| **位置** | `frontend/src/app/(dashboard)/change-docs/new/page.tsx` Line 32, 76-78, 84-86 |
| **说明** | 前端 ci_selector 的类型定义 `CiSnapshot` 和 API 响应解构直接依赖 CMDB 后端 DTO 字段名 (`model_id`, `model_name`, `is_root`) |
| **风险** | CMDB 模块的 CiInstanceSearchVO / TopologyNodeVO 字段改名或重构会破坏 changedoc 前端 |
| **影响范围** | 变更 CMDB DTO 字段名时需同步改 changedoc 前端（隐形跨模块联动） |
| **变更成本** | **低** — 引入代理后，changedoc 定义自有 DTO，解除此耦合 |

### CP-4: 权限级联耦合 [MEDIUM · 权限依赖]

| 维度 | 详情 |
|------|------|
| **位置** | CMDB API 的 `@PreAuthorize("hasAuthority('cmdb_instance:read')")` |
| **说明** | 用户使用 ci_selector 需要同时拥有 `change_doc:create` 和 `cmdb_instance:read` 权限 |
| **风险** | 仅分配了 `change_doc:create` 而无 `cmdb_instance:read` 的用户，CI 选择器静默失败（API 403） |
| **影响范围** | 权限模型设计者可能不知道 changedoc 依赖 cmdb 权限 |
| **变更成本** | **低** — 代理端点使用 `change_doc:read` 权限内部调用 cmdb 服务层（绕过权限检查） |

### CP-5: 实体遗留字段耦合 [LOW · 数据迁移遗留]

| 维度 | 详情 |
|------|------|
| **位置** | `backend/.../changedoc/entity/ChangeDoc.java` Line 15-28, 42 |
| **说明** | 实体类保留 12 个字段列（changeDesc, impactScope, changeWindow, resourceSupport, background, steps, riskAssessment, rollbackPlan, verifyMethod, contacts, title）和 @Deprecated templateId |
| **当前状态** | Service 层已仅通过 fieldsData (Map) 读写，不再使用这些字段（title 除外，仍从 fieldsData 同步到 column 用于 NOT NULL 约束） |
| **数据库状态** | V9 migration 创建了这些列，V12 migration 将数据迁移到 fieldsData，V13 增加双模板列但未删除旧列 |
| **风险** | 数据库列和实体字段存在但无业务代码使用，造成维护迷惑 |
| **影响范围** | 仅 changedoc 内部，不影响 cmdb |
| **变更成本** | **中-高** — 需要编写 migration 删除列（不可逆），确保所有历史数据在 fieldsData 中有完整副本 |

### CP-6: 前端详情页接口未对齐后端 VO [LOW · 前端/后端不一致]

| 维度 | 详情 |
|------|------|
| **位置** | `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx` Line 27-43 |
| **说明** | 前端 `ChangeDocVO` 接口仍使用 `templateId`/`templateName`/`fieldConfig`（单模板模型），而后端已返回 `applicationTemplateId`/`applicationTemplateName`/`planTemplateId`/`planTemplateName`/`applicationFieldConfig`/`planFieldConfig` |
| **风险** | 双模板功能在前端详情页无法正确展示 |
| **影响范围** | 仅 changedoc 内部，不影响 cmdb |
| **变更成本** | **低** — 改接口定义 + 渲染逻辑 |

---

## 二、耦合度总览

```
┌─────────────────────────────────────────────────────────┐
│                    耦合关系图                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐     CP-1  HTTP  ────────────┐         │
│  │  Frontend    │──── GET /cmdb/instances/search│       │
│  │  (ci_selector)│─── GET /cmdb/topology/{id}   │       │
│  └──────┬───────┘       CP-2  HTTP  ────────────┤       │
│         │                                       │       │
│         │ CP-3 (DTO 类型依赖)                    │       │
│         │                                       ▼       │
│  ┌──────┴───────┐                        ┌──────────┐  │
│  │  change-docs │  ──── 无直接后端调用 ───▶│  CMDB    │  │
│  │  (前端页面)   │                        │  (后端)   │  │
│  └──────────────┘                        └──────────┘  │
│                                             ▲          │
│                                             │          │
│                                  CP-4 (权限级联)        │
│                                                         │
│  ┌──────────────────────────────────────────┐          │
│  │ changedoc 后端 (Java)                     │          │
│  │   - ChangeDocService   0 条 cmdb import   │          │
│  │   - ChangeDocController                  │          │
│  │   - ExportService                         │          │
│  │   - ChangeDocTemplateService              │          │
│  └──────────────────────────────────────────┘          │
│                                                         │
│  CMDB 后端 (Java)                                       │
│     - 0 条 changedoc import ✓                          │
│                                                         │
│  共同基础设施:                                           │
│     - 同一 PostgreSQL 数据库 (不同 table)                │
│     - 同一 User 模块 (用户名解析)                        │
│     - 同一 AuditLog (审计日志)                          │
│     - 同一 Security 框架 (权限控制)                      │
└─────────────────────────────────────────────────────────┘
```

**关键发现:** 后端层面 changedoc 和 cmdb 是**完全解耦**的（0 条交叉 import），所有耦合集中在**前端 ci_selector 对 cmdb API 的直接 HTTP 调用**。

---

## 三、高风险耦合区域识别

### 🔴 高风险 (需立即解耦)

| # | 耦合点 | 风险描述 |
|---|--------|---------|
| CP-1 | 前端直调 CMDB 搜索 | ⚠️ 最高风险。CMDB 任何接口变更（路径、参数、响应结构）直接破坏 changedoc 新建页。受影响的用户路径: `/change-docs/new` → ci_selector 搜索 |
| CP-2 | 前端直调 CMDB 拓扑 | 与 CP-1 绑定，CMDB 拓扑算法/DTO 变更直接影响 changedoc 关联推荐功能 |
| CP-4 | 权限级联 | 安全边界模糊 — changedoc 功能的可用性取决于 cmdb 权限是否分配，对管理员透明性差 |

### 🟡 中风险 (需配合重构)

| # | 耦合点 | 风险描述 |
|---|--------|---------|
| CP-3 | DTO 类型耦合 | 通过代理端点即可自然解耦 |
| CP-5 | 实体遗留字段 | 阻碍实体层清理，让新开发者误解数据模型 |

### 🟢 低风险 (非紧急)

| # | 耦合点 | 风险描述 |
|---|--------|---------|
| CP-6 | 前端 VO 不对齐 | 仅影响双模板显示，不影响 cmdb 耦合 |

---

## 四、解耦方案摘要 (对齐 PRD)

| 步骤 | 动作 | 对应验收标准 | 预估工作量 |
|------|------|-------------|-----------|
| 1 | 后端新增 `GET /api/change-docs/ci/search` 代理端点 → 内部调用 `CiInstanceService.searchAcrossModels()` | PRD 验收标准 3.1 | 1-2h |
| 2 | 后端新增 `GET /api/change-docs/ci/topology/{instanceId}` 代理端点 → 内部调用 `CiTopologyService.getTopology()` | PRD 验收标准 3.1 | 1h |
| 3 | 定义 changedoc 自有 CI DTO (`CiSearchVO`, `CiTopologyNodeVO`)，不依赖 cmdb DTO 包 | PRD 验收标准 3.3 | 0.5h |
| 4 | 前端 ci_selector 改为调用 `/api/change-docs/ci/*` 代理端点 | PRD 验收标准 3.2 | 1h |
| 5 | 前端详情页对齐双模板 VO (`applicationFieldConfig` / `planFieldConfig`) | PRD 验收标准 2.1, 2.2 | 1h |
| 6 | 清理 ChangeDoc 实体遗留字段 + migration 删除数据库列 | PRD 验收标准 1.1, 1.2, 1.3 | 2h |
| 7 | 新增代理端点集成测试 | PRD 验收标准 3.4 (测试) | 1h |

---

## 五、关键文件清单

### 需要修改
| 文件 | 当前状态 | 目标 |
|------|---------|------|
| `backend/.../changedoc/ChangeDocController.java` | 无 CI 端点 | + 2 个代理端点 (search, topology) |
| `backend/.../changedoc/ChangeDocService.java` | 无 cmdb 调用 | + 注入 CiInstanceService, CiTopologyService |
| `backend/.../changedoc/dto/` | 无 CI DTO | + CiSearchVO.java, CiTopologyNodeVO.java |
| `frontend/src/app/(dashboard)/change-docs/new/page.tsx` | 直调 /cmdb/* | 改为 /change-docs/ci/* |
| `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx` | 单模板 VO | 双模板 VO |
| `backend/.../changedoc/entity/ChangeDoc.java` | 12 遗留字段 + @Deprecated | 移除冗余、仅保留 title, fieldsData, 双模板ID |
| `backend/.../db/migration/V*__cleanup_change_doc.sql` | 不存在 | 新 migration 丢弃旧列 |

### 无需修改 (已验证)
| 模块 | 文件 | 原因 |
|------|------|------|
| CMDB (后端) | 全部 `.java` | 0 条 changedoc 引用，CMDB 独立演进 |
| ExportService | `ExportService.java` | 无 cmdb import，仅用 fieldsData |
| ChangeDocTemplateService | `ChangeDocTemplateService.java` | 无 cmdb import |
| AI 模块 | `AiGatewayService.java` | 无 cmdb import |

---

*分析完成。下一步: 变更代理端点实现 (CP-1, CP-2, CP-3, CP-4 一并解耦)，然后清理实体 + 前端对齐。*
