# cwgsyw-platform — CLAUDE.md

IT 基础设施运维运营管理平台。当前阶段：内部单团队 MVP，架构为未来多租户 SaaS 预留扩展点。

---

## 项目结构

```
cwgsyw-platform/
├── backend/          # Spring Boot 3.4.5 / Java 24
├── frontend/         # Next.js 15 / React 19 / App Router
├── docker-compose.yml
├── .env.example
└── docs/
    └── superpowers/
        ├── plans/    # 实施计划
        └── specs/    # 需求规格
```

---

## 技术栈

| 层       | 技术                                                      |
|----------|-----------------------------------------------------------|
| 前端     | Next.js 15, React 19, App Router, shadcn/ui, Tailwind v4 |
| 状态管理 | Zustand (persist), TanStack Query v5                      |
| 后端     | Spring Boot 3.4.5, Java 24, Spring Security + JWT         |
| ORM      | MyBatis-Plus 3.5.12                                       |
| 工作流   | Flowable 7.1.0                                            |
| 数据库   | PostgreSQL 16, Redis 7, MinIO                             |
| 部署     | Docker Compose (6 containers: db/redis/minio/backend/frontend/nginx) |

---

## 数据库约定

- **时间字段一律用 `TIMESTAMP`**，不用 `TIMESTAMPTZ`（JDBC 驱动映射 LocalDateTime 时会报错）
- **不做物理删除**：所有表有 `is_deleted + deleted_at + deleted_by`，通过 MyBatis-Plus `@TableLogic` 实现软删
- **多租户**：所有表有 `tenant_id VARCHAR(64) DEFAULT 'default'`，当前 MVP 固定为 `'default'`
- **Flyway**：`validate-on-migrate: false`（防止手动修改过的迁移文件引发 checksum 错误）
- **CMDB 动态属性**：`ci_instance.attrs` 使用 `JSONB` + GIN 索引，通过 MyBatis-Plus `JacksonTypeHandler` 映射到 `Map<String, Object>`

### 已完成的迁移

| 版本 | 内容                                                      |
|------|-----------------------------------------------------------|
| V1   | `sys_group`, `sys_user`, `audit_log`                      |
| V2   | `sys_resource`, `sys_permission`, `sys_role_permission`, `sys_user_role` |
| V3   | 种子数据：5个组、5个角色、superadmin (`Admin@123`)        |
| V4   | `daily_report`, `daily_report_approval` + RBAC 权限      |
| V5   | 修复 `sys_role` 缺少 BaseEntity 列                        |
| V6   | `device`, `device_credential`, `password_access_log` + RBAC |
| V7   | `sys_config`, `notification_message` + RBAC               |
| V8   | `change_doc`, `change_doc_approval` + RBAC 权限           |
| V9   | `change_doc` 添加 `doc_number`, `category`, `risk_level` 列 |
| V10  | `change_doc` 添加 MinIO 附件字段 (`attachment_*`)         |
| V11  | `change_doc` 添加 Word 模板导出字段 (`template_*`, `exported_*`) |
| V12  | `change_doc` 添加 AI 摘要字段 (`ai_summary`, `ai_generated_at`) |
| V13  | `change_doc` 双模板支持（`template2_*`, `exported2_*`）   |
| V14  | `ci_model_group`, `ci_model` — CMDB 模型分组与模型定义  |
| V15  | `ci_attribute_group`, `ci_attribute` — CMDB 属性分组与属性定义 |
| V16  | `ci_instance` — CMDB 实例表（JSONB 动态字段）           |
| V17  | `ci_association_kind`, `ci_association_def`, `ci_instance_rel` — CMDB 关联 |
| V18  | CMDB 内置 seed 数据（5模型分组、2模型、18属性、5关联类型） |
| V19  | CMDB 索引补充（含 GIN 索引、CMDB 审计索引）             |
| V20  | 主机模型增加 `sn`（序列号）内置属性                      |
| V23  | CMDB RBAC 权限 seed 数据（3资源 + 角色分配）             |
| V24  | `ci_instance_rel.metadata` JSONB + `ci_association_attr_def` 关联扩展属性定义 |
| V25  | CSV 导入权限 seed（`cmdb_instance:import`）              |
| V26  | 影响分析权限 seed（`cmdb_instance:impact`）              |
| V27  | `device` 增加 `ci_instance_id`（设备 ↔ CI 实例关联）     |
| V28  | `change_doc_ci_link` — 变更文档 ↔ CI 实例关联表         |
| V29  | `daily_report` 增加 `ci_instance_ids` JSONB（日报 ↔ CI） |
| V30  | `ip_pool` + `ip_allocation` — IPAM 模块 + RBAC          |
| V31  | `cmdb_alert` — Prometheus 告警表 + RBAC                 |

