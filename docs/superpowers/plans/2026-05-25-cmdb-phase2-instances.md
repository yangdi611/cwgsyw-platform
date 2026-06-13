# CMDB Phase 2: CI Instance Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CI instance CRUD — users can create, read, update, delete instances of any CI model (host, app, mysql_instance, or any custom model), with dynamic attribute validation and a dynamic form UI that adapts to each model's field configuration.

**Architecture:** A single `ci_instance` table stores all instances across all models using JSONB for dynamic attributes. `CiInstanceService` handles CRUD with attribute validation (required fields, unique checks against existing instances) driven by `ci_attribute` definitions. The frontend renders a dynamic form based on `field_config` returned by the model detail API. Phase 1's metadata layer is a hard prerequisite and is already complete.

**Tech Stack:** Spring Boot 3.4.5, MyBatis-Plus 3.5.12, PostgreSQL 16 (JSONB + GIN index), Next.js 15, shadcn/ui, TanStack Query v5

---

## File Map

**Backend — new:**
- `backend/src/main/resources/db/migration/V15__cmdb_instances.sql`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiInstance.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiInstanceVO.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/SaveCiInstanceRequest.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiInstanceQueryRequest.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceController.java`

**Frontend — new:**
- `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/page.tsx` — instance list for a model
- `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/new/page.tsx` — create instance
- `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/page.tsx` — instance detail / edit

**Frontend — modified:**
- `frontend/src/app/(dashboard)/cmdb/models/[modelId]/page.tsx` — add "查看实例" button linking to instance list

---

## Task 1: V15 Database Migration

**Files:**
- Create: `backend/src/main/resources/db/migration/V15__cmdb_instances.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- V15: CMDB CI 实例表

CREATE TABLE ci_instance (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    model_id    VARCHAR(64)  NOT NULL,
    name        VARCHAR(255),                      -- 实例名称（冗余存储，用于列表展示和搜索）
    attrs       JSONB        NOT NULL DEFAULT '{}', -- 所有动态属性 key-value
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMP,
    deleted_by  BIGINT,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by  BIGINT       NOT NULL DEFAULT 0
);

-- 按模型分页查询的主索引
CREATE INDEX idx_ci_instance_model ON ci_instance(tenant_id, model_id, created_at DESC) WHERE NOT is_deleted;

-- JSONB GIN 索引，用于属性值搜索（如 attrs @> '{"inner_ip":"10.0.0.1"}'）
CREATE INDEX idx_ci_instance_attrs ON ci_instance USING GIN(attrs);
```

- [ ] **Step 2: Apply migration**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build --no-cache backend 2>&1 | tail -3
docker compose up -d backend
sleep 25
docker compose logs backend --tail=10 2>&1 | grep -E "V15|migration|Started|ERROR"
```

Expected: `Current version of schema "public": 15` and `Started PlatformApplication`

- [ ] **Step 3: Verify**

```bash
docker compose exec postgres psql -U platform_user -d cwgsyw_platform \
  -c "\d ci_instance" 2>&1 | grep -E "Column|attrs|model_id|GIN"
```

Expected: table exists with `attrs JSONB` column and GIN index visible.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/migration/V15__cmdb_instances.sql
git commit -m "feat: V15 migration - ci_instance table with JSONB attrs and GIN index"
```

---

## Task 2: Entity, Mapper, DTOs

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiInstance.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiInstanceVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/SaveCiInstanceRequest.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiInstanceQueryRequest.java`

