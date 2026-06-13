# CMDB Phase 3: Instance Associations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CI instance association CRUD — users can create, query, and delete associations between CI instances, with cardinality enforcement (1:1 / 1:n / n:n), inline error messages, and a dedicated management page.

**Architecture:** A single `ci_instance_rel` table stores directed associations (src→dst) with `attrs JSONB` for Phase 4 extensibility. `CiInstanceRelService` queries both directions and groups by association kind. The frontend adds a panel to the existing instance detail page and a new standalone associations page. The cardinality check runs server-side before insert; validation errors are returned as HTTP 400 with the offending CI name and model in the message, and displayed inline (red text) in the frontend dialog.

**Tech Stack:** Spring Boot 3.4.5, MyBatis-Plus 3.5.12, PostgreSQL 16 (JSONB + GIN index), Next.js 15, shadcn/ui (Dialog, Select, Button), TanStack Query v5

---

## File Map

**Backend — new (9 files):**
- `backend/src/main/resources/db/migration/V16__cmdb_instance_rel.sql`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiInstanceRel.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiInstanceRelVO.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiRelGroupVO.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CreateRelRequest.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/InstanceSearchVO.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelController.java`

**Backend — test (1 file):**
- `backend/src/test/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelServiceTest.java`

**Frontend — modified (1 file):**
- `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/page.tsx`

**Frontend — new (1 file):**
- `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/associations/page.tsx`

---

## Task 1: V16 Database Migration

**Files:**
- Create: `backend/src/main/resources/db/migration/V16__cmdb_instance_rel.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- V16: CMDB CI 实例关联表

CREATE TABLE ci_instance_rel (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    def_id      VARCHAR(64)  NOT NULL,
    src_id      BIGINT       NOT NULL,
    dst_id      BIGINT       NOT NULL,
    attrs       JSONB        NOT NULL DEFAULT '{}',
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMP,
    deleted_by  BIGINT,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by  BIGINT       NOT NULL DEFAULT 0,
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_by  BIGINT
);

CREATE INDEX idx_ci_rel_src   ON ci_instance_rel(tenant_id, src_id) WHERE NOT is_deleted;
CREATE INDEX idx_ci_rel_dst   ON ci_instance_rel(tenant_id, dst_id) WHERE NOT is_deleted;
CREATE INDEX idx_ci_rel_attrs ON ci_instance_rel USING GIN(attrs)   WHERE NOT is_deleted;
CREATE UNIQUE INDEX idx_ci_rel_unique
    ON ci_instance_rel(tenant_id, def_id, src_id, dst_id) WHERE NOT is_deleted;
```

- [ ] **Step 2: Build and deploy**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build --no-cache backend 2>&1 | tail -3
docker compose up -d backend
sleep 30
docker compose logs backend --tail=10 2>&1 | grep -E "V16|migration|Started|ERROR"
```

Expected: `Migrating schema "public" to version "16 - cmdb instance rel"` and `Started PlatformApplication`.

- [ ] **Step 3: Verify table**

```bash
docker compose exec postgres psql -U platform_user -d cwgsyw_platform \
  -c "\d ci_instance_rel" 2>&1 | grep -E "Column|attrs|src_id|dst_id|GIN|unique"
```

Expected: table has `attrs jsonb`, `src_id bigint`, `dst_id bigint`, plus the 4 indexes.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/migration/V16__cmdb_instance_rel.sql
git commit -m "feat: V16 migration - ci_instance_rel table with JSONB attrs and GIN index"
```

---

## Task 2: Entity, Mapper, and DTOs

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiInstanceRel.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiInstanceRelVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiRelGroupVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CreateRelRequest.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/InstanceSearchVO.java`

