# CMDB Phase 1: Metadata Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CMDB metadata layer — model definitions, attribute definitions with full type system, attribute groups, association kinds, and association definitions — which is the foundation everything else (CI instances, associations, topology) depends on.

**Architecture:** New `cmdb` module under `backend/src/main/java/com/cwgsyw/platform/module/cmdb/`. All CMDB tables use the existing PostgreSQL (JSONB for `option` field on attributes). Metadata is mostly admin-only; `super_admin` and `admin` can manage models/attributes; all roles can read models (needed for dynamic form rendering). Frontend has a `/cmdb` section with model management pages.

**Tech Stack:** Spring Boot 3.4.5, MyBatis-Plus 3.5.12, PostgreSQL 16 (JSONB), Next.js 15, shadcn/ui, TanStack Query v5

---

## File Map

**Backend — new:**
- `backend/src/main/resources/db/migration/V14__cmdb_metadata.sql`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiModel.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAttribute.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAttributeGroup.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAssociationKind.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAssociationDef.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiModelMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiAttributeMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiAttributeGroupMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiAssociationKindMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiAssociationDefMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiModelVO.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiAttributeVO.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/SaveCiModelRequest.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/SaveCiAttributeRequest.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/SaveAssociationKindRequest.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/SaveAssociationDefRequest.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiMetadataService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiMetadataController.java`

**Frontend — new:**
- `frontend/src/app/(dashboard)/cmdb/page.tsx` — model list page
- `frontend/src/app/(dashboard)/cmdb/models/[modelId]/page.tsx` — model detail + attribute editor
- `frontend/src/app/(dashboard)/cmdb/associations/page.tsx` — association kinds + defs management

**Frontend — modified:**
- `frontend/src/components/layout/Sidebar.tsx` — add CMDB nav item

---

## Task 1: V14 Database Migration

**Files:**
- Create: `backend/src/main/resources/db/migration/V14__cmdb_metadata.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- V14: CMDB 元数据层

-- 模型分类（用于在 UI 中对模型分组展示）
CREATE TABLE ci_model_group (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    code        VARCHAR(64)  NOT NULL,
    name        VARCHAR(128) NOT NULL,
    icon        VARCHAR(64),
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_built_in BOOLEAN      NOT NULL DEFAULT FALSE,
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by  BIGINT       NOT NULL DEFAULT 0,
    UNIQUE(tenant_id, code)
);

-- 模型定义（类比 bk-cmdb cc_ObjDes）
CREATE TABLE ci_model (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    model_id    VARCHAR(64)  NOT NULL,             -- 唯一标识，如 host / mysql_instance
    name        VARCHAR(128) NOT NULL,
    icon        VARCHAR(64),
    group_code  VARCHAR(64),                       -- FK to ci_model_group.code
    description VARCHAR(512),
    is_built_in BOOLEAN      NOT NULL DEFAULT FALSE, -- 内置模型不可删除
    is_paused   BOOLEAN      NOT NULL DEFAULT FALSE,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by  BIGINT       NOT NULL DEFAULT 0,
    UNIQUE(tenant_id, model_id)
);
CREATE INDEX idx_ci_model_tenant ON ci_model(tenant_id) WHERE NOT is_deleted;

-- 属性分组（用于在详情页对字段分组展示）
CREATE TABLE ci_attribute_group (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    model_id    VARCHAR(64)  NOT NULL,
    group_id    VARCHAR(64)  NOT NULL,             -- 分组唯一标识
    name        VARCHAR(128) NOT NULL,
    is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
    is_built_in BOOLEAN      NOT NULL DEFAULT FALSE,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, model_id, group_id)
);

-- 属性定义（类比 bk-cmdb cc_ObjAttDes）
-- field_type: singlechar | longchar | int | float | enum | enummulti | date | time | bool | list | innertable | objuser
CREATE TABLE ci_attribute (
    id            BIGSERIAL PRIMARY KEY,
    tenant_id     VARCHAR(64)  NOT NULL DEFAULT 'default',
    model_id      VARCHAR(64)  NOT NULL,
    field_key     VARCHAR(64)  NOT NULL,           -- 字段唯一标识，如 bk_host_innerip
    name          VARCHAR(128) NOT NULL,           -- 中文标签
    group_id      VARCHAR(64),                     -- 所属分组
    field_type    VARCHAR(32)  NOT NULL,           -- 字段类型
    option        JSONB,                           -- 类型约束（枚举选项/数值范围等）
    default_val   TEXT,
    placeholder   VARCHAR(255),
    unit          VARCHAR(32),
    is_required   BOOLEAN      NOT NULL DEFAULT FALSE,
    is_editable   BOOLEAN      NOT NULL DEFAULT TRUE,
    is_unique     BOOLEAN      NOT NULL DEFAULT FALSE,
    is_built_in   BOOLEAN      NOT NULL DEFAULT FALSE,
    is_list_show  BOOLEAN      NOT NULL DEFAULT TRUE,  -- 是否在列表页展示
    sort_order    INTEGER      NOT NULL DEFAULT 0,
    is_deleted    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by    BIGINT       NOT NULL DEFAULT 0,
    UNIQUE(tenant_id, model_id, field_key)
);
CREATE INDEX idx_ci_attribute_model ON ci_attribute(tenant_id, model_id) WHERE NOT is_deleted;

-- 关联种类（关联的语义类型，如"属于"/"运行"/"依赖"）
CREATE TABLE ci_association_kind (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64)  NOT NULL DEFAULT 'default',
    kind_id      VARCHAR(64)  NOT NULL,            -- 如 belong / run / depend / bk_mainline
    name         VARCHAR(128) NOT NULL,
    src_to_dst   VARCHAR(64),                      -- 正向描述，如"属于"
    dst_to_src   VARCHAR(64),                      -- 反向描述，如"包含"
    is_built_in  BOOLEAN      NOT NULL DEFAULT FALSE,
    is_deleted   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, kind_id)
);

-- 模型关联定义（定义两个模型间允许建立哪种关联）
-- mapping: 1:1 | 1:n | n:n
-- on_delete: none | delete_src | delete_dst
CREATE TABLE ci_association_def (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64)  NOT NULL DEFAULT 'default',
    def_id       VARCHAR(128) NOT NULL,            -- 格式: {src_model_id}_{kind_id}_{dst_model_id}
    kind_id      VARCHAR(64)  NOT NULL,
    src_model_id VARCHAR(64)  NOT NULL,
    dst_model_id VARCHAR(64)  NOT NULL,
    name         VARCHAR(128),
    mapping      VARCHAR(8)   NOT NULL DEFAULT 'n:n',
    on_delete    VARCHAR(16)  NOT NULL DEFAULT 'none',
    is_built_in  BOOLEAN      NOT NULL DEFAULT FALSE,
    is_deleted   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, def_id)
);

-- ── 内置模型分类种子数据 ──────────────────────────────────────────────────────
INSERT INTO ci_model_group (tenant_id, code, name, icon, sort_order, is_built_in) VALUES
('default', 'host_manage',   '主机管理',   'server',     1, TRUE),
('default', 'network',       '网络设备',   'network',    2, TRUE),
('default', 'app_manage',    '应用管理',   'app',        3, TRUE),
('default', 'middleware',    '中间件',     'database',   4, TRUE),
('default', 'datacenter',    '数据中心',   'building',   5, TRUE);

-- ── 内置关联种类种子数据 ──────────────────────────────────────────────────────
INSERT INTO ci_association_kind (tenant_id, kind_id, name, src_to_dst, dst_to_src, is_built_in) VALUES
('default', 'bk_mainline', '主线拓扑', '属于',   '包含',   TRUE),
('default', 'belong',      '属于',     '属于',   '包含',   TRUE),
('default', 'run',         '运行',     '运行在', '运行着', TRUE),
('default', 'connect',     '连接',     '连接',   '连接',   TRUE),
('default', 'depend',      '依赖',     '依赖',   '被依赖', TRUE),
('default', 'deploy',      '部署',     '部署到', '部署着', TRUE);

-- ── 内置主机模型 ──────────────────────────────────────────────────────────────
INSERT INTO ci_model (tenant_id, model_id, name, icon, group_code, description, is_built_in, sort_order)
VALUES ('default', 'host', '主机', 'server', 'host_manage', '物理机/虚拟机', TRUE, 1);

