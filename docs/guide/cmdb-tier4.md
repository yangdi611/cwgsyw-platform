# CMDB Tier 4 — 集成联动完整指南

> 模块：CMDB 集成联动 / CI 实例 ↔ 设备 / 凭证 / 变更文档 / 日报 / 告警 / IPAM / 生命周期
> 对应 Flyway V27–V32，Phase 4A–4G（7 个子阶段）
> 前端：6 个 CMDB 页面 + 2 个 IPAM 页面 + 跨模块关联组件

---

## 目录

1. [概述](#概述)
2. [数据模型变更](#数据模型变更)
3. [Phase 4A: CI 状态变更/删除通知](#phase-4a-ci-状态变更删除通知)
4. [Phase 4B: 设备 ↔ CI 实例关联](#phase-4b-设备--ci-实例关联)
5. [Phase 4C: CMDB ↔ 变更文档关联](#phase-4c-cmdb--变更文档关联)
6. [Phase 4D: CMDB ↔ 日报关联](#phase-4d-cmdb--日报关联)
7. [Phase 4E: IP 地址池管理 (IPAM)](#phase-4e-ip-地址池管理-ipam)
8. [Phase 4F: Prometheus 告警集成](#phase-4f-prometheus-告警集成)
9. [Phase 4G: CI 实例生命周期 + 凭证管理](#phase-4g-ci-实例生命周期--凭证管理)
10. [前端页面与组件](#前端页面与组件)
11. [API 参考](#api-参考)
12. [权限控制（RBAC）](#权限控制rbac)
13. [审计日志](#审计日志)
14. [配置项](#配置项)
15. [已知问题与注意事项](#已知问题与注意事项)

---

## 概述

CMDB Tier 4 是平台的集成联动层，将 CMDB 实例与平台其他模块（设备、变更文档、日报、IP 地址池、监控系统）打通，形成完整的运维闭环：

| 子阶段 | 功能 | 关键能力 |
|--------|------|----------|
| 4A | CI 状态变更/删除通知 | CI 实例状态变化时自动推送站内信给 Owner 和管理员 |
| 4B | 设备 ↔ CI 实例关联 | `device.ci_instance_id` 外键，设备页面可选择关联 CI |
| 4C | CMDB ↔ 变更文档关联 | `change_doc_ci_link` 多对多关联表，支持影响级别标注 |
| 4D | CMDB ↔ 日报关联 | `daily_report.ci_instance_ids` JSONB 数组字段 |
| 4E | IP 地址池管理 (IPAM) | CIDR 自动计算、IP 分配/释放、关联 CI 实例 |
| 4F | Prometheus 告警集成 | 30 秒轮询 Prometheus → 自动匹配 CI 实例 → 告警列表 + 确认 |
| 4G | CI 实例生命周期 + 凭证管理 | `ci_instance` 生命周期/资产字段 + `device_credential.ci_instance_id` 关联 |

### 模块文件结构（Tier 4 新增/修改）

```
后端:
module/cmdb/
  alert/                                    # Phase 4F — Prometheus 告警集成
    CmdbAlertController.java                # /api/cmdb/alerts
    CmdbAlertMapper.java                    # 告警查询 Mapper
    PrometheusAlertSyncService.java         # 30s 定时轮询 Prometheus API
    dto/CmdbAlertVO.java
    entity/CmdbAlert.java
  service/
    CiNotificationService.java              # Phase 4A — CI 状态变更/删除通知
    CiInstanceService.java                  # 新增 getRelatedDevices/ChangeDocs/DailyReports
  controller/
    CiInstanceController.java               # 新增 /devices /change-docs /daily-reports 端点
module/changedoc/
  ChangeDocLinkService.java                 # Phase 4C — 变更文档 ↔ CI 关联管理
  ChangeDocCiLinkMapper.java                # change_doc_ci_link Mapper
  ChangeDocController.java                  # 新增 /ci-links 端点
  entity/ChangeDocCiLink.java
  dto/LinkCiRequest.java
  dto/LinkedCiInstanceVO.java
  dto/LinkedChangeDocVO.java
module/ipam/                                # Phase 4E — IP 地址池管理
  IpPoolController.java                     # /api/ip-pools
  IpPoolService.java                        # CIDR 计算 + 分配/释放
  IpPoolMapper.java
  IpAllocationMapper.java
  entity/IpPool.java
  entity/IpAllocation.java
  dto/CreateIpPoolRequest.java
  dto/UpdateIpPoolRequest.java
  dto/AllocateIpRequest.java
  dto/ReleaseIpRequest.java
  dto/IpPoolVO.java
  dto/IpPoolDetailVO.java
  dto/IpAllocationVO.java
module/config/
  SysConfigController.java                  # 新增 PUT /prometheus 配置端点
module/device/
  Device.java                               # 新增 ci_instance_id 字段
  DeviceVO.java                             # 新增 ciInstanceId + ciInstanceName
  CreateDeviceRequest.java                  # 新增 ciInstanceId
  entity/DeviceCredential.java              # Phase 4G — 新增 ci_instance_id 字段
  dto/CredentialVO.java                     # Phase 4G — 凭证 VO（含 ciInstanceId）
  dto/CreateCredentialRequest.java          # Phase 4G — 创建凭证请求
  DeviceCredentialMapper.java               # 新增 findCredentialVOsByCiInstanceId
module/daily/
  DailyReport.java                          # 新增 ci_instance_ids JSONB 字段
  DailyReportVO.java                        # 新增 ciInstanceIds
  DailyReportBriefVO.java                   # Phase 4D — CI 实例关联日报 VO
  DailyReportMapper.java                    # 新增 findByCiInstanceId
  DailyReportService.java                   # 关联 CI 实例保存逻辑

Flyway 迁移:
  V27__device_add_ci_instance_id.sql        # device 表增加 ci_instance_id
  V28__change_doc_ci_link.sql               # change_doc_ci_link 表
  V29__daily_report_ci_instance_ids.sql     # daily_report 增加 ci_instance_ids
  V30__ipam_tables.sql                      # ip_pool + ip_allocation + RBAC
  V31__prometheus_alerts.sql                # cmdb_alert + RBAC
  V32__ci_instance_lifecycle.sql            # ci_instance 生命周期字段 + device_credential.ci_instance_id

前端:
app/(dashboard)/
  cmdb/
    page.tsx                                # /cmdb → 重定向到 /cmdb/models
    models/page.tsx                         # CMDB 模型列表（CRUD）
    models/[id]/page.tsx                    # 模型详情（属性 CRUD + 实例列表 Tab）
    instances/page.tsx                      # CMDB 实例列表（CRUD + CSV 导入）
    instances/[id]/page.tsx                 # 实例详情（关联/拓扑/影响分析/设备/变更/日报/告警）
    changes/page.tsx                        # 变更历史（模型筛选 + 日期范围）
  ipam/
    page.tsx                                # IP 地址池列表
    ipam/[id]/page.tsx                      # 地址池详情（分配/释放/利用率）
components/
  cmdb/
    CiInstanceSelect.tsx                    # CI 实例单选下拉（用于设备/变更文档关联）
    CiLinkSelector.tsx                      # 变更文档 CI 关联选择器（多选 + 影响级别）
    CsvImportDialog.tsx                     # CSV 导入预览/执行对话框
  daily/
    CiInstanceMultiSelect.tsx               # 日报 CI 实例多选组件
hooks/
  usePrometheusAlerts.ts                    # 前端 30s 轮询告警数据 Hook
```

---

## 数据模型变更

### V27: device 表增加 ci_instance_id

```sql
ALTER TABLE device ADD COLUMN ci_instance_id BIGINT;
```

设备与 CI 实例的一对一关联（可选）。一个 CI 实例可关联多个设备，但一个设备只能关联一个 CI 实例。

### V28: change_doc_ci_link 表

```sql
CREATE TABLE change_doc_ci_link (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    change_doc_id   BIGINT NOT NULL REFERENCES change_doc(id),
    instance_id     BIGINT NOT NULL REFERENCES ci_instance(id),
    impact_level    VARCHAR(32),            -- 影响级别: high / medium / low
    is_deleted      BOOLEAN DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by      BIGINT
);

CREATE INDEX idx_cdcl_change_doc ON change_doc_ci_link(change_doc_id);
CREATE INDEX idx_cdcl_instance ON change_doc_ci_link(instance_id);
CREATE UNIQUE INDEX idx_cdcl_unique
    ON change_doc_ci_link(change_doc_id, instance_id) WHERE is_deleted = FALSE;
```

变更文档与 CI 实例的多对多关联表。同一个变更可关联多个 CI 实例，同一个 CI 实例也可被多个变更文档引用。唯一索引确保不重复关联。

### V29: daily_report 表增加 ci_instance_ids

```sql
ALTER TABLE daily_report ADD COLUMN ci_instance_ids JSONB DEFAULT '[]'::jsonb;
```

日报关联的 CI 实例 ID 列表，使用 JSONB 数组存储（如 `[1, 5, 12]`）。

### V30: ip_pool + ip_allocation 表

```sql
CREATE TABLE ip_pool (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    name            VARCHAR(128) NOT NULL,
    description     TEXT,
    cidr            VARCHAR(43) NOT NULL,       -- 如 192.168.1.0/24
    gateway         VARCHAR(39),
    dns             VARCHAR(255),
    status          VARCHAR(32) DEFAULT 'active', -- active / full / disabled
    total_count     INT NOT NULL DEFAULT 0,      -- 由 CIDR 自动计算
    allocated_count INT NOT NULL DEFAULT 0,
    -- 软删除 + 审计字段 ...
);

CREATE TABLE ip_allocation (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    pool_id         BIGINT NOT NULL REFERENCES ip_pool(id),
    ip_address      VARCHAR(39) NOT NULL,
    status          VARCHAR(32) DEFAULT 'allocated', -- allocated / released
    ci_instance_id  BIGINT REFERENCES ci_instance(id), -- 可选关联 CI 实例
    description     TEXT,
    allocated_by    BIGINT,
    allocated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    released_at     TIMESTAMP,
    -- 软删除 + 审计字段 ...
);

CREATE UNIQUE INDEX idx_ip_allocation_unique
    ON ip_allocation(pool_id, ip_address) WHERE is_deleted = FALSE;
```

### V31: cmdb_alert 表

```sql
CREATE TABLE cmdb_alert (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    ci_instance_id  BIGINT REFERENCES ci_instance(id),
    alert_name      VARCHAR(256) NOT NULL,
    severity        VARCHAR(32) NOT NULL DEFAULT 'warning', -- info / warning / critical
    status          VARCHAR(32) NOT NULL DEFAULT 'firing',  -- firing / resolved
    fingerprint     VARCHAR(64) NOT NULL,        -- Prometheus 告警指纹（唯一标识）
    summary         TEXT,
    description     TEXT,
    starts_at       TIMESTAMP,
    ends_at         TIMESTAMP,
    raw_labels      TEXT,                        -- Prometheus labels JSON 原文
    acknowledged    BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    acknowledged_by BIGINT,
    -- 软删除 + 审计字段 ...
);

CREATE UNIQUE INDEX idx_cmdb_alert_fingerprint
    ON cmdb_alert(fingerprint) WHERE is_deleted = FALSE;
```

### V32: ci_instance 生命周期字段 + device_credential ↔ CI 关联

```sql
-- CI 实例生命周期/资产管理字段
ALTER TABLE ci_instance ADD COLUMN lifecycle_status VARCHAR(32);
ALTER TABLE ci_instance ADD COLUMN lifecycle_stage VARCHAR(32);
ALTER TABLE ci_instance ADD COLUMN asset_category VARCHAR(64);
ALTER TABLE ci_instance ADD COLUMN purchase_date DATE;
ALTER TABLE ci_instance ADD COLUMN purchase_price DECIMAL(12,2);
ALTER TABLE ci_instance ADD COLUMN vendor VARCHAR(128);
ALTER TABLE ci_instance ADD COLUMN warranty_start DATE;
ALTER TABLE ci_instance ADD COLUMN warranty_end DATE;
ALTER TABLE ci_instance ADD COLUMN contract_no VARCHAR(64);

CREATE INDEX idx_ci_instance_lifecycle_status
    ON ci_instance(tenant_id, lifecycle_status) WHERE NOT is_deleted;

-- 设备凭证 ↔ CI 实例关联
ALTER TABLE device_credential ADD COLUMN ci_instance_id BIGINT REFERENCES ci_instance(id);
CREATE INDEX idx_device_credential_ci ON device_credential(ci_instance_id) WHERE NOT is_deleted;
```

CI 实例新增 9 个生命周期/资产管理字段，支持从采购到报废的全生命周期追踪。`device_credential` 表新增 `ci_instance_id` 外键，使凭证可以直接关联到 CI 实例（独立于设备关联）。

---

## Phase 4A: CI 状态变更/删除通知

### 核心服务：CiNotificationService

当 CI 实例状态变更或被删除时，自动向相关用户推送站内信通知。

**通知触发点：**
- `CiInstanceService.update()` — 当 status 字段实际变更时调用 `notifyStatusChange()`
- `CiInstanceService.delete()` — 删除后调用 `notifyDelete()`

**通知目标用户解析逻辑（resolveNotifyTargets）：**
1. CI 实例的 Owner（通过 `instance.owner` 字段的 username 查找用户）
2. 拥有 `platform` 或 `tenant` scope 角色的管理员用户（通过 `sys_role` + `sys_user_role` 表查询）
3. 去重并排除操作者本人

**通知内容示例：**
- 状态变更：`CI 状态变更: web-server-01` / `CI 实例 [web-server-01] 状态从 running 变为 stopped`
- 删除：`CI 实例已删除: web-server-01` / `CI 实例 [web-server-01] 已被 张三 删除`

### 实现要点

```
CiInstanceService
  ├── 注入 CiNotificationService（构造器注入）
  ├── update() → 比较 oldStatus vs newStatus → notifyStatusChange()
  └── delete() → notifyDelete()
```

通知通过 `NotificationService.notify()` 写入 `notification_message` 表，前端通知铃铛 30 秒轮询展示。

---

## Phase 4B: 设备 ↔ CI 实例关联

### 数据模型

`device` 表新增 `ci_instance_id BIGINT` 列（V27），作为指向 `ci_instance(id)` 的外键。

### 关联查询

`CiInstanceService.getRelatedDevices(instanceId, tenantId)` 查询关联到指定 CI 实例的所有设备：

```java
LambdaQueryWrapper<Device> query = new LambdaQueryWrapper<Device>()
    .eq(Device::getCiInstanceId, instanceId)
    .eq(Device::getIsDeleted, false)
    .eq(Device::getTenantId, tenantId)
    .orderByDesc(Device::getCreatedAt);
```

### API 端点

```
GET /api/cmdb/instances/{id}/devices → List<DeviceVO>
```

### 前端集成

- 设备创建/编辑页面可选择关联的 CI 实例（通过 `CiInstanceSelect` 组件）
- CI 实例详情页展示关联设备列表，并提供跳转到设备详情的链接

---

## Phase 4C: CMDB ↔ 变更文档关联

### 核心服务：ChangeDocLinkService

管理 `change_doc_ci_link` 表的读写，支持变更文档与 CI 实例的多对多关联。

**关键方法：**

| 方法 | 描述 |
|------|------|
| `linkCiInstances(tenantId, changeDocId, operatorId, LinkCiRequest)` | 批量关联 CI 实例（幂等，跳过已存在的关联） |
| `unlinkCiInstance(tenantId, changeDocId, instanceId, operatorId)` | 软删除单个关联 |
| `listLinkedInstances(changeDocId, tenantId)` | 列出变更文档关联的 CI 实例（含模型名、状态） |
| `listLinkedChangeDocs(instanceId, tenantId)` | 列出 CI 实例关联的变更文档（含申请人名、状态） |

### API 端点（变更文档侧）

```
POST   /api/change-docs/{id}/ci-links          → Integer（新增关联数）
DELETE /api/change-docs/{id}/ci-links/{instanceId} → void
GET    /api/change-docs/{id}/ci-links          → List<LinkedCiInstanceVO>
```

### API 端点（CI 实例侧）

```
GET    /api/cmdb/instances/{id}/change-docs    → List<LinkedChangeDocVO>
```

### 关联请求格式

```json
{
  "links": [
    { "instanceId": 1, "impactLevel": "high" },
    { "instanceId": 5, "impactLevel": "medium" }
  ]
}
```

### 设计决策

- `ChangeDocLinkService` 直接使用 `CiInstanceMapper` 而非 `CiInstanceService`，避免循环依赖
- 关联操作是幂等的：重复关联同一 CI 实例不会报错，而是跳过
- `impact_level` 字段支持 high / medium / low 三级影响标注
- 所有写操作记录审计日志（module=`change_doc`，action=`link_ci`/`unlink_ci`）

---

## Phase 4D: CMDB ↔ 日报关联

### 数据模型

`daily_report` 表新增 `ci_instance_ids JSONB DEFAULT '[]'` 列（V29），存储关联 CI 实例的 ID 数组。

### 关联查询

`CiInstanceService.getRelatedDailyReports(instanceId, tenantId)` 通过 `DailyReportMapper.findByCiInstanceId()` 查询，底层使用 JSONB 包含查询：

```sql
SELECT * FROM daily_report
WHERE ci_instance_ids @> CAST('[<instanceId>]' AS jsonb)
  AND is_deleted = false
```

### API 端点

```
GET /api/cmdb/instances/{id}/daily-reports → List<DailyReportBriefVO>
```

### 前端集成

- 日报创建/编辑页面通过 `CiInstanceMultiSelect` 组件选择关联的 CI 实例
- CI 实例详情页展示关联日报列表

---

## Phase 4E: IP 地址池管理 (IPAM)

### 核心服务：IpPoolService

管理 IP 地址池的全生命周期：创建（CIDR 自动计算总容量）、分配（手动指定或自动分配下一个可用 IP）、释放、删除。

**CIDR 容量计算：**

```java
// /24 → 254 个可用 IP（减去网络地址和广播地址）
// /31 → 2 个（点对点链路）
// /32 → 1 个（单主机）
int total = (1 << (32 - prefixLength)) - 2;
```

**自动分配逻辑（findNextAvailableIp）：**

1. 从 CIDR 的网络地址 + 1 开始遍历到广播地址 - 1
2. 跳过已分配的 IP（查询 `ip_allocation` 表）
3. 返回第一个可用 IP

**手动分配校验：**

1. 验证 IP 属于 CIDR 范围（位掩码比较）
2. 验证 IP 未被分配（查唯一索引 + 查询确认）

### API 端点

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/ip-pools` | `ip_pool:read` | 地址池列表（keyword/status 筛选 + 分页） |
| GET | `/api/ip-pools/{id}` | `ip_pool:read` | 地址池详情（含分配列表） |
| POST | `/api/ip-pools` | `ip_pool:create` | 创建地址池 |
| PUT | `/api/ip-pools/{id}` | `ip_pool:update` | 更新地址池信息 |
| DELETE | `/api/ip-pools/{id}` | `ip_pool:delete` | 删除地址池（需无活跃分配） |
| POST | `/api/ip-pools/{id}/allocate` | `ip_pool:update` | 分配 IP（可指定 IP 或自动分配） |
| POST | `/api/ip-pools/{id}/release` | `ip_pool:update` | 释放 IP |
| GET | `/api/ip-pools/{id}/utilization` | `ip_pool:read` | 地址池利用率 |
| GET | `/api/ip-pools/instances/{ciInstanceId}` | `ip_pool:read` | 查询 CI 实例关联的 IP 分配 |

### IP 分配请求

```json
{
  "ipAddress": "192.168.1.10",    // 可选，留空则自动分配
  "ciInstanceId": 5,               // 可选，关联到 CI 实例
  "description": "Web 服务器主 IP"
}
```

### 删除保护

删除地址池前检查活跃分配数，如有未释放的 IP 则拒绝删除：

```java
int activeCount = ipPoolMapper.countAllocated(id);
if (activeCount > 0) {
    throw new IllegalArgumentException("地址池中尚有 " + activeCount + " 个已分配的 IP，请先释放后再删除");
}
```

---

## Phase 4F: Prometheus 告警集成

> 详见完整指南: [docs/guide/cmdb-ac3-alerts.md](./cmdb-ac3-alerts.md) — 覆盖数据模型、API 参考、前端组件、RBAC、审计日志、设计决策。

### 核心服务：PrometheusAlertSyncService

通过 Spring `@Scheduled(fixedDelay = 30_000)` 每 30 秒轮询 Prometheus API，同步告警到 `cmdb_alert` 表。

**工作流程：**

1. 读取 `sys_config` 表中的 `prometheus.enabled` 配置，未启用则跳过
2. 读取 `prometheus.url` 配置，请求 `{url}/api/v1/alerts`
3. 遍历返回的告警列表，对每个告警：
   - 提取 `fingerprint`（Prometheus 告警唯一标识）
   - 查询本地是否已存在该 fingerprint 的告警
   - **新告警**：插入 `cmdb_alert` 记录，写审计日志（action=`alert_fired`）
   - **状态变更**（如 firing → resolved）：更新状态和结束时间，写审计日志（action=`alert_resolved`）
   - **无变化**：跳过

**CI 实例自动匹配（resolveCiInstance）：**

通过 Prometheus 告警的 `labels` 自动匹配 CI 实例：

1. 提取 `instance` 标签（格式 `192.168.1.1:9090`）→ 提取 IP
2. 用 IP 查询 `ci_instance.fields_data->>'ip'` 匹配 CI 实例
3. 如果 IP 无匹配，尝试用 hostname 匹配 `ci_instance.name`
4. 提取 `ip` 标签直接匹配
5. 无匹配则 `ci_instance_id` 为 null

### API 端点

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/cmdb/alerts` | `cmdb_alert:read` | 告警列表（status/severity 筛选 + 分页） |
| GET | `/api/cmdb/alerts/by-instance/{instanceId}` | `cmdb_alert:read` | 按 CI 实例查询告警 |
| POST | `/api/cmdb/alerts/{id}/acknowledge` | `cmdb_alert:acknowledge` | 确认告警 |

### 告警确认

确认告警会设置 `acknowledged=true`、记录确认人和时间，并写审计日志（action=`alert_acknowledged`）。

### Prometheus 配置

通过管理后台配置（`PUT /api/admin/config/prometheus`）：

```
prometheus.enabled = true
prometheus.url = http://prometheus:9090
prometheus.scrape_interval = 30
```

### 前端集成

- `usePrometheusAlerts` Hook 每 30 秒轮询告警数据
- CI 实例详情页的「告警」Tab 展示该实例关联的告警
- 管理后台配置页面新增 Prometheus 配置卡片

---

## Phase 4G: CI 实例生命周期 + 凭证管理

### CI 实例生命周期（V32）

CI 实例新增 9 个生命周期和资产管理字段，支持完整的资产生命周期追踪：

| 字段 | 类型 | 说明 |
|------|------|------|
| `lifecycle_status` | VARCHAR(32) | 生命周期状态（如 planning / procurement / deployed / maintenance / retired） |
| `lifecycle_stage` | VARCHAR(32) | 生命周期阶段（更细粒度的阶段分类） |
| `asset_category` | VARCHAR(64) | 资产分类（如 server / network / storage） |
| `purchase_date` | DATE | 采购日期 |
| `purchase_price` | DECIMAL(12,2) | 采购价格 |
| `vendor` | VARCHAR(128) | 供应商 |
| `warranty_start` | DATE | 保修开始日期 |
| `warranty_end` | DATE | 保修结束日期 |
| `contract_no` | VARCHAR(64) | 合同编号 |

对应 Java 实体 `CiInstance.java` 新增以下字段：

```java
private String lifecycleStatus;
private String lifecycleStage;
private String assetCategory;
private LocalDate purchaseDate;
private BigDecimal purchasePrice;
private String vendor;
private LocalDate warrantyStart;
private LocalDate warrantyEnd;
private String contractNo;
```

前端实例详情页的「基本信息」Tab 展示这些字段，编辑表单也支持填写和修改。

### 设备凭证 ↔ CI 实例关联

`device_credential` 表新增 `ci_instance_id` 外键（V32），使凭证可以直接关联到 CI 实例。这与 Phase 4B 的 `device.ci_instance_id` 形成互补：

- **Phase 4B**：设备关联 CI 实例 → 通过设备间接查看凭证
- **Phase 4G**：凭证直接关联 CI 实例 → CI 详情页直接展示关联凭证

**CredentialVO 结构：**

```java
@Data
public class CredentialVO {
    private Long id;
    private Long deviceId;
    private Long groupId;
    private String groupName;
    private String username;
    private String password;       // null when masked, plaintext when revealed
    private String description;
    private LocalDateTime createdAt;
    private Long ciInstanceId;
    private String ciInstanceName;
}
```

### API 端点

```
GET /api/cmdb/instances/{id}/credentials → List<CredentialVO>
```

**权限要求：** `device:view_password`（仅持有查看密码权限的用户可调用）

该端点通过 `DeviceCredentialMapper.findCredentialVOsByCiInstanceId()` 查询，返回所有关联到指定 CI 实例的设备凭证列表。密码字段默认为 null（脱敏），需要单独调用密码揭示接口获取明文。

### 前端集成

- CI 实例详情页新增「凭证」Tab（第 10 个 Tab）
- 凭证列表展示用户名、描述、关联设备
- 支持点击「显示密码」按钮揭示密码明文（需 `device:view_password` 权限）
- 前端使用 `CredentialVO` 接口和 `CredentialRow.tsx` 组件

---

## 前端页面与组件

### CMDB 前端页面（7 页）

| 路由 | 页面 | 功能 | 行数 |
|------|------|------|------|
| `/cmdb` | cmdb/page.tsx | 重定向到 `/cmdb/models` | 9 |
| `/cmdb/models` | models/page.tsx | 模型 CRUD + 分组筛选 + 搜索 + 分页 | 287 |
| `/cmdb/models/[id]` | models/[id]/page.tsx | 模型详情 + 属性 CRUD + 实例列表 Tab + 动态表单 | 494 |
| `/cmdb/instances` | instances/page.tsx | 实例 CRUD + 模型/状态筛选 + 动态表单 + CSV 导入 | 420 |
| `/cmdb/instances/[id]` | instances/[id]/page.tsx | 实例详情 + 基本信息(含生命周期字段) + 关联 CRUD + 拓扑图 + 影响分析 + 关联设备 + 变更文档 + 日报 + 告警 + 凭证 + 变更历史 | 1452 |
| `/cmdb/changes` | changes/page.tsx | 变更历史列表 + 模型筛选 + 日期范围 + 分页 | 127 |

### IPAM 前端页面（2 页）

| 路由 | 页面 | 功能 |
|------|------|------|
| `/ipam` | ipam/page.tsx | 地址池列表 + 创建/编辑/删除 |
| `/ipam/[id]` | ipam/[id]/page.tsx | 地址池详情 + IP 分配/释放 + 利用率可视化 |

### 复用组件

| 组件 | 用途 |
|------|------|
| `CiInstanceSelect` | CI 实例单选下拉（设备关联、IP 分配） |
| `CiLinkSelector` | 变更文档 CI 关联选择器（多选 + 影响级别） |
| `CsvImportDialog` | CSV 导入预览/执行对话框 |
| `CiInstanceMultiSelect` | 日报 CI 实例多选组件 |
| `CredentialRow` | 设备凭证行组件（CI 详情页凭证 Tab 使用） |

### 侧边栏导航

CMDB 和 IPAM 导航项带有权限守卫：

```
{ href: '/cmdb/models',    label: 'CMDB 模型',  icon: ServerCog, resource: 'cmdb_model' }
{ href: '/cmdb/instances', label: 'CMDB 实例',  icon: Database,  resource: 'cmdb_instance' }
{ href: '/cmdb/changes',   label: 'CMDB 变更',  icon: History,   resource: 'cmdb_instance' }
{ href: '/ipam',           label: 'IP 地址池',   icon: Globe,     resource: 'ip_pool' }
```

### 数据加载方式

所有 CMDB 功能页面均通过 TanStack Query (v5) 加载 API 数据，支持缓存、自动刷新、乐观更新。

---

## API 参考

### CMDB 实例新增端点（Tier 4）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/cmdb/instances/{id}/devices` | `cmdb_instance:read` | 关联设备列表 |
| GET | `/api/cmdb/instances/{id}/change-docs` | `cmdb_instance:read` | 关联变更文档列表 |
| GET | `/api/cmdb/instances/{id}/daily-reports` | `cmdb_instance:read` | 关联日报列表 |
| GET | `/api/cmdb/instances/{id}/credentials` | `device:view_password` | 关联设备凭证列表 |

### 变更文档 CI 关联端点

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/change-docs/{id}/ci-links` | `change_doc:update` | 批量关联 CI 实例 |
| DELETE | `/api/change-docs/{id}/ci-links/{instanceId}` | `change_doc:update` | 取消关联 |
| GET | `/api/change-docs/{id}/ci-links` | `change_doc:read` | 列出关联的 CI 实例 |

### IPAM 端点

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/ip-pools` | `ip_pool:read` | 地址池列表 |
| GET | `/api/ip-pools/{id}` | `ip_pool:read` | 地址池详情 |
| POST | `/api/ip-pools` | `ip_pool:create` | 创建地址池 |
| PUT | `/api/ip-pools/{id}` | `ip_pool:update` | 更新地址池 |
| DELETE | `/api/ip-pools/{id}` | `ip_pool:delete` | 删除地址池 |
| POST | `/api/ip-pools/{id}/allocate` | `ip_pool:update` | 分配 IP |
| POST | `/api/ip-pools/{id}/release` | `ip_pool:update` | 释放 IP |
| GET | `/api/ip-pools/{id}/utilization` | `ip_pool:read` | 利用率 |
| GET | `/api/ip-pools/instances/{ciInstanceId}` | `ip_pool:read` | CI 实例关联的 IP |

### 告警端点

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/cmdb/alerts` | `cmdb_alert:read` | 告警列表 |
| GET | `/api/cmdb/alerts/by-instance/{instanceId}` | `cmdb_alert:read` | 按实例查询告警 |
| POST | `/api/cmdb/alerts/{id}/acknowledge` | `cmdb_alert:acknowledge` | 确认告警 |

### 系统配置端点

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| PUT | `/api/admin/config/prometheus` | `notification:manage` | 配置 Prometheus 连接 |

---

## 权限控制（RBAC）

### 新增资源

| 资源 (resource) | actions | 注册于 |
|-----------------|---------|--------|
| `ip_pool` | create, read, update, delete | V30 |
| `cmdb_alert` | create, read, acknowledge | V31 |

### 角色权限分配

| 角色 | ip_pool | cmdb_alert |
|------|---------|------------|
| super_admin | 全部 | 全部 |
| admin | 全部 | 全部 |
| group_leader | 全部 | read, acknowledge |
| member | read | read |
| viewer | read | read |

### 前端权限守卫

- 侧边栏导航项绑定 `resource + action`，无权限的菜单项自动隐藏
- 页面级别通过 `usePermission().hasPermission(resource, action)` 检查
- API 级别通过 `@PreAuthorize` 或 `@PreAuthorize("hasPermission(...)")` 控制

---

## 审计日志

所有 Tier 4 写操作均写入 `audit_log` 表：

| 模块 (module) | 动作 (action) | 目标类型 (targetType) | 触发场景 |
|---------------|---------------|----------------------|----------|
| cmdb | alert_fired | cmdb_alert | Prometheus 新告警写入 |
| cmdb | alert_resolved | cmdb_alert | 告警状态变为 resolved |
| cmdb | alert_acknowledged | cmdb_alert | 用户确认告警 |
| change_doc | link_ci | ChangeDoc | 变更文档关联 CI 实例 |
| change_doc | unlink_ci | ChangeDoc | 变更文档取消关联 |
| ip_pool | create | ip_pool | 创建地址池 |
| ip_pool | update | ip_pool | 更新地址池 |
| ip_pool | delete | ip_pool | 删除地址池 |
| ip_pool | allocate | ip_pool | 分配 IP |
| ip_pool | release | ip_pool | 释放 IP |

Prometheus 告警同步的审计日志 `operatorId=0L`（系统自动操作）。

---

## 配置项

Prometheus 集成需要在 `sys_config` 表中配置以下键（通过管理后台或 API 设置）：

| 配置键 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `prometheus.enabled` | boolean | false | 是否启用告警同步 |
| `prometheus.url` | string | — | Prometheus 服务器地址（如 `http://prometheus:9090`） |
| `prometheus.scrape_interval` | number | 30 | 轮询间隔（秒），实际由 `@Scheduled(fixedDelay = 30_000)` 控制 |

配置通过 `PUT /api/admin/config/prometheus` 设置，需要 `notification:manage` 权限。

---

## 已知问题与注意事项

### 已修复的问题

1. **createModel 参数名不匹配**（已修复，commit 09692b952）
   - ~~从模型详情页跳转到实例创建页时，URL 传 `createModel` 参数，但 instances 页面读取 `model` 参数~~
   - 已统一参数名为 `model`，从模型详情自动预设模型功能正常

### 代码质量提示

1. `instances/[id]/page.tsx` 第 258 行使用了 `relEditTarget!.id` 非空断言
2. `models/[id]/page.tsx` 第 98 行使用了 `model!.name` 非空断言
   - 建议添加 null 检查以避免运行时错误

### 架构注意事项

1. **ChangeDocLinkService 避免循环依赖**：该服务直接注入 `CiInstanceMapper` 而非 `CiInstanceService`，因为它被后者依赖
2. **Prometheus 告警 CI 匹配**：依赖 CI 实例的 `fields_data->>'ip'` 字段或 `name` 字段匹配 Prometheus 的 `instance` 标签。如果 CI 实例没有 `ip` 属性或名称不匹配 Prometheus 主机名，告警的 `ci_instance_id` 将为 null
3. **IPAM 仅支持 IPv4**：CIDR 计算和 IP 地址解析基于 32 位整数，不支持 IPv6
4. **日报 CI 关联使用 JSONB 数组**：查询通过 `@>` 包含操作符，大数据量下可能需要 GIN 索引优化
5. **告警 fingerprint 唯一**：基于 Prometheus 的 fingerprint 去重，确保同一告警不会重复入库
6. **凭证 ↔ CI 双重关联**：`device.ci_instance_id`（Phase 4B）通过设备间接关联凭证，`device_credential.ci_instance_id`（Phase 4G）直接关联。CI 详情页的凭证 Tab 使用直接关联查询，覆盖未关联设备但直接绑定 CI 的凭证
7. **生命周期字段可选**：V32 新增的生命周期/资产字段均为 nullable，不影响现有实例的创建和更新流程