- [ ] **Step 1: Create CiInstanceRel entity**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/entity/CiInstanceRel.java
package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@TableName(value = "ci_instance_rel", autoResultMap = true)
public class CiInstanceRel {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String defId;
    private Long srcId;
    private Long dstId;
    @TableField(typeHandler = com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler.class)
    private Map<String, Object> attrs;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private Long deletedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long createdBy;
    private Long updatedBy;
}
```

- [ ] **Step 2: Create CiInstanceRelMapper**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelMapper.java
package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.cwgsyw.platform.module.cmdb.entity.CiInstanceRel;
import org.apache.ibatis.annotations.*;
import java.util.List;
import java.util.Map;

@Mapper
public interface CiInstanceRelMapper extends BaseMapper<CiInstanceRel> {

    @Results(id = "ciRelMap", value = {
        @Result(column = "id",         property = "id"),
        @Result(column = "tenant_id",  property = "tenantId"),
        @Result(column = "def_id",     property = "defId"),
        @Result(column = "src_id",     property = "srcId"),
        @Result(column = "dst_id",     property = "dstId"),
        @Result(column = "attrs",      property = "attrs",
                javaType = Map.class,  typeHandler = JacksonTypeHandler.class),
        @Result(column = "is_deleted", property = "isDeleted"),
        @Result(column = "deleted_at", property = "deletedAt"),
        @Result(column = "deleted_by", property = "deletedBy"),
        @Result(column = "created_at", property = "createdAt"),
        @Result(column = "updated_at", property = "updatedAt"),
        @Result(column = "created_by", property = "createdBy"),
        @Result(column = "updated_by", property = "updatedBy")
    })
    @Select("SELECT * FROM ci_instance_rel WHERE tenant_id = #{tenantId} AND (src_id = #{instanceId} OR dst_id = #{instanceId}) AND is_deleted = FALSE ORDER BY created_at DESC")
    List<CiInstanceRel> findByInstance(@Param("tenantId") String tenantId,
                                        @Param("instanceId") Long instanceId);

    @Select("SELECT COUNT(*) FROM ci_instance_rel WHERE tenant_id = #{tenantId} AND def_id = #{defId} AND src_id = #{srcId} AND is_deleted = FALSE AND id != #{excludeId}")
    int countBySrcAndDef(@Param("tenantId") String tenantId,
                          @Param("defId") String defId,
                          @Param("srcId") Long srcId,
                          @Param("excludeId") long excludeId);

    @Select("SELECT COUNT(*) FROM ci_instance_rel WHERE tenant_id = #{tenantId} AND def_id = #{defId} AND dst_id = #{dstId} AND is_deleted = FALSE AND id != #{excludeId}")
    int countByDstAndDef(@Param("tenantId") String tenantId,
                          @Param("defId") String defId,
                          @Param("dstId") Long dstId,
                          @Param("excludeId") long excludeId);
}
```

- [ ] **Step 3: Create CiInstanceRelVO**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiInstanceRelVO.java
package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
public class CiInstanceRelVO {
    private Long id;
    private String defId;
    private Boolean isSrc;           // true = current instance is src; false = current is dst
    private Long peerId;
    private String peerName;
    private String peerModelId;
    private String peerModelName;
    private String directionLabel;   // kind.srcToDst if isSrc, kind.dstToSrc if !isSrc
    private Map<String, Object> attrs;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 4: Create CiRelGroupVO**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiRelGroupVO.java
package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.util.List;

@Data
public class CiRelGroupVO {
    private String kindId;
    private String kindName;
    private String srcToDst;
    private String dstToSrc;
    private List<CiInstanceRelVO> relations;
}
```

- [ ] **Step 5: Create CreateRelRequest**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CreateRelRequest.java
package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.util.Map;

@Data
public class CreateRelRequest {
    private String defId;
    private Long srcId;
    private Long dstId;
    private Map<String, Object> attrs;  // optional, defaults to {}
}
```

- [ ] **Step 6: Create InstanceSearchVO**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/InstanceSearchVO.java
package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;

@Data
public class InstanceSearchVO {
    private Long id;
    private String name;
    private String modelId;
    private String modelName;
}
```

- [ ] **Step 7: Build check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | grep -E "Built|ERROR|error" | head -5
```

Expected: `Image cwgsyw-platform-backend Built`

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/cmdb/
git commit -m "feat: CiInstanceRel entity, mapper, and DTOs"
```

---

## Task 3: CiInstanceRelService

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelService.java`
- Create: `backend/src/test/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelServiceTest.java`

- [ ] **Step 1: Write the failing test first**

```java
// backend/src/test/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelServiceTest.java
package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.cmdb.dto.CreateRelRequest;
import com.cwgsyw.platform.module.cmdb.entity.*;
import com.cwgsyw.platform.module.user.UserMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CiInstanceRelServiceTest {

    @Mock CiInstanceRelMapper relMapper;
    @Mock CiAssociationDefMapper defMapper;
    @Mock CiAssociationKindMapper kindMapper;
    @Mock CiInstanceMapper instanceMapper;
    @Mock CiModelMapper modelMapper;
    @Mock AuditLogMapper auditLogMapper;

    @InjectMocks CiInstanceRelService service;

    @Test
    void createRelation_1_1_dst_occupied_throws_with_ci_name() {
        CiAssociationDef def = new CiAssociationDef();
        def.setDefId("host_belong_app");
        def.setKindId("belong");
        def.setSrcModelId("host");
        def.setDstModelId("app");
        def.setMapping("1:1");
        when(defMapper.selectOne(any())).thenReturn(def);
        when(relMapper.countByDstAndDef("default", "host_belong_app", 5L, -1L)).thenReturn(1);

        CiInstance dstInst = new CiInstance();
        dstInst.setId(5L);
        dstInst.setName("app-server-01");
        dstInst.setModelId("app");
        when(instanceMapper.selectById(5L)).thenReturn(dstInst);

        CiModel dstModel = new CiModel();
        dstModel.setModelId("app");
        dstModel.setName("应用");
        when(modelMapper.selectOne(any())).thenReturn(dstModel);

        CreateRelRequest req = new CreateRelRequest();
        req.setDefId("host_belong_app");
        req.setSrcId(1L);
        req.setDstId(5L);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
            () -> service.createRelation("default", 1L, req));
        assertTrue(ex.getMessage().contains("app-server-01"), "message must contain dst CI name");
        assertTrue(ex.getMessage().contains("应用"), "message must contain dst model name");
        assertTrue(ex.getMessage().contains("1:1"), "message must contain mapping type");
    }

    @Test
    void createRelation_1_1_src_occupied_throws_with_ci_name() {
        CiAssociationDef def = new CiAssociationDef();
        def.setDefId("host_belong_app");
        def.setKindId("belong");
        def.setSrcModelId("host");
        def.setDstModelId("app");
        def.setMapping("1:1");
        when(defMapper.selectOne(any())).thenReturn(def);
        when(relMapper.countByDstAndDef(anyString(), anyString(), anyLong(), anyLong())).thenReturn(0);
        when(relMapper.countBySrcAndDef("default", "host_belong_app", 1L, -1L)).thenReturn(1);

        CiInstance srcInst = new CiInstance();
        srcInst.setId(1L);
        srcInst.setName("web-server-01");
        srcInst.setModelId("host");
        when(instanceMapper.selectById(1L)).thenReturn(srcInst);

        CiModel srcModel = new CiModel();
        srcModel.setModelId("host");
        srcModel.setName("主机");
        when(modelMapper.selectOne(any())).thenReturn(srcModel);

        CreateRelRequest req = new CreateRelRequest();
        req.setDefId("host_belong_app");
        req.setSrcId(1L);
        req.setDstId(5L);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
            () -> service.createRelation("default", 1L, req));
        assertTrue(ex.getMessage().contains("web-server-01"), "message must contain src CI name");
        assertTrue(ex.getMessage().contains("主机"), "message must contain src model name");
    }

    @Test
    void createRelation_nn_no_constraint_passes() {
        CiAssociationDef def = new CiAssociationDef();
        def.setDefId("app_connect_db");
        def.setKindId("connect");
        def.setSrcModelId("app");
        def.setDstModelId("mysql");
        def.setMapping("n:n");

        CiAssociationKind kind = new CiAssociationKind();
        kind.setKindId("connect");
        kind.setName("连接");
        kind.setSrcToDst("连接");
        kind.setDstToSrc("被连接");

        when(defMapper.selectOne(any())).thenReturn(def);
        when(kindMapper.selectOne(any())).thenReturn(kind);
        when(relMapper.insert(any())).thenReturn(1);
        when(auditLogMapper.insert(any())).thenReturn(1);

        CiInstance dstInst = new CiInstance();
        dstInst.setId(10L);
        dstInst.setName("mysql-01");
        dstInst.setModelId("mysql");
        when(instanceMapper.selectById(10L)).thenReturn(dstInst);

        CreateRelRequest req = new CreateRelRequest();
        req.setDefId("app_connect_db");
        req.setSrcId(2L);
        req.setDstId(10L);

        // Should not throw
        assertDoesNotThrow(() -> service.createRelation("default", 1L, req));
        verify(relMapper).insert(any());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/backend
mvn test -Dtest=CiInstanceRelServiceTest -q 2>&1 | tail -10
```

Expected: FAIL — `CiInstanceRelService` does not exist yet.

- [ ] **Step 3: Create CiInstanceRelService**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelService.java
package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.*;
import com.cwgsyw.platform.module.cmdb.entity.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

@Service
@RequiredArgsConstructor
public class CiInstanceRelService {