- [ ] **Step 1: Create CiInstance entity**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiInstance.java
package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@TableName(value = "ci_instance", autoResultMap = true)
public class CiInstance {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String modelId;
    private String name;
    @TableField(typeHandler = com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler.class)
    private Map<String, Object> attrs;   // dynamic attribute values
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private Long deletedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long createdBy;
}
```

- [ ] **Step 2: Create CiInstanceMapper**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceMapper.java
package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CiInstanceMapper extends BaseMapper<CiInstance> {

    @Select("SELECT * FROM ci_instance WHERE tenant_id = #{tenantId} AND model_id = #{modelId} AND is_deleted = FALSE ORDER BY created_at DESC")
    Page<CiInstance> findByModel(Page<CiInstance> page,
                                  @Param("tenantId") String tenantId,
                                  @Param("modelId") String modelId);

    @Select("SELECT COUNT(*) FROM ci_instance WHERE tenant_id = #{tenantId} AND model_id = #{modelId} AND is_deleted = FALSE AND attrs ->> #{fieldKey} = #{value} AND id != #{excludeId}")
    int countByFieldValue(@Param("tenantId") String tenantId,
                           @Param("modelId") String modelId,
                           @Param("fieldKey") String fieldKey,
                           @Param("value") String value,
                           @Param("excludeId") Long excludeId);
}
```

- [ ] **Step 3: Create CiInstanceVO**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiInstanceVO.java
package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
public class CiInstanceVO {
    private Long id;
    private String modelId;
    private String modelName;
    private String name;
    private Map<String, Object> attrs;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long createdBy;
    private String createdByName;
    // Field config is included so the frontend can render the detail page
    // without a separate model metadata request
    private List<CiAttributeVO> fieldConfig;
}
```

- [ ] **Step 4: Create SaveCiInstanceRequest**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/SaveCiInstanceRequest.java
package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.util.Map;

@Data
public class SaveCiInstanceRequest {
    private Map<String, Object> attrs;
}
```

- [ ] **Step 5: Create CiInstanceQueryRequest**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiInstanceQueryRequest.java
package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;

@Data
public class CiInstanceQueryRequest {
    private String keyword;   // searches name and key attrs
    private Integer page = 1;
    private Integer size = 20;
}
```

- [ ] **Step 6: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | grep -E "Built|ERROR|error" | head -5
```

Expected: `Image cwgsyw-platform-backend Built`

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/cmdb/
git commit -m "feat: CiInstance entity, mapper, and DTOs"
```

---

## Task 3: CiInstanceService

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceService.java`

