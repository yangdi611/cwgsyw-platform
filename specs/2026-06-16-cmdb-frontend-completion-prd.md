# PRD: CMDB 前端全量补齐

> **目标**: 消除 CMDB 前端与后端 API 之间的全部差距，让 Tier 1–4 已实现的后端能力在前端 100% 可用。
> **前置**: Tier 1–4 后端已完成（10 个 Controller，40+ API 端点），前端有 16 个页面但存在严重的 API 路径不匹配和功能缺失。
> **下游**: Spec 由 Architect 在同一文件中追加技术方案。

---

## 1. 背景

### 1.1 现状

CMDB 模块后端已完成 Tier 1–4（模型/属性/实例/关联/拓扑/变更历史/CSV 导入/影响分析/2D 视图/变更统计/告警/跨模块联动），共 10 个 Controller 暴露 40+ REST 端点。

前端有 16 个 CMDB 页面（合计 4000+ 行代码），浏览器验收报告（2026-06-14）确认所有页面返回 HTTP 200。但经验证发现两个层面的严重问题：

1. **API 路径全量不匹配**（P0 阻断级）：前端大量调用不存在的后端端点
2. **后端已有能力前端未对接**（P1 功能缺失）：告警、生命周期、跨模块联动（设备/变更文档/日报）等 Tier 4 后端端点前端完全没有对接

### 1.2 核心矛盾

前端在构建时引用了一套与后端实际 Controller 不一致的 API 路径，导致**页面壳层加载正常（200），但客户端数据请求全部 4xx/404**。具体表现：

| 前端调用路径 | 后端实际路径 | 状态 |
|---|---|---|
| `GET /cmdb/meta/models/{modelId}` | `GET /cmdb/models/{id}` | ❌ 不存在 |
| `GET /cmdb/instances/{modelId}/{id}` | `GET /cmdb/instances/{id}` | ❌ 不存在 |
| `PUT /cmdb/instances/{modelId}/{id}` | `PUT /cmdb/instances/{id}` | ❌ 不存在 |
| `GET /cmdb/rel/{id}` | `GET /cmdb/instances/{id}/relations` | ❌ 不存在 |
| `POST /cmdb/rel` | `POST /cmdb/instances/{id}/relations` | ❌ 不存在 |
| `DELETE /cmdb/rel/{relId}` | `DELETE /cmdb/instances/{id}/relations/{relationId}` | ❌ 不存在 |
| `GET /cmdb/meta/association-defs` | 无对应端点 | ❌ 不存在 |

---

## 2. 用户故事

### 2.1 基础可用性修复（P0 — 阻断级）

- 作为**运维工程师**，我想打开 CMDB 实例详情页时能正常加载实例数据，而不是看到空白页面或报错，以便查看资产配置。
- 作为**运维工程师**，我想在实例详情页查看/编辑/删除关联关系时操作能成功，而不是提交后无响应，以便管理 CI 间的拓扑。
- 作为**CMDB 管理员**，我想创建新实例时表单能正确提交（参数名 `modelId` 而非 `model`），以便录入资产数据。
- 作为**CMDB 管理员**，我想编辑实例属性后保存能成功，以便更新资产台账。

### 2.2 实例详情页功能补齐（P1 — 后端已就绪）

- 作为**运维工程师**，我想在实例详情页看到"变更历史"tab，展示该实例的全部变更记录（含 JSONB diff），以便追溯配置变化。
- 作为**运维工程师**，我想在实例详情页看到"关联凭证"区域，展示该 CI 关联的设备密码库凭证（可解密查看，需 `device:view_password` 权限），以便快速找到登录信息。
- 作为**运维工程师**，我想在实例详情页看到"关联变更文档"区域，展示引用了此 CI 的变更单列表，以便了解该资产经历过的变更。
- 作为**运维工程师**，我想在实例详情页看到"关联日报"区域，展示提及此 CI 的运维日报，以便了解该资产的日常维护记录。
- 作为**运维工程师**，我想在实例详情页看到"告警"tab，展示该 CI 的 Prometheus 告警（active/firing 状态），以便快速发现异常。