---

## 强制规则（每次开发必须遵守）

### 1. RBAC 检查清单（每新增模块必须执行）

每次新增模块或功能时，必须：

1. **数据库**：在迁移脚本中向 `sys_resource` 插入新资源，向 `sys_permission` 插入所有 action，向 `sys_role_permission` 分配给相应角色
2. **后端**：所有 Controller 方法加 `@PreAuthorize("hasAuthority('resource:action')")`
3. **前端 API**：所有敏感操作加权限判断（`hasPermission(resource, action)`）
4. **前端 UI**：Sidebar 导航项加权限守卫；页面级别加 `useEffect` 检查权限，无权则 redirect

### 2. 审计日志（所有写操作必须写 audit_log）

- insert/update/delete 都要在同一事务内写 `audit_log`
- `operatorId = 0L` 用于系统自动操作（如工作流回调）
- 字段：`tenantId, module, action, targetId, targetType, operatorId, operatorIp, beforeJson, afterJson, remark, createdAt`

### 3. 禁止物理删除

所有删除操作通过 MyBatis-Plus 逻辑删除，不允许执行 `DELETE FROM` SQL。

### 4. Jackson SNAKE_CASE

后端全局配置 `property-naming-strategy: SNAKE_CASE`。Java `modelId` → JSON `model_id`。
前端 API 请求体 (POST/PUT) 必须使用 snake_case 字段名。

---

## 安全

- **JWT**：stateless，secret 来自 `${JWT_SECRET}`
- **AES-256-GCM**：加密 key 来自 `${ENCRYPT_KEY}`（Base64 编码的 32 字节 key）
  - 当前 dev key：`dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleTEyMzQ=`
- **superadmin 密码**：`Admin@123`（BCrypt hash 在 V3 种子数据中）

---

## RBAC 模型

```
Resource (资源) → Permission (权限=resource:action) → Role → User
```

### 角色定义

| 角色代码       | 中文名   | groupScope  | 说明                       |
|----------------|----------|-------------|----------------------------|
| `super_admin`  | 超级管理员 | `platform` | 全平台所有权限             |
| `admin`        | 管理员   | `tenant`    | 租户级别所有权限           |
| `group_leader` | 组长     | `group`     | 本组管理 + 审批权限        |
| `member`       | 组员     | `group`     | 基本读权限                 |
| `viewer`       | 只读     | `group`     | 只读                       |

### 已注册资源

| resource       | actions                                              |
|----------------|------------------------------------------------------|
| `user`         | create, read, update, delete                         |
| `group`        | create, read, update, delete                         |
| `role`         | create, read, update, delete, assign                 |
| `daily_report` | create, read, update, delete, approve                |
| `workflow`     | read, approve                                        |
| `device`       | create, read, update, delete, view_password          |
| `notification` | read, manage                                         |
| `cmdb_model`    | create, read, update, delete                       |
| `cmdb_instance` | create, read, update, delete, import, impact       |
| `cmdb_relation` | create, read, update, delete                       |
| `ip_pool`       | create, read, update, delete                       |
| `cmdb_alert`    | create, read, acknowledge                          |

---

## SecurityUser

```java
user.getUserId()     // Long
user.getUsername()   // String
user.getGroupId()    // Long  (null for admin/super_admin)
user.getGroupScope() // "group" | "tenant" | "platform"
user.getTenantId()   // String, 当前固定 "default"
user.getPermissions() // Collection<GrantedAuthority>
```

---

## 关键 Bean / 服务