- [ ] **Step 1: Create CiInstanceService**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceService.java
package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.*;
import com.cwgsyw.platform.module.cmdb.entity.*;
import com.cwgsyw.platform.module.user.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CiInstanceService {

    private final CiInstanceMapper instanceMapper;
    private final CiMetadataService metadataService;
    private final CiAttributeMapper attributeMapper;
    private final AuditLogMapper auditLogMapper;
    private final UserMapper userMapper;

    public PageResult<CiInstanceVO> listInstances(String tenantId, String modelId, int page, int size) {
        Page<CiInstance> result = instanceMapper.findByModel(new Page<>(page, size), tenantId, modelId);
        // Batch-resolve creator names
        Set<Long> userIds = result.getRecords().stream()
                .filter(i -> i.getCreatedBy() != null)
                .map(CiInstance::getCreatedBy)
                .collect(Collectors.toSet());
        Map<Long, String> userNames = userIds.isEmpty() ? Map.of() :
                userMapper.selectBatchIds(userIds).stream()
                        .collect(Collectors.toMap(
                                com.cwgsyw.platform.module.user.entity.User::getId,
                                u -> u.getRealName() != null ? u.getRealName() : u.getUsername()));

        return PageResult.of(result.convert(inst -> toVO(inst, userNames, null)));
    }

    public CiInstanceVO getInstance(String tenantId, Long id) {
        CiInstance inst = findOrThrow(tenantId, id);
        // Enrich with field config so frontend can render without extra call
        List<CiAttributeVO> fieldConfig = attributeMapper.findByModel(tenantId, inst.getModelId())
                .stream().map(this::toAttrVO).collect(Collectors.toList());
        return toVO(inst, Map.of(), fieldConfig);
    }

    @Transactional
    public CiInstanceVO createInstance(String tenantId, Long operatorId, String modelId,
                                        SaveCiInstanceRequest req) {
        // Validate against model's attribute definitions
        List<CiAttribute> attrs = attributeMapper.findByModel(tenantId, modelId);
        validateAttrs(tenantId, modelId, req.getAttrs(), attrs, null);

        CiInstance inst = new CiInstance();
        inst.setTenantId(tenantId);
        inst.setModelId(modelId);
        inst.setAttrs(req.getAttrs() != null ? req.getAttrs() : new HashMap<>());
        // Derive display name: use first required singlechar field value, fallback to id
        inst.setName(deriveDisplayName(inst.getAttrs(), attrs));
        inst.setCreatedAt(LocalDateTime.now());
        inst.setUpdatedAt(LocalDateTime.now());
        inst.setCreatedBy(operatorId);
        instanceMapper.insert(inst);

        writeAudit(tenantId, "create_instance", inst.getId(), operatorId,
                "model_id=" + modelId + " name=" + inst.getName());
        return toVO(inst, Map.of(), null);
    }

    @Transactional
    public CiInstanceVO updateInstance(String tenantId, Long id, Long operatorId,
                                        SaveCiInstanceRequest req) {
        CiInstance inst = findOrThrow(tenantId, id);
        List<CiAttribute> attrs = attributeMapper.findByModel(tenantId, inst.getModelId());
        validateAttrs(tenantId, inst.getModelId(), req.getAttrs(), attrs, id);

        Map<String, Object> merged = new HashMap<>(inst.getAttrs() != null ? inst.getAttrs() : Map.of());
        if (req.getAttrs() != null) merged.putAll(req.getAttrs());

        instanceMapper.update(null, new LambdaUpdateWrapper<CiInstance>()
                .eq(CiInstance::getId, id)
                .set(CiInstance::getAttrs, merged)
                .set(CiInstance::getName, deriveDisplayName(merged, attrs))
                .set(CiInstance::getUpdatedAt, LocalDateTime.now()));

        inst.setAttrs(merged);
        writeAudit(tenantId, "update_instance", id, operatorId, "id=" + id);
        return toVO(inst, Map.of(), null);
    }

    @Transactional
    public void deleteInstance(String tenantId, Long id, Long operatorId) {
        CiInstance inst = findOrThrow(tenantId, id);
        instanceMapper.update(null, new LambdaUpdateWrapper<CiInstance>()
                .eq(CiInstance::getId, id)
                .set(CiInstance::getIsDeleted, true)
                .set(CiInstance::getDeletedAt, LocalDateTime.now())
                .set(CiInstance::getDeletedBy, operatorId));
        writeAudit(tenantId, "delete_instance", id, operatorId,
                "model_id=" + inst.getModelId() + " name=" + inst.getName());
    }

    // ── Validation ────────────────────────────────────────────────────────────

    private void validateAttrs(String tenantId, String modelId, Map<String, Object> incoming,
                                List<CiAttribute> attrDefs, Long excludeId) {
        if (incoming == null) incoming = Map.of();
        for (CiAttribute def : attrDefs) {
            Object val = incoming.get(def.getFieldKey());
            // Required check
            if (Boolean.TRUE.equals(def.getIsRequired())) {
                if (val == null || val.toString().isBlank()) {
                    throw new IllegalArgumentException("必填字段不能为空: " + def.getName());
                }
            }
            // Unique check
            if (Boolean.TRUE.equals(def.getIsUnique()) && val != null && !val.toString().isBlank()) {
                int count = instanceMapper.countByFieldValue(tenantId, modelId,
                        def.getFieldKey(), val.toString(),
                        excludeId != null ? excludeId : -1L);
                if (count > 0) {
                    throw new IllegalArgumentException("字段值已存在（唯一约束）: " + def.getName() + "=" + val);
                }
            }
        }
    }

    private String deriveDisplayName(Map<String, Object> attrs, List<CiAttribute> attrDefs) {
        if (attrs == null || attrDefs == null) return null;
        // Priority: first required singlechar field
        for (CiAttribute def : attrDefs) {
            if (Boolean.TRUE.equals(def.getIsRequired()) && "singlechar".equals(def.getFieldType())) {
                Object v = attrs.get(def.getFieldKey());
                if (v != null && !v.toString().isBlank()) return v.toString();
            }
        }
        // Fallback: first non-null singlechar field
        for (CiAttribute def : attrDefs) {
            if ("singlechar".equals(def.getFieldType())) {
                Object v = attrs.get(def.getFieldKey());
                if (v != null && !v.toString().isBlank()) return v.toString();
            }
        }
        return null;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private CiInstance findOrThrow(String tenantId, Long id) {
        CiInstance inst = instanceMapper.selectOne(new LambdaQueryWrapper<CiInstance>()
                .eq(CiInstance::getTenantId, tenantId)
                .eq(CiInstance::getId, id)
                .eq(CiInstance::getIsDeleted, false));
        if (inst == null) throw new IllegalArgumentException("CI实例不存在: " + id);
        return inst;
    }

    private CiInstanceVO toVO(CiInstance inst, Map<Long, String> userNames,
                               List<CiAttributeVO> fieldConfig) {
        CiInstanceVO vo = new CiInstanceVO();
        vo.setId(inst.getId());
        vo.setModelId(inst.getModelId());
        vo.setName(inst.getName());
        vo.setAttrs(inst.getAttrs());
        vo.setCreatedAt(inst.getCreatedAt());
        vo.setUpdatedAt(inst.getUpdatedAt());
        vo.setCreatedBy(inst.getCreatedBy());
        if (inst.getCreatedBy() != null) {
            vo.setCreatedByName(userNames.getOrDefault(inst.getCreatedBy(),
                    String.valueOf(inst.getCreatedBy())));
        }
        vo.setFieldConfig(fieldConfig);
        return vo;
    }

    private CiAttributeVO toAttrVO(CiAttribute a) {
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

    private void writeAudit(String tenantId, String action, Long targetId,
                             Long operatorId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("cmdb").action(action)
                .targetId(targetId).targetType("ci_instance")
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
git add backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceService.java
git commit -m "feat: CiInstanceService - CI instance CRUD with attribute validation"
```

---

## Task 4: CiInstanceController

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceController.java`

- [ ] **Step 1: Create CiInstanceController**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceController.java
package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cmdb/instances")
@RequiredArgsConstructor
public class CiInstanceController {

    private final CiInstanceService instanceService;

    @GetMapping("/{modelId}")
    @PreAuthorize("hasAuthority('cmdb_instance:read')")
    public R<PageResult<CiInstanceVO>> list(
            @PathVariable String modelId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(instanceService.listInstances(user.getTenantId(), modelId, page, size));
    }

    @GetMapping("/{modelId}/{id}")
    @PreAuthorize("hasAuthority('cmdb_instance:read')")
    public R<CiInstanceVO> get(
            @PathVariable String modelId,
            @PathVariable Long id,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(instanceService.getInstance(user.getTenantId(), id));
    }

    @PostMapping("/{modelId}")
    @PreAuthorize("hasAuthority('cmdb_instance:create')")
    public R<CiInstanceVO> create(
            @PathVariable String modelId,
            @RequestBody SaveCiInstanceRequest req,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(instanceService.createInstance(user.getTenantId(), user.getUserId(), modelId, req));
    }

    @PutMapping("/{modelId}/{id}")
    @PreAuthorize("hasAuthority('cmdb_instance:update')")
    public R<CiInstanceVO> update(
            @PathVariable String modelId,
            @PathVariable Long id,
            @RequestBody SaveCiInstanceRequest req,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(instanceService.updateInstance(user.getTenantId(), id, user.getUserId(), req));
    }

    @DeleteMapping("/{modelId}/{id}")
    @PreAuthorize("hasAuthority('cmdb_instance:delete')")
    public R<Void> delete(
            @PathVariable String modelId,
            @PathVariable Long id,
            @AuthenticationPrincipal SecurityUser user) {
        instanceService.deleteInstance(user.getTenantId(), id, user.getUserId());
        return R.ok(null);
    }
}
```

- [ ] **Step 2: Build, deploy and smoke test**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | tail -3
docker compose up -d backend
sleep 20
docker compose logs backend --tail=5 2>&1 | grep -E "Started|ERROR"

TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# Create a host instance
echo "=== Create host instance ==="
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  http://localhost/api/cmdb/instances/host \
  -d '{"attrs":{"inner_ip":"192.168.1.100","hostname":"web-server-01","os_type":"linux","env":"prod","status":"running","cpu_cores":8,"mem_gb":16}}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('code:', d['code'], 'id:', d.get('data',{}).get('id'), 'name:', d.get('data',{}).get('name'))"

# List host instances
echo "=== List host instances ==="
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/cmdb/instances/host | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('code:', d['code'], 'total:', d.get('data',{}).get('total'), 'count:', len(d.get('data',{}).get('records',[])))"

# Test unique validation (try duplicate IP)
echo "=== Test unique validation ==="
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  http://localhost/api/cmdb/instances/host \
  -d '{"attrs":{"inner_ip":"192.168.1.100","hostname":"another-host"}}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('code:', d['code'], 'message:', d.get('message',''))"
```

Expected: first create returns code 200 with id and name "192.168.1.100", list returns total=1, duplicate IP returns error message about unique constraint.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceController.java
git commit -m "feat: CiInstanceController - REST endpoints for CI instance CRUD"
```

---

## Task 5: Frontend — Instance Pages

**Files:**
- Create: `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/page.tsx`
- Create: `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/new/page.tsx`
- Create: `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/page.tsx`
- Modify: `frontend/src/app/(dashboard)/cmdb/models/[modelId]/page.tsx`

- [ ] **Step 1: Create instance list page**

```tsx
// frontend/src/app/(dashboard)/cmdb/instances/[modelId]/page.tsx
'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Eye } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface CiInstanceVO {
  id: number
  model_id: string
  name: string
  attrs: Record<string, unknown>
  created_at: string
  created_by_name: string
}

interface PageResult {
  records: CiInstanceVO[]
  total: number
  page: number
  size: number
}

interface CiModelVO {
  model_id: string
  name: string
  attributes: { field_key: string; name: string; is_list_show: boolean; field_type: string }[]
}

export default function InstanceListPage() {
  const { modelId } = useParams<{ modelId: string }>()
  const { hasPermission } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data: model } = useQuery<CiModelVO>({
    queryKey: ['cmdb-model', modelId],
    queryFn: () => api.get(`/cmdb/meta/models/${modelId}`).then(r => r.data.data),
  })

  const { data: result, isLoading } = useQuery<PageResult>({
    queryKey: ['cmdb-instances', modelId],
    queryFn: () => api.get(`/cmdb/instances/${modelId}`).then(r => r.data.data),
    enabled: hasPermission('cmdb_instance', 'read'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/instances/${modelId}/${id}`),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-instances', modelId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  const listColumns = (model?.attributes ?? [])
    .filter(a => a.is_list_show)
    .slice(0, 5) // max 5 columns in list view

  const instances = result?.records ?? []

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href={`/cmdb/models/${modelId}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <ArrowLeft className="h-4 w-4 mr-1" />返回模型
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{model?.name ?? modelId} 实例列表</h1>
            <p className="text-xs text-muted-foreground mt-0.5">共 {result?.total ?? 0} 条</p>
          </div>
        </div>
        {hasPermission('cmdb_instance', 'create') && (
          <Button size="sm" asChild>
            <Link href={`/cmdb/instances/${modelId}/new`}>
              <Plus className="h-4 w-4 mr-1" />新建实例
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">加载中...</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">实例名称</th>
                {listColumns.map(col => (
                  <th key={col.field_key} className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">
                    {col.name}
                  </th>
                ))}
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">创建时间</th>
                <th className="px-4 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {instances.length === 0 ? (
                <tr>
                  <td colSpan={listColumns.length + 3} className="text-center py-12 text-muted-foreground text-sm">
                    暂无实例，点击右上角新建
                  </td>
                </tr>
              ) : (
                instances.map(inst => (
                  <tr key={inst.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">
                      {inst.name ?? <span className="text-muted-foreground">#{inst.id}</span>}
                    </td>
                    {listColumns.map(col => (
                      <td key={col.field_key} className="px-4 py-3 text-muted-foreground">
                        {String(inst.attrs?.[col.field_key] ?? '—')}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(inst.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                          <Link href={`/cmdb/instances/${modelId}/${inst.id}`}>
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        {hasPermission('cmdb_instance', 'delete') && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                            onClick={() => { if (confirm('删除此实例?')) deleteMutation.mutate(inst.id) }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create instance creation page**

```tsx
// frontend/src/app/(dashboard)/cmdb/instances/[modelId]/new/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface CiAttributeVO {
  id: number; field_key: string; name: string; field_type: string
  is_required: boolean; is_editable: boolean; option: unknown
  placeholder: string; unit: string; sort_order: number; group_id: string
}
interface CiAttributeGroupVO { id: number; group_id: string; name: string; sort_order: number }
interface CiModelVO {
  model_id: string; name: string
  attributes: CiAttributeVO[]; attribute_groups: CiAttributeGroupVO[]
}

export default function NewInstancePage() {
  const { modelId } = useParams<{ modelId: string }>()
  const { hasPermission } = usePermission()
  const router = useRouter()
  const [attrs, setAttrs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!hasPermission('cmdb_instance', 'create')) router.replace(`/cmdb/instances/${modelId}`)
  }, [hasPermission, router, modelId])

  const { data: model, isLoading } = useQuery<CiModelVO>({
    queryKey: ['cmdb-model', modelId],
    queryFn: () => api.get(`/cmdb/meta/models/${modelId}`).then(r => r.data.data),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post(`/cmdb/instances/${modelId}`, { attrs }),
    onSuccess: (res) => {
      toast.success('实例已创建')
      router.push(`/cmdb/instances/${modelId}/${res.data.data.id}`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const set = (key: string, val: string) => setAttrs(a => ({ ...a, [key]: val }))

  const groups = model?.attribute_groups ?? []
  const attrsByGroup = (model?.attributes ?? []).reduce((acc, a) => {
    const g = a.group_id || 'default'
    if (!acc[g]) acc[g] = []
    acc[g].push(a)
    return acc
  }, {} as Record<string, CiAttributeVO[]>)

  if (isLoading) return <p className="text-muted-foreground">加载中...</p>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/cmdb/instances/${modelId}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回列表
        </Link>
        <h1 className="text-2xl font-bold">新建 {model?.name ?? modelId} 实例</h1>
      </div>

      <div className="space-y-6">
        {groups.sort((a, b) => a.sort_order - b.sort_order).map(group => {
          const groupAttrs = (attrsByGroup[group.group_id] ?? [])
            .sort((a, b) => a.sort_order - b.sort_order)
          if (groupAttrs.length === 0) return null
          return (
            <div key={group.group_id} className="border rounded-lg p-5">
              <h2 className="font-semibold text-sm mb-4">{group.name}</h2>
              <div className="space-y-4">
                {groupAttrs.map(attr => (
                  <div key={attr.field_key} className="space-y-1.5">
                    <Label className="text-sm">
                      {attr.name}
                      {attr.is_required && <span className="text-destructive ml-1">*</span>}
                      {attr.unit && <span className="text-muted-foreground ml-1 text-xs">({attr.unit})</span>}
                    </Label>
                    {renderField(attr, attrs[attr.field_key] ?? '', val => set(attr.field_key, val))}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2 mt-6">
        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          {createMutation.isPending ? '创建中...' : '创建实例'}
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/cmdb/instances/${modelId}`}>取消</Link>
        </Button>
      </div>
    </div>
  )
}

function renderField(attr: CiAttributeVO, value: string, onChange: (v: string) => void) {
  const { field_type, option, placeholder } = attr
  const ph = placeholder ?? ''

  if (field_type === 'longchar') {
    return <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder={ph} rows={3} />
  }
  if (field_type === 'enum' && Array.isArray(option)) {
    const opts = option as { id: string; name: string }[]
    return (
      <Select value={value} onValueChange={v => onChange(v ?? '')}>
        <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
        <SelectContent>{opts.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
      </Select>
    )
  }
  if (field_type === 'bool') {
    return (
      <Select value={value} onValueChange={v => onChange(v ?? '')}>
        <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="true">是</SelectItem>
          <SelectItem value="false">否</SelectItem>
        </SelectContent>
      </Select>
    )
  }
  if (field_type === 'date') {
    return <Input type="date" value={value} onChange={e => onChange(e.target.value)} />
  }
  if (field_type === 'int' || field_type === 'float') {
    return <Input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={ph} />
  }
  return <Input value={value} onChange={e => onChange(e.target.value)} placeholder={ph} />
}
```

- [ ] **Step 3: Create instance detail/edit page**

```tsx
// frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Pencil, Save, X } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface CiAttributeVO {
  id: number; field_key: string; name: string; field_type: string
  is_required: boolean; is_editable: boolean; option: unknown
  placeholder: string; unit: string; sort_order: number; group_id: string
}
interface CiInstanceVO {
  id: number; model_id: string; name: string
  attrs: Record<string, unknown>
  field_config: CiAttributeVO[]
  created_at: string; updated_at: string; created_by_name: string
}

export default function InstanceDetailPage() {
  const { modelId, id } = useParams<{ modelId: string; id: string }>()
  const { hasPermission } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editAttrs, setEditAttrs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data: inst, isLoading } = useQuery<CiInstanceVO>({
    queryKey: ['cmdb-instance', modelId, id],
    queryFn: () => api.get(`/cmdb/instances/${modelId}/${id}`).then(r => r.data.data),
  })

  useEffect(() => {
    if (inst) {
      setEditAttrs(Object.fromEntries(
        Object.entries(inst.attrs ?? {}).map(([k, v]) => [k, String(v ?? '')])
      ))
    }
  }, [inst])

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/cmdb/instances/${modelId}/${id}`, { attrs: editAttrs }),
    onSuccess: () => {
      toast.success('已保存')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['cmdb-instance', modelId, id] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '保存失败'),
  })

  if (isLoading) return <p className="text-muted-foreground">加载中...</p>
  if (!inst) return <p className="text-destructive">实例不存在</p>

  const canEdit = hasPermission('cmdb_instance', 'update')
  const fieldConfig = inst.field_config ?? []
  const attrsByGroup = fieldConfig.reduce((acc, a) => {
    const g = a.group_id || 'default'
    if (!acc[g]) acc[g] = []
    acc[g].push(a)
    return acc
  }, {} as Record<string, CiAttributeVO[]>)

  const groupIds = [...new Set(fieldConfig.map(a => a.group_id || 'default'))]

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href={`/cmdb/instances/${modelId}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <ArrowLeft className="h-4 w-4 mr-1" />返回列表
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{inst.name ?? `#${inst.id}`}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {inst.model_id} · 创建于 {new Date(inst.created_at).toLocaleString('zh-CN')}
              {inst.created_by_name && ` · ${inst.created_by_name}`}
            </p>
          </div>
        </div>
        {canEdit && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-1" />编辑
          </Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-1" />保存
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {groupIds.map(groupId => {
          const attrs = (attrsByGroup[groupId] ?? []).sort((a, b) => a.sort_order - b.sort_order)
          return (
            <div key={groupId} className="border rounded-lg p-5">
              <div className="space-y-3">
                {attrs.map(attr => {
                  const rawVal = inst.attrs?.[attr.field_key]
                  const displayVal = rawVal != null ? String(rawVal) : '—'
                  return (
                    <div key={attr.field_key} className="grid grid-cols-3 gap-4 items-start">
                      <div className="text-sm text-muted-foreground pt-2">
                        {attr.name}
                        {attr.unit && <span className="ml-1 text-xs">({attr.unit})</span>}
                      </div>
                      <div className="col-span-2">
                        {editing && attr.is_editable ? (
                          renderEditField(attr, editAttrs[attr.field_key] ?? displayVal,
                            val => setEditAttrs(a => ({ ...a, [attr.field_key]: val })))
                        ) : (
                          <p className="text-sm pt-2">{displayVal}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function renderEditField(attr: CiAttributeVO, value: string, onChange: (v: string) => void) {
  const { field_type, option, placeholder } = attr
  const ph = placeholder ?? ''
  if (field_type === 'longchar') return <Textarea value={value} onChange={e => onChange(e.target.value)} rows={3} />
  if (field_type === 'enum' && Array.isArray(option)) {
    const opts = option as { id: string; name: string }[]
    return (
      <Select value={value} onValueChange={v => onChange(v ?? '')}>
        <SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger>
        <SelectContent>{opts.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
      </Select>
    )
  }
  if (field_type === 'bool') {
    return (
      <Select value={value} onValueChange={v => onChange(v ?? '')}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="true">是</SelectItem><SelectItem value="false">否</SelectItem></SelectContent>
      </Select>
    )
  }
  if (field_type === 'date') return <Input type="date" value={value} onChange={e => onChange(e.target.value)} />
  if (field_type === 'int' || field_type === 'float') return <Input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={ph} />
  return <Input value={value} onChange={e => onChange(e.target.value)} placeholder={ph} />
}
```

- [ ] **Step 4: Add "查看实例" link to model detail page**

In `frontend/src/app/(dashboard)/cmdb/models/[modelId]/page.tsx`, add a button in the header area (after the title, before the "添加属性" button):

```tsx
<Button variant="outline" size="sm" asChild>
  <Link href={`/cmdb/instances/${modelId}`}>查看实例</Link>
</Button>
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
  -d '{"username":"superadmin","password":"Admin@123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# Create second host
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  http://localhost/api/cmdb/instances/host \
  -d '{"attrs":{"inner_ip":"192.168.1.101","hostname":"db-server-01","os_type":"linux","env":"prod","status":"running","cpu_cores":16,"mem_gb":64}}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('created:', d['data']['id'], d['data']['name'])"

# List all host instances
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/cmdb/instances/host | \
  python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('total:', d['total'])"

# Frontend pages check
for path in cmdb/instances/host; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/$path)
  echo "/$path → $code"
done
```

Expected: 2 hosts total, frontend returns 200.

- [ ] **Step 7: Commit and tag**

```bash
git add "frontend/src/app/(dashboard)/cmdb/"
git commit -m "feat: CMDB Phase 2 - CI instance CRUD with dynamic form rendering"
git tag v0.9.0-cmdb-phase2
echo "Phase CMDB-2 complete"
```

---

## Self-Review

### Spec coverage
- ✅ V15 migration: `ci_instance` table with JSONB `attrs` + GIN index
- ✅ Create instance with attribute validation (required, unique)
- ✅ Read instance: single (`GET /{modelId}/{id}`) and list (`GET /{modelId}`)
- ✅ Update instance: merged JSONB patch
- ✅ Delete instance: soft delete
- ✅ `name` column derived from first required singlechar attribute (for display)
- ✅ Frontend: list page with dynamic columns (is_list_show), create page with dynamic form, detail page with inline edit
- ✅ Dynamic form renders: singlechar, longchar, int, float, enum, bool, date field types
- ✅ "查看实例" link from model detail page

### No placeholders found.

### Type consistency
- `CiInstanceService.createInstance()` → `CiInstanceVO`; controller `R<CiInstanceVO>` matches
- `CiInstanceService.listInstances()` → `PageResult<CiInstanceVO>`; controller `R<PageResult<CiInstanceVO>>` matches
- Frontend `CiInstanceVO.field_config` → `CiAttributeVO[]` — populated only by `getInstance()`, null in list results (frontend handles null gracefully)
- `attrs` is `Map<String, Object>` in Java → `Record<string, unknown>` in TypeScript — consistent