### 2.3 CMDB 告警管理（P1 — 后端已就绪）

- 作为**运维工程师**，我想在 CMDB 模块下有一个独立的"告警列表"页面，展示全部 CI 告警（按状态/严重级别过滤），以便集中查看告警。
- 作为**运维工程师**，我想在告警列表中点击"确认"来 acknowledge 一条告警，以便标记已知问题。

### 2.4 CSV 批量导入（P1 — 后端已就绪）

- 作为**CMDB 管理员**，我想在实例列表页点击"批量导入"按钮，上传 CSV 文件并预览（显示新增/更新/冲突行），以便批量录入实例。
- 作为**CMDB 管理员**，我想在预览页面选择冲突处理策略（覆盖/跳过/报错），然后执行导入并查看进度，以便完成大批量数据迁移。

### 2.5 关联类型管理增强（P2 — 后端已就绪）

- 作为**CMDB 管理员**，我想在 CMDB 配置管理页面管理关联类型的扩展属性定义（association-kinds/{kind}/attributes），以便为关联关系添加自定义字段。

### 2.6 拓扑图对比模式入口（P2 — 后端已就绪）

- 作为**运维工程师**，我想在拓扑图页面使用"对比模式"功能，选择两个时间点查看拓扑差异，以便验证变更影响范围。

---

## 3. 验收标准

### AC-1 API 路径全量对齐（P0 阻断）

- [ ] **AC-1.1** 实例详情页 `GET /cmdb/instances/{id}` 调用正确（去掉 `modelId` 路径段），能正常加载实例数据和属性配置。
- [ ] **AC-1.2** 实例更新 `PUT /cmdb/instances/{id}` 调用正确，保存成功后 toast 提示并刷新数据。
- [ ] **AC-1.3** 模型详情 `GET /cmdb/models/{id}` 调用正确（替换 `/cmdb/meta/models/`），能加载属性组和字段定义。
- [ ] **AC-1.4** 关联查询 `GET /cmdb/instances/{id}/relations` 调用正确（替换 `/cmdb/rel/{id}`），能渲染关联分组列表。
- [ ] **AC-1.5** 创建关联 `POST /cmdb/instances/{id}/relations` 调用正确（替换 `POST /cmdb/rel`），成功后刷新关联列表。
- [ ] **AC-1.6** 删除关联 `DELETE /cmdb/instances/{id}/relations/{relationId}` 调用正确（替换 `DELETE /cmdb/rel/{relId}`）。
- [ ] **AC-1.7** 关联定义查询使用正确端点（需后端补充 `GET /api/cmdb/association-defs` 或前端适配现有数据结构），能加载可选关联定义列表。
- [ ] **AC-1.8** 新建实例页面创建实例时提交参数包含 `modelId`（不是 `model`），调用 `POST /cmdb/instances` 成功。
- [ ] **AC-1.9** 全部 16 个 CMDB 页面的浏览器 Network 面板无 404/4xx 错误（排除权限不足的 403）。

### AC-2 实例详情页 Tab 化重构（P1）

- [ ] **AC-2.1** 实例详情页重构为 Tab 布局：基本信息 | 关联关系 | 变更历史 | 告警 | 关联资源（凭证/变更单/日报）。
- [ ] **AC-2.2** "变更历史"tab 调用 `GET /cmdb/instances/{id}/history`，渲染时间线 + JSONB diff（复用 ChangeRecordItem + JsonDiffView 组件），支持按时间范围/操作人/动作类型过滤 + 分页。
- [ ] **AC-2.3** "告警"tab 调用 `GET /cmdb/alerts/by-instance/{instanceId}`，渲染告警列表（名称、严重级别、状态、摘要、时间），支持 acknowledge 操作。
- [ ] **AC-2.4** "关联资源"区域调用三个端点渲染：
  - `GET /cmdb/instances/{id}/devices` → 关联设备凭证列表（名称、IP、凭证类型），可跳转到设备详情。
  - `GET /cmdb/instances/{id}/change-docs` → 关联变更文档列表（标题、状态、日期），可跳转。
  - `GET /cmdb/instances/{id}/daily-reports` → 关联日报列表（日期、作者），可跳转。