| Bean                    | 位置                                    | 说明                            |
|-------------------------|-----------------------------------------|---------------------------------|
| `CryptoService`         | `config/CryptoService.java`             | AES-256-GCM 加解密              |
| `EmailService`          | `config/EmailService.java`              | 运行时从 sys_config 读 SMTP 配置发邮件 |
| `SysConfigService`      | `module/config/SysConfigService.java`   | 读写 sys_config 表              |
| `NotificationService`   | `module/notification/NotificationService.java` | 写站内信 + 触发邮件       |
| `WorkflowService`       | `module/workflow/WorkflowService.java`  | Flowable 流程操作               |
| `AuditLogMapper`        | `common/AuditLogMapper.java`            | 直接写 audit_log                |
| `CiModelService`        | `module/cmdb/service/`                  | CMDB 模型管理                   |
| `CiInstanceService`     | `module/cmdb/service/`                  | CMDB 实例管理（含 schema 校验） |
| `CiAssociationAttrDefService` | `module/cmdb/service/`             | 关联扩展属性定义管理             |
| `CiRelationService`     | `module/cmdb/service/`                  | 关联管理（含 metadata 校验）    |
| `CiTopologyService`     | `module/cmdb/service/`                  | CMDB 拓扑遍历（递归 CTE BFS）   |
| `CsvImportService`      | `module/cmdb/service/`                  | CSV 批量导入（preview/execute） |
| `ImpactAnalysisService` | `module/cmdb/service/`                  | 影响分析（CTE + Java BFS）      |
| `CiNotificationService` | `module/cmdb/service/`                  | CI 状态变更/删除通知（Phase 4A）|
| `ChangeDocLinkService`  | `module/changedoc/`                     | 变更文档 ↔ CI 实例关联（4C）    |
| `IpPoolService`         | `module/ipam/`                          | IP 地址池管理（Phase 4E）      |
| `PrometheusAlertSyncService` | `module/cmdb/alert/`               | Prometheus 告警同步（Phase 4F）|

---

## 前端约定

- **Auth guard**：`(dashboard)/layout.tsx` 用 `getToken()` 直接判断（不依赖 Zustand hydration）
- **权限判断**：`usePermission().hasPermission(resource, action)`
- **groupScope**：从 `useAuthStore(s => s.groupScope)` 获取，用于区分 admin/leader/member 视图
- **groupId**：从 `useAuthStore(s => s.groupId)` 获取（admin/super_admin 为 null）
- **API 前缀**：所有请求通过 `@/lib/api`（axios instance），baseURL = `/api`
- **通知铃铛**：`NotificationBell` 挂载在 dashboard layout header，30 秒轮询未读数
- **动态表单**：CMDB 和变更文档均基于 `field_config` 动态渲染表单，见 `cmdb/instances/[modelId]/new/page.tsx`
- **Button asChild 不可用**：项目使用 `@base-ui/react/button`，不支持 Radix 风格 `asChild`。需要链接按钮时用 `<Link className={buttonVariants({...})}>` 替代
- **分页 total 问题**：MyBatis-Plus `selectPage` 对 `Boolean @TableLogic` 字段自动 count 有 bug（返回 0）。统一用 `selectCount` + `new Page<>(p, s, false)` + `result.setTotal(total)` 三步分页
- **JSONB 更新**：`LambdaUpdateWrapper.set(entity::getAttrs, map)` 会绕过 `JacksonTypeHandler` 触发 hstore 错误。更新含 JSONB 字段的记录必须用 `updateById(entity)` 方式
- **useColumnConfig**：`useColumnConfig(modelId, defaultKeys)` - storageKey = `cmdb_col_config_{modelId}`。切换 modelId 时会自动从 localStorage 重新读取（内部有 useEffect）。`defaultKeys` 若每次传新数组引用会导致 reset() 不稳定，建议在组件外定义为常量
- **useSearchParams Suspense**：Next.js 15 App Router 中使用 `useSearchParams()` 的组件必须被 `<Suspense>` 包裹，否则会产生构建警告
- **@RequestParam vs FormData**：GET 请求使用 camelCase（`@RequestParam Long folderId`），POST FormData 使用 snake_case（`folder_id`）。前端调用必须匹配后端参数名

---

## 共享文件模块

独立文件库，支持文件夹树、文件上传/下载/预览/搜索、按组可见性控制、pandoc Word→Markdown 转换、变更文档审批后自动归档。

### 数据模型

- **SharedFolder**：`id, tenant_id, name, parent_id, sort_order, created_by`，通过 `parent_id` 构建递归树
- **SharedFile**：`id, tenant_id, name, original_name, file_type, size_bytes, minio_path, folder_id, created_by, visible_groups (JSONB List<Long>), is_archived, archive_source_type, archive_source_id`，`@TableName(autoResultMap = true)` + `JacksonTypeHandler` 处理 JSONB

### API 路由