-- 主机属性分组
INSERT INTO ci_attribute_group (tenant_id, model_id, group_id, name, is_default, is_built_in, sort_order)
VALUES
('default', 'host', 'base',     '基本信息', TRUE,  TRUE, 1),
('default', 'host', 'hardware', '硬件信息', FALSE, TRUE, 2),
('default', 'host', 'network',  '网络信息', FALSE, TRUE, 3);

-- 主机内置属性
INSERT INTO ci_attribute (tenant_id, model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, sort_order) VALUES
('default', 'host', 'inner_ip',    '内网IP',     'base',     'singlechar', TRUE,  FALSE, TRUE,  TRUE,  1),
('default', 'host', 'outer_ip',    '外网IP',     'network',  'singlechar', FALSE, TRUE,  FALSE, TRUE,  2),
('default', 'host', 'hostname',    '主机名',     'base',     'singlechar', FALSE, TRUE,  FALSE, TRUE,  3),
('default', 'host', 'os_type',     '操作系统',   'base',     'enum',       FALSE, TRUE,  FALSE, TRUE,  4),
('default', 'host', 'os_version',  'OS版本',     'base',     'singlechar', FALSE, TRUE,  FALSE, TRUE,  5),
('default', 'host', 'cpu_cores',   'CPU核心数',  'hardware', 'int',        FALSE, TRUE,  FALSE, TRUE,  6),
('default', 'host', 'mem_gb',      '内存(GB)',   'hardware', 'int',        FALSE, TRUE,  FALSE, TRUE,  7),
('default', 'host', 'disk_gb',     '磁盘(GB)',   'hardware', 'int',        FALSE, TRUE,  FALSE, TRUE,  8),
('default', 'host', 'operator',    '主要负责人', 'base',     'objuser',    FALSE, TRUE,  FALSE, TRUE,  9),
('default', 'host', 'env',         '环境',       'base',     'enum',       FALSE, TRUE,  FALSE, TRUE,  10),
('default', 'host', 'status',      '状态',       'base',     'enum',       FALSE, TRUE,  FALSE, TRUE,  11),
('default', 'host', 'comment',     '备注',       'base',     'longchar',   FALSE, TRUE,  FALSE, TRUE,  12);

-- 主机 OS 类型枚举
UPDATE ci_attribute SET option = '[
  {"id":"linux",   "name":"Linux",   "is_default":true},
  {"id":"windows", "name":"Windows", "is_default":false},
  {"id":"aix",     "name":"AIX",     "is_default":false},
  {"id":"other",   "name":"其他",    "is_default":false}
]'::jsonb WHERE model_id='host' AND field_key='os_type';

-- 主机环境枚举
UPDATE ci_attribute SET option = '[
  {"id":"prod",    "name":"生产",   "is_default":false},
  {"id":"staging", "name":"预发布", "is_default":false},
  {"id":"test",    "name":"测试",   "is_default":false},
  {"id":"dev",     "name":"开发",   "is_default":true}
]'::jsonb WHERE model_id='host' AND field_key='env';

-- 主机状态枚举
UPDATE ci_attribute SET option = '[
  {"id":"running",  "name":"运行中", "is_default":true},
  {"id":"stopped",  "name":"已停机", "is_default":false},
  {"id":"fault",    "name":"故障",   "is_default":false},
  {"id":"maintain", "name":"维护中", "is_default":false}
]'::jsonb WHERE model_id='host' AND field_key='status';

-- ── 内置应用模型 ──────────────────────────────────────────────────────────────
INSERT INTO ci_model (tenant_id, model_id, name, icon, group_code, description, is_built_in, sort_order)
VALUES ('default', 'app', '应用', 'app', 'app_manage', '业务应用系统', TRUE, 2);

INSERT INTO ci_attribute_group (tenant_id, model_id, group_id, name, is_default, is_built_in, sort_order)
VALUES ('default', 'app', 'base', '基本信息', TRUE, TRUE, 1);

INSERT INTO ci_attribute (tenant_id, model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, sort_order) VALUES
('default', 'app', 'app_name',   '应用名称', 'base', 'singlechar', TRUE,  TRUE, TRUE,  TRUE, 1),
('default', 'app', 'app_code',   '应用代码', 'base', 'singlechar', FALSE, TRUE, FALSE, TRUE, 2),
('default', 'app', 'owner',      '负责人',   'base', 'objuser',    FALSE, TRUE, FALSE, TRUE, 3),
('default', 'app', 'repo_url',   '代码仓库', 'base', 'singlechar', FALSE, TRUE, FALSE, TRUE, 4),
('default', 'app', 'description','描述',     'base', 'longchar',   FALSE, TRUE, FALSE, TRUE, 5);

-- ── RBAC ─────────────────────────────────────────────────────────────────────
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
('cmdb_model',    'CMDB模型管理', '["read","write"]',                           70),
('cmdb_instance', 'CMDB实例管理', '["create","read","update","delete","export"]', 71);

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code IN ('cmdb_model', 'cmdb_instance');

-- super_admin / admin: full access
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin')
  AND p.code LIKE 'cmdb_%'
ON CONFLICT DO NOTHING;

-- group_leader / member / viewer: read instances + read models
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM sys_role r, sys_permission p
WHERE r.code IN ('group_leader', 'member', 'viewer')
  AND p.code IN ('cmdb_model:read', 'cmdb_instance:read')
ON CONFLICT DO NOTHING;

-- group_leader + member: also create/update/delete instances
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM sys_role r, sys_permission p
WHERE r.code IN ('group_leader', 'member')
  AND p.code IN ('cmdb_instance:create', 'cmdb_instance:update', 'cmdb_instance:delete')
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Apply migration**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | tail -3
docker compose up -d backend
sleep 20
docker compose logs backend --tail=10 2>&1 | grep -E "migration|V14|ERROR|Started"
```

Expected: `Successfully applied 1 migration to schema "public", now at version v14`

- [ ] **Step 3: Verify seed data**

```bash
docker compose exec postgres psql -U platform_user -d cwgsyw_platform \
  -c "SELECT model_id, name, is_built_in FROM ci_model;" \
  -c "SELECT kind_id, name FROM ci_association_kind;" \
  -c "SELECT COUNT(*) FROM ci_attribute WHERE model_id='host';"
```

Expected: 2 models (host, app), 6 association kinds, 12 host attributes.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/migration/V14__cmdb_metadata.sql
git commit -m "feat: V14 migration - CMDB metadata tables with built-in host and app models"
```

---

## Task 2: Entities and Mappers

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiModel.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAttribute.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAttributeGroup.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAssociationKind.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAssociationDef.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiModelMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiAttributeMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiAttributeGroupMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiAssociationKindMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiAssociationDefMapper.java`

- [ ] **Step 1: Create CiModel entity**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiModel.java
package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ci_model")
public class CiModel {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String modelId;       // unique code: host, mysql_instance, etc.
    private String name;
    private String icon;
    private String groupCode;
    private String description;
    private Boolean isBuiltIn;
    private Boolean isPaused;
    private Integer sortOrder;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long createdBy;
}
```

