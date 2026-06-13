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
    ├── guide/         # 功能指南（CMDB Tier 1-4 等）
    └── superpowers/
        ├── plans/     # 实施计划
        ├── specs/     # 需求规格
        └── verification/  # 验证报告
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
user.getGroupId()    // Long
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
- **API 前缀**：所有请求通过 `@/lib/api`（axios instance），baseURL = `/api`
- **通知铃铛**：`NotificationBell` 挂载在 dashboard layout header，30 秒轮询未读数

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

# 重新构建后端
docker compose build backend && docker compose up -d backend

# 重新构建前端
docker compose build frontend && docker compose up -d frontend

# 进入 DB
docker compose exec db psql -U platform_user -d cwgsyw_platform
```

---

## 计划文档位置

- Phase 1: `docs/superpowers/plans/2026-05-21-phase1-foundation.md`
- Phase 2a: `docs/superpowers/plans/2026-05-21-phase2a-daily-report.md`
- Phase 2b: `docs/superpowers/plans/2026-05-22-phase2b-device-vault.md`
- Phase 2c: `docs/superpowers/plans/2026-05-22-phase2c-notifications.md`
- CMDB Tier 4: `docs/superpowers/plans/2026-06-13-cmdb-tier4-implementation.md`
- 设计规格: `docs/superpowers/specs/2026-05-21-it-ops-platform-design.md`

## 功能指南

- CMDB Tier 1: `docs/guide/cmdb-tier1.md` — 模型/属性/实例/关联/拓扑
- CMDB Tier 2: `docs/guide/cmdb-tier2.md` — 关联元数据增强 + CSV 导入 + 影响分析
- CMDB Tier 4: `docs/guide/cmdb-tier4.md` — CI 通知/设备关联/变更关联/日报关联/IPAM/告警
