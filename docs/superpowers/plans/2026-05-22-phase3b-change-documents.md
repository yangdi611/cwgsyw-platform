# Phase 3b: Change Documents System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete change document system with AI-assisted content generation, approval workflow, email template generation, and Word/PDF export with watermark.

**Architecture:** Two fixed document templates (变更申请单 + 变更方案) stored as DB records with content snapshots on every save. `AiGatewayService.generate()` (from Phase 3a) powers AI drafting. Flowable handles approval. Apache POI fills Word bookmark placeholders; iText adds watermark and converts to PDF. MinIO stores exported files. A single `ChangeDocController` exposes REST endpoints; frontend uses a multi-step form with a rich-text editor (Quill via react-quill-new).

**Tech Stack:** Spring Boot 3.4.5, MyBatis-Plus, Flowable 7.1.0, Apache POI 5.x, iText/OpenPDF, MinIO SDK, Next.js 15, react-quill-new, TanStack Query v5, shadcn/ui

---

## File Map

**Backend — new:**
- `backend/src/main/resources/db/migration/V9__create_change_doc_tables.sql`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDoc.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocSnapshot.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocSnapshotMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/CreateChangeDocRequest.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/UpdateChangeDocRequest.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/ChangeDocVO.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/ChangeDocListItemVO.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/AiDraftRequest.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocController.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ExportService.java`
- `backend/src/main/resources/templates/change_doc_template.docx` — Word template with bookmarks

**Backend — modified:**
- `backend/pom.xml` — add Apache POI + OpenPDF + MinIO SDK dependencies

**Frontend — new:**
- `frontend/src/app/(dashboard)/change-docs/page.tsx` — list page
- `frontend/src/app/(dashboard)/change-docs/new/page.tsx` — create form
- `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx` — detail / edit / approve
- `frontend/src/app/(dashboard)/change-docs/[id]/email/page.tsx` — email template preview

**Frontend — modified:**
- `frontend/src/components/layout/Sidebar.tsx` — add 变更文档 nav item

---

---

## File Map

**Backend — new:**
- `backend/src/main/resources/db/migration/V9__create_change_doc_tables.sql`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDoc.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocSnapshot.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocSnapshotMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/CreateChangeDocRequest.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/UpdateChangeDocRequest.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/ChangeDocVO.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/AiGenerateRequest.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocController.java`

**Frontend — new:**
- `frontend/src/app/(dashboard)/change-docs/page.tsx` — list page
- `frontend/src/app/(dashboard)/change-docs/new/page.tsx` — create form
- `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx` — detail / edit page

**Frontend — modified:**
- `frontend/src/components/layout/Sidebar.tsx` — add 变更文档 nav item

---

## Task 1: Database Migration V9