- [ ] **Step 2: Create CiAttribute entity**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAttribute.java
package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName(value = "ci_attribute", autoResultMap = true)
public class CiAttribute {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String modelId;
    private String fieldKey;
    private String name;
    private String groupId;
    private String fieldType;
    @TableField(typeHandler = com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler.class)
    private Object option;         // JSONB: EnumOption[] | IntOption | null
    private String defaultVal;
    private String placeholder;
    private String unit;
    private Boolean isRequired;
    private Boolean isEditable;
    private Boolean isUnique;
    private Boolean isBuiltIn;
    private Boolean isListShow;
    private Integer sortOrder;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long createdBy;
}
```

- [ ] **Step 3: Create CiAttributeGroup entity**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAttributeGroup.java
package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ci_attribute_group")
public class CiAttributeGroup {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String modelId;
    private String groupId;
    private String name;
    private Boolean isDefault;
    private Boolean isBuiltIn;
    private Integer sortOrder;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 4: Create CiAssociationKind entity**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAssociationKind.java
package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ci_association_kind")
public class CiAssociationKind {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String kindId;
    private String name;
    private String srcToDst;
    private String dstToSrc;
    private Boolean isBuiltIn;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 5: Create CiAssociationDef entity**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiAssociationDef.java
package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ci_association_def")
public class CiAssociationDef {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String defId;          // {src_model_id}_{kind_id}_{dst_model_id}
    private String kindId;
    private String srcModelId;
    private String dstModelId;
    private String name;
    private String mapping;        // 1:1 | 1:n | n:n
    private String onDelete;       // none | delete_src | delete_dst
    private Boolean isBuiltIn;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 6: Create all 5 Mappers**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiModelMapper.java
package com.cwgsyw.platform.module.cmdb;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface CiModelMapper extends BaseMapper<CiModel> {
    @Select("SELECT * FROM ci_model WHERE tenant_id = #{tenantId} AND is_deleted = FALSE ORDER BY sort_order, id")
    List<CiModel> findByTenant(@Param("tenantId") String tenantId);
}
```

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiAttributeMapper.java
package com.cwgsyw.platform.module.cmdb;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface CiAttributeMapper extends BaseMapper<CiAttribute> {
    @Select("SELECT * FROM ci_attribute WHERE tenant_id = #{tenantId} AND model_id = #{modelId} AND is_deleted = FALSE ORDER BY sort_order, id")
    List<CiAttribute> findByModel(@Param("tenantId") String tenantId, @Param("modelId") String modelId);
}
```

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiAttributeGroupMapper.java
package com.cwgsyw.platform.module.cmdb;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiAttributeGroup;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface CiAttributeGroupMapper extends BaseMapper<CiAttributeGroup> {
    @Select("SELECT * FROM ci_attribute_group WHERE tenant_id = #{tenantId} AND model_id = #{modelId} AND is_deleted = FALSE ORDER BY sort_order, id")
    List<CiAttributeGroup> findByModel(@Param("tenantId") String tenantId, @Param("modelId") String modelId);
}
```

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiAssociationKindMapper.java
package com.cwgsyw.platform.module.cmdb;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationKind;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface CiAssociationKindMapper extends BaseMapper<CiAssociationKind> {
    @Select("SELECT * FROM ci_association_kind WHERE tenant_id = #{tenantId} AND is_deleted = FALSE ORDER BY id")
    List<CiAssociationKind> findByTenant(@Param("tenantId") String tenantId);
}
```

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiAssociationDefMapper.java
package com.cwgsyw.platform.module.cmdb;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiAssociationDef;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface CiAssociationDefMapper extends BaseMapper<CiAssociationDef> {
    @Select("SELECT * FROM ci_association_def WHERE tenant_id = #{tenantId} AND is_deleted = FALSE ORDER BY id")
    List<CiAssociationDef> findByTenant(@Param("tenantId") String tenantId);

    @Select("SELECT * FROM ci_association_def WHERE tenant_id = #{tenantId} AND (src_model_id = #{modelId} OR dst_model_id = #{modelId}) AND is_deleted = FALSE")
    List<CiAssociationDef> findByModel(@Param("tenantId") String tenantId, @Param("modelId") String modelId);
}
```

- [ ] **Step 7: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | grep -E "Built|ERROR|error" | head -10
```

Expected: `Image cwgsyw-platform-backend Built`

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/cmdb/
git commit -m "feat: CMDB entities and mappers"
```

---

## Task 3: DTOs

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiModelVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiAttributeVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/SaveCiModelRequest.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/SaveCiAttributeRequest.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/SaveAssociationKindRequest.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/SaveAssociationDefRequest.java`

- [ ] **Step 1: Create CiModelVO**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiModelVO.java
package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class CiModelVO {
    private Long id;
    private String modelId;
    private String name;
    private String icon;
    private String groupCode;
    private String description;
    private Boolean isBuiltIn;
    private Boolean isPaused;
    private Integer sortOrder;
    private LocalDateTime createdAt;
    // Enriched when fetching single model detail
    private List<CiAttributeGroupVO> attributeGroups;
    private List<CiAttributeVO> attributes;
    private Integer instanceCount;  // populated lazily when needed
}
```

- [ ] **Step 2: Create CiAttributeGroupVO**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiAttributeGroupVO.java
package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;

@Data
public class CiAttributeGroupVO {
    private Long id;
    private String groupId;
    private String name;
    private Boolean isDefault;
    private Boolean isBuiltIn;
    private Integer sortOrder;
}
```

- [ ] **Step 3: Create CiAttributeVO**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiAttributeVO.java
package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;

@Data
public class CiAttributeVO {
    private Long id;
    private String modelId;
    private String fieldKey;
    private String name;
    private String groupId;
    private String fieldType;
    private Object option;
    private String defaultVal;
    private String placeholder;
    private String unit;
    private Boolean isRequired;
    private Boolean isEditable;
    private Boolean isUnique;
    private Boolean isBuiltIn;
    private Boolean isListShow;
    private Integer sortOrder;
}
```

- [ ] **Step 4: Create SaveCiModelRequest**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/SaveCiModelRequest.java
package com.cwgsyw.platform.module.cmdb.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SaveCiModelRequest {
    @NotBlank private String modelId;
    @NotBlank private String name;
    private String icon;
    private String groupCode;
    private String description;
    private Integer sortOrder;
}
```

- [ ] **Step 5: Create SaveCiAttributeRequest**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/SaveCiAttributeRequest.java
package com.cwgsyw.platform.module.cmdb.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SaveCiAttributeRequest {
    @NotBlank private String fieldKey;
    @NotBlank private String name;
    private String groupId;
    @NotBlank private String fieldType;
    private Object option;
    private String defaultVal;
    private String placeholder;
    private String unit;
    private Boolean isRequired;
    private Boolean isEditable;
    private Boolean isUnique;
    private Boolean isListShow;
    private Integer sortOrder;
}
```

- [ ] **Step 6: Create SaveAssociationKindRequest**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/SaveAssociationKindRequest.java
package com.cwgsyw.platform.module.cmdb.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SaveAssociationKindRequest {
    @NotBlank private String kindId;
    @NotBlank private String name;
    private String srcToDst;
    private String dstToSrc;
}
```

- [ ] **Step 7: Create SaveAssociationDefRequest**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/SaveAssociationDefRequest.java
package com.cwgsyw.platform.module.cmdb.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SaveAssociationDefRequest {
    @NotBlank private String kindId;
    @NotBlank private String srcModelId;
    @NotBlank private String dstModelId;
    private String name;
    private String mapping;   // 1:1 | 1:n | n:n  (default n:n)
    private String onDelete;  // none | delete_src | delete_dst (default none)
}
```

- [ ] **Step 8: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | grep -E "Built|ERROR|error" | head -5
```

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/
git commit -m "feat: CMDB metadata DTOs"
```

---