- [ ] **AC-2.5** 各 Tab 内容采用懒加载（切到 Tab 时才请求），初始只加载基本信息。

### AC-3 CMDB 告警列表页（P1）

- [ ] **AC-3.1** 新增路由 `/cmdb/alerts`，展示全局 CMDB 告警列表。
- [ ] **AC-3.2** 调用 `GET /cmdb/alerts`，支持按 status（firing/resolved）、severity（critical/warning/info）过滤 + 分页。
- [ ] **AC-3.3** 每条告警显示：告警名称、关联 CI 实例名（可点击跳转）、严重级别（颜色标识）、状态、摘要、触发时间。
- [ ] **AC-3.4** 告警行可点击"确认"按钮，调用 `POST /cmdb/alerts/{id}/acknowledge`，需 `cmdb_alert:acknowledge` 权限。
- [ ] **AC-3.5** 侧边栏"CMDB"分组下新增"CMDB 告警"导航项。

### AC-4 CSV 批量导入集成（P1）

- [ ] **AC-4.1** 实例列表页（`/cmdb/instances/by-model/[modelId]`）新增"批量导入"按钮，点击后打开 CsvImportDialog。
- [ ] **AC-4.2** CsvImportDialog 步骤 1：选择文件 → 调用 `POST /cmdb/instances/import/preview?model=...&conflictStrategy=...`，展示预览（新增 N 条 / 更新 N 条 / 冲突 N 条）。
- [ ] **AC-4.3** CsvImportDialog 步骤 2：执行导入 → 调用 `POST /cmdb/instances/import/execute`，轮询 `GET /cmdb/instances/import/{batchId}/progress` 展示进度条。
- [ ] **AC-4.4** 导入完成后展示结果（成功数 / 失败数），失败行可下载（`GET /cmdb/instances/import/{batchId}/failed-rows`）。
- [ ] **AC-4.5** 提供"下载模板"链接，调用 `GET /cmdb/instances/import/template?model=...`。

### AC-5 关联定义/类型管理完善（P2）

- [ ] **AC-5.1** CMDB 配置管理页（`/cmdb/admin`）关联 tab 下，新增关联属性定义管理子区域。
- [ ] **AC-5.2** 调用 `GET /cmdb/association-kinds/{kind}/attributes` 展示每个关联类型的扩展属性列表。
- [ ] **AC-5.3** 支持新增/编辑/删除关联属性定义（`POST/PUT/DELETE /cmdb/association-kinds/{kind}/attributes/{attrId}`）。

### AC-6 拓扑对比模式（P2）

- [ ] **AC-6.1** 拓扑图全屏页面（`/cmdb/topology/[instanceId]`）新增"对比模式"按钮。
- [ ] **AC-6.2** 点击后展开时间选择器（from/to），调用 `GET /cmdb/topology/{id}/compare?fromTime=...&toTime=...&depth=5`。
- [ ] **AC-6.3** 渲染差异拓扑：新增节点=绿色、删除节点=红色、修改节点=黄色，附带差异图例。
- [ ] **AC-6.4** 拓扑图导出 PNG 功能（svg-to-png 转换，分辨率 ≥ 1920×1080）。

### AC-7 权限与导航（贯穿）