- `GET /api/files/folders` — 文件夹树
- `POST /api/files/folders` — 创建文件夹（body: `{name, parent_id}`）
- `DELETE /api/files/folders/{id}` — 软删除（含子文件夹递归）
- `GET /api/files` — 文件列表（params: `folderId, keyword, page, size`，按组可见性过滤）
- `POST /api/files/upload` — 上传（multipart: `file + folder_id`，异步触发 pandoc 预览图生成）
- `GET /api/files/{id}/download-url` — 预签名下载 URL（5 分钟有效）
- `GET /api/files/{id}/preview-url` — 预签名预览 URL（30 分钟有效）
- `DELETE /api/files/{id}` — 软删除

### 前端页面

| 路径 | 说明 |
|------|------|
| `/files` | 文件管理页（左侧文件夹树 + 右侧表格，搜索/分页/新建文件夹/上传/下载/删除） |
| `/files/preview/[id]` | 文件预览页（PDF iframe / Word docx-preview / Excel SheetJS） |

### 前后端字段映射注意

后端 Jackson `SNAKE_CASE`，接口返回的 JSON 字段均为 snake_case。前端 `SharedFile` 接口字段必须匹配：
- `original_name`, `file_type`, `size_bytes`, `folder_id`, `created_by_name`, `created_at`

GET 请求使用 camelCase（`@RequestParam folderId`），POST FormData 使用 snake_case（`folder_id`）。

### 变更文档自动归档

`SharedFileService.archiveFromChangeDoc(changeDoc)` 由审批回调触发：
1. 调用 ExportService 生成 Word + PDF
2. 上传到 MinIO（路径：`shared/archived/<year>/<month>/<docId>_<title>.docx/.pdf`）
3. 通过 `getOrCreateFolder` 递归创建文件夹路径（如 `变更文档 / 2026 / 05`）
4. 写入 `SharedFile` 记录，`is_archived=true`，`archive_source_type=CHANGE_DOC`，`visible_groups` 继承变更文档的审批组

---

## CMDB 模块说明

CMDB（配置管理数据库）是自建的，不依赖 bk-cmdb，基于 PostgreSQL JSONB 实现。

### 核心概念

- **模型（CiModel）**：CI 类型定义，如主机、应用、MySQL 实例。`model_id` 是唯一标识。
- **属性（CiAttribute）**：模型的字段定义，含类型系统（singlechar/longchar/int/float/enum/enummulti/date/bool/objuser/list）
- **属性分组（CiAttributeGroup）**：属性在详情页的分组展示
- **关联种类（CiAssociationKind）**：关联语义，内置：`belong`（属于/包含）、`run`（运行/被运行）、`connect`（连接）、`depend`（依赖）、`deploy`（部署）、`bk_mainline`（主线）
- **模型关联定义（CiAssociationDef）**：定义两个模型间允许建立哪种关联，含基数(1:1/1:n/n:n)和 `on_delete` 行为
- **CI 实例（CiInstance）**：模型的具体数据，所有动态属性存在 `attrs JSONB` 列中
- **实例关联（CiInstanceRel）**：两个 CI 实例间的有向关联，`src_id → dst_id`，通过 `def_id` 引用关联定义。`attrs JSONB` 用于存储关联属性（Phase 4 起可扩展）

### API 路由

- `GET/POST /api/cmdb/meta/models` — 模型 CRUD
- `GET /api/cmdb/meta/models/{modelId}` — 模型详情（含 attributes + attribute_groups）
- `POST /api/cmdb/meta/models/{modelId}/attributes` — 新增属性
- `GET/POST /api/cmdb/meta/association-kinds` — 关联种类
- `GET/POST /api/cmdb/meta/association-defs` — 模型关联定义
- `GET/POST /api/cmdb/instances/{modelId}` — 实例列表/创建
- `GET/PUT/DELETE /api/cmdb/instances/{modelId}/{id}` — 实例详情/更新/删除
- `GET /api/cmdb/rel/{instanceId}` — 查询某实例所有关联（正向+反向，按 kind 分组）
- `POST /api/cmdb/rel` — 建立关联（body: `{def_id, src_id, dst_id}`，触发 mapping 基数校验）
- `DELETE /api/cmdb/rel/{relId}` — 软删除关联
- `GET /api/cmdb/rel/search` — 搜索实例（params: `modelId`, `keyword`, `page`, `size`）
- `GET /api/cmdb/instances/search` — 跨模型搜索（params: `keyword`, `modelId`, `page`, `size`，返回 `model_counts`）
- `GET /api/cmdb/topology/{instanceId}` — BFS 拓扑图（param: `depth` 1-5，默认 2，返回 `{nodes, edges}`）

### 前端页面结构（当前 v0.12.0）