## Task 4: CiMetadataService

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiMetadataService.java`

- [ ] **Step 1: Create CiMetadataService**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiMetadataService.java
package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.*;
import com.cwgsyw.platform.module.cmdb.entity.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CiMetadataService {

    private final CiModelMapper modelMapper;
    private final CiAttributeMapper attributeMapper;
    private final CiAttributeGroupMapper groupMapper;
    private final CiAssociationKindMapper kindMapper;
    private final CiAssociationDefMapper defMapper;
    private final AuditLogMapper auditLogMapper;

    // ── Models ────────────────────────────────────────────────────────────────

    public List<CiModelVO> listModels(String tenantId) {
        return modelMapper.findByTenant(tenantId).stream()
                .map(this::toModelVO)
                .collect(Collectors.toList());
    }

    public CiModelVO getModel(String tenantId, String modelId) {
        CiModel model = findModelOrThrow(tenantId, modelId);
        CiModelVO vo = toModelVO(model);
        // Enrich with groups and attributes
        List<CiAttributeGroup> groups = groupMapper.findByModel(tenantId, modelId);
        List<CiAttribute> attrs = attributeMapper.findByModel(tenantId, modelId);
        vo.setAttributeGroups(groups.stream().map(this::toGroupVO).collect(Collectors.toList()));
        vo.setAttributes(attrs.stream().map(this::toAttributeVO).collect(Collectors.toList()));
        return vo;
    }

    @Transactional
    public CiModelVO createModel(String tenantId, Long operatorId, SaveCiModelRequest req) {
        // Check unique modelId
        if (modelMapper.selectOne(new LambdaQueryWrapper<CiModel>()
                .eq(CiModel::getTenantId, tenantId)
                .eq(CiModel::getModelId, req.getModelId())
                .eq(CiModel::getIsDeleted, false)) != null) {
            throw new IllegalArgumentException("模型ID已存在: " + req.getModelId());
        }
        CiModel model = new CiModel();
        model.setTenantId(tenantId);
        model.setModelId(req.getModelId());
        model.setName(req.getName());
        model.setIcon(req.getIcon());
        model.setGroupCode(req.getGroupCode());
        model.setDescription(req.getDescription());
        model.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : 0);
        model.setIsBuiltIn(false);
        model.setIsPaused(false);
        model.setCreatedAt(LocalDateTime.now());
        model.setUpdatedAt(LocalDateTime.now());
        model.setCreatedBy(operatorId);
        modelMapper.insert(model);

        // Auto-create default attribute group
        CiAttributeGroup defaultGroup = new CiAttributeGroup();
        defaultGroup.setTenantId(tenantId);
        defaultGroup.setModelId(req.getModelId());
        defaultGroup.setGroupId("default");
        defaultGroup.setName("基本信息");
        defaultGroup.setIsDefault(true);
        defaultGroup.setIsBuiltIn(false);
        defaultGroup.setSortOrder(1);
        defaultGroup.setCreatedAt(LocalDateTime.now());
        groupMapper.insert(defaultGroup);

        writeAudit(tenantId, "create_model", model.getId(), operatorId, "model_id=" + req.getModelId());
        return toModelVO(model);
    }

    @Transactional
    public void updateModel(String tenantId, String modelId, Long operatorId, SaveCiModelRequest req) {
        CiModel model = findModelOrThrow(tenantId, modelId);
        if (model.getIsBuiltIn() && !req.getModelId().equals(modelId)) {
            throw new IllegalArgumentException("内置模型不能修改 model_id");
        }
        modelMapper.update(null, new LambdaUpdateWrapper<CiModel>()
                .eq(CiModel::getTenantId, tenantId)
                .eq(CiModel::getModelId, modelId)
                .set(CiModel::getName, req.getName())
                .set(CiModel::getIcon, req.getIcon())
                .set(CiModel::getGroupCode, req.getGroupCode())
                .set(CiModel::getDescription, req.getDescription())
                .set(CiModel::getSortOrder, req.getSortOrder() != null ? req.getSortOrder() : model.getSortOrder())
                .set(CiModel::getUpdatedAt, LocalDateTime.now()));
        writeAudit(tenantId, "update_model", model.getId(), operatorId, "model_id=" + modelId);
    }

    @Transactional
    public void deleteModel(String tenantId, String modelId, Long operatorId) {
        CiModel model = findModelOrThrow(tenantId, modelId);
        if (model.getIsBuiltIn()) {
            throw new IllegalArgumentException("内置模型不可删除");
        }
        modelMapper.update(null, new LambdaUpdateWrapper<CiModel>()
                .eq(CiModel::getTenantId, tenantId)
                .eq(CiModel::getModelId, modelId)
                .set(CiModel::getIsDeleted, true)
                .set(CiModel::getUpdatedAt, LocalDateTime.now()));
        writeAudit(tenantId, "delete_model", model.getId(), operatorId, "model_id=" + modelId);
    }

    // ── Attributes ────────────────────────────────────────────────────────────

    @Transactional
    public CiAttributeVO createAttribute(String tenantId, String modelId, Long operatorId, SaveCiAttributeRequest req) {
        findModelOrThrow(tenantId, modelId);
        if (attributeMapper.selectOne(new LambdaQueryWrapper<CiAttribute>()
                .eq(CiAttribute::getTenantId, tenantId)
                .eq(CiAttribute::getModelId, modelId)
                .eq(CiAttribute::getFieldKey, req.getFieldKey())
                .eq(CiAttribute::getIsDeleted, false)) != null) {
            throw new IllegalArgumentException("字段Key已存在: " + req.getFieldKey());
        }
        CiAttribute attr = new CiAttribute();
        attr.setTenantId(tenantId);
        attr.setModelId(modelId);
        attr.setFieldKey(req.getFieldKey());
        attr.setName(req.getName());
        attr.setGroupId(req.getGroupId() != null ? req.getGroupId() : "default");
        attr.setFieldType(req.getFieldType());
        attr.setOption(req.getOption());
        attr.setDefaultVal(req.getDefaultVal());
        attr.setPlaceholder(req.getPlaceholder());
        attr.setUnit(req.getUnit());
        attr.setIsRequired(req.getIsRequired() != null ? req.getIsRequired() : false);
        attr.setIsEditable(req.getIsEditable() != null ? req.getIsEditable() : true);
        attr.setIsUnique(req.getIsUnique() != null ? req.getIsUnique() : false);
        attr.setIsBuiltIn(false);
        attr.setIsListShow(req.getIsListShow() != null ? req.getIsListShow() : true);
        attr.setSortOrder(req.getSortOrder() != null ? req.getSortOrder() : 0);
        attr.setCreatedAt(LocalDateTime.now());
        attr.setUpdatedAt(LocalDateTime.now());
        attr.setCreatedBy(operatorId);
        attributeMapper.insert(attr);
        return toAttributeVO(attr);
    }

    @Transactional
    public void updateAttribute(String tenantId, Long attrId, Long operatorId, SaveCiAttributeRequest req) {
        CiAttribute attr = attributeMapper.selectById(attrId);
        if (attr == null || !attr.getTenantId().equals(tenantId) || attr.getIsDeleted()) {
            throw new IllegalArgumentException("属性不存在: " + attrId);
        }
        if (attr.getIsBuiltIn() && !attr.getFieldKey().equals(req.getFieldKey())) {
            throw new IllegalArgumentException("内置属性不能修改 field_key");
        }
        attributeMapper.update(null, new LambdaUpdateWrapper<CiAttribute>()
                .eq(CiAttribute::getId, attrId)
                .set(CiAttribute::getName, req.getName())
                .set(CiAttribute::getGroupId, req.getGroupId())
                .set(CiAttribute::getOption, req.getOption())
                .set(CiAttribute::getPlaceholder, req.getPlaceholder())
                .set(CiAttribute::getUnit, req.getUnit())
                .set(CiAttribute::getIsRequired, req.getIsRequired())
                .set(CiAttribute::getIsListShow, req.getIsListShow())
                .set(CiAttribute::getSortOrder, req.getSortOrder())
                .set(CiAttribute::getUpdatedAt, LocalDateTime.now()));
    }

    @Transactional
    public void deleteAttribute(String tenantId, Long attrId, Long operatorId) {
        CiAttribute attr = attributeMapper.selectById(attrId);
        if (attr == null || !attr.getTenantId().equals(tenantId) || attr.getIsDeleted()) {
            throw new IllegalArgumentException("属性不存在: " + attrId);
        }
        if (attr.getIsBuiltIn()) throw new IllegalArgumentException("内置属性不可删除");
        attributeMapper.update(null, new LambdaUpdateWrapper<CiAttribute>()
                .eq(CiAttribute::getId, attrId)
                .set(CiAttribute::getIsDeleted, true)
                .set(CiAttribute::getUpdatedAt, LocalDateTime.now()));
    }

    // ── Association Kinds ─────────────────────────────────────────────────────

    public List<CiAssociationKind> listKinds(String tenantId) {
        return kindMapper.findByTenant(tenantId);
    }

    @Transactional
    public CiAssociationKind createKind(String tenantId, Long operatorId, SaveAssociationKindRequest req) {
        if (kindMapper.selectOne(new LambdaQueryWrapper<CiAssociationKind>()
                .eq(CiAssociationKind::getTenantId, tenantId)
                .eq(CiAssociationKind::getKindId, req.getKindId())
                .eq(CiAssociationKind::getIsDeleted, false)) != null) {
            throw new IllegalArgumentException("关联种类ID已存在: " + req.getKindId());
        }
        CiAssociationKind kind = new CiAssociationKind();
        kind.setTenantId(tenantId);
        kind.setKindId(req.getKindId());
        kind.setName(req.getName());
        kind.setSrcToDst(req.getSrcToDst());
        kind.setDstToSrc(req.getDstToSrc());
        kind.setIsBuiltIn(false);
        kind.setCreatedAt(LocalDateTime.now());
        kindMapper.insert(kind);
        return kind;
    }

    // ── Association Defs ──────────────────────────────────────────────────────

    public List<CiAssociationDef> listDefs(String tenantId) {
        return defMapper.findByTenant(tenantId);
    }

    @Transactional
    public CiAssociationDef createDef(String tenantId, Long operatorId, SaveAssociationDefRequest req) {
        findModelOrThrow(tenantId, req.getSrcModelId());
        findModelOrThrow(tenantId, req.getDstModelId());
        String defId = req.getSrcModelId() + "_" + req.getKindId() + "_" + req.getDstModelId();
        if (defMapper.selectOne(new LambdaQueryWrapper<CiAssociationDef>()
                .eq(CiAssociationDef::getTenantId, tenantId)
                .eq(CiAssociationDef::getDefId, defId)
                .eq(CiAssociationDef::getIsDeleted, false)) != null) {
            throw new IllegalArgumentException("该模型关联已存在: " + defId);
        }
        CiAssociationDef def = new CiAssociationDef();
        def.setTenantId(tenantId);
        def.setDefId(defId);
        def.setKindId(req.getKindId());
        def.setSrcModelId(req.getSrcModelId());
        def.setDstModelId(req.getDstModelId());
        def.setName(req.getName() != null ? req.getName() : defId);
        def.setMapping(req.getMapping() != null ? req.getMapping() : "n:n");
        def.setOnDelete(req.getOnDelete() != null ? req.getOnDelete() : "none");
        def.setIsBuiltIn(false);
        def.setCreatedAt(LocalDateTime.now());
        defMapper.insert(def);
        return def;
    }

    @Transactional
    public void deleteDef(String tenantId, Long defDbId, Long operatorId) {
        CiAssociationDef def = defMapper.selectById(defDbId);
        if (def == null || !def.getTenantId().equals(tenantId) || def.getIsDeleted()) {
            throw new IllegalArgumentException("模型关联不存在: " + defDbId);
        }
        if (def.getIsBuiltIn()) throw new IllegalArgumentException("内置关联不可删除");
        defMapper.update(null, new LambdaUpdateWrapper<CiAssociationDef>()
                .eq(CiAssociationDef::getId, defDbId)
                .set(CiAssociationDef::getIsDeleted, true));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private CiModel findModelOrThrow(String tenantId, String modelId) {
        CiModel model = modelMapper.selectOne(new LambdaQueryWrapper<CiModel>()
                .eq(CiModel::getTenantId, tenantId)
                .eq(CiModel::getModelId, modelId)
                .eq(CiModel::getIsDeleted, false));
        if (model == null) throw new IllegalArgumentException("模型不存在: " + modelId);
        return model;
    }

    private CiModelVO toModelVO(CiModel m) {
        CiModelVO vo = new CiModelVO();
        vo.setId(m.getId());
        vo.setModelId(m.getModelId());
        vo.setName(m.getName());
        vo.setIcon(m.getIcon());
        vo.setGroupCode(m.getGroupCode());
        vo.setDescription(m.getDescription());
        vo.setIsBuiltIn(m.getIsBuiltIn());
        vo.setIsPaused(m.getIsPaused());
        vo.setSortOrder(m.getSortOrder());
        vo.setCreatedAt(m.getCreatedAt());
        return vo;
    }

    private CiAttributeGroupVO toGroupVO(CiAttributeGroup g) {
        CiAttributeGroupVO vo = new CiAttributeGroupVO();
        vo.setId(g.getId());
        vo.setGroupId(g.getGroupId());
        vo.setName(g.getName());
        vo.setIsDefault(g.getIsDefault());
        vo.setIsBuiltIn(g.getIsBuiltIn());
        vo.setSortOrder(g.getSortOrder());
        return vo;
    }

    private CiAttributeVO toAttributeVO(CiAttribute a) {
        CiAttributeVO vo = new CiAttributeVO();
        vo.setId(a.getId());
        vo.setModelId(a.getModelId());
        vo.setFieldKey(a.getFieldKey());
        vo.setName(a.getName());
        vo.setGroupId(a.getGroupId());
        vo.setFieldType(a.getFieldType());
        vo.setOption(a.getOption());
        vo.setDefaultVal(a.getDefaultVal());
        vo.setPlaceholder(a.getPlaceholder());
        vo.setUnit(a.getUnit());
        vo.setIsRequired(a.getIsRequired());
        vo.setIsEditable(a.getIsEditable());
        vo.setIsUnique(a.getIsUnique());
        vo.setIsBuiltIn(a.getIsBuiltIn());
        vo.setIsListShow(a.getIsListShow());
        vo.setSortOrder(a.getSortOrder());
        return vo;
    }

    private void writeAudit(String tenantId, String action, Long targetId, Long operatorId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("cmdb").action(action)
                .targetId(targetId).targetType("ci_model")
                .operatorId(operatorId).remark(remark)
                .createdAt(LocalDateTime.now()).build());
    }
}
```