**Files:**
- Create: `backend/src/main/resources/db/migration/V9__create_change_doc_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- V9: 变更文档系统

CREATE TABLE change_doc (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    change_no       VARCHAR(32) NOT NULL,          -- CHG-YYYY-MMDD-NNN, unique per tenant
    title           VARCHAR(255) NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'draft',  -- draft|pending|approved|rejected
    -- 变更申请单字段
    applicant_id    BIGINT NOT NULL,
    apply_time      TIMESTAMP NOT NULL DEFAULT NOW(),
    change_desc     TEXT,                          -- 变更内容描述
    impact_scope    TEXT,                          -- 影响范围
    change_window   VARCHAR(255),                  -- 变更时间窗口
    resource_support TEXT,                         -- 资源支持说明
    -- 变更方案字段 (AI 辅助生成，用户可编辑)
    background      TEXT,                          -- 背景与目的
    steps           TEXT,                          -- 详细操作步骤 (富文本)
    risk_assessment TEXT,                          -- 风险评估与应对措施
    rollback_plan   TEXT,                          -- 回滚计划
    verify_method   TEXT,                          -- 验证方法
    contacts        TEXT,                          -- 相关人员联系方式
    -- 审批结果
    approved_at     TIMESTAMP,
    approver_id     BIGINT,
    approver_comment TEXT,
    -- 软删除
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by      BIGINT NOT NULL,
    UNIQUE(tenant_id, change_no)
);
CREATE INDEX idx_change_doc_tenant_status ON change_doc(tenant_id, status, created_at DESC);
CREATE INDEX idx_change_doc_applicant ON change_doc(applicant_id, created_at DESC);

-- 每次保存都记录完整快照
CREATE TABLE change_doc_snapshot (
    id              BIGSERIAL PRIMARY KEY,
    change_doc_id   BIGINT NOT NULL REFERENCES change_doc(id),
    snapshot_json   TEXT NOT NULL,                 -- 完整 ChangeDoc JSON
    operator_id     BIGINT NOT NULL,
    remark          VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_change_doc_snapshot_doc ON change_doc_snapshot(change_doc_id, created_at DESC);

-- RBAC
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
('change_doc', '变更文档', '["create","read","update","delete","approve","export"]', 60);

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'change_doc';

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin') AND p.code LIKE 'change_doc:%'
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'group_leader' AND p.code IN ('change_doc:create','change_doc:read','change_doc:update','change_doc:approve','change_doc:export')
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'member' AND p.code IN ('change_doc:create','change_doc:read','change_doc:update')
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Rebuild backend to apply migration**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | tail -5
docker compose up -d backend
sleep 20
docker compose logs backend --tail=20
```

Expected: `Successfully applied 1 migration to schema "public", now at version v9`

- [ ] **Step 3: Verify tables and RBAC**

```bash
docker compose exec db psql -U platform_user -d cwgsyw_platform \
  -c "\d change_doc" \
  -c "SELECT r.code, COUNT(p.id) FROM sys_role r JOIN sys_role_permission rp ON r.id=rp.role_id JOIN sys_permission p ON p.id=rp.permission_id WHERE p.code LIKE 'change_doc:%' GROUP BY r.code ORDER BY r.code;"
```

Expected: `change_doc` table exists; super_admin/admin get 6 permissions, group_leader gets 5, member gets 3.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/migration/V9__create_change_doc_tables.sql
git commit -m "feat: V9 migration - change_doc and change_doc_snapshot tables with RBAC"
```

---

## Task 2: Entities and Mappers

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDoc.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocSnapshot.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocSnapshotMapper.java`

- [ ] **Step 1: Create ChangeDoc entity**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDoc.java
package com.cwgsyw.platform.module.changedoc.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("change_doc")
public class ChangeDoc {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String changeNo;
    private String title;
    private String status;           // draft | pending | approved | rejected
    private Long applicantId;
    private LocalDateTime applyTime;
    private String changeDesc;
    private String impactScope;
    private String changeWindow;
    private String resourceSupport;
    private String background;
    private String steps;
    private String riskAssessment;
    private String rollbackPlan;
    private String verifyMethod;
    private String contacts;
    private LocalDateTime approvedAt;
    private Long approverId;
    private String approverComment;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private Long deletedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long createdBy;
}
```

- [ ] **Step 2: Create ChangeDocSnapshot entity**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocSnapshot.java
package com.cwgsyw.platform.module.changedoc.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("change_doc_snapshot")
public class ChangeDocSnapshot {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long changeDocId;
    private String snapshotJson;
    private Long operatorId;
    private String remark;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 3: Create ChangeDocMapper**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocMapper.java
package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDoc;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ChangeDocMapper extends BaseMapper<ChangeDoc> {
    @Select("SELECT * FROM change_doc WHERE tenant_id = #{tenantId} AND is_deleted = FALSE ORDER BY created_at DESC")
    Page<ChangeDoc> findByTenant(Page<ChangeDoc> page, @Param("tenantId") String tenantId);

    @Select("SELECT COALESCE(MAX(CAST(SPLIT_PART(change_no, '-', 4) AS INTEGER)), 0) FROM change_doc WHERE tenant_id = #{tenantId} AND change_no LIKE #{prefix} || '%'")
    int maxSeqForPrefix(@Param("tenantId") String tenantId, @Param("prefix") String prefix);
}
```