    private final CiInstanceRelMapper relMapper;
    private final CiAssociationDefMapper defMapper;
    private final CiAssociationKindMapper kindMapper;
    private final CiInstanceMapper instanceMapper;
    private final CiModelMapper modelMapper;
    private final AuditLogMapper auditLogMapper;

    public List<CiRelGroupVO> getRelations(String tenantId, Long instanceId) {
        List<CiInstanceRel> rels = relMapper.findByInstance(tenantId, instanceId);
        if (rels.isEmpty()) return List.of();

        // Batch-fetch peer instances
        Set<Long> peerIds = rels.stream()
            .map(r -> instanceId.equals(r.getSrcId()) ? r.getDstId() : r.getSrcId())
            .collect(Collectors.toSet());
        Map<Long, CiInstance> peerMap = instanceMapper.selectBatchIds(peerIds).stream()
            .collect(Collectors.toMap(CiInstance::getId, i -> i));

        // Batch-fetch defs and kinds
        Set<String> defIds = rels.stream().map(CiInstanceRel::getDefId).collect(Collectors.toSet());
        Map<String, CiAssociationDef> defMap = defMapper.selectList(
            new LambdaQueryWrapper<CiAssociationDef>().in(CiAssociationDef::getDefId, defIds))
            .stream().collect(Collectors.toMap(CiAssociationDef::getDefId, d -> d));

        Set<String> kindIds = defMap.values().stream()
            .map(CiAssociationDef::getKindId).collect(Collectors.toSet());
        Map<String, CiAssociationKind> kindMap = kindMapper.selectList(
            new LambdaQueryWrapper<CiAssociationKind>().in(CiAssociationKind::getKindId, kindIds))
            .stream().collect(Collectors.toMap(CiAssociationKind::getKindId, k -> k));

        // Batch-fetch model names for peers
        Set<String> modelIds = peerMap.values().stream()
            .map(CiInstance::getModelId).collect(Collectors.toSet());
        Map<String, String> modelNameMap = modelMapper.selectList(
            new LambdaQueryWrapper<CiModel>().in(CiModel::getModelId, modelIds))
            .stream().collect(Collectors.toMap(CiModel::getModelId, CiModel::getName));

        // Build groups (insertion-ordered by first-seen kind)
        Map<String, CiRelGroupVO> groups = new LinkedHashMap<>();
        for (CiInstanceRel rel : rels) {
            CiAssociationDef def = defMap.get(rel.getDefId());
            if (def == null) continue;
            CiAssociationKind kind = kindMap.get(def.getKindId());
            if (kind == null) continue;

            boolean isSrc = instanceId.equals(rel.getSrcId());
            Long peerId = isSrc ? rel.getDstId() : rel.getSrcId();
            CiInstance peer = peerMap.get(peerId);

            CiInstanceRelVO vo = new CiInstanceRelVO();
            vo.setId(rel.getId());
            vo.setDefId(rel.getDefId());
            vo.setIsSrc(isSrc);
            vo.setPeerId(peerId);
            vo.setPeerName(peer != null ? peer.getName() : String.valueOf(peerId));
            vo.setPeerModelId(peer != null ? peer.getModelId() : null);
            vo.setPeerModelName(peer != null
                ? modelNameMap.getOrDefault(peer.getModelId(), peer.getModelId())
                : null);
            vo.setDirectionLabel(isSrc ? kind.getSrcToDst() : kind.getDstToSrc());
            vo.setAttrs(rel.getAttrs());
            vo.setCreatedAt(rel.getCreatedAt());

            groups.computeIfAbsent(kind.getKindId(), k -> {
                CiRelGroupVO g = new CiRelGroupVO();
                g.setKindId(kind.getKindId());
                g.setKindName(kind.getName());
                g.setSrcToDst(kind.getSrcToDst());
                g.setDstToSrc(kind.getDstToSrc());
                g.setRelations(new ArrayList<>());
                return g;
            }).getRelations().add(vo);
        }

        return new ArrayList<>(groups.values());
    }