- [ ] **AC-7.1** 所有新增页面/Tab 遵循现有 RBAC 权限控制（通过 `usePermission` hook + `PermissionGuard` 组件）。
- [ ] **AC-7.2** 侧边栏 CMDB 相关导航项整合为一组（可折叠）：CMDB 模型 / CMDB 实例 / CMDB 变更 / CMDB 告警 / CMDB 统计 / IP 地址池。
- [ ] **AC-7.3** 所有新增 API 调用的错误处理统一：401 跳登录、403 提示无权限、404 提示不存在、500 提示服务异常。

### AC-8 向后兼容

- [ ] **AC-8.1** 不修改任何后端 Controller 或 API 路径——本 PRD 只改前端。
- [ ] **AC-8.2** 现有已正常工作的页面（拓扑图、变更历史列表、变更统计、影响分析、2D 视图）行为不变。
- [ ] **AC-8.3** changedoc 前端的 ci_selector 行为不受影响（它通过独立的 `/cmdb/instances/search` 端点工作，已验证正常）。

---

## 4. 交互流

### 4.1 实例详情页（重构后）

```
用户进入 /cmdb/instances/by-model/host/123
  → 系统加载 GET /cmdb/instances/123（实例详情 + 属性）
  → 渲染 Tab 布局：
    [基本信息]（默认选中）| [关联关系] | [变更历史] | [告警] | [关联资源]
    
  → 基本信息 Tab：
    - 分组展示属性（只读 / 编辑模式切换）
    - 编辑 → PUT /cmdb/instances/123 → 刷新
    
  → 关联关系 Tab（切到时加载）：
    - GET /cmdb/instances/123/relations → 按 kind 分组
    - 添加关联 → 选定义 → 搜目标实例 → POST → 刷新
    
  → 变更历史 Tab（切到时加载）：
    - GET /cmdb/instances/123/history → 时间线 + JSONB diff
    - 过滤（时间/操作人/动作）+ 分页
    
  → 告警 Tab（切到时加载）：
    - GET /cmdb/alerts/by-instance/123 → 告警列表
    - 确认 → POST /cmdb/alerts/{alertId}/acknowledge
    
  → 关联资源区域（基本信息下方或独立 Tab）：
    - GET /cmdb/instances/123/devices → 凭证列表
    - GET /cmdb/instances/123/change-docs → 变更文档列表
    - GET /cmdb/instances/123/daily-reports → 日报列表
```

### 4.2 CMDB 告警列表页

```
用户进入 /cmdb/alerts
  → 系统加载 GET /cmdb/alerts?page=1&size=20
  → 渲染告警表格：
    [告警名称] [关联 CI] [严重级别] [状态] [触发时间] [操作]
  → 用户点击严重级别/状态筛选 → 重新请求
  → 用户点击"确认" → POST acknowledge → 刷新该行
  → 用户点击 CI 名称 → 跳转到实例详情页
```

### 4.3 CSV 批量导入

```
用户在实例列表页点击"批量导入"
  → 打开 CsvImportDialog
  → Step 1: 用户选择文件 + 冲突策略
    → POST /cmdb/instances/import/preview
    → 展示预览表格（新增/更新/冲突分类）
  → Step 2: 用户确认执行
    → POST /cmdb/instances/import/execute → 获 batchId
    → 轮询 GET /cmdb/instances/import/{batchId}/progress
    → 进度条 0→100%
  → Step 3: 展示结果
    → 成功 N 条 / 失败 N 条
    → 失败行可下载
  → 关闭对话框 → 刷新实例列表
```

---

## 5. 非功能性需求

### 5.1 性能

- 实例详情页初始加载 P95 < 800ms（含属性 + Tab 骨架）。
- 各 Tab 懒加载，切换后数据渲染 P95 < 500ms。
- 告警列表页分页加载 P95 < 300ms。
- CSV 导入预览（1000 行）P95 < 3 秒。
- 拓扑对比模式渲染 P95 < 2 秒（500 节点规模）。

### 5.2 前端架构