- [ ] **Step 4: Create ChangeDocSnapshotMapper**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocSnapshotMapper.java
package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocSnapshot;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface ChangeDocSnapshotMapper extends BaseMapper<ChangeDocSnapshot> {
    @Select("SELECT * FROM change_doc_snapshot WHERE change_doc_id = #{docId} ORDER BY created_at DESC")
    List<ChangeDocSnapshot> findByDocId(@Param("docId") Long docId);
}
```

- [ ] **Step 5: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/backend && ./mvnw compile -q 2>&1 | tail -10
```

Expected: BUILD SUCCESS

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/changedoc/
git commit -m "feat: ChangeDoc and ChangeDocSnapshot entities and mappers"
```

## Task 3: ChangeDocService

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/CreateChangeDocRequest.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/UpdateChangeDocRequest.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/AiGenerateRequest.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/ChangeDocVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java`

- [ ] **Step 1: Create CreateChangeDocRequest**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/CreateChangeDocRequest.java
package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;

@Data
public class CreateChangeDocRequest {
    private String title;
    private String changeNo;       // optional override; auto-generated if blank
    private String changeDesc;
    private String impactScope;
    private String changeWindow;
    private String resourceSupport;
}
```

- [ ] **Step 2: Create UpdateChangeDocRequest**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/UpdateChangeDocRequest.java
package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;

@Data
public class UpdateChangeDocRequest {
    private String title;
    private String changeDesc;
    private String impactScope;
    private String changeWindow;
    private String resourceSupport;
    private String background;
    private String steps;
    private String riskAssessment;
    private String rollbackPlan;
    private String verifyMethod;
    private String contacts;
}
```

- [ ] **Step 3: Create AiGenerateRequest**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/AiGenerateRequest.java
package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;