    @Transactional
    public CiInstanceRelVO createRelation(String tenantId, Long operatorId, CreateRelRequest req) {
        CiAssociationDef def = defMapper.selectOne(new LambdaQueryWrapper<CiAssociationDef>()
            .eq(CiAssociationDef::getDefId, req.getDefId()));
        if (def == null) throw new IllegalArgumentException("关联定义不存在: " + req.getDefId());

        validateMapping(tenantId, def, req.getSrcId(), req.getDstId());

        CiInstanceRel rel = new CiInstanceRel();
        rel.setTenantId(tenantId);
        rel.setDefId(req.getDefId());
        rel.setSrcId(req.getSrcId());
        rel.setDstId(req.getDstId());
        rel.setAttrs(req.getAttrs() != null ? req.getAttrs() : new HashMap<>());
        rel.setCreatedAt(LocalDateTime.now());
        rel.setUpdatedAt(LocalDateTime.now());
        rel.setCreatedBy(operatorId);
        rel.setUpdatedBy(operatorId);
        relMapper.insert(rel);

        writeAudit(tenantId, "create_rel", rel.getId(), operatorId,
            "def_id=" + req.getDefId() + " src=" + req.getSrcId() + " dst=" + req.getDstId());

        // Build response VO
        CiInstance dstInst = instanceMapper.selectById(req.getDstId());
        CiAssociationKind kind = kindMapper.selectOne(new LambdaQueryWrapper<CiAssociationKind>()
            .eq(CiAssociationKind::getKindId, def.getKindId()));

        CiInstanceRelVO vo = new CiInstanceRelVO();
        vo.setId(rel.getId());
        vo.setDefId(rel.getDefId());
        vo.setIsSrc(true);
        vo.setPeerId(req.getDstId());
        vo.setPeerName(dstInst != null ? dstInst.getName() : String.valueOf(req.getDstId()));
        vo.setPeerModelId(dstInst != null ? dstInst.getModelId() : null);
        vo.setDirectionLabel(kind != null ? kind.getSrcToDst() : def.getKindId());
        vo.setAttrs(rel.getAttrs());
        vo.setCreatedAt(rel.getCreatedAt());
        return vo;
    }

    @Transactional
    public void deleteRelation(String tenantId, Long relId, Long operatorId) {
        CiInstanceRel rel = relMapper.selectOne(new LambdaQueryWrapper<CiInstanceRel>()
            .eq(CiInstanceRel::getTenantId, tenantId)
            .eq(CiInstanceRel::getId, relId));
        if (rel == null) throw new IllegalArgumentException("关联不存在: " + relId);

        relMapper.update(null, new LambdaUpdateWrapper<CiInstanceRel>()
            .eq(CiInstanceRel::getId, relId)
            .set(CiInstanceRel::getIsDeleted, true)
            .set(CiInstanceRel::getDeletedAt, LocalDateTime.now())
            .set(CiInstanceRel::getDeletedBy, operatorId));

        writeAudit(tenantId, "delete_rel", relId, operatorId,
            "def_id=" + rel.getDefId() + " src=" + rel.getSrcId() + " dst=" + rel.getDstId());
    }