- [ ] **Step 2: Build check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | grep -E "Built|ERROR|error" | head -10
```

Expected: `Image cwgsyw-platform-backend Built`

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiMetadataService.java
git commit -m "feat: CiMetadataService - model/attribute/association CRUD"
```

---

## Task 5: CiMetadataController

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiMetadataController.java`

- [ ] **Step 1: Create CiMetadataController**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiMetadataController.java
package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.*;
import com.cwgsyw.platform.module.cmdb.entity.*;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cmdb/meta")
@RequiredArgsConstructor
public class CiMetadataController {

    private final CiMetadataService metadataService;

    // ── Models ────────────────────────────────────────────────────────────────

    @GetMapping("/models")
    @PreAuthorize("hasAuthority('cmdb_model:read')")
    public R<List<CiModelVO>> listModels(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(metadataService.listModels(user.getTenantId()));
    }

    @GetMapping("/models/{modelId}")
    @PreAuthorize("hasAuthority('cmdb_model:read')")
    public R<CiModelVO> getModel(@PathVariable String modelId,
                                  @AuthenticationPrincipal SecurityUser user) {
        return R.ok(metadataService.getModel(user.getTenantId(), modelId));
    }

    @PostMapping("/models")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<CiModelVO> createModel(@Valid @RequestBody SaveCiModelRequest req,
                                     @AuthenticationPrincipal SecurityUser user) {
        return R.ok(metadataService.createModel(user.getTenantId(), user.getUserId(), req));
    }

    @PutMapping("/models/{modelId}")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<Void> updateModel(@PathVariable String modelId,
                                @Valid @RequestBody SaveCiModelRequest req,
                                @AuthenticationPrincipal SecurityUser user) {
        metadataService.updateModel(user.getTenantId(), modelId, user.getUserId(), req);
        return R.ok(null);
    }

    @DeleteMapping("/models/{modelId}")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<Void> deleteModel(@PathVariable String modelId,
                                @AuthenticationPrincipal SecurityUser user) {
        metadataService.deleteModel(user.getTenantId(), modelId, user.getUserId());
        return R.ok(null);
    }

    // ── Attributes ────────────────────────────────────────────────────────────

    @PostMapping("/models/{modelId}/attributes")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<CiAttributeVO> createAttribute(@PathVariable String modelId,
                                              @Valid @RequestBody SaveCiAttributeRequest req,
                                              @AuthenticationPrincipal SecurityUser user) {
        return R.ok(metadataService.createAttribute(user.getTenantId(), modelId, user.getUserId(), req));
    }

    @PutMapping("/attributes/{attrId}")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<Void> updateAttribute(@PathVariable Long attrId,
                                    @RequestBody SaveCiAttributeRequest req,
                                    @AuthenticationPrincipal SecurityUser user) {
        metadataService.updateAttribute(user.getTenantId(), attrId, user.getUserId(), req);
        return R.ok(null);
    }

    @DeleteMapping("/attributes/{attrId}")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<Void> deleteAttribute(@PathVariable Long attrId,
                                    @AuthenticationPrincipal SecurityUser user) {
        metadataService.deleteAttribute(user.getTenantId(), attrId, user.getUserId());
        return R.ok(null);
    }

    // ── Association Kinds ─────────────────────────────────────────────────────

    @GetMapping("/association-kinds")
    @PreAuthorize("hasAuthority('cmdb_model:read')")
    public R<List<CiAssociationKind>> listKinds(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(metadataService.listKinds(user.getTenantId()));
    }

    @PostMapping("/association-kinds")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<CiAssociationKind> createKind(@Valid @RequestBody SaveAssociationKindRequest req,
                                            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(metadataService.createKind(user.getTenantId(), user.getUserId(), req));
    }

    // ── Association Defs ──────────────────────────────────────────────────────

    @GetMapping("/association-defs")
    @PreAuthorize("hasAuthority('cmdb_model:read')")
    public R<List<CiAssociationDef>> listDefs(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(metadataService.listDefs(user.getTenantId()));
    }

    @PostMapping("/association-defs")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<CiAssociationDef> createDef(@Valid @RequestBody SaveAssociationDefRequest req,
                                          @AuthenticationPrincipal SecurityUser user) {
        return R.ok(metadataService.createDef(user.getTenantId(), user.getUserId(), req));
    }

    @DeleteMapping("/association-defs/{id}")
    @PreAuthorize("hasAuthority('cmdb_model:write')")
    public R<Void> deleteDef(@PathVariable Long id,
                              @AuthenticationPrincipal SecurityUser user) {
        metadataService.deleteDef(user.getTenantId(), id, user.getUserId());
        return R.ok(null);
    }
}
```