| 路径 | 说明 |
|------|------|
| `/cmdb` | **搜索首页**（跨模型关键词搜索 + 模型筛选标签 + 列自定义） |
| `/cmdb/instances` | **CI 资源页**（左侧模型树 + 右侧实例表格 + 列自定义） |
| `/cmdb/instances/[modelId]/new` | 新建实例（动态表单） |
| `/cmdb/instances/[modelId]/[id]` | 实例详情/编辑 + 关联面板 + 拓扑预览面板 |
| `/cmdb/instances/[modelId]/[id]/associations` | 实例关联管理页 |
| `/cmdb/topology/[instanceId]` | **拓扑全屏页**（React Flow，深度选择器，节点详情面板） |
| `/cmdb/admin` | **配置管理**（模型管理 + 关联定义 Tab，`cmdb_model:write`） |
| `/cmdb/admin/models/[modelId]` | 模型属性编辑 |
| `/cmdb/models/[modelId]` | → redirect to `/cmdb/admin/models/[modelId]` |
| `/cmdb/associations` | → redirect to `/cmdb/admin` |

| model_id | 名称 | 内置属性数 |
|----------|------|-----------|
| `host`   | 主机 | 12（inner_ip、hostname、os_type、env、status 等） |
| `app`    | 应用 | 5（app_name、owner、repo_url 等） |

---

## 已完成的功能模块

| Phase | 功能              | 状态 |
|-------|-------------------|------|
| 1     | 认证、RBAC、用户/组管理、Docker 部署 | ✅ |
| 2a    | 日报系统 + Flowable 审批工作流      | ✅ |
| 2b    | 设备密码库 (AES-256-GCM)            | ✅ |
| 2c    | 邮件通知中心 + 站内信 + 定时提醒    | 🚧 进行中 |
| 3a    | 变更文档系统 + AI 辅助 + Word/PDF 导出 | ✅ |
| 3b    | CMDB Tier 1（模型+属性+实例+关联+拓扑） | ✅ |
| 3c    | CMDB Tier 2（关联增强+CSV导入+影响分析） | ✅ |
| 4A    | CI 状态变更/删除通知 | ✅ |
| 4B    | 设备 ↔ CI 实例关联 | ✅ |
| 4C    | CMDB ↔ 变更文档关联 | ✅ |
| 4D    | CMDB ↔ 日报关联 | ✅ |
| 4E    | IP 地址池管理 (IPAM) | ✅ |
| 4F    | Prometheus 告警集成 | ✅ |

## 计划中的功能模块

| Phase | 功能                                              |
|-------|---------------------------------------------------|
| 5     | 月度/季度报表导出、微信通知、审计日志 UI          |

---

## 开发命令

```bash
# 启动所有容器
docker compose up -d

# 查看后端日志
docker compose logs backend -f

# 重新构建后端（用 --no-cache 确保 migration 文件包含进 JAR）
docker compose build --no-cache backend && docker compose up -d backend

# 重新构建前端
docker compose build frontend && docker compose up -d frontend

# 进入 DB
docker compose exec postgres psql -U platform_user -d cwgsyw_platform

# 当前 branch
# feat/shared-files — 共享文件库开发分支
# master — 稳定版本
```

---

## 计划文档位置

- Phase 1: `docs/superpowers/plans/2026-05-21-phase1-foundation.md`
- Phase 2a: `docs/superpowers/plans/2026-05-21-phase2a-daily-report.md`
- Phase 2b: `docs/superpowers/plans/2026-05-22-phase2b-device-vault.md`
- Phase 2c: `docs/superpowers/plans/2026-05-22-phase2c-notifications.md`
- CMDB Tier 4: `docs/superpowers/plans/2026-06-13-cmdb-tier4-implementation.md`
- 设计规格: `docs/superpowers/specs/2026-05-21-it-ops-platform-design.md`
- CMDB Phase 3 设计: `docs/superpowers/specs/2026-05-25-cmdb-phase3-instance-associations.md`
- CMDB-UX 设计: `docs/superpowers/specs/2026-05-26-cmdb-ux-redesign.md`
- 共享文件库计划: `docs/superpowers/plans/2026-05-27-shared-files.md`

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **cwgsyw-platform** (4261 symbols, 8452 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/cwgsyw-platform/context` | Codebase overview, check index freshness |
| `gitnexus://repo/cwgsyw-platform/clusters` | All functional areas |
| `gitnexus://repo/cwgsyw-platform/processes` | All execution flows |
| `gitnexus://repo/cwgsyw-platform/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