    public PageResult<InstanceSearchVO> searchInstances(String tenantId, String modelId,
                                                         String keyword, int page, int size) {
        boolean hasKeyword = StringUtils.hasText(keyword);
        LambdaQueryWrapper<CiInstance> qw = new LambdaQueryWrapper<CiInstance>()
            .eq(CiInstance::getTenantId, tenantId)
            .eq(CiInstance::getModelId, modelId)
            .like(hasKeyword, CiInstance::getName, keyword)
            .orderByDesc(CiInstance::getCreatedAt);
        long total = instanceMapper.selectCount(new LambdaQueryWrapper<CiInstance>()
            .eq(CiInstance::getTenantId, tenantId)
            .eq(CiInstance::getModelId, modelId)
            .like(hasKeyword, CiInstance::getName, keyword));
        Page<CiInstance> result = instanceMapper.selectPage(new Page<>(page, size, false), qw);
        result.setTotal(total);

        CiModel model = modelMapper.selectOne(new LambdaQueryWrapper<CiModel>()
            .eq(CiModel::getModelId, modelId));
        String modelName = model != null ? model.getName() : modelId;

        return PageResult.of(result.convert(inst -> {
            InstanceSearchVO vo = new InstanceSearchVO();
            vo.setId(inst.getId());
            vo.setName(inst.getName() != null ? inst.getName() : "#" + inst.getId());
            vo.setModelId(inst.getModelId());
            vo.setModelName(modelName);
            return vo;
        }));
    }

    // ── Validation ────────────────────────────────────────────────────────────

    private void validateMapping(String tenantId, CiAssociationDef def, Long srcId, Long dstId) {
        String mapping = def.getMapping();
        if ("n:n".equals(mapping)) return;

        // For 1:1 and 1:n: dst must appear at most once per def
        int dstCount = relMapper.countByDstAndDef(tenantId, def.getDefId(), dstId, -1L);
        if (dstCount > 0) {
            CiInstance dstInst = instanceMapper.selectById(dstId);
            CiModel dstModel = modelMapper.selectOne(new LambdaQueryWrapper<CiModel>()
                .eq(CiModel::getModelId, dstInst.getModelId()));
            throw new IllegalArgumentException(
                ciLabel(dstInst, dstModel) + "在此关联定义下已被占用，无法建立 " + mapping + " 关联");
        }

        // For 1:1 only: src must also appear at most once per def
        if ("1:1".equals(mapping)) {
            int srcCount = relMapper.countBySrcAndDef(tenantId, def.getDefId(), srcId, -1L);
            if (srcCount > 0) {
                CiInstance srcInst = instanceMapper.selectById(srcId);
                CiModel srcModel = modelMapper.selectOne(new LambdaQueryWrapper<CiModel>()
                    .eq(CiModel::getModelId, srcInst.getModelId()));
                throw new IllegalArgumentException(
                    ciLabel(srcInst, srcModel) + "在此关联定义下已被占用，无法建立 1:1 关联");
            }
        }
    }

    private String ciLabel(CiInstance inst, CiModel model) {
        String name = inst.getName() != null ? inst.getName() : "#" + inst.getId();
        String modelName = model != null ? model.getName() : inst.getModelId();
        return name + "（" + modelName + "）";
    }

    private void writeAudit(String tenantId, String action, Long targetId,
                             Long operatorId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId).module("cmdb").action(action)
            .targetId(targetId).targetType("ci_instance_rel")
            .operatorId(operatorId).remark(remark)
            .createdAt(LocalDateTime.now()).build());
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/backend
mvn test -Dtest=CiInstanceRelServiceTest -q 2>&1 | tail -10
```

Expected: `Tests run: 3, Failures: 0, Errors: 0, Skipped: 0` and `BUILD SUCCESS`.

- [ ] **Step 5: Build check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | grep -E "Built|ERROR|error" | head -5
```

Expected: `Image cwgsyw-platform-backend Built`

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelService.java \
        backend/src/test/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelServiceTest.java
git commit -m "feat: CiInstanceRelService - association CRUD with mapping enforcement and audit logging"
```

---

## Task 4: CiInstanceRelController + Smoke Tests

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelController.java`

- [ ] **Step 1: Create CiInstanceRelController**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelController.java
package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cmdb/rel")
@RequiredArgsConstructor
public class CiInstanceRelController {

    private final CiInstanceRelService relService;