- 统一使用 TanStack Query 做数据获取 + 缓存（与现有代码一致）。
- API 调用统一通过 `@/lib/api` 的 axios 实例（`baseURL: /api`）。
- 新增组件放在 `@/components/cmdb/` 目录下。
- Tab 组件使用 shadcn/ui（与现有 UI 库一致）。

### 5.3 兼容性

- 不引入新的 npm 依赖（除非拓扑导出 PNG 需要额外库，由 Architect 决定）。
- 保持 Next.js App Router 路由结构。
- 保持现有 shadcn/ui 组件库风格。

---

## 6. 已知 Bug（随本次一起修复）

| Bug ID | 描述 | 优先级 | 根因 |
|---|---|---|---|
| t_1c1b805b | 创建实例时发送 `model` 而非 `modelId` → 实例创建失败 | P0 | 前端参数名错误 |
| (新发现) | 实例详情页 GET 路径含 modelId 导致 404 | P0 | 前端 API 路径错误 |
| (新发现) | 关联关系 CRUD 全部 404（路径 `/cmdb/rel/*` 不存在） | P0 | 前端 API 路径错误 |
| (新发现) | 模型详情 GET `/cmdb/meta/models/*` 导致 404 | P0 | 前端 API 路径错误 |
| (新发现) | 关联定义查询 `/cmdb/meta/association-defs` 404 | P0 | 前端 API 路径错误 |

---

## 7. 不做的事（显式排除）

- ❌ 不修改后端代码（Controller / Service / Mapper / Entity）。
- ❌ 不做 Prometheus SD 端点（后端尚未实现）。
- ❌ 不做生命周期管理 UI（后端尚未实现 lifecycle 字段）。
- ❌ 不做通知中心 CMDB 事件集成 UI（后端 notification service 存在但前端通知中心已有通用页面）。
- ❌ 不做 IPAM 页面改造（IPAM 已有独立页面 `/ipam`，不在本次范围）。
- ❌ 不做前端组件库迁移或主题变更。
- ❌ 不做自动化端到端测试（由后续 QA 任务覆盖）。

---

## 8. 开放问题（留给 Architect / 评审）

1. **关联定义查询端点缺失**：前端需要查询当前模型可用的关联定义列表（`CiAssociationDef`），但后端没有暴露 `GET /api/cmdb/association-defs` 端点。是在后端补一个只读查询接口，还是前端从模型 attributes 间接推断？**建议**：后端补一个轻量只读端点 `GET /api/cmdb/association-defs?modelId=xxx`。
2. **实例详情 Tab vs 折叠面板**：当前实例详情页使用折叠面板（Collapsible）组织关联和拓扑。改为 Tab 布局是更好的 UX，但改变了现有交互模式。是否保留折叠面板而新增 Tab？**建议**：改为 Tab 布局，基本信息 + 关联 + 变更 + 告警 + 资源各一个 Tab。
3. **关联关系的权限**：后端关联 CRUD 使用 `cmdb_relation:create/read/update/delete` 权限，但前端目前用 `cmdb_instance:create/delete` 判断。是否统一为 `cmdb_relation`？**建议**：前端对齐后端，使用 `cmdb_relation` 权限。
4. **告警导航位置**：告警列表放在 CMDB 分组下还是独立顶级菜单？**建议**：CMDB 分组下，因为告警强绑 CI 实例。
5. **CSV 导入组件**：CsvImportDialog 组件已存在（160 行），是否需要重写还是适配现有组件？**建议**：适配现有组件，补齐 API 对接逻辑。

---

## 9. 下游 handoff

- **Architect** 阅读本 PRD 后，在同一文件追加技术方案（API 路径映射表、组件重构方案、新增文件清单、路由变更、风险点）。
- **PRD 完成标准**: 验收标准全部 ✅ 可验证、开放问题已闭环、Architect 技术方案已追加。

---
---