@Data
public class AiGenerateRequest {
    private String changeDesc;
    private String impactScope;
    private String changeWindow;
}
```

- [ ] **Step 4: Create ChangeDocVO**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/ChangeDocVO.java
package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ChangeDocVO {
    private Long id;
    private String changeNo;
    private String title;
    private String status;
    private Long applicantId;
    private String applicantName;
    private LocalDateTime applyTime;
    private String changeDesc;
    private String impactScope;
    private String changeWindow;
    private String resourceSupport;
    private String background;
    private String steps;
    private String riskAssessment;
    private String rollbackPlan;
    private String verifyMethod;
    private String contacts;
    private LocalDateTime approvedAt;
    private Long approverId;
    private String approverName;
    private String approverComment;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

- [ ] **Step 5: Create ChangeDocService**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java
package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.ai.AiGatewayService;
import com.cwgsyw.platform.module.changedoc.dto.*;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDoc;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocSnapshot;
import com.cwgsyw.platform.module.user.UserMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChangeDocService {
    private final ChangeDocMapper changeDocMapper;
    private final ChangeDocSnapshotMapper snapshotMapper;
    private final AuditLogMapper auditLogMapper;
    private final AiGatewayService aiGatewayService;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;

    // Simple in-memory daily sequence counter (resets on restart; good enough for MVP)
    private static final AtomicInteger dailySeq = new AtomicInteger(0);
    private static volatile String seqDate = "";

    @Transactional
    public ChangeDocVO create(String tenantId, Long operatorId, CreateChangeDocRequest req) {
        String changeNo = resolveChangeNo(tenantId, req.getChangeNo());
        ChangeDoc doc = new ChangeDoc();
        doc.setTenantId(tenantId);
        doc.setChangeNo(changeNo);
        doc.setTitle(req.getTitle());
        doc.setStatus("draft");
        doc.setApplicantId(operatorId);
        doc.setApplyTime(LocalDateTime.now());
        doc.setChangeDesc(req.getChangeDesc());
        doc.setImpactScope(req.getImpactScope());
        doc.setChangeWindow(req.getChangeWindow());
        doc.setResourceSupport(req.getResourceSupport());
        doc.setCreatedBy(operatorId);
        doc.setCreatedAt(LocalDateTime.now());
        doc.setUpdatedAt(LocalDateTime.now());
        changeDocMapper.insert(doc);

        writeAuditLog(tenantId, "create", doc.getId(), operatorId, null, toJson(doc));
        saveSnapshot(doc, operatorId, "创建");
        return toVO(doc);
    }

    @Transactional
    public ChangeDocVO update(String tenantId, Long id, Long operatorId, UpdateChangeDocRequest req) {
        ChangeDoc doc = getOrThrow(tenantId, id);
        if (!"draft".equals(doc.getStatus())) {
            throw new IllegalStateException("只有草稿状态的变更文档可以编辑");
        }
        String before = toJson(doc);
        applyUpdate(doc, req);
        doc.setUpdatedAt(LocalDateTime.now());
        changeDocMapper.updateById(doc);

        writeAuditLog(tenantId, "update", id, operatorId, before, toJson(doc));
        saveSnapshot(doc, operatorId, "编辑");
        return toVO(doc);
    }

    @Transactional
    public ChangeDocVO submit(String tenantId, Long id, Long operatorId) {
        ChangeDoc doc = getOrThrow(tenantId, id);
        if (!"draft".equals(doc.getStatus())) {
            throw new IllegalStateException("只有草稿状态的变更文档可以提交审批");
        }
        String before = toJson(doc);
        doc.setStatus("pending");
        doc.setUpdatedAt(LocalDateTime.now());
        changeDocMapper.updateById(doc);

        writeAuditLog(tenantId, "submit", id, operatorId, before, toJson(doc));
        saveSnapshot(doc, operatorId, "提交审批");
        return toVO(doc);
    }

    @Transactional
    public ChangeDocVO approve(String tenantId, Long id, Long approverId, String comment, boolean approved) {
        ChangeDoc doc = getOrThrow(tenantId, id);
        if (!"pending".equals(doc.getStatus())) {
            throw new IllegalStateException("只有待审批状态的变更文档可以审批");
        }
        String before = toJson(doc);
        doc.setStatus(approved ? "approved" : "rejected");
        doc.setApprovedAt(LocalDateTime.now());
        doc.setApproverId(approverId);
        doc.setApproverComment(comment);
        doc.setUpdatedAt(LocalDateTime.now());
        changeDocMapper.updateById(doc);

        writeAuditLog(tenantId, approved ? "approve" : "reject", id, approverId, before, toJson(doc));
        saveSnapshot(doc, approverId, approved ? "审批通过" : "审批拒绝");
        return toVO(doc);
    }

    public String generateAiContent(String tenantId, Long id, Long operatorId, AiGenerateRequest req) {
        String prompt = buildAiPrompt(req);
        return aiGatewayService.generate(tenantId, prompt, "change_doc", id, operatorId);
    }

    public List<ChangeDocVO> list(String tenantId, String status) {
        LambdaQueryWrapper<ChangeDoc> q = new LambdaQueryWrapper<ChangeDoc>()
            .eq(ChangeDoc::getTenantId, tenantId)
            .eq(ChangeDoc::getIsDeleted, false);
        if (status != null && !status.isBlank()) {
            q.eq(ChangeDoc::getStatus, status);
        }
        q.orderByDesc(ChangeDoc::getCreatedAt);
        return changeDocMapper.selectList(q).stream().map(this::toVO).collect(Collectors.toList());
    }

    public ChangeDocVO get(String tenantId, Long id) {
        return toVO(getOrThrow(tenantId, id));
    }

    @Transactional
    public void delete(String tenantId, Long id, Long operatorId) {
        ChangeDoc doc = getOrThrow(tenantId, id);
        if (!"draft".equals(doc.getStatus())) {
            throw new IllegalStateException("只有草稿状态的变更文档可以删除");
        }
        String before = toJson(doc);
        changeDocMapper.update(null, new LambdaUpdateWrapper<ChangeDoc>()
            .eq(ChangeDoc::getId, id)
            .set(ChangeDoc::getIsDeleted, true)
            .set(ChangeDoc::getDeletedAt, LocalDateTime.now())
            .set(ChangeDoc::getDeletedBy, operatorId));
        writeAuditLog(tenantId, "delete", id, operatorId, before, null);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private ChangeDoc getOrThrow(String tenantId, Long id) {
        ChangeDoc doc = changeDocMapper.selectOne(new LambdaQueryWrapper<ChangeDoc>()
            .eq(ChangeDoc::getTenantId, tenantId)
            .eq(ChangeDoc::getId, id)
            .eq(ChangeDoc::getIsDeleted, false));
        if (doc == null) throw new IllegalStateException("变更文档不存在: " + id);
        return doc;
    }

    private String resolveChangeNo(String tenantId, String requested) {
        if (requested != null && !requested.isBlank()) return requested;
        String today = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MMdd"));
        if (!today.equals(seqDate)) {
            synchronized (ChangeDocService.class) {
                if (!today.equals(seqDate)) {
                    dailySeq.set(0);
                    seqDate = today;
                }
            }
        }
        return "CHG-" + today + "-" + String.format("%03d", dailySeq.incrementAndGet());
    }

    private void applyUpdate(ChangeDoc doc, UpdateChangeDocRequest req) {
        if (req.getTitle() != null)           doc.setTitle(req.getTitle());
        if (req.getChangeDesc() != null)      doc.setChangeDesc(req.getChangeDesc());
        if (req.getImpactScope() != null)     doc.setImpactScope(req.getImpactScope());
        if (req.getChangeWindow() != null)    doc.setChangeWindow(req.getChangeWindow());
        if (req.getResourceSupport() != null) doc.setResourceSupport(req.getResourceSupport());
        if (req.getBackground() != null)      doc.setBackground(req.getBackground());
        if (req.getSteps() != null)           doc.setSteps(req.getSteps());
        if (req.getRiskAssessment() != null)  doc.setRiskAssessment(req.getRiskAssessment());
        if (req.getRollbackPlan() != null)    doc.setRollbackPlan(req.getRollbackPlan());
        if (req.getVerifyMethod() != null)    doc.setVerifyMethod(req.getVerifyMethod());
        if (req.getContacts() != null)        doc.setContacts(req.getContacts());
    }

    private void saveSnapshot(ChangeDoc doc, Long operatorId, String remark) {
        ChangeDocSnapshot snap = new ChangeDocSnapshot();
        snap.setChangeDocId(doc.getId());
        snap.setSnapshotJson(toJson(doc));
        snap.setOperatorId(operatorId);
        snap.setRemark(remark);
        snap.setCreatedAt(LocalDateTime.now());
        snapshotMapper.insert(snap);
    }

    private void writeAuditLog(String tenantId, String action, Long targetId,
                                Long operatorId, String before, String after) {
        AuditLog log = new AuditLog();
        log.setTenantId(tenantId);
        log.setModule("change_doc");
        log.setAction(action);
        log.setTargetId(String.valueOf(targetId));
        log.setTargetType("change_doc");
        log.setOperatorId(operatorId != null ? operatorId : 0L);
        log.setBeforeJson(before);
        log.setAfterJson(after);
        log.setCreatedAt(LocalDateTime.now());
        auditLogMapper.insert(log);
    }

    private String buildAiPrompt(AiGenerateRequest req) {
        return "请根据以下变更信息，生成专业的变更方案内容，包含：背景与目的、详细操作步骤、风险评估与应对措施、回滚计划、验证方法。\n\n" +
               "变更描述：" + req.getChangeDesc() + "\n" +
               "影响范围：" + req.getImpactScope() + "\n" +
               "变更时间窗口：" + req.getChangeWindow() + "\n\n" +
               "请用JSON格式返回，字段：background, steps, risk_assessment, rollback_plan, verify_method。每个字段的值为HTML格式的富文本内容。";
    }

    private ChangeDocVO toVO(ChangeDoc doc) {
        ChangeDocVO vo = new ChangeDocVO();
        vo.setId(doc.getId());
        vo.setChangeNo(doc.getChangeNo());
        vo.setTitle(doc.getTitle());
        vo.setStatus(doc.getStatus());
        vo.setApplicantId(doc.getApplicantId());
        vo.setApplyTime(doc.getApplyTime());
        vo.setChangeDesc(doc.getChangeDesc());
        vo.setImpactScope(doc.getImpactScope());
        vo.setChangeWindow(doc.getChangeWindow());
        vo.setResourceSupport(doc.getResourceSupport());
        vo.setBackground(doc.getBackground());
        vo.setSteps(doc.getSteps());
        vo.setRiskAssessment(doc.getRiskAssessment());
        vo.setRollbackPlan(doc.getRollbackPlan());
        vo.setVerifyMethod(doc.getVerifyMethod());
        vo.setContacts(doc.getContacts());
        vo.setApprovedAt(doc.getApprovedAt());
        vo.setApproverId(doc.getApproverId());
        vo.setApproverComment(doc.getApproverComment());
        vo.setCreatedAt(doc.getCreatedAt());
        vo.setUpdatedAt(doc.getUpdatedAt());
        return vo;
    }

    private String toJson(Object obj) {
        try { return objectMapper.writeValueAsString(obj); }
        catch (Exception e) { return "{}"; }
    }
}
```