    @GetMapping("/{instanceId}")
    @PreAuthorize("hasAuthority('cmdb_instance:read')")
    public R<List<CiRelGroupVO>> getRelations(
            @PathVariable Long instanceId,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(relService.getRelations(user.getTenantId(), instanceId));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('cmdb_instance:create')")
    public R<CiInstanceRelVO> create(
            @RequestBody CreateRelRequest req,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(relService.createRelation(user.getTenantId(), user.getUserId(), req));
    }

    @DeleteMapping("/{relId}")
    @PreAuthorize("hasAuthority('cmdb_instance:delete')")
    public R<Void> delete(
            @PathVariable Long relId,
            @AuthenticationPrincipal SecurityUser user) {
        relService.deleteRelation(user.getTenantId(), relId, user.getUserId());
        return R.ok(null);
    }

    @GetMapping("/search")
    @PreAuthorize("hasAuthority('cmdb_instance:read')")
    public R<PageResult<InstanceSearchVO>> search(
            @RequestParam String modelId,
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(relService.searchInstances(user.getTenantId(), modelId, keyword, page, size));
    }
}
```

- [ ] **Step 2: Build and deploy**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | tail -3
docker compose up -d backend
sleep 25
docker compose logs backend --tail=3 2>&1 | grep -E "Started|ERROR"
```

Expected: `Started PlatformApplication`

- [ ] **Step 3: Smoke tests**

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# Get existing instance IDs
echo "=== Existing host instances ==="
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/cmdb/instances/host | \
  python3 -c "import sys,json; recs=json.load(sys.stdin)['data']['records']; [print('id:', r['id'], 'name:', r['name']) for r in recs]"

echo "=== Search instances ==="
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost/api/cmdb/rel/search?modelId=host&keyword=&size=5" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('code:', d['code'], 'total:', d['data']['total'])"

echo "=== Get relations for instance 2 (empty) ==="
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/cmdb/rel/2 | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('code:', d['code'], 'groups:', len(d.get('data', [])))"
```

Expected: search returns instances with total>0, relations returns empty list `[]`.

Note: full association creation smoke test requires two instances from different models connected by a def. Run after basic checks pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceRelController.java
git commit -m "feat: CiInstanceRelController - REST endpoints for CI instance associations"
```

---

## Task 5: Frontend — Detail Page Association Panel

**Files:**
- Modify: `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/page.tsx`

- [ ] **Step 1: Read the current detail page**

Read `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/page.tsx` in full before making changes. Note the existing imports, interface definitions, and where the JSX ends (after the attribute groups `space-y-4` div).

- [ ] **Step 2: Add imports and new interfaces to the detail page**

At the top of the file, add these new imports after the existing ones:

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ChevronDown, ChevronUp, Link2, X } from 'lucide-react'
```

Add these new interfaces after the existing `CiInstanceVO` interface:

```tsx
interface CiInstanceRelVO {
  id: number
  def_id: string
  is_src: boolean
  peer_id: number
  peer_name: string
  peer_model_id: string
  peer_model_name: string
  direction_label: string
  attrs: Record<string, unknown>
  created_at: string
}

interface CiRelGroupVO {
  kind_id: string
  kind_name: string
  src_to_dst: string
  dst_to_src: string
  relations: CiInstanceRelVO[]
}

interface CiAssociationDefVO {
  def_id: string
  kind_id: string
  name: string
  src_model_id: string
  dst_model_id: string
  mapping: string
}

interface InstanceSearchVO {
  id: number
  name: string
  model_id: string
  model_name: string
}
```

- [ ] **Step 3: Add state variables and queries for associations**

Inside `InstanceDetailPage()`, after the existing state declarations (`editing`, `editAttrs`), add:

```tsx
  const [relPanelOpen, setRelPanelOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedDefId, setSelectedDefId] = useState('')
  const [peerSearch, setPeerSearch] = useState('')
  const [selectedPeerId, setSelectedPeerId] = useState<number | null>(null)
  const [addError, setAddError] = useState('')
```

After the existing `saveMutation` useMutation, add:

```tsx
  const { data: relGroups = [], refetch: refetchRels } = useQuery<CiRelGroupVO[]>({
    queryKey: ['cmdb-rel', id],
    queryFn: () => api.get(`/cmdb/rel/${id}`).then(r => r.data.data),
    enabled: relPanelOpen,
  })

  const { data: allDefs = [] } = useQuery<CiAssociationDefVO[]>({
    queryKey: ['cmdb-assoc-defs'],
    queryFn: () => api.get('/cmdb/meta/association-defs').then(r => r.data.data),
    enabled: addDialogOpen,
  })

  const applicableDefs = allDefs.filter(
    d => d.src_model_id === modelId || d.dst_model_id === modelId
  )

  const selectedDef = applicableDefs.find(d => d.def_id === selectedDefId)
  const targetModelId = selectedDef
    ? (selectedDef.src_model_id === modelId ? selectedDef.dst_model_id : selectedDef.src_model_id)
    : null

  const { data: searchResult } = useQuery<{ records: InstanceSearchVO[] }>({
    queryKey: ['cmdb-rel-search', targetModelId, peerSearch],
    queryFn: () => api.get('/cmdb/rel/search', {
      params: { modelId: targetModelId, keyword: peerSearch, size: 8 }
    }).then(r => r.data.data),
    enabled: !!targetModelId && addDialogOpen,
  })

