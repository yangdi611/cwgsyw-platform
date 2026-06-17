# CMDB AC3 — Prometheus 告警集成完整指南

> 模块：CMDB / Prometheus 告警集成（AC3）
> 对应 Flyway V31，后端 4 文件 + 前端 3 文件
> 覆盖：告警同步 → 告警列表 → 筛选/分页/确认 → 实例关联

---

## 目录

1. [概述](#概述)
2. [数据模型](#数据模型)
3. [核心服务：PrometheusAlertSyncService](#核心服务prometheusalertsyncservice)
4. [API 参考](#api-参考)
5. [前端页面与组件](#前端页面与组件)
6. [权限控制（RBAC）](#权限控制rbac)
7. [审计日志](#审计日志)
8. [配置项](#配置项)
9. [集成工作流](#集成工作流)
10. [设计决策与注意事项](#设计决策与注意事项)

---

## 概述

AC3 实现了 CMDB 与 Prometheus 告警的深度集成，提供「告警自动同步 → CI 实例自动关联 → 统一列表 + 筛选/分页/确认」的完整闭环。

### 核心能力

| # | 能力 | 后端 | 前端 | 说明 |
|---|------|------|------|------|
| 1 | Prometheus 告警自动同步 | ✅ | — | 每 30 秒轮询 `/api/v1/alerts`，基于 fingerprint 增/改审计 |
| 2 | CI 实例自动匹配 | ✅ | — | 通过 instance 标签 IP / hostname 自动关联 CI 实例 |
| 3 | 告警列表 + 筛选 | ✅ | ✅ | status/firing|resolved + severity/critical|warning|info |
| 4 | 分页 | ✅ | ✅ | MyBatis-Plus Page + 前端 prev/next |
| 5 | 告警确认 | ✅ | ✅ | POST acknowledge → 设置用户/时间 + 审计日志 |
| 6 | 实例详情告警 Tab | — | ✅ | InstanceAlertsTab 组件，嵌入实例详情页 |
| 7 | 侧边栏入口 | — | ✅ | CMDB 导航组「CMDB 警告」项 |
| 8 | RBAC 权限守卫 | ✅ | ✅ | cmdb_alert:read / acknowledge |

### 文件结构

```
后端:
module/cmdb/alert/
  CmdbAlertController.java          # 157 行  /api/cmdb/alerts (3 endpoints)
  CmdbAlertMapper.java              # 21 行   告警查询 + fingerprint 去重
  PrometheusAlertSyncService.java   # 205 行  30s 定时轮询 Prometheus API
  entity/CmdbAlert.java             # 27 行   cmdb_alert 实体
  dto/CmdbAlertVO.java              # 21 行   告警响应 DTO
resources/db/migration/
  V31__prometheus_alerts.sql        # 67 行   建表 + 索引 + RBAC

前端:
app/(dashboard)/cmdb/alerts/page.tsx        # 264 行  告警列表页
hooks/usePrometheusAlerts.ts                # 39 行   数据 Hook + 确认 Mutation
components/cmdb/InstanceAlertsTab.tsx       # 130 行  实例详情告警 Tab
components/layout/Sidebar.tsx               # line 72 导航入口
```

---

## 数据模型

### 表结构: `cmdb_alert`

```sql
CREATE TABLE cmdb_alert (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL DEFAULT 'default',
    ci_instance_id    BIGINT REFERENCES ci_instance(id),   -- 关联的 CI 实例（可为 null）
    alert_name        VARCHAR(256) NOT NULL,                 -- 告警规则名称
    severity          VARCHAR(32) NOT NULL DEFAULT 'warning', -- critical / warning / info
    status            VARCHAR(32) NOT NULL DEFAULT 'firing',  -- firing / resolved
    fingerprint       VARCHAR(64) NOT NULL,                   -- Prometheus 告警唯一指纹
    summary           TEXT,                                   -- 告警摘要
    description       TEXT,                                   -- 告警详细描述
    starts_at         TIMESTAMP,                              -- 告警触发时间
    ends_at           TIMESTAMP,                              -- 告警恢复时间
    raw_labels        TEXT,                                   -- Prometheus labels JSON 原文
    acknowledged      BOOLEAN DEFAULT FALSE,                  -- 是否已人工确认
    acknowledged_at   TIMESTAMP,                              -- 确认时间
    acknowledged_by   BIGINT,                                 -- 确认人用户 ID
    is_deleted        BOOLEAN DEFAULT FALSE,
    deleted_at        TIMESTAMP,
    deleted_by        BIGINT,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by        BIGINT,
    updated_by        BIGINT
);
```

### 索引

```sql
-- 告警防重（逻辑删除后排除）
CREATE UNIQUE INDEX idx_cmdb_alert_fingerprint
  ON cmdb_alert(fingerprint) WHERE is_deleted = FALSE;

-- 快速查询实例关联告警
CREATE INDEX idx_cmdb_alert_ci
  ON cmdb_alert(ci_instance_id, tenant_id);

-- 快速筛选告警状态
CREATE INDEX idx_cmdb_alert_status
  ON cmdb_alert(status, tenant_id);
```

### 字段说明

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| `fingerprint` | VARCHAR(64) | Prometheus API | 告警唯一标识，同步过程用于 upsert |
| `severity` | VARCHAR(32) | `labels.severity` | 严重级别: `critical`/`warning`/`info` |
| `status` | VARCHAR(32) | `alert.status` | `firing`=触发中, `resolved`=已恢复 |
| `ci_instance_id` | BIGINT FK | 自动匹配 | 通过 instance label IP 或 hostname 匹配 CI 实例 |
| `raw_labels` | TEXT | `labels` JSON | 保留完整 labels 以便未来扩展 |
| `acknowledged` | BOOLEAN | 人工操作 | 默认为 false，确认后不可撤销 |

---

## 核心服务：PrometheusAlertSyncService

通过 Spring `@Scheduled(fixedDelay = 30_000)` 每 30 秒轮询 Prometheus Alertmanager API。

### 同步流程

```
┌─────────────────────────────────────────────────────────────┐
│                       每 30 秒                              │
│                                                             │
│  1. 读取 sys_config → prometheus.enabled == true?           │
│     ├── 否 → 跳过本轮                                       │
│     └── 是 → 读取 prometheus.url                             │
│                                                             │
│  2. GET {prometheus.url}/api/v1/alerts                       │
│     ├── HTTP 失败 → log.warn + 跳过本轮                     │
│     └── 成功 → 解析 JSON 的 data.alerts 数组                 │
│                                                             │
│  3. 遍历每个告警:                                            │
│     ├── 提取 fingerprint → 查询本地是否存在                 │
│     │   ├── 不存在 → INSERT new + audit_log(alert_fired)    │
│     │   ├── 存在但 status 不同 → UPDATE + audit_log(alert_   │
│     │   │   resolved 或 re-fired)                            │
│     │   └── 存在且 status 相同 → 跳过（无变更）             │
│     └── 异常 → log.warn + 继续下一条                        │
└─────────────────────────────────────────────────────────────┘
```

### CI 实例自动匹配（resolveCiInstance）

告警 labels 中可能包含多种标识 CI 实例的方式，匹配优先级如下：

| 优先级 | 标签 | 匹配策略 | 示例 |
|--------|------|----------|------|
| 1 | `instance` | 提取 IP 部分，查 `fields_data->>'ip'` | `192.168.1.1:9090` → IP `192.168.1.1` |
| 2 | `instance` (IP 匹配失败) | 用 IP 尝试匹配 `ci_instance.name`（可能为 hostname） | `web-01` → name 匹配 |
| 3 | `ip` | 直接按 IP 查 `fields_data->>'ip'` | `10.0.0.5` |
| 4 | 所有标签均不匹配 | `ci_instance_id` 设为 null | 告警仍会入库，但无法在实例详情页展示 |

### 配置开关

| 配置项 | 类型 | 默认 | 说明 |
|--------|------|------|------|
| `prometheus.enabled` | boolean | 无（必须设置） | 启用告警同步，未配置则跳过 |
| `prometheus.url` | string | 无 | Prometheus 服务地址，如 `http://prometheus:9090` |

配置通过 `SysConfigService` 读取，可在管理后台动态修改（无需重启）。

---

## API 参考

所有 API 需要 JWT 认证，通过 `@PreAuthorize` 进行权限检查。

### 1. 告警列表

```
GET /api/cmdb/alerts
```

**权限**: `cmdb_alert:read`

**查询参数**:

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `severity` | String | null | 筛选: `critical` / `warning` / `info` |
| `status` | String | null | 筛选: `firing` / `resolved` |
| `page` | int | 1 | 页码 |
| `size` | int | 20 | 每页条数 |

**响应**: `PageResult<CmdbAlertVO>`

```json
{
  "records": [
    {
      "id": 42,
      "ci_instance_id": 1,
      "ci_instance_name": "web-01",
      "alert_name": "HighCpuUsage",
      "severity": "critical",
      "status": "firing",
      "summary": "CPU usage > 90% on web-01",
      "description": "CPU usage has been above 90% for 5 minutes",
      "starts_at": "2026-06-17T10:30:00",
      "ends_at": null,
      "acknowledged": false,
      "created_at": "2026-06-17T10:30:01"
    }
  ],
  "total": 128,
  "page": 1,
  "size": 20
}
```

**字段说明**:

| 字段 | 说明 |
|------|------|
| `ci_instance_name` | 实时从 `ci_instance` 表中 resolve，非冗余存储 |
| `acknowledged` | 是否已被工程师确认，`true` = 已知晓处理中 |
| `starts_at` | Prometheus 方报告的触发时间 |
| `ends_at` | `firing` 时为 null，`resolved` 时为恢复时间 |

### 2. 按实例查询告警

```
GET /api/cmdb/alerts/by-instance/{instanceId}
```

**权限**: `cmdb_alert:read`

**返回**: `List<CmdbAlertVO>` — 该 CI 实例关联的所有非删除告警，按触发时间降序。

**注意**：该端点不返回 `PageResult` — 返回值是完整列表。因为实例级别的告警数量通常较少（个位数），免去分页的复杂度。

### 3. 确认告警

```
POST /api/cmdb/alerts/{id}/acknowledge
```

**权限**: `cmdb_alert:acknowledge`

**请求体**: 无

**响应**: `CmdbAlertVO`（更新后的告警对象）

**副作用**:
1. 设置 `acknowledged = true`
2. 记录 `acknowledged_at = now()`、`acknowledged_by = 当前用户 ID`
3. 写入审计日志，action=`alert_acknowledged`

**错误处理**:
- 告警不存在 → `R.fail("告警不存在")`
- 无 acknowledge 权限 → Spring Security 403

---

## 前端页面与组件

### 告警列表页 (`/cmdb/alerts`)

**文件**: `frontend/src/app/(dashboard)/cmdb/alerts/page.tsx` (264 行)

**功能**:
- 权限守卫：无 `cmdb_alert:read` 权限自动重定向到首页
- 筛选栏：级别下拉（全部/严重/警告/提示）+ 状态下拉（全部/触发/已恢复）
- 表格展示：级别标签（颜色编码）、状态标签、告警名称+描述、关联实例、摘要、触发时间、操作列
- 确认按钮：`cmdb_alert:acknowledge` 权限控制显隐，已确认的显示 ✅ 标记
- 分页：上/下按钮 + `{page} / {totalPages}` + 总数显示
- 刷新策略：React Query 缓存，确认后自动 invalidate

**UI 规范**:

| 元素 | 颜色 | 样式 |
|------|------|------|
| `critical` 级别 | 红色 | `border-red-500/40 bg-red-500/15 text-red-700` |
| `warning` 级别 | 琥珀色 | `border-amber-500/40 bg-amber-500/15 text-amber-700` |
| `info` 级别 | 蓝色 | `border-blue-500/40 bg-blue-500/15 text-blue-700` |
| `firing` 状态 | 红色 | `border-red-500/40 bg-red-500/10 text-red-700` |
| `resolved` 状态 | 绿色 | `border-green-500/40 bg-green-500/10 text-green-700` |

### 实例详情告警 Tab (`InstanceAlertsTab`)

**文件**: `frontend/src/components/cmdb/InstanceAlertsTab.tsx` (130 行)

**集成方式**: 嵌入实例详情页 (`/cmdb/instances/[id]`) 的 Tab 中，通过 `useInstanceAlerts(instanceId)` 加载数据。

**展示**:
- 卡片列表：每条告警渲染为独立卡片（vs 表格——更适合少量关联数据）
- 空状态：`BellOff` 图标 + 「该实例暂无告警」
- 加载中：loading 文字
- 底部链接：「查看全部告警 →」跳转到 `/cmdb/alerts`

### 数据 Hook (`usePrometheusAlerts.ts`)

**文件**: `frontend/src/hooks/usePrometheusAlerts.ts` (39 行)

| Hook | 用途 | 缓存 key |
|------|------|----------|
| `useInstanceAlerts(instanceId)` | 加载实例关联告警列表 | `['cmdb-instance-alerts', instanceId]` |
| `useAcknowledgeAlert()` | 确认告警 Mutation | invalidates `['cmdb-instance-alerts']` + `['cmdb-alerts']` |

**类型对齐注意**: 后端 Jackson 全局 SNAKE_CASE 策略返回 snake_case JSON（`ci_instance_name`），但 `CmdbAlertVO` 接口在 hook 中定义为 camelCase。前端 page 和 tab 组件各自用本地 `AlertVO` 接口（snake_case 字段名）读取真实响应。参见代码中的 TODO 注释。

---

## 权限控制（RBAC）

### V31 新增资源

```sql
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
    ('cmdb_alert', 'CMDB 告警', '["create","read","acknowledge"]', 54);
```

### 角色权限矩阵

| 角色 | cmdb_alert:read | cmdb_alert:acknowledge | cmdb_alert:create |
|------|:---------------:|:----------------------:|:-----------------:|
| super_admin | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ |
| group_leader | ✅ | ✅ | — |
| member | ✅ | — | — |
| viewer | ✅ | — | — |

**说明**:
- `group_leader` 可以确认本租户下的告警（但不创建 — 告警自动同步）
- `member` 只能查看，不能确认
- `create` 权限已注册但不影响现有功能（告警由同步服务自动创建，不走用户操作）

### 前端守卫

- 列表页入口：侧边栏显示前提是用户拥有 `cmdb_alert:read`
- 页面守卫：无 `cmdb_alert:read` 重定向 `/`
- 确认按钮：无 `cmdb_alert:acknowledge` 不显示确认按钮

---

## 审计日志

AC3 的每一次告警生命周期事件都会写入 `audit_log` 表：

| action | 触发条件 | operator_id | 说明 |
|--------|----------|-------------|------|
| `alert_fired` | 同步服务发现新告警 | 0（系统） | 记录 alert_name 到 remark |
| `alert_resolved` | 同步服务发现告警从 firing → resolved | 0（系统） | 同上 |
| `alert_acknowledged` | 用户通过 POST acknowledge 确认 | 当前用户 ID | 确认人记录到 operator_id |

审计日志的 `target_type` 统一为 `cmdb_alert`，`target_id` 为告警 ID。

---

## 配置项

通过 `PUT /api/admin/config/prometheus` 配置：

```json
// sys_config 表中存储
{
  "key": "prometheus.enabled",
  "value": "true"
},
{
  "key": "prometheus.url",
  "value": "http://prometheus:9090"
}
```

| 管理后台 | 功能 |
|----------|------|
| 系统配置页 | 编辑 Prometheus URL / 启用开关 |

**切换生效**: 无需重启服务，下一次调度（最多 30 秒）自动检测配置变更。

---

## 集成工作流

### 完整链路

```
Prometheus Alertmanager
    │
    │ 每 30 秒轮询 GET /api/v1/alerts
    ▼
PrometheusAlertSyncService
    │
    ├─ 新告警 → INSERT cmdb_alert + audit_log('alert_fired')
    ├─ 状态变更 → UPDATE cmdb_alert + audit_log('alert_resolved')
    └─ 无变更 → 跳过
          │
          ▼
工程师访问 /cmdb/alerts
    │
    ├─ 查看告警列表（筛选/分页）
    ├─ 点击告警名称 → 查看详情（alert_name + description）
    ├─ 关联实例 → 可点击跳转到实例详情页
    └─ 确认告警 → POST /api/cmdb/alerts/{id}/acknowledge
          │
          ▼
    audit_log('alert_acknowledged')
    cmdb_alert.acknowledged = true
```

### 告警生命周期

```
                ┌─────────────┐
                │   无告警     │
                └──────┬──────┘
                       │ Prometheus 触发告警规则
                       ▼
                ┌─────────────┐
                │   firing    │ ──→ 工程师确认 → acknowledged = true
                │  (触发中)   │      （确认后状态仍保持 firing）
                └──────┬──────┘
                       │ 告警规则恢复
                       ▼
                ┌─────────────┐
                │  resolved   │
                │  (已恢复)    │
                └─────────────┘
```

---

## 设计决策与注意事项

### AD-1: fingerprint 作为去重键

选择 Prometheus 的 `fingerprint` 作为本地唯一键，而非 `alert_name` + `starts_at` 复合键。原因：
- fingerprint 由 Prometheus 按 labels 内容 hash 生成，完全相同规则+实例的告警产生相同 fingerprint，天然防重
- 唯一索引使用了部分索引（`WHERE is_deleted = FALSE`），逻辑删除不影响唯一约束

### AD-2: 不提供编辑/删除告警的 API

告警数据完全由 Prometheus Sidecar 同步管理，数据源唯一权威。前端不提供编辑/删除功能，避免人工修改与同步循环不一致。

### AD-3: 30 秒固定轮询间隔

- 当前采用 `@Scheduled(fixedDelay = 30_000)` — 任务完成后再等 30 秒
- 未来可改为 `SysConfigService` 中配置 `prometheus.scrape_interval` 动态调整
- 对于高频率告警场景，可改为 fixedRate（但需注意 Prometheus API 限流）

### AD-4: by-instance 端点不分页

`GET /api/cmdb/alerts/by-instance/{instanceId}` 返回完整列表而非分页结果。理由：
- 单个实例的活跃告警通常 ≤ 10 条（多数 0-3 条）
- Tab 内展示不需要分页 UI 的复杂度
- 若未来有实例产生大量告警，可改为分页（附带 cursor 参数）

### 注意事项

1. **类型对齐问题**: 前端 `CmdbAlertVO` hook 接口定义为 camelCase，但后端 Jackson SNAKE_CASE 全局策略返回 snake_case。page 和 InstanceAlertsTab 各自用本地 snake_case 接口规避。**TODO**: 对齐 hook 中的接口定义。
2. **确认不可逆**: 当前 `acknowledge` 是单向操作 — 确认后不可取消。如需「标记为误报」等能力，需新增字段或状态。
3. **Prometheus 不可用**: sync 失败时仅 log.warn，不会级联失败。旧告警数据仍在本地表可查询。
4. **无自动清理**: 已 resolved 的告警不会自动删除。长期运行后 cmdb_alert 表可能增长。建议外部定期清理已 resolved + 超过 N 天的告警。
5. **CI 实例匹配精度**: 基于 IP/hostname 的匹配在 NAT/容器场景下可能有歧义。可通过扩展 `resolveCiInstance` 方法增加标签映射规则。