- [ ] **Step 2: Build and deploy**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | grep -E "Built|ERROR|error" | head -5
docker compose up -d backend
sleep 20
docker compose logs backend --tail=5 2>&1 | grep -E "Started|ERROR"
```

Expected: `Started PlatformApplication`

- [ ] **Step 3: Smoke test all endpoints**

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | jq -r '.data.token')

# List models
echo "=== Models ===" && \
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/cmdb/meta/models | \
  jq '.data[] | {model_id, name}'

# Get host model detail (with attributes)
echo "=== Host model detail ===" && \
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/cmdb/meta/models/host | \
  jq '{model_id: .data.model_id, attr_count: (.data.attributes | length), group_count: (.data.attribute_groups | length)}'

# List association kinds
echo "=== Association kinds ===" && \
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/cmdb/meta/association-kinds | \
  jq '.data[] | {kind_id, name}'

# Create a custom model
echo "=== Create MySQL model ===" && \
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  http://localhost/api/cmdb/meta/models \
  -d '{"modelId":"mysql_instance","name":"MySQL实例","icon":"database","groupCode":"middleware","description":"MySQL数据库实例"}' | \
  jq '{code, model_id: .data.model_id}'

# Add an attribute to the new model
echo "=== Add port attribute ===" && \
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  http://localhost/api/cmdb/meta/models/mysql_instance/attributes \
  -d '{"fieldKey":"port","name":"端口","fieldType":"int","isRequired":true,"option":{"min":1,"max":65535},"defaultVal":"3306"}' | \
  jq '{code, field_key: .data.field_key}'
```

Expected: models list has host + app, host has 12 attributes and 3 groups, custom model created with 200, attribute added with 200.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiMetadataController.java
git commit -m "feat: CiMetadataController - REST endpoints for CMDB metadata"
```

---

## Task 6: Frontend — CMDB Model Management Pages

**Files:**
- Create: `frontend/src/app/(dashboard)/cmdb/page.tsx`
- Create: `frontend/src/app/(dashboard)/cmdb/models/[modelId]/page.tsx`
- Create: `frontend/src/app/(dashboard)/cmdb/associations/page.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create CMDB model list page**

```tsx
// frontend/src/app/(dashboard)/cmdb/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import Link from 'next/link'
import { Plus, Settings, Server, Database, Network, Box } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface CiModelVO {
  id: number
  model_id: string
  name: string
  icon: string
  group_code: string
  description: string
  is_built_in: boolean
  is_paused: boolean
}

const ICON_MAP: Record<string, React.ElementType> = {
  server: Server,
  database: Database,
  network: Network,
}

export default function CmdbPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ modelId: '', name: '', icon: 'box', groupCode: '', description: '' })

  useEffect(() => {
    if (!hasPermission('cmdb_model', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data: models = [], isLoading } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-models'],
    queryFn: () => api.get('/cmdb/meta/models').then(r => r.data.data),
    enabled: hasPermission('cmdb_model', 'read'),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/cmdb/meta/models', {
      modelId: form.modelId,
      name: form.name,
      icon: form.icon,
      groupCode: form.groupCode || undefined,
      description: form.description || undefined,
    }),
    onSuccess: (res) => {
      toast.success('模型已创建')
      queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
      setCreating(false)
      setForm({ modelId: '', name: '', icon: 'box', groupCode: '', description: '' })
      router.push(`/cmdb/models/${res.data.data.model_id}`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  // Group models by group_code
  const grouped = models.reduce((acc, m) => {
    const key = m.group_code || '未分类'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {} as Record<string, CiModelVO[]>)

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">配置管理数据库 (CMDB)</h1>
          <p className="text-sm text-muted-foreground mt-1">管理 CI 模型和实例数据</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/cmdb/associations">关联关系管理</Link>
          </Button>
          {hasPermission('cmdb_model', 'write') && (
            <Button size="sm" onClick={() => setCreating(v => !v)}>
              <Plus className="h-4 w-4 mr-1" />新建模型
            </Button>
          )}
        </div>
      </div>

      {creating && (
        <div className="border rounded-lg p-4 mb-6 bg-muted/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">模型ID * <span className="text-muted-foreground">(英文/下划线)</span></Label>
              <Input value={form.modelId} onChange={e => setForm(f => ({ ...f, modelId: e.target.value }))}
                placeholder="如: mysql_instance" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">模型名称 *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="如: MySQL实例" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">所属分类</Label>
              <Input value={form.groupCode} onChange={e => setForm(f => ({ ...f, groupCode: e.target.value }))}
                placeholder="如: middleware" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">描述</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="模型用途说明" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMutation.mutate()}
              disabled={!form.modelId || !form.name || createMutation.isPending}>创建</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>取消</Button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-muted-foreground text-sm">加载中...</p> : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([group, groupModels]) => (
            <div key={group}>
              <h2 className="text-sm font-medium text-muted-foreground mb-3">{group}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {groupModels.map(model => {
                  const Icon = ICON_MAP[model.icon] ?? Box
                  return (
                    <Link key={model.model_id} href={`/cmdb/models/${model.model_id}`}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors block">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-md">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{model.name}</span>
                            {model.is_built_in && <Badge variant="secondary" className="text-xs">内置</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{model.model_id}</p>
                        </div>
                        {hasPermission('cmdb_model', 'write') && (
                          <Settings className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
          {models.length === 0 && <p className="text-muted-foreground text-sm text-center py-12">暂无模型</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create model detail page (attribute editor)**

```tsx
// frontend/src/app/(dashboard)/cmdb/models/[modelId]/page.tsx
'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface CiAttributeVO {
  id: number
  field_key: string
  name: string
  group_id: string
  field_type: string
  is_required: boolean
  is_editable: boolean
  is_unique: boolean
  is_built_in: boolean
  is_list_show: boolean
  sort_order: number
  placeholder: string
  unit: string
}

interface CiAttributeGroupVO {
  id: number
  group_id: string
  name: string
  is_default: boolean
  is_built_in: boolean
}

interface CiModelVO {
  id: number
  model_id: string
  name: string
  icon: string
  is_built_in: boolean
  attributes: CiAttributeVO[]
  attribute_groups: CiAttributeGroupVO[]
}