  const deletRelMutation = useMutation({
    mutationFn: (relId: number) => api.delete(`/cmdb/rel/${relId}`),
    onSuccess: () => { toast.success('关联已删除'); refetchRels() },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  const createRelMutation = useMutation({
    mutationFn: () => {
      if (!selectedDef || !selectedPeerId) throw new Error('请选择关联定义和目标实例')
      const isSrc = selectedDef.src_model_id === modelId
      return api.post('/cmdb/rel', {
        def_id: selectedDefId,
        src_id: isSrc ? Number(id) : selectedPeerId,
        dst_id: isSrc ? selectedPeerId : Number(id),
      })
    },
    onSuccess: () => {
      toast.success('关联已建立')
      setAddDialogOpen(false)
      setSelectedDefId('')
      setSelectedPeerId(null)
      setPeerSearch('')
      setAddError('')
      refetchRels()
    },
    onError: (e: any) => {
      setAddError(e?.response?.data?.message ?? '创建失败')
    },
  })
```

- [ ] **Step 4: Add the association panel JSX**

Inside the return JSX, after the closing `</div>` of the `space-y-4` attribute groups section (and before the final outer `</div>`), add:

```tsx
      {/* Association Panel */}
      <div className="mt-6 border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
          onClick={() => setRelPanelOpen(v => !v)}
        >
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            关联关系
          </div>
          {relPanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {relPanelOpen && (
          <div className="px-5 pb-5 pt-1 space-y-4 border-t">
            {relGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">暂无关联</p>
            ) : (
              relGroups.map(group => (
                <div key={group.kind_id}>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    [{group.kind_name}]
                  </p>
                  <div className="space-y-1">
                    {group.relations.map(rel => (
                      <div key={rel.id} className="flex items-center justify-between py-1.5 px-3 rounded-md hover:bg-muted/30 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{rel.direction_label}</span>
                          <span className="font-medium">{rel.peer_name}</span>
                          <span className="text-xs text-muted-foreground">({rel.peer_model_name})</span>
                        </div>
                        {hasPermission('cmdb_instance', 'delete') && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive"
                            onClick={() => { if (confirm('删除此关联?')) deletRelMutation.mutate(rel.id) }}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              {hasPermission('cmdb_instance', 'create') && (
                <Button size="sm" variant="outline" onClick={() => { setAddDialogOpen(true); setAddError('') }}>
                  + 添加关联
                </Button>
              )}
              <Link href={`/cmdb/instances/${modelId}/${id}/associations`}
                className="text-xs text-muted-foreground hover:text-foreground ml-auto">
                管理全部关联 →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Add Relation Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={open => { setAddDialogOpen(open); if (!open) { setAddError(''); setSelectedDefId(''); setSelectedPeerId(null); setPeerSearch('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加关联</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">关联定义</Label>
              <Select value={selectedDefId} onValueChange={v => { setSelectedDefId(v); setSelectedPeerId(null); setPeerSearch(''); setAddError('') }}>
                <SelectTrigger>
                  <SelectValue placeholder="选择关联定义..." />
                </SelectTrigger>
                <SelectContent>
                  {applicableDefs.map(d => (
                    <SelectItem key={d.def_id} value={d.def_id}>
                      {d.name} ({d.mapping})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDef && (
              <div className="space-y-1.5">
                <Label className="text-sm">
                  目标实例
                  <span className="text-muted-foreground ml-1 font-normal">
                    ({searchResult?.records?.[0]?.model_name ?? targetModelId})
                  </span>
                </Label>
                <Input
                  placeholder="搜索实例名称..."
                  value={peerSearch}
                  onChange={e => { setPeerSearch(e.target.value); setSelectedPeerId(null) }}
                />
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {(searchResult?.records ?? []).map(inst => (
                    <button key={inst.id}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${selectedPeerId === inst.id ? 'bg-muted font-medium' : ''}`}
                      onClick={() => setSelectedPeerId(inst.id)}>
                      {inst.name}
                    </button>
                  ))}
                  {(searchResult?.records ?? []).length === 0 && (
                    <p className="text-center text-muted-foreground text-xs py-3">无匹配实例</p>
                  )}
                </div>
              </div>
            )}

            {addError && (
              <p className="text-sm text-destructive">{addError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>取消</Button>
            <Button
              onClick={() => createRelMutation.mutate()}
              disabled={!selectedDefId || !selectedPeerId || createRelMutation.isPending}>
              {createRelMutation.isPending ? '创建中...' : '建立关联'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: 0 errors.

- [ ] **Step 6: Build frontend**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build frontend 2>&1 | tail -3
docker compose up -d frontend && sleep 15
```

Expected: `Image cwgsyw-platform-frontend Built` and frontend starts.

- [ ] **Step 7: Smoke test**

```bash
/usr/bin/curl -s -o /dev/null -w "%{http_code}" http://localhost/cmdb/instances/host/2 && echo ""
```

Expected: `200`

- [ ] **Step 8: Commit**

```bash
git add "frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/page.tsx"
git commit -m "feat: CMDB instance detail page - association panel and add-relation dialog"
```

---

## Task 6: Frontend — Associations Management Page

**Files:**
- Create: `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/associations/page.tsx`

- [ ] **Step 1: Create the associations management page**

```tsx
// frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/associations/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface CiInstanceRelVO {
  id: number
  def_id: string
  is_src: boolean
  peer_id: number
  peer_name: string
  peer_model_id: string
  peer_model_name: string
  direction_label: string
  created_at: string
}

interface CiRelGroupVO {
  kind_id: string
  kind_name: string
  relations: CiInstanceRelVO[]
}

interface CiInstanceSummary {
  name: string
  model_id: string
}

export default function AssociationsPage() {
  const { modelId, id } = useParams<{ modelId: string; id: string }>()
  const { hasPermission } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [filterKind, setFilterKind] = useState('all')

  useEffect(() => {
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data: inst } = useQuery<CiInstanceSummary>({
    queryKey: ['cmdb-instance-summary', modelId, id],
    queryFn: () => api.get(`/cmdb/instances/${modelId}/${id}`).then(r => ({
      name: r.data.data.name,
      model_id: r.data.data.model_id,
    })),
  })

  const { data: relGroups = [], isLoading } = useQuery<CiRelGroupVO[]>({
    queryKey: ['cmdb-rel', id],
    queryFn: () => api.get(`/cmdb/rel/${id}`).then(r => r.data.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (relId: number) => api.delete(`/cmdb/rel/${relId}`),
    onSuccess: () => {
      toast.success('关联已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-rel', id] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  // Flatten all relations for table display
  const allRelations = relGroups.flatMap(g =>
    g.relations.map(r => ({ ...r, kind_name: g.kind_name }))
  )
  const filtered = filterKind === 'all'
    ? allRelations
    : allRelations.filter(r => {
        const group = relGroups.find(g => g.relations.some(rel => rel.id === r.id))
        return group?.kind_id === filterKind
      })

  const kindOptions = relGroups.map(g => ({ value: g.kind_id, label: g.kind_name }))

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/cmdb/instances/${modelId}/${id}`}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回详情
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            {inst?.name ?? `#${id}`} — 关联管理
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">共 {allRelations.length} 条关联</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <Select value={filterKind} onValueChange={setFilterKind}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="全部种类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部种类</SelectItem>
            {kindOptions.map(k => (
              <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">加载中...</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">种类</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">方向</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">对端 CI</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">模型</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">创建时间</th>
                <th className="px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                    暂无关联
                  </td>
                </tr>
              ) : (
                filtered.map(rel => (
                  <tr key={rel.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground">{rel.kind_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {rel.direction_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/cmdb/instances/${rel.peer_model_id}/${rel.peer_id}`}
                        className="hover:underline">
                        {rel.peer_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{rel.peer_model_name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(rel.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      {hasPermission('cmdb_instance', 'delete') && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                          onClick={() => { if (confirm('删除此关联?')) deleteMutation.mutate(rel.id) }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
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

- [ ] **Step 2: TypeScript check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: 0 errors.

- [ ] **Step 3: Build and deploy**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build frontend 2>&1 | tail -3
docker compose up -d frontend && sleep 15
```

- [ ] **Step 4: Smoke test**

```bash
/usr/bin/curl -s -o /dev/null -w "%{http_code}" http://localhost/cmdb/instances/host/2/associations && echo ""
```

Expected: `200`

- [ ] **Step 5: Commit and tag**

```bash
git add "frontend/src/app/(dashboard)/cmdb/instances/"
git commit -m "feat: CMDB Phase 3 - associations management page"
git tag v0.10.0-cmdb-phase3
echo "Phase CMDB-3 complete"
```

---

## Self-Review

### Spec Coverage
- ✅ V16: `ci_instance_rel` table with JSONB `attrs`, GIN index, unique constraint
- ✅ Mapping enforcement: 1:1 (src+dst unique per def), 1:n (dst unique per def), n:n (no constraint)
- ✅ Error message format: CI name + model name in parentheses + mapping type
- ✅ GET `/rel/{instanceId}`: both directions merged, grouped by kind
- ✅ POST `/rel`: cardinality check before insert
- ✅ DELETE `/rel/{relId}`: soft delete
- ✅ GET `/rel/search`: keyword + modelId filter, recent-first default
- ✅ Detail page panel: collapsed by default, groups by kind, X to delete, "+ 添加" opens dialog
- ✅ Add dialog: def dropdown filtered by current model, instance search, inline red error
- ✅ Management page: table with kind filter, direction label, peer link, delete

### Placeholder Scan
No TBD, TODO, or incomplete sections found.

### Type Consistency
- `CiRelGroupVO.relations: List<CiInstanceRelVO>` in Java → `relations: CiInstanceRelVO[]` in TS — consistent
- `CiInstanceRelVO.isSrc: Boolean` → JSON `is_src` (SNAKE_CASE) → TS `is_src: boolean` — consistent
- `CreateRelRequest.defId` → JSON `def_id` → frontend sends `def_id` — consistent
- `InstanceSearchVO` returned by `/rel/search` → TS `InstanceSearchVO` in detail page and management page — consistent
- `relMapper.countBySrcAndDef(tenantId, defId, srcId, excludeId: long)` matches service call `countBySrcAndDef(tenantId, def.getDefId(), srcId, -1L)` — consistent