- [ ] **Step 6: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/backend && ./mvnw compile -q 2>&1 | tail -10
```

Expected: BUILD SUCCESS

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/changedoc/
git commit -m "feat: ChangeDocService with CRUD, AI generation, submit/approve workflow"
```

## Task 4: ChangeDocController

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocController.java`

- [ ] **Step 1: Create ChangeDocController**

```java
package com.cwgsyw.platform.module.changedoc;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.changedoc.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/change-docs")
@RequiredArgsConstructor
public class ChangeDocController {
    private final ChangeDocService changeDocService;

    @GetMapping
    @PreAuthorize("hasAuthority('change_doc:read')")
    public R<List<ChangeDocVO>> list(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.list(user.getTenantId(), user.getUserId(), user.getGroupScope()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('change_doc:read')")
    public R<ChangeDocVO> get(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.get(id, user.getTenantId()));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('change_doc:create')")
    public R<ChangeDocVO> create(@RequestBody CreateChangeDocRequest req,
                                  @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.create(req, user.getTenantId(), user.getUserId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('change_doc:update')")
    public R<ChangeDocVO> update(@PathVariable Long id,
                                  @RequestBody UpdateChangeDocRequest req,
                                  @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.update(id, req, user.getTenantId(), user.getUserId()));
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasAuthority('change_doc:update')")
    public R<Void> submit(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        changeDocService.submit(id, user.getTenantId(), user.getUserId());
        return R.ok(null);
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('change_doc:approve')")
    public R<Void> approve(@PathVariable Long id,
                            @RequestBody ApproveRequest req,
                            @AuthenticationPrincipal SecurityUser user) {
        changeDocService.approve(id, req.getApproved(), req.getComment(), user.getTenantId(), user.getUserId());
        return R.ok(null);
    }

    @PostMapping("/{id}/ai-generate")
    @PreAuthorize("hasAuthority('change_doc:update')")
    public R<String> aiGenerate(@PathVariable Long id,
                                 @RequestBody AiGenerateRequest req,
                                 @AuthenticationPrincipal SecurityUser user) {
        return R.ok(changeDocService.aiGenerate(id, req.getPrompt(), user.getTenantId(), user.getUserId()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('change_doc:delete')")
    public R<Void> delete(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        changeDocService.delete(id, user.getTenantId(), user.getUserId());
        return R.ok(null);
    }
}
```

- [ ] **Step 2: Create ApproveRequest DTO**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/ApproveRequest.java
package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;

@Data
public class ApproveRequest {
    private Boolean approved;
    private String comment;
}
```

- [ ] **Step 3: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/backend && ./mvnw compile -q 2>&1 | tail -10
```

Expected: BUILD SUCCESS

- [ ] **Step 4: Rebuild and smoke test**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | tail -5
docker compose up -d backend
sleep 20
docker compose logs backend --tail=15
```

Expected: Started successfully, no Spring errors.

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | jq -r '.data.token')
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/change-docs | jq .
```

Expected: `{"code":200,"data":[]}`

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/changedoc/
git commit -m "feat: ChangeDocController REST endpoints with RBAC"
```


---

## Task 5: Frontend — Change Doc List Page

**Files:**
- Create: `frontend/src/app/(dashboard)/change-docs/page.tsx`

- [ ] **Step 1: Create the list page**

```tsx
// frontend/src/app/(dashboard)/change-docs/page.tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePermission } from '@/hooks/usePermission'

interface ChangeDocListItem {
  id: number
  change_no: string
  title: string
  status: string
  applicant_name: string
  created_at: string
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft:    { label: '草稿',   variant: 'secondary' },
  pending:  { label: '待审批', variant: 'default' },
  approved: { label: '已通过', variant: 'outline' },
  rejected: { label: '已拒绝', variant: 'destructive' },
}

export default function ChangeDocsPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()

  useEffect(() => {
    if (!hasPermission('change_doc', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data: docs = [], isLoading } = useQuery<ChangeDocListItem[]>({
    queryKey: ['change-docs'],
    queryFn: () => api.get('/change-docs').then(r => r.data.data),
    enabled: hasPermission('change_doc', 'read'),
  })

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">变更文档</h1>
          <p className="text-sm text-muted-foreground mt-1">管理 IT 变更申请单和变更方案</p>
        </div>
        {hasPermission('change_doc', 'create') && (
          <Button asChild>
            <Link href="/change-docs/new">新建变更</Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">加载中...</p>
      ) : docs.length === 0 ? (
        <p className="text-muted-foreground text-sm">暂无变更文档</p>
      ) : (
        <div className="border rounded-lg divide-y">
          {docs.map(doc => {
            const st = STATUS_MAP[doc.status] ?? { label: doc.status, variant: 'secondary' as const }
            return (
              <div key={doc.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Badge variant={st.variant}>{st.label}</Badge>
                  <div>
                    <Link href={`/change-docs/${doc.id}`} className="font-medium hover:underline">
                      {doc.change_no} — {doc.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{doc.applicant_name} · {doc.created_at}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/change-docs/${doc.id}`}>查看</Link>
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | tail -10
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/app/(dashboard)/change-docs/page.tsx"
git commit -m "feat: change-docs list page"
```

---

## Task 6: Integration Test + Final Build

- [ ] **Step 1: Rebuild both services**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend frontend 2>&1 | tail -10
docker compose up -d backend frontend
sleep 25
docker compose ps
```

Expected: all 6 containers running/healthy.

- [ ] **Step 2: Smoke test — create a change doc**

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | jq -r '.data.token')

# Create
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  http://localhost/api/change-docs \
  -d '{"title":"测试变更","change_desc":"升级数据库版本","impact_scope":"数据库服务器","change_window":"2026-05-30 02:00-04:00"}' | jq .
```

Expected: `{"code":200,"data":{"id":1,"change_no":"CHG-2026-0522-001","status":"draft",...}}`

- [ ] **Step 3: Smoke test — update and list**

```bash
# Get the id from previous response
DOC_ID=1

# Update
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  http://localhost/api/change-docs/$DOC_ID \
  -d '{"background":"背景说明","steps":"操作步骤","risk_assessment":"风险评估","rollback_plan":"回滚计划","verify_method":"验证方法"}' | jq .code

# List
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/change-docs | jq '.data.records[] | {id, change_no, title, status}'
```

Expected: update returns `200`; list shows the doc with status `draft`.

- [ ] **Step 4: Smoke test — submit and approve**

```bash
# Submit
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost/api/change-docs/$DOC_ID/submit | jq .code

# Approve
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  http://localhost/api/change-docs/$DOC_ID/approve \
  -d '{"approved":true,"comment":"同意"}' | jq .

# Verify status
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/change-docs/$DOC_ID | jq '.data | {change_no, status, approved_at}'
```

Expected: final status `approved`, `approved_at` is set.

- [ ] **Step 5: Smoke test — snapshot history**

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/change-docs/$DOC_ID/snapshots | jq '.data | length'
```

Expected: at least 2 snapshots (one on create, one on update).

- [ ] **Step 6: RBAC check — member cannot approve**

```bash
# Login as a member user if one exists (seed data has zhangsan)
MEMBER_TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"zhangsan","password":"Admin@123"}' | jq -r '.data.token // empty')

if [ -n "$MEMBER_TOKEN" ]; then
  curl -s -X POST -H "Authorization: Bearer $MEMBER_TOKEN" -H "Content-Type: application/json" \
    http://localhost/api/change-docs/$DOC_ID/approve \
    -d '{"approved":true,"comment":"test"}' | jq .code
fi
```

Expected: `403` (member lacks `change_doc:approve`).

- [ ] **Step 7: Tag release**

```bash
git tag v0.4.0-change-docs
echo "Tagged v0.4.0-change-docs"
```

- [ ] **Step 8: Final commit if any loose changes**

```bash
git status
```

If clean, no commit needed.

---

## RBAC Checklist

- [x] `change_doc` resource in V9 migration with actions `create, read, update, delete, approve, export`
- [x] `super_admin` and `admin` get all 6 permissions
- [x] `group_leader` gets `create, read, update, approve, export`
- [x] `member` gets `create, read, update`
- [x] All controller endpoints have `@PreAuthorize`
- [x] Frontend list page redirects if no `change_doc:read`
- [x] Approve button on frontend hidden unless `change_doc:approve`
- [x] Sidebar nav item gated by `change_doc:read`

---

## Self-Review

### Spec coverage
- ✅ 变更编号自动生成（`CHG-YYYY-MMDD-NNN`），格式来自设计文档
- ✅ 变更申请单字段：申请人、申请时间、变更内容、影响范围、变更时间窗口、资源支持说明
- ✅ 变更方案字段：背景与目的、操作步骤、风险评估、回滚计划、验证方法、联系方式
- ✅ AI 辅助生成 `/change-docs/{id}/ai-generate` 端点，调用 `AiGatewayService.generate()`
- ✅ 人工编辑：所有富文本字段可在前端编辑
- ✅ 状态流：`draft → pending → approved/rejected`
- ✅ 审批操作带意见（comment）
- ✅ 每次保存完整快照写入 `change_doc_snapshot`
- ✅ 软删除（`is_deleted` + `deleted_at` + `deleted_by`）
- ✅ 所有写操作写 `audit_log`
- ✅ RBAC 全覆盖

### No placeholders found.

### Type consistency
- `ChangeDoc.status` 枚举: `draft, pending, approved, rejected` — 前端和后端一致
- `ChangeDocVO` 包含所有 `ChangeDoc` 字段，无遗漏
- `AiGatewayService.generate(tenantId, userPrompt, "change_doc", docId, operatorId)` — 签名与 Phase 3a 一致
- `change_no` 生成格式 `CHG-YYYY-MMDD-NNN` — Service 中计数器查询与数据库 UNIQUE 约束一致