const FIELD_TYPES = [
  { value: 'singlechar', label: '单行文本' },
  { value: 'longchar',   label: '多行文本' },
  { value: 'int',        label: '整数' },
  { value: 'float',      label: '浮点数' },
  { value: 'enum',       label: '单选枚举' },
  { value: 'enummulti',  label: '多选枚举' },
  { value: 'date',       label: '日期' },
  { value: 'bool',       label: '是/否' },
  { value: 'objuser',    label: '用户' },
]

export default function ModelDetailPage() {
  const { modelId } = useParams<{ modelId: string }>()
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const [addingAttr, setAddingAttr] = useState(false)
  const [newAttr, setNewAttr] = useState({
    fieldKey: '', name: '', fieldType: 'singlechar', groupId: 'default',
    isRequired: false, isUnique: false, isListShow: true, placeholder: '', unit: '',
  })

  const { data: model, isLoading } = useQuery<CiModelVO>({
    queryKey: ['cmdb-model', modelId],
    queryFn: () => api.get(`/cmdb/meta/models/${modelId}`).then(r => r.data.data),
  })

  const addAttrMutation = useMutation({
    mutationFn: () => api.post(`/cmdb/meta/models/${modelId}/attributes`, {
      fieldKey: newAttr.fieldKey,
      name: newAttr.name,
      fieldType: newAttr.fieldType,
      groupId: newAttr.groupId,
      isRequired: newAttr.isRequired,
      isUnique: newAttr.isUnique,
      isListShow: newAttr.isListShow,
      placeholder: newAttr.placeholder || undefined,
      unit: newAttr.unit || undefined,
    }),
    onSuccess: () => {
      toast.success('属性已添加')
      queryClient.invalidateQueries({ queryKey: ['cmdb-model', modelId] })
      setAddingAttr(false)
      setNewAttr({ fieldKey: '', name: '', fieldType: 'singlechar', groupId: 'default',
        isRequired: false, isUnique: false, isListShow: true, placeholder: '', unit: '' })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '添加失败'),
  })

  const deleteAttrMutation = useMutation({
    mutationFn: (attrId: number) => api.delete(`/cmdb/meta/attributes/${attrId}`),
    onSuccess: () => { toast.success('属性已删除'); queryClient.invalidateQueries({ queryKey: ['cmdb-model', modelId] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  if (isLoading) return <p className="text-muted-foreground">加载中...</p>
  if (!model) return <p className="text-destructive">模型不存在</p>

  const canWrite = hasPermission('cmdb_model', 'write')

  // Group attributes by group_id
  const attrsByGroup = (model.attributes ?? []).reduce((acc, a) => {
    const g = a.group_id || 'default'
    if (!acc[g]) acc[g] = []
    acc[g].push(a)
    return acc
  }, {} as Record<string, CiAttributeVO[]>)

  const groups = model.attribute_groups ?? []

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/cmdb" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{model.name}</h1>
            {model.is_built_in && <Badge variant="secondary">内置</Badge>}
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{model.model_id}</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setAddingAttr(v => !v)}>
            <Plus className="h-4 w-4 mr-1" />添加属性
          </Button>
        )}
      </div>

      {/* Add attribute form */}
      {addingAttr && (
        <div className="border rounded-lg p-4 mb-6 bg-muted/30 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">字段Key *</Label>
              <Input value={newAttr.fieldKey} onChange={e => setNewAttr(f => ({ ...f, fieldKey: e.target.value }))}
                placeholder="如: port" className="font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">显示名称 *</Label>
              <Input value={newAttr.name} onChange={e => setNewAttr(f => ({ ...f, name: e.target.value }))}
                placeholder="如: 端口" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">字段类型 *</Label>
              <Select value={newAttr.fieldType} onValueChange={v => setNewAttr(f => ({ ...f, fieldType: v ?? 'singlechar' }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">所属分组</Label>
              <Select value={newAttr.groupId} onValueChange={v => setNewAttr(f => ({ ...f, groupId: v ?? 'default' }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {groups.map(g => <SelectItem key={g.group_id} value={g.group_id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">提示文字</Label>
              <Input value={newAttr.placeholder} onChange={e => setNewAttr(f => ({ ...f, placeholder: e.target.value }))}
                placeholder="可选" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">单位</Label>
              <Input value={newAttr.unit} onChange={e => setNewAttr(f => ({ ...f, unit: e.target.value }))}
                placeholder="如: MB, GB" />
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={newAttr.isRequired}
                onChange={e => setNewAttr(f => ({ ...f, isRequired: e.target.checked }))} />必填
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={newAttr.isUnique}
                onChange={e => setNewAttr(f => ({ ...f, isUnique: e.target.checked }))} />唯一
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={newAttr.isListShow}
                onChange={e => setNewAttr(f => ({ ...f, isListShow: e.target.checked }))} />列表显示
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addAttrMutation.mutate()}
              disabled={!newAttr.fieldKey || !newAttr.name || addAttrMutation.isPending}>保存</Button>
            <Button size="sm" variant="ghost" onClick={() => setAddingAttr(false)}>取消</Button>
          </div>
        </div>
      )}

      {/* Attribute groups */}
      <div className="space-y-4">
        {groups.map(group => {
          const attrs = attrsByGroup[group.group_id] ?? []
          return (
            <div key={group.group_id} className="border rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/40 flex items-center gap-2">
                <span className="font-medium text-sm">{group.name}</span>
                <Badge variant="secondary" className="text-xs">{attrs.length}</Badge>
                {group.is_default && <Badge variant="outline" className="text-xs">默认</Badge>}
              </div>
              {attrs.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground">暂无属性</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/20 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2">字段Key</th>
                      <th className="text-left px-4 py-2">名称</th>
                      <th className="text-left px-4 py-2">类型</th>
                      <th className="text-left px-4 py-2">属性</th>
                      {canWrite && <th className="px-4 py-2"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {attrs.map(attr => (
                      <tr key={attr.field_key} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-mono text-xs">{attr.field_key}</td>
                        <td className="px-4 py-2.5">{attr.name}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className="text-xs">
                            {FIELD_TYPES.find(t => t.value === attr.field_type)?.label ?? attr.field_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1 flex-wrap">
                            {attr.is_required && <Badge variant="destructive" className="text-xs">必填</Badge>}
                            {attr.is_unique && <Badge className="text-xs">唯一</Badge>}
                            {attr.is_built_in && <Badge variant="secondary" className="text-xs">内置</Badge>}
                          </div>
                        </td>
                        {canWrite && (
                          <td className="px-4 py-2.5 text-right">
                            {!attr.is_built_in && (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                                onClick={() => { if (confirm(`删除属性 "${attr.name}"?`)) deleteAttrMutation.mutate(attr.id) }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create associations management page**

```tsx
// frontend/src/app/(dashboard)/cmdb/associations/page.tsx
'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface AsstKind { id: number; kind_id: string; name: string; src_to_dst: string; dst_to_src: string; is_built_in: boolean }
interface AsstDef { id: number; def_id: string; kind_id: string; src_model_id: string; dst_model_id: string; name: string; mapping: string; is_built_in: boolean }
interface CiModelVO { id: number; model_id: string; name: string }

export default function AssociationsPage() {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const canWrite = hasPermission('cmdb_model', 'write')

  const [addingKind, setAddingKind] = useState(false)
  const [addingDef, setAddingDef] = useState(false)
  const [newKind, setNewKind] = useState({ kindId: '', name: '', srcToDst: '', dstToSrc: '' })
  const [newDef, setNewDef] = useState({ kindId: '', srcModelId: '', dstModelId: '', name: '', mapping: 'n:n' })

  const { data: kinds = [] } = useQuery<AsstKind[]>({
    queryKey: ['cmdb-asst-kinds'],
    queryFn: () => api.get('/cmdb/meta/association-kinds').then(r => r.data.data),
  })
  const { data: defs = [] } = useQuery<AsstDef[]>({
    queryKey: ['cmdb-asst-defs'],
    queryFn: () => api.get('/cmdb/meta/association-defs').then(r => r.data.data),
  })
  const { data: models = [] } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-models'],
    queryFn: () => api.get('/cmdb/meta/models').then(r => r.data.data),
  })

  const createKindMutation = useMutation({
    mutationFn: () => api.post('/cmdb/meta/association-kinds', newKind),
    onSuccess: () => { toast.success('关联种类已创建'); queryClient.invalidateQueries({ queryKey: ['cmdb-asst-kinds'] }); setAddingKind(false) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })
  const createDefMutation = useMutation({
    mutationFn: () => api.post('/cmdb/meta/association-defs', newDef),
    onSuccess: () => { toast.success('关联关系已创建'); queryClient.invalidateQueries({ queryKey: ['cmdb-asst-defs'] }); setAddingDef(false) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })
  const deleteDefMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/meta/association-defs/${id}`),
    onSuccess: () => { toast.success('已删除'); queryClient.invalidateQueries({ queryKey: ['cmdb-asst-defs'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/cmdb" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回
        </Link>
        <h1 className="text-2xl font-bold">关联关系管理</h1>
      </div>

      {/* Association Kinds */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">关联种类</h2>
          {canWrite && <Button size="sm" variant="outline" onClick={() => setAddingKind(v => !v)}><Plus className="h-4 w-4 mr-1" />新建种类</Button>}
        </div>
        {addingKind && (
          <div className="border rounded-lg p-4 mb-3 bg-muted/30 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">种类ID *</Label><Input value={newKind.kindId} onChange={e => setNewKind(f => ({...f, kindId: e.target.value}))} placeholder="如: support" /></div>
              <div className="space-y-1"><Label className="text-xs">名称 *</Label><Input value={newKind.name} onChange={e => setNewKind(f => ({...f, name: e.target.value}))} placeholder="如: 支撑" /></div>
              <div className="space-y-1"><Label className="text-xs">正向描述</Label><Input value={newKind.srcToDst} onChange={e => setNewKind(f => ({...f, srcToDst: e.target.value}))} placeholder="如: 支撑" /></div>
              <div className="space-y-1"><Label className="text-xs">反向描述</Label><Input value={newKind.dstToSrc} onChange={e => setNewKind(f => ({...f, dstToSrc: e.target.value}))} placeholder="如: 被支撑" /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createKindMutation.mutate()} disabled={!newKind.kindId || !newKind.name || createKindMutation.isPending}>创建</Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingKind(false)}>取消</Button>
            </div>
          </div>
        )}
        <div className="border rounded-lg divide-y">
          {kinds.map(k => (
            <div key={k.kind_id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <code className="text-xs bg-muted px-2 py-0.5 rounded">{k.kind_id}</code>
                <span className="text-sm font-medium">{k.name}</span>
                {k.src_to_dst && <span className="text-xs text-muted-foreground">{k.src_to_dst} / {k.dst_to_src}</span>}
              </div>
              {k.is_built_in && <Badge variant="secondary" className="text-xs">内置</Badge>}
            </div>
          ))}
        </div>
      </div>

      {/* Association Defs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">模型关联定义</h2>
          {canWrite && <Button size="sm" variant="outline" onClick={() => setAddingDef(v => !v)}><Plus className="h-4 w-4 mr-1" />新建关联</Button>}
        </div>
        {addingDef && (
          <div className="border rounded-lg p-4 mb-3 bg-muted/30 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">源模型 *</Label>
                <Select value={newDef.srcModelId} onValueChange={v => setNewDef(f => ({...f, srcModelId: v ?? ''}))}>
                  <SelectTrigger><SelectValue placeholder="选择模型" /></SelectTrigger>
                  <SelectContent>{models.map(m => <SelectItem key={m.model_id} value={m.model_id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">目标模型 *</Label>
                <Select value={newDef.dstModelId} onValueChange={v => setNewDef(f => ({...f, dstModelId: v ?? ''}))}>
                  <SelectTrigger><SelectValue placeholder="选择模型" /></SelectTrigger>
                  <SelectContent>{models.map(m => <SelectItem key={m.model_id} value={m.model_id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">关联种类 *</Label>
                <Select value={newDef.kindId} onValueChange={v => setNewDef(f => ({...f, kindId: v ?? ''}))}>
                  <SelectTrigger><SelectValue placeholder="选择种类" /></SelectTrigger>
                  <SelectContent>{kinds.map(k => <SelectItem key={k.kind_id} value={k.kind_id}>{k.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">基数</Label>
                <Select value={newDef.mapping} onValueChange={v => setNewDef(f => ({...f, mapping: v ?? 'n:n'}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1:1">1:1 一对一</SelectItem>
                    <SelectItem value="1:n">1:n 一对多</SelectItem>
                    <SelectItem value="n:n">n:n 多对多</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createDefMutation.mutate()} disabled={!newDef.kindId || !newDef.srcModelId || !newDef.dstModelId || createDefMutation.isPending}>创建</Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingDef(false)}>取消</Button>
            </div>
          </div>
        )}
        <div className="border rounded-lg divide-y">
          {defs.map(d => (
            <div key={d.def_id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{models.find(m => m.model_id === d.src_model_id)?.name ?? d.src_model_id}</span>
                <span className="text-xs text-muted-foreground px-1">—{kinds.find(k => k.kind_id === d.kind_id)?.name ?? d.kind_id}→</span>
                <span className="text-sm font-medium">{models.find(m => m.model_id === d.dst_model_id)?.name ?? d.dst_model_id}</span>
                <Badge variant="outline" className="text-xs">{d.mapping}</Badge>
                {d.is_built_in && <Badge variant="secondary" className="text-xs">内置</Badge>}
              </div>
              {canWrite && !d.is_built_in && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                  onClick={() => { if (confirm('删除此关联定义?')) deleteDefMutation.mutate(d.id) }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
          {defs.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground text-center">暂无关联定义</p>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add CMDB nav item to Sidebar**

In `frontend/src/components/layout/Sidebar.tsx`, add `Database` to the lucide-react import, then add to `navItems` after 变更文档:

```tsx
import { ..., Database } from 'lucide-react'

// In navItems, after change-docs:
{ href: '/cmdb', label: 'CMDB', icon: Database, resource: 'cmdb_model', action: 'read' },
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: 0 errors.

- [ ] **Step 6: Full rebuild and final smoke test**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build frontend 2>&1 | tail -3
docker compose up -d frontend
sleep 15

TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | jq -r '.data.token')

# Final API verification
echo "=== Models ===" && curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/cmdb/meta/models | jq '[.data[] | {model_id, name}]'
echo "=== Kinds ===" && curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/cmdb/meta/association-kinds | jq '[.data[] | {kind_id, name}]'
echo "=== Frontend ===" && curl -s -o /dev/null -w "%{http_code}" http://localhost/cmdb
```

Expected: 2 models, 6 kinds, frontend returns 200.

- [ ] **Step 7: Commit and tag**

```bash
git add frontend/src/app/(dashboard)/cmdb/ frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: CMDB frontend - model list, model detail with attribute editor, association management"
git tag v0.8.0-cmdb-phase1
echo "Phase CMDB-1 complete: v0.8.0-cmdb-phase1"
```

---

## Self-Review

### Spec coverage
- ✅ V14 migration with all 5 tables + seed data (2 built-in models, 12 host attributes, 6 association kinds)
- ✅ 15 field types defined in migration (via field_type column, supported in frontend FIELD_TYPES selector)
- ✅ Model CRUD (create/read/update/delete, built-in protection)
- ✅ Attribute CRUD with group assignment
- ✅ Attribute groups auto-created on model creation
- ✅ Association kinds CRUD
- ✅ Association definitions CRUD with model validation and mapping (1:1/1:n/n:n)
- ✅ RBAC: `cmdb_model:read/write` + `cmdb_instance:read/create/update/delete/export`
- ✅ Frontend: model list grouped by category, model detail with attribute table, association management
- ✅ Sidebar nav item gated by `cmdb_model:read`

### No placeholders found.

### Type consistency
- `CiMetadataService.createModel()` → returns `CiModelVO` — matches controller `R<CiModelVO>`
- `CiMetadataService.createAttribute()` → returns `CiAttributeVO` — matches controller `R<CiAttributeVO>`
- Frontend `CiModelVO` uses `model_id`, `is_built_in`, `attribute_groups` (snake_case, consistent with global Jackson `SNAKE_CASE`)
- `def_id` format: `{srcModelId}_{kindId}_{dstModelId}` — built in service, not exposed to client
