# Change Document Template Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a flexible change-document template system where admins upload `.docx` files with `{{field_key}}` bookmarks, configure the fields (label, type, order, required), and the system dynamically renders the fill-in form and produces Word/PDF exports from the actual template file.

**Architecture:** A `change_doc_template` table stores template versions (with the `.docx` file stored in MinIO); a `change_doc_field` table stores per-template field definitions. When a user creates a change document they pick a template — the form fields come from `change_doc_field`. Field values are stored as `fields_data JSONB` on `change_doc`. On export, Apache POI opens the template `.docx` from MinIO and replaces `{{field_key}}` text runs with the stored values. Existing fixed-field records are migrated gracefully via a `fields_data` seed on V12.

**Tech Stack:** MinIO Java SDK 8.x, Apache POI XWPFDocument (already in pom.xml), Spring Boot 3.4.5, MyBatis-Plus, Next.js 15, shadcn/ui, TanStack Query v5

---

## File Map

**Backend — new:**
- `backend/src/main/resources/db/migration/V12__change_doc_template.sql`
- `backend/src/main/java/com/cwgsyw/platform/config/MinioConfig.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocTemplate.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocField.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocTemplateMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocFieldMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/TemplateVO.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/FieldConfigVO.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/SaveFieldRequest.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocTemplateService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocTemplateController.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/MinioStorageService.java`

**Backend — modified:**
- `backend/pom.xml` — add MinIO SDK dependency
- `backend/src/main/resources/application.yml` — add minio config block
- `docker-compose.yml` — pass MINIO_* env vars to backend service
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDoc.java` — add `templateId`, `fieldsData`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/ChangeDocVO.java` — add `templateId`, `fields` map
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/CreateChangeDocRequest.java` — add `templateId`, `fieldsData`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/UpdateChangeDocRequest.java` — replace fixed fields with `fieldsData`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java` — use `fieldsData`, resolve template fields
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ExportService.java` — replace programmatic build with template bookmark-fill

**Frontend — new:**
- `frontend/src/app/(dashboard)/admin/change-doc-templates/page.tsx` — template list + upload
- `frontend/src/app/(dashboard)/admin/change-doc-templates/[id]/page.tsx` — field config editor

**Frontend — modified:**
- `frontend/src/app/(dashboard)/change-docs/new/page.tsx` — template picker + dynamic fields
- `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx` — dynamic field rendering
- `frontend/src/components/layout/Sidebar.tsx` — add template management nav item

---

## Task 1: MinIO SDK + Config

**Files:**
- Modify: `backend/pom.xml`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `docker-compose.yml`
- Create: `backend/src/main/java/com/cwgsyw/platform/config/MinioConfig.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/MinioStorageService.java`

- [ ] **Step 1: Add MinIO SDK to pom.xml**

In `backend/pom.xml`, inside `<dependencies>`, add after the OpenPDF dependency:

```xml
<!-- MinIO object storage -->
<dependency>
    <groupId>io.minio</groupId>
    <artifactId>minio</artifactId>
    <version>8.5.11</version>
</dependency>
```

- [ ] **Step 2: Add MinIO config to application.yml**

Append at the end of `backend/src/main/resources/application.yml`:

```yaml
minio:
  endpoint: ${MINIO_ENDPOINT:http://minio:9000}
  access-key: ${MINIO_ACCESS_KEY:minioadmin}
  secret-key: ${MINIO_SECRET_KEY:minioadmin}
  bucket: ${MINIO_BUCKET:change-doc-templates}
```

- [ ] **Step 3: Pass MinIO env vars to backend in docker-compose.yml**

In `docker-compose.yml`, inside the `backend.environment` block, add:

```yaml
      MINIO_ENDPOINT: http://minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
      MINIO_BUCKET: change-doc-templates
```

- [ ] **Step 4: Create MinioConfig.java**

```java
// backend/src/main/java/com/cwgsyw/platform/config/MinioConfig.java
package com.cwgsyw.platform.config;

import io.minio.MinioClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MinioConfig {

    @Value("${minio.endpoint}")
    private String endpoint;

    @Value("${minio.access-key}")
    private String accessKey;

    @Value("${minio.secret-key}")
    private String secretKey;

    @Bean
    public MinioClient minioClient() {
        return MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
    }
}
```

- [ ] **Step 5: Create MinioStorageService.java**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/MinioStorageService.java
package com.cwgsyw.platform.module.changedoc;

import io.minio.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;

@Service
@RequiredArgsConstructor
@Slf4j
public class MinioStorageService {

    private final MinioClient minioClient;

    @Value("${minio.bucket}")
    private String bucket;

    public void upload(String objectKey, InputStream data, long size, String contentType) {
        try {
            ensureBucket();
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .stream(data, size, -1)
                    .contentType(contentType)
                    .build());
        } catch (Exception e) {
            throw new RuntimeException("上传文件失败: " + e.getMessage(), e);
        }
    }

    public InputStream download(String objectKey) {
        try {
            return minioClient.getObject(GetObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .build());
        } catch (Exception e) {
            throw new RuntimeException("下载文件失败: " + e.getMessage(), e);
        }
    }

    public void delete(String objectKey) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectKey)
                    .build());
        } catch (Exception e) {
            log.warn("删除文件失败 key={}: {}", objectKey, e.getMessage());
        }
    }

    private void ensureBucket() throws Exception {
        boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
        if (!exists) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
        }
    }
}
```

- [ ] **Step 6: Verify build compiles**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | grep -E "Built|ERROR|error" | head -10
```

Expected: `Image cwgsyw-platform-backend Built`

- [ ] **Step 7: Commit**

```bash
git add backend/pom.xml \
        backend/src/main/resources/application.yml \
        docker-compose.yml \
        backend/src/main/java/com/cwgsyw/platform/config/MinioConfig.java \
        backend/src/main/java/com/cwgsyw/platform/module/changedoc/MinioStorageService.java
git commit -m "feat: MinIO SDK + config + StorageService"
```

---

## Task 2: V12 Database Migration

**Files:**
- Create: `backend/src/main/resources/db/migration/V12__change_doc_template.sql`

- [ ] **Step 1: Create V12 migration**

```sql
-- V12: 变更文档模板引擎

-- 模板版本表
CREATE TABLE change_doc_template (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    name        VARCHAR(255) NOT NULL,
    description VARCHAR(512),
    version     INTEGER      NOT NULL DEFAULT 1,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    docx_key    VARCHAR(512),          -- MinIO object key, NULL until file is uploaded
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by  BIGINT       NOT NULL DEFAULT 0
);
CREATE INDEX idx_change_doc_template_tenant ON change_doc_template(tenant_id, is_active) WHERE NOT is_deleted;

-- 字段配置表
CREATE TABLE change_doc_field (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    template_id BIGINT      NOT NULL REFERENCES change_doc_template(id),
    field_key   VARCHAR(64) NOT NULL,   -- matches {{field_key}} in .docx
    label       VARCHAR(128) NOT NULL,  -- Chinese display label
    field_type  VARCHAR(32) NOT NULL DEFAULT 'textarea', -- text | textarea | date | readonly
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    required    BOOLEAN     NOT NULL DEFAULT FALSE,
    in_form     BOOLEAN     NOT NULL DEFAULT TRUE,  -- show in fill-in form
    placeholder VARCHAR(255),
    UNIQUE(template_id, field_key)
);
CREATE INDEX idx_change_doc_field_template ON change_doc_field(template_id, sort_order);

-- Seed: default template with existing fields (so existing docs still work)
INSERT INTO change_doc_template (tenant_id, name, description, version, is_active, created_by)
VALUES ('default', '默认变更文档模板', '系统内置模板，字段与原有表单一致', 1, TRUE, 0);

INSERT INTO change_doc_field (tenant_id, template_id, field_key, label, field_type, sort_order, required, in_form)
SELECT 'default', t.id, f.field_key, f.label, f.field_type, f.sort_order, f.required, f.in_form
FROM change_doc_template t,
     (VALUES
       ('title',            '变更标题',         'text',     1,  TRUE,  TRUE),
       ('change_desc',      '变更内容描述',     'textarea', 2,  TRUE,  TRUE),
       ('impact_scope',     '影响范围',         'textarea', 3,  TRUE,  TRUE),
       ('change_window',    '变更时间窗口',     'text',     4,  TRUE,  TRUE),
       ('resource_support', '资源支持说明',     'textarea', 5,  FALSE, TRUE),
       ('background',       '背景与目的',       'textarea', 6,  FALSE, TRUE),
       ('steps',            '详细操作步骤',     'textarea', 7,  FALSE, TRUE),
       ('risk_assessment',  '风险评估与应对措施','textarea', 8,  FALSE, TRUE),
       ('rollback_plan',    '回滚计划',         'textarea', 9,  FALSE, TRUE),
       ('verify_method',    '验证方法',         'textarea', 10, FALSE, TRUE),
       ('contacts',         '相关人员联系方式', 'textarea', 11, FALSE, TRUE)
     ) AS f(field_key, label, field_type, sort_order, required, in_form)
WHERE t.name = '默认变更文档模板';

-- Add template ref + dynamic fields data to change_doc
ALTER TABLE change_doc
    ADD COLUMN template_id BIGINT REFERENCES change_doc_template(id),
    ADD COLUMN fields_data JSONB;

-- Migrate existing rows: point to default template and pack existing columns into fields_data
UPDATE change_doc cd
SET template_id = (SELECT id FROM change_doc_template WHERE name = '默认变更文档模板' LIMIT 1),
    fields_data = jsonb_build_object(
        'title',            cd.title,
        'change_desc',      cd.change_desc,
        'impact_scope',     cd.impact_scope,
        'change_window',    cd.change_window,
        'resource_support', cd.resource_support,
        'background',       cd.background,
        'steps',            cd.steps,
        'risk_assessment',  cd.risk_assessment,
        'rollback_plan',    cd.rollback_plan,
        'verify_method',    cd.verify_method,
        'contacts',         cd.contacts
    );

-- RBAC: template management permission (admin only)
INSERT INTO sys_resource (code, name, actions, sort_order)
VALUES ('change_doc_template', '变更文档模板', '["read","write"]', 65);

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'change_doc_template';

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin')
  AND p.code LIKE 'change_doc_template:%'
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Apply migration**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | tail -3
docker compose up -d backend
sleep 25
docker compose logs backend --tail=15
```

Expected: `Successfully applied 1 migration to schema "public", now at version v12`

- [ ] **Step 3: Verify migration**

```bash
docker compose exec db psql -U platform_user -d cwgsyw_platform \
  -c "SELECT id, name, version, is_active FROM change_doc_template;" \
  -c "SELECT field_key, label, field_type, sort_order FROM change_doc_field ORDER BY sort_order;" \
  -c "SELECT id, template_id, fields_data->>'title' as title FROM change_doc LIMIT 3;"
```

Expected: 1 default template, 11 fields, existing change_doc rows have `template_id` set and `fields_data` populated.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/migration/V12__change_doc_template.sql
git commit -m "feat: V12 migration - change_doc_template + change_doc_field + fields_data migration"
```

---

## Task 3: Entities, Mappers, DTOs

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocTemplate.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocField.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocTemplateMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocFieldMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/TemplateVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/FieldConfigVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/SaveFieldRequest.java`
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDoc.java`
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/ChangeDocVO.java`
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/CreateChangeDocRequest.java`
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/UpdateChangeDocRequest.java`

- [ ] **Step 1: Create ChangeDocTemplate entity**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocTemplate.java
package com.cwgsyw.platform.module.changedoc.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("change_doc_template")
public class ChangeDocTemplate {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String name;
    private String description;
    private Integer version;
    private Boolean isActive;
    private String docxKey;       // MinIO object key; null if no file uploaded yet
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long createdBy;
}
```

- [ ] **Step 2: Create ChangeDocField entity**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocField.java
package com.cwgsyw.platform.module.changedoc.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("change_doc_field")
public class ChangeDocField {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long templateId;
    private String fieldKey;
    private String label;
    private String fieldType;   // text | textarea | date | readonly
    private Integer sortOrder;
    private Boolean required;
    private Boolean inForm;
    private String placeholder;
}
```

- [ ] **Step 3: Create ChangeDocTemplateMapper**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocTemplateMapper.java
package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocTemplate;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface ChangeDocTemplateMapper extends BaseMapper<ChangeDocTemplate> {

    @Select("SELECT * FROM change_doc_template WHERE tenant_id = #{tenantId} AND is_deleted = FALSE ORDER BY is_active DESC, created_at DESC")
    List<ChangeDocTemplate> findByTenant(@Param("tenantId") String tenantId);
}
```

- [ ] **Step 4: Create ChangeDocFieldMapper**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocFieldMapper.java
package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocField;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface ChangeDocFieldMapper extends BaseMapper<ChangeDocField> {

    @Select("SELECT * FROM change_doc_field WHERE template_id = #{templateId} ORDER BY sort_order")
    List<ChangeDocField> findByTemplate(@Param("templateId") Long templateId);
}
```

- [ ] **Step 5: Create DTOs**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/TemplateVO.java
package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class TemplateVO {
    private Long id;
    private String name;
    private String description;
    private Integer version;
    private Boolean isActive;
    private Boolean hasDocx;    // true if docxKey is set
    private List<FieldConfigVO> fields;
    private LocalDateTime createdAt;
}
```

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/FieldConfigVO.java
package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;

@Data
public class FieldConfigVO {
    private Long id;
    private String fieldKey;
    private String label;
    private String fieldType;
    private Integer sortOrder;
    private Boolean required;
    private Boolean inForm;
    private String placeholder;
}
```

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/SaveFieldRequest.java
package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.util.List;

@Data
public class SaveFieldRequest {
    private List<FieldItem> fields;

    @Data
    public static class FieldItem {
        private Long id;          // null for new fields
        private String fieldKey;
        private String label;
        private String fieldType;
        private Integer sortOrder;
        private Boolean required;
        private Boolean inForm;
        private String placeholder;
    }
}
```

- [ ] **Step 6: Update ChangeDoc entity — add templateId and fieldsData**

In `ChangeDoc.java`, add after `private Long createdBy;`:

```java
    private Long templateId;

    @TableField(typeHandler = com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler.class)
    private java.util.Map<String, String> fieldsData;
```

Also add `@TableName(value = "change_doc", autoResultMap = true)` to replace the existing `@TableName("change_doc")`.

Import needed: `import com.baomidou.mybatisplus.annotation.TableField;`

- [ ] **Step 7: Update ChangeDocVO — add templateId and fields map**

In `ChangeDocVO.java`, replace all the individual field properties (`changeDesc`, `impactScope`, etc.) with a fields map, keeping only the system/meta fields:

```java
// Replace the entire file content:
package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
public class ChangeDocVO {
    private Long id;
    private String changeNo;
    private String status;
    private Long templateId;
    private String templateName;
    private Long applicantId;
    private String applicantName;
    private LocalDateTime applyTime;
    private LocalDateTime approvedAt;
    private Long approverId;
    private String approverName;
    private String approverComment;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    // Dynamic fields from fieldsData + field config for rendering
    private Map<String, String> fieldsData;
    private List<FieldConfigVO> fieldConfig;  // ordered field definitions for the template
}
```

- [ ] **Step 8: Update CreateChangeDocRequest**

Replace content:

```java
package com.cwgsyw.platform.module.changedoc.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.Map;

@Data
public class CreateChangeDocRequest {
    @NotNull(message = "请选择变更文档模板")
    private Long templateId;

    private String changeNo;     // optional; auto-generated if blank

    private Map<String, String> fieldsData;  // {"title":"...", "change_desc":"..."}
}
```

- [ ] **Step 9: Update UpdateChangeDocRequest**

Replace content:

```java
package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.util.Map;

@Data
public class UpdateChangeDocRequest {
    private Map<String, String> fieldsData;
}
```

- [ ] **Step 10: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | grep -E "Built|ERROR|error" | head -15
```

Expected: BUILD SUCCESS (may have errors in ChangeDocService due to removed fields — fix in Task 4).

- [ ] **Step 11: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/changedoc/
git commit -m "feat: template + field entities, mappers, DTOs — dynamic field data model"
```

---

## Task 4: ChangeDocTemplateService + ChangeDocService update

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocTemplateService.java`
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java`

- [ ] **Step 1: Create ChangeDocTemplateService**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocTemplateService.java
package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.cwgsyw.platform.module.changedoc.dto.*;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocField;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocTemplate;
import lombok.RequiredArgsConstructor;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChangeDocTemplateService {

    private final ChangeDocTemplateMapper templateMapper;
    private final ChangeDocFieldMapper fieldMapper;
    private final MinioStorageService storage;

    // ── Template CRUD ─────────────────────────────────────────────────────────

    @Transactional
    public TemplateVO createTemplate(String tenantId, Long operatorId, String name, String description) {
        ChangeDocTemplate tpl = new ChangeDocTemplate();
        tpl.setTenantId(tenantId);
        tpl.setName(name);
        tpl.setDescription(description);
        tpl.setVersion(1);
        tpl.setIsActive(true);
        tpl.setCreatedAt(LocalDateTime.now());
        tpl.setUpdatedAt(LocalDateTime.now());
        tpl.setCreatedBy(operatorId);
        templateMapper.insert(tpl);
        return toTemplateVO(tpl, List.of());
    }

    public List<TemplateVO> listTemplates(String tenantId) {
        List<ChangeDocTemplate> templates = templateMapper.findByTenant(tenantId);
        return templates.stream().map(t -> {
            List<ChangeDocField> fields = fieldMapper.findByTemplate(t.getId());
            return toTemplateVO(t, fields);
        }).collect(Collectors.toList());
    }

    public TemplateVO getTemplate(String tenantId, Long id) {
        ChangeDocTemplate tpl = getOrThrow(tenantId, id);
        List<ChangeDocField> fields = fieldMapper.findByTemplate(id);
        return toTemplateVO(tpl, fields);
    }

    public List<FieldConfigVO> getFields(Long templateId) {
        return fieldMapper.findByTemplate(templateId).stream()
                .map(this::toFieldVO).collect(Collectors.toList());
    }

    @Transactional
    public void uploadDocx(String tenantId, Long templateId, MultipartFile file) {
        ChangeDocTemplate tpl = getOrThrow(tenantId, templateId);
        String key = "templates/" + tenantId + "/" + templateId + "/v" + tpl.getVersion() + ".docx";
        try {
            storage.upload(key, file.getInputStream(), file.getSize(),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        } catch (Exception e) {
            throw new RuntimeException("上传模板文件失败: " + e.getMessage(), e);
        }
        templateMapper.update(null, new LambdaUpdateWrapper<ChangeDocTemplate>()
                .eq(ChangeDocTemplate::getId, templateId)
                .set(ChangeDocTemplate::getDocxKey, key)
                .set(ChangeDocTemplate::getUpdatedAt, LocalDateTime.now()));
    }

    /**
     * Parse bookmark names from uploaded .docx and auto-create missing field configs.
     * Returns the list of bookmark names found.
     */
    public List<String> parseBookmarks(String tenantId, Long templateId) {
        ChangeDocTemplate tpl = getOrThrow(tenantId, templateId);
        if (tpl.getDocxKey() == null) throw new IllegalStateException("请先上传模板文件");

        List<String> bookmarks = new ArrayList<>();
        try (InputStream in = storage.download(tpl.getDocxKey());
             XWPFDocument doc = new XWPFDocument(in)) {
            // Scan all paragraphs for {{key}} patterns
            for (XWPFParagraph para : doc.getParagraphs()) {
                String text = para.getText();
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\{\\{([^}]+)}}").matcher(text);
                while (m.find()) bookmarks.add(m.group(1).trim());
            }
            for (XWPFTable table : doc.getTables()) {
                for (XWPFTableRow row : table.getRows()) {
                    for (XWPFTableCell cell : row.getTableCells()) {
                        for (XWPFParagraph para : cell.getParagraphs()) {
                            String text = para.getText();
                            java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\{\\{([^}]+)}}").matcher(text);
                            while (m.find()) bookmarks.add(m.group(1).trim());
                        }
                    }
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("解析模板书签失败: " + e.getMessage(), e);
        }

        // Auto-create field configs for new bookmarks
        List<ChangeDocField> existing = fieldMapper.findByTemplate(templateId);
        Set<String> existingKeys = existing.stream().map(ChangeDocField::getFieldKey).collect(Collectors.toSet());
        int maxOrder = existing.stream().mapToInt(ChangeDocField::getSortOrder).max().orElse(0);

        for (String key : bookmarks) {
            if (!existingKeys.contains(key)) {
                ChangeDocField f = new ChangeDocField();
                f.setTenantId(tenantId);
                f.setTemplateId(templateId);
                f.setFieldKey(key);
                f.setLabel(key);  // user can rename in UI
                f.setFieldType("textarea");
                f.setSortOrder(++maxOrder);
                f.setRequired(false);
                f.setInForm(true);
                fieldMapper.insert(f);
            }
        }
        return new ArrayList<>(new LinkedHashSet<>(bookmarks));  // deduped, ordered
    }

    @Transactional
    public void saveFields(String tenantId, Long templateId, SaveFieldRequest req) {
        getOrThrow(tenantId, templateId);
        for (SaveFieldRequest.FieldItem item : req.getFields()) {
            if (item.getId() != null) {
                // Update existing
                fieldMapper.update(null, new LambdaUpdateWrapper<ChangeDocField>()
                        .eq(ChangeDocField::getId, item.getId())
                        .eq(ChangeDocField::getTemplateId, templateId)
                        .set(ChangeDocField::getLabel, item.getLabel())
                        .set(ChangeDocField::getFieldType, item.getFieldType())
                        .set(ChangeDocField::getSortOrder, item.getSortOrder())
                        .set(ChangeDocField::getRequired, item.getRequired())
                        .set(ChangeDocField::getInForm, item.getInForm())
                        .set(ChangeDocField::getPlaceholder, item.getPlaceholder()));
            } else {
                // Insert new
                ChangeDocField f = new ChangeDocField();
                f.setTenantId(tenantId);
                f.setTemplateId(templateId);
                f.setFieldKey(item.getFieldKey());
                f.setLabel(item.getLabel());
                f.setFieldType(item.getFieldType());
                f.setSortOrder(item.getSortOrder());
                f.setRequired(item.getRequired() != null ? item.getRequired() : false);
                f.setInForm(item.getInForm() != null ? item.getInForm() : true);
                f.setPlaceholder(item.getPlaceholder());
                fieldMapper.insert(f);
            }
        }
    }

    @Transactional
    public void deleteField(Long fieldId) {
        fieldMapper.deleteById(fieldId);
    }

    @Transactional
    public void setActive(String tenantId, Long templateId, boolean active) {
        getOrThrow(tenantId, templateId);
        templateMapper.update(null, new LambdaUpdateWrapper<ChangeDocTemplate>()
                .eq(ChangeDocTemplate::getId, templateId)
                .set(ChangeDocTemplate::getIsActive, active)
                .set(ChangeDocTemplate::getUpdatedAt, LocalDateTime.now()));
    }

    // ── Export: fill .docx template with field values ─────────────────────────

    /**
     * Open the template .docx from MinIO and replace every {{field_key}} occurrence
     * with the value from fieldsData. Returns the filled .docx bytes.
     */
    public byte[] fillDocx(String tenantId, Long templateId, Map<String, String> fieldsData) {
        ChangeDocTemplate tpl = getOrThrow(tenantId, templateId);
        if (tpl.getDocxKey() == null) throw new IllegalStateException("该模板尚未上传 Word 文件");

        try (InputStream in = storage.download(tpl.getDocxKey());
             XWPFDocument doc = new XWPFDocument(in);
             java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {

            replacePlaceholders(doc, fieldsData);
            doc.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("填充模板失败: " + e.getMessage(), e);
        }
    }

    private void replacePlaceholders(XWPFDocument doc, Map<String, String> data) {
        // Replace in regular paragraphs
        for (XWPFParagraph para : doc.getParagraphs()) {
            replaceParagraph(para, data);
        }
        // Replace in tables
        for (XWPFTable table : doc.getTables()) {
            for (XWPFTableRow row : table.getRows()) {
                for (XWPFTableCell cell : row.getTableCells()) {
                    for (XWPFParagraph para : cell.getParagraphs()) {
                        replaceParagraph(para, data);
                    }
                }
            }
        }
        // Replace in headers and footers
        for (XWPFHeader header : doc.getHeaderList()) {
            for (XWPFParagraph para : header.getParagraphs()) {
                replaceParagraph(para, data);
            }
        }
        for (XWPFFooter footer : doc.getFooterList()) {
            for (XWPFParagraph para : footer.getParagraphs()) {
                replaceParagraph(para, data);
            }
        }
    }

    /**
     * Replaces {{key}} patterns in a paragraph. Handles the case where a placeholder
     * is split across multiple runs (common in Word) by first concatenating all run
     * text, checking for placeholders, then rewriting runs.
     */
    private void replaceParagraph(XWPFParagraph para, Map<String, String> data) {
        String full = para.getText();
        if (!full.contains("{{")) return;

        String replaced = full;
        for (Map.Entry<String, String> e : data.entrySet()) {
            replaced = replaced.replace("{{" + e.getKey() + "}}", e.getValue() != null ? e.getValue() : "");
        }
        if (replaced.equals(full)) return;

        // Rewrite: put replaced text in first run, clear the rest
        List<XWPFRun> runs = para.getRuns();
        if (runs.isEmpty()) return;
        runs.get(0).setText(replaced, 0);
        for (int i = 1; i < runs.size(); i++) {
            runs.get(i).setText("", 0);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private ChangeDocTemplate getOrThrow(String tenantId, Long id) {
        ChangeDocTemplate tpl = templateMapper.selectOne(new LambdaQueryWrapper<ChangeDocTemplate>()
                .eq(ChangeDocTemplate::getTenantId, tenantId)
                .eq(ChangeDocTemplate::getId, id)
                .eq(ChangeDocTemplate::getIsDeleted, false));
        if (tpl == null) throw new IllegalArgumentException("模板不存在: " + id);
        return tpl;
    }

    private TemplateVO toTemplateVO(ChangeDocTemplate t, List<ChangeDocField> fields) {
        TemplateVO vo = new TemplateVO();
        vo.setId(t.getId());
        vo.setName(t.getName());
        vo.setDescription(t.getDescription());
        vo.setVersion(t.getVersion());
        vo.setIsActive(t.getIsActive());
        vo.setHasDocx(t.getDocxKey() != null);
        vo.setCreatedAt(t.getCreatedAt());
        vo.setFields(fields.stream().map(this::toFieldVO).collect(Collectors.toList()));
        return vo;
    }

    private FieldConfigVO toFieldVO(ChangeDocField f) {
        FieldConfigVO vo = new FieldConfigVO();
        vo.setId(f.getId());
        vo.setFieldKey(f.getFieldKey());
        vo.setLabel(f.getLabel());
        vo.setFieldType(f.getFieldType());
        vo.setSortOrder(f.getSortOrder());
        vo.setRequired(f.getRequired());
        vo.setInForm(f.getInForm());
        vo.setPlaceholder(f.getPlaceholder());
        return vo;
    }
}
```

- [ ] **Step 2: Update ChangeDocService to use fieldsData**

The service's `create`, `update`, `toVO` methods reference fixed fields that no longer exist directly. Replace the key parts:

**`create` method** — replace body after generating `changeNo`:

```java
    @Transactional
    public ChangeDocVO create(String tenantId, Long operatorId, CreateChangeDocRequest req) {
        String changeNo = resolveChangeNo(tenantId, req.getChangeNo());
        ChangeDoc doc = new ChangeDoc();
        doc.setTenantId(tenantId);
        doc.setChangeNo(changeNo);
        // title comes from fieldsData for backward compat display
        String title = req.getFieldsData() != null ? req.getFieldsData().getOrDefault("title", changeNo) : changeNo;
        doc.setTitle(title);
        doc.setStatus("draft");
        doc.setApplicantId(operatorId);
        doc.setApplyTime(LocalDateTime.now());
        doc.setTemplateId(req.getTemplateId());
        doc.setFieldsData(req.getFieldsData() != null ? req.getFieldsData() : new java.util.HashMap<>());
        doc.setCreatedBy(operatorId);
        doc.setCreatedAt(LocalDateTime.now());
        doc.setUpdatedAt(LocalDateTime.now());
        changeDocMapper.insert(doc);
        writeAuditLog(tenantId, "create", doc.getId(), operatorId, null, toJson(doc));
        saveSnapshot(doc, operatorId, "create");
        return toVO(doc);
    }
```

**`update` method** — replace body:

```java
    @Transactional
    public ChangeDocVO update(String tenantId, Long id, Long operatorId, UpdateChangeDocRequest req) {
        ChangeDoc doc = getOrThrow(tenantId, id);
        if (!"draft".equals(doc.getStatus())) throw new IllegalStateException("只有草稿状态的变更文档可以编辑");
        String before = toJson(doc);
        if (req.getFieldsData() != null) {
            Map<String, String> merged = new java.util.HashMap<>(
                    doc.getFieldsData() != null ? doc.getFieldsData() : Map.of());
            merged.putAll(req.getFieldsData());
            doc.setFieldsData(merged);
            // keep title column in sync
            if (merged.containsKey("title")) doc.setTitle(merged.get("title"));
        }
        doc.setUpdatedAt(LocalDateTime.now());
        changeDocMapper.updateById(doc);
        writeAuditLog(tenantId, "update", id, operatorId, before, toJson(doc));
        saveSnapshot(doc, operatorId, "edit");
        return toVO(doc);
    }
```

**`toVO` method** — replace to use fieldsData and inject fieldConfig:

```java
    private ChangeDocVO toVO(ChangeDoc doc) {
        return toVO(doc, Map.of());
    }

    private ChangeDocVO toVO(ChangeDoc doc, Map<Long, String> userNames) {
        ChangeDocVO vo = new ChangeDocVO();
        vo.setId(doc.getId());
        vo.setChangeNo(doc.getChangeNo());
        vo.setStatus(doc.getStatus());
        vo.setTemplateId(doc.getTemplateId());
        vo.setApplicantId(doc.getApplicantId());
        vo.setApplyTime(doc.getApplyTime());
        vo.setApprovedAt(doc.getApprovedAt());
        vo.setApproverId(doc.getApproverId());
        vo.setApproverComment(doc.getApproverComment());
        vo.setCreatedAt(doc.getCreatedAt());
        vo.setUpdatedAt(doc.getUpdatedAt());
        vo.setFieldsData(doc.getFieldsData());
        // Resolve user names
        if (doc.getApplicantId() != null)
            vo.setApplicantName(userNames.getOrDefault(doc.getApplicantId(), String.valueOf(doc.getApplicantId())));
        if (doc.getApproverId() != null)
            vo.setApproverName(userNames.getOrDefault(doc.getApproverId(), String.valueOf(doc.getApproverId())));
        return vo;
    }
```

**`get` method** — enrich with fieldConfig from template:

```java
    public ChangeDocVO get(String tenantId, Long id) {
        ChangeDoc doc = getOrThrow(tenantId, id);
        ChangeDocVO vo = toVO(doc);
        // Attach field config so frontend can render the form
        if (doc.getTemplateId() != null) {
            vo.setFieldConfig(changeDocFieldMapper.findByTemplate(doc.getTemplateId())
                    .stream().map(f -> {
                        FieldConfigVO fvo = new FieldConfigVO();
                        fvo.setId(f.getId());
                        fvo.setFieldKey(f.getFieldKey());
                        fvo.setLabel(f.getLabel());
                        fvo.setFieldType(f.getFieldType());
                        fvo.setSortOrder(f.getSortOrder());
                        fvo.setRequired(f.getRequired());
                        fvo.setInForm(f.getInForm());
                        fvo.setPlaceholder(f.getPlaceholder());
                        return fvo;
                    }).collect(java.util.stream.Collectors.toList()));
        }
        return vo;
    }
```

Also inject `ChangeDocFieldMapper changeDocFieldMapper` as a new field in the service.

- [ ] **Step 3: Build check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | grep -E "Built|ERROR|error" | head -15
```

Fix any remaining compile errors. Common ones:
- Missing `import java.util.Map;` in ChangeDocService
- The `generateAiContent` method references `req.getChangeDesc()` etc — update to use `fieldsData.get("change_desc")` etc.
- The `list` method's `toVO` call needs `Map.of()` for userNames

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/changedoc/
git commit -m "feat: ChangeDocTemplateService + updated ChangeDocService using fieldsData"
```

---

## Task 5: ChangeDocTemplateController + ExportService update

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocTemplateController.java`
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ExportService.java`

- [ ] **Step 1: Create ChangeDocTemplateController**

```java
// backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocTemplateController.java
package com.cwgsyw.platform.module.changedoc;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.changedoc.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/admin/change-doc-templates")
@RequiredArgsConstructor
public class ChangeDocTemplateController {

    private final ChangeDocTemplateService templateService;

    @GetMapping
    @PreAuthorize("hasAuthority('change_doc_template:read')")
    public R<List<TemplateVO>> list(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.listTemplates(user.getTenantId()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('change_doc_template:read')")
    public R<TemplateVO> get(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.getTemplate(user.getTenantId(), id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('change_doc_template:write')")
    public R<TemplateVO> create(
            @RequestParam String name,
            @RequestParam(required = false) String description,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.createTemplate(user.getTenantId(), user.getUserId(), name, description));
    }

    @PostMapping(value = "/{id}/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('change_doc_template:write')")
    public R<Void> uploadDocx(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal SecurityUser user) {
        templateService.uploadDocx(user.getTenantId(), id, file);
        return R.ok(null);
    }

    @PostMapping("/{id}/parse-bookmarks")
    @PreAuthorize("hasAuthority('change_doc_template:write')")
    public R<List<String>> parseBookmarks(
            @PathVariable Long id,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(templateService.parseBookmarks(user.getTenantId(), id));
    }

    @PutMapping("/{id}/fields")
    @PreAuthorize("hasAuthority('change_doc_template:write')")
    public R<Void> saveFields(
            @PathVariable Long id,
            @RequestBody SaveFieldRequest req,
            @AuthenticationPrincipal SecurityUser user) {
        templateService.saveFields(user.getTenantId(), id, req);
        return R.ok(null);
    }

    @DeleteMapping("/{id}/fields/{fieldId}")
    @PreAuthorize("hasAuthority('change_doc_template:write')")
    public R<Void> deleteField(@PathVariable Long id, @PathVariable Long fieldId,
                                @AuthenticationPrincipal SecurityUser user) {
        templateService.deleteField(fieldId);
        return R.ok(null);
    }

    @PutMapping("/{id}/active")
    @PreAuthorize("hasAuthority('change_doc_template:write')")
    public R<Void> setActive(
            @PathVariable Long id,
            @RequestParam boolean active,
            @AuthenticationPrincipal SecurityUser user) {
        templateService.setActive(user.getTenantId(), id, active);
        return R.ok(null);
    }
}
```

- [ ] **Step 2: Update ExportService to use template-based DOCX fill**

In `ExportService.java`, add `ChangeDocTemplateService templateService` as a dependency, then update `exportDocx` and `exportPdfDirect`:

```java
    // Replace exportDocx to use template file when available
    public byte[] exportDocx(ChangeDocVO doc, String tenantId) {
        if (doc.getTemplateId() != null) {
            try {
                return templateService.fillDocx(tenantId, doc.getTemplateId(),
                        doc.getFieldsData() != null ? doc.getFieldsData() : Map.of());
            } catch (IllegalStateException e) {
                // Template has no .docx yet — fall through to programmatic generation
            }
        }
        return exportDocxProgrammatic(doc);
    }

    // Rename existing exportDocx body to exportDocxProgrammatic (keep as fallback)
    private byte[] exportDocxProgrammatic(ChangeDocVO doc) {
        // ... existing XWPFDocument generation code unchanged ...
    }
```

For `exportPdfDirect`, after generating the PDF bytes, the watermark logic is unchanged — just make sure it calls `exportDocx` internally for the content.

- [ ] **Step 3: Build and smoke test**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | grep -E "Built|ERROR|error" | head -10
docker compose up -d backend
sleep 20

TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | jq -r '.data.token')

# List templates
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost/api/admin/change-doc-templates | jq '.data[] | {id, name, hasDocx}'

# Create a new template
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  "http://localhost/api/admin/change-doc-templates?name=网络变更模板&description=用于网络设备变更" | jq '{code, id: .data.id, name: .data.name}'
```

Expected: 1 default template listed, new template created with code 200.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/changedoc/
git commit -m "feat: ChangeDocTemplateController + template-based DOCX export"
```

---

## Task 6: Frontend — Admin Template Management Pages

**Files:**
- Create: `frontend/src/app/(dashboard)/admin/change-doc-templates/page.tsx`
- Create: `frontend/src/app/(dashboard)/admin/change-doc-templates/[id]/page.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create template list page**

```tsx
// frontend/src/app/(dashboard)/admin/change-doc-templates/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import Link from 'next/link'
import { Plus, Upload, Settings, ToggleLeft, ToggleRight } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface TemplateVO {
  id: number
  name: string
  description: string
  version: number
  isActive: boolean
  hasDocx: boolean
  fields: { id: number; fieldKey: string; label: string }[]
  createdAt: string
}

export default function ChangeDocTemplatesPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!hasPermission('change_doc_template', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data: templates = [], isLoading } = useQuery<TemplateVO[]>({
    queryKey: ['change-doc-templates'],
    queryFn: () => api.get('/admin/change-doc-templates').then(r => r.data.data),
    enabled: hasPermission('change_doc_template', 'read'),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post(`/admin/change-doc-templates?name=${encodeURIComponent(newName)}&description=${encodeURIComponent(newDesc)}`),
    onSuccess: (res) => {
      toast.success('模板已创建')
      queryClient.invalidateQueries({ queryKey: ['change-doc-templates'] })
      setCreating(false)
      setNewName('')
      setNewDesc('')
      router.push(`/admin/change-doc-templates/${res.data.data.id}`)
    },
    onError: () => toast.error('创建失败'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      api.put(`/admin/change-doc-templates/${id}/active?active=${active}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['change-doc-templates'] }),
    onError: () => toast.error('操作失败'),
  })

  const handleUpload = async (templateId: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    try {
      await api.post(`/admin/change-doc-templates/${templateId}/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await api.post(`/admin/change-doc-templates/${templateId}/parse-bookmarks`)
      toast.success('模板文件已上传，书签已解析')
      queryClient.invalidateQueries({ queryKey: ['change-doc-templates'] })
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '上传失败')
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">变更文档模板</h1>
          <p className="text-sm text-muted-foreground mt-1">管理 Word 模板文件和字段配置</p>
        </div>
        {hasPermission('change_doc_template', 'write') && (
          <Button size="sm" onClick={() => setCreating(v => !v)}>
            <Plus className="h-4 w-4 mr-1" />新建模板
          </Button>
        )}
      </div>

      {creating && (
        <div className="border rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">模板名称 *</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="例：网络变更模板" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">描述</label>
              <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="适用场景说明" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!newName || createMutation.isPending}>创建</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>取消</Button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-muted-foreground text-sm">加载中...</p> : (
        <div className="space-y-3">
          {templates.map(tpl => (
            <div key={tpl.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{tpl.name}</span>
                    <Badge variant={tpl.isActive ? 'default' : 'secondary'}>
                      {tpl.isActive ? '启用中' : '已禁用'}
                    </Badge>
                    {tpl.hasDocx && <Badge variant="outline" className="text-xs">已上传 .docx</Badge>}
                    <span className="text-xs text-muted-foreground">v{tpl.version} · {tpl.fields.length} 个字段</span>
                  </div>
                  {tpl.description && <p className="text-sm text-muted-foreground mt-1">{tpl.description}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  {hasPermission('change_doc_template', 'write') && (
                    <>
                      <label className="cursor-pointer">
                        <input type="file" accept=".docx" className="hidden"
                          onChange={e => { if (e.target.files?.[0]) handleUpload(tpl.id, e.target.files[0]) }} />
                        <Button size="sm" variant="outline" asChild>
                          <span><Upload className="h-4 w-4 mr-1" />上传 .docx</span>
                        </Button>
                      </label>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/admin/change-doc-templates/${tpl.id}`}>
                          <Settings className="h-4 w-4 mr-1" />配置字段
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => toggleMutation.mutate({ id: tpl.id, active: !tpl.isActive })}>
                        {tpl.isActive
                          ? <ToggleRight className="h-4 w-4 text-green-500" />
                          : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          {templates.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">暂无模板</p>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create field config editor page**

```tsx
// frontend/src/app/(dashboard)/admin/change-doc-templates/[id]/page.tsx
'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, GripVertical, Trash2, Plus } from 'lucide-react'

interface FieldConfigVO {
  id: number
  fieldKey: string
  label: string
  fieldType: string
  sortOrder: number
  required: boolean
  inForm: boolean
  placeholder: string
}

interface TemplateVO {
  id: number
  name: string
  hasDocx: boolean
  fields: FieldConfigVO[]
}

const FIELD_TYPES = [
  { value: 'text',     label: '单行文本' },
  { value: 'textarea', label: '多行文本' },
  { value: 'date',     label: '日期' },
  { value: 'readonly', label: '只读（导出用）' },
]

export default function TemplateFieldsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: tpl, isLoading } = useQuery<TemplateVO>({
    queryKey: ['change-doc-template', id],
    queryFn: () => api.get(`/admin/change-doc-templates/${id}`).then(r => r.data.data),
  })

  const [fields, setFields] = useState<FieldConfigVO[]>([])
  const [initialized, setInitialized] = useState(false)

  if (tpl && !initialized) {
    setFields(tpl.fields ?? [])
    setInitialized(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/admin/change-doc-templates/${id}/fields`, { fields }),
    onSuccess: () => {
      toast.success('字段配置已保存')
      queryClient.invalidateQueries({ queryKey: ['change-doc-template', id] })
      queryClient.invalidateQueries({ queryKey: ['change-doc-templates'] })
    },
    onError: () => toast.error('保存失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (fieldId: number) => api.delete(`/admin/change-doc-templates/${id}/fields/${fieldId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['change-doc-template', id] }),
    onError: () => toast.error('删除失败'),
  })

  const addField = () => {
    setFields(f => [...f, {
      id: 0,
      fieldKey: `field_${Date.now()}`,
      label: '新字段',
      fieldType: 'textarea',
      sortOrder: (f.length + 1) * 10,
      required: false,
      inForm: true,
      placeholder: '',
    }])
  }

  const update = (idx: number, key: keyof FieldConfigVO, val: unknown) => {
    setFields(f => f.map((field, i) => i === idx ? { ...field, [key]: val } : field))
  }

  if (isLoading) return <p className="text-muted-foreground">加载中...</p>

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/change-doc-templates" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回
        </Link>
        <div>
          <h1 className="text-xl font-bold">{tpl?.name}</h1>
          <p className="text-xs text-muted-foreground">配置表单字段 — 字段 key 需与 Word 模板中的 {'{{key}}'} 一致</p>
        </div>
      </div>

      {!tpl?.hasDocx && (
        <div className="mb-4 p-3 border border-amber-200 bg-amber-50 rounded-lg text-sm text-amber-800">
          尚未上传 Word 模板文件。可先配置字段，或在列表页上传 .docx 后点"解析书签"自动生成。
        </div>
      )}

      <div className="space-y-2 mb-4">
        {fields.map((field, idx) => (
          <div key={field.id || idx} className="border rounded-lg p-3 flex gap-3 items-start">
            <GripVertical className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
            <div className="grid grid-cols-2 gap-2 flex-1">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">书签 Key ({{'{{'}{field.fieldKey}{'}}'}}) </label>
                <Input value={field.fieldKey} className="h-8 text-xs font-mono"
                  onChange={e => update(idx, 'fieldKey', e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">显示标签</label>
                <Input value={field.label} className="h-8"
                  onChange={e => update(idx, 'label', e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">字段类型</label>
                <Select value={field.fieldType} onValueChange={v => update(idx, 'fieldType', v ?? 'textarea')}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">提示文字</label>
                <Input value={field.placeholder ?? ''} className="h-8"
                  onChange={e => update(idx, 'placeholder', e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={field.required}
                  onChange={e => update(idx, 'required', e.target.checked)} />
                必填
              </label>
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input type="checkbox" checked={field.inForm}
                  onChange={e => update(idx, 'inForm', e.target.checked)} />
                表单可见
              </label>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                onClick={() => {
                  if (field.id) deleteMutation.mutate(field.id)
                  setFields(f => f.filter((_, i) => i !== idx))
                }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={addField}>
          <Plus className="h-4 w-4 mr-1" />添加字段
        </Button>
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          保存配置
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add template management nav item to Sidebar**

In `frontend/src/components/layout/Sidebar.tsx`, add `FileCode` to lucide-react imports, then add after `系统配置`:

```tsx
{ href: '/admin/change-doc-templates', label: '变更模板', icon: FileCode, resource: 'change_doc_template', action: 'read' },
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | tail -10
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/app/(dashboard)/admin/change-doc-templates/" \
        frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: admin change-doc template management pages (list + field config)"
```

---

## Task 7: Frontend — Dynamic Form on Change Doc Pages

**Files:**
- Modify: `frontend/src/app/(dashboard)/change-docs/new/page.tsx`
- Modify: `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx`

- [ ] **Step 1: Update new change doc page with template picker + dynamic fields**

Replace `frontend/src/app/(dashboard)/change-docs/new/page.tsx` with:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { usePermission } from '@/hooks/usePermission'

interface TemplateVO {
  id: number
  name: string
  isActive: boolean
  fields: { id: number; fieldKey: string; label: string; fieldType: string; required: boolean; inForm: boolean; placeholder: string }[]
}

export default function NewChangeDocPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const [templateId, setTemplateId] = useState<string>('')
  const [fieldsData, setFieldsData] = useState<Record<string, string>>({})
  const [changeNo, setChangeNo] = useState('')

  useEffect(() => {
    if (!hasPermission('change_doc', 'create')) router.replace('/change-docs')
  }, [hasPermission, router])

  const { data: templates = [] } = useQuery<TemplateVO[]>({
    queryKey: ['active-templates'],
    queryFn: () => api.get('/admin/change-doc-templates').then(r =>
      (r.data.data as TemplateVO[]).filter(t => t.isActive)),
  })

  const selectedTemplate = templates.find(t => String(t.id) === templateId)
  const visibleFields = selectedTemplate?.fields.filter(f => f.inForm) ?? []

  const createMutation = useMutation({
    mutationFn: () => api.post('/change-docs', {
      template_id: Number(templateId),
      change_no: changeNo || undefined,
      fields_data: fieldsData,
    }),
    onSuccess: (res) => {
      toast.success('变更文档已创建')
      router.push(`/change-docs/${res.data.data.id}`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const setField = (key: string, val: string) =>
    setFieldsData(f => ({ ...f, [key]: val }))

  const canSubmit = templateId &&
    visibleFields.filter(f => f.required).every(f => fieldsData[f.fieldKey]?.trim())

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/change-docs" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回
        </Link>
        <h1 className="text-2xl font-bold">新建变更文档</h1>
      </div>

      <div className="space-y-5">
        {/* Template selector */}
        <div className="space-y-1.5">
          <Label>选择模板 *</Label>
          <Select value={templateId} onValueChange={v => { setTemplateId(v ?? ''); setFieldsData({}) }}>
            <SelectTrigger>
              <SelectValue placeholder="请选择变更文档模板" />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Optional change number override */}
        {templateId && (
          <div className="space-y-1.5">
            <Label>变更编号（可选，留空自动生成）</Label>
            <Input value={changeNo} onChange={e => setChangeNo(e.target.value)}
              placeholder="CHG-YYYYMMDD-NNN" />
          </div>
        )}

        {/* Dynamic fields from template */}
        {visibleFields.map(field => (
          <div key={field.fieldKey} className="space-y-1.5">
            <Label>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {field.fieldType === 'textarea' ? (
              <Textarea
                value={fieldsData[field.fieldKey] ?? ''}
                onChange={e => setField(field.fieldKey, e.target.value)}
                placeholder={field.placeholder || ''}
                rows={3}
              />
            ) : field.fieldType === 'date' ? (
              <Input
                type="date"
                value={fieldsData[field.fieldKey] ?? ''}
                onChange={e => setField(field.fieldKey, e.target.value)}
              />
            ) : (
              <Input
                value={fieldsData[field.fieldKey] ?? ''}
                onChange={e => setField(field.fieldKey, e.target.value)}
                placeholder={field.placeholder || ''}
              />
            )}
          </div>
        ))}

        {templateId && (
          <div className="flex gap-2 pt-2">
            <Button onClick={() => createMutation.mutate()}
              disabled={!canSubmit || createMutation.isPending}>
              {createMutation.isPending ? '创建中...' : '创建变更文档'}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/change-docs">取消</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update change doc detail page to render dynamic fields**

In `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx`, the current hardcoded sections for 变更申请单 and 变更方案 should be replaced with a dynamic field renderer. The `ChangeDocVO` now has `fieldsData` (map) and `fieldConfig` (array of field definitions).

Replace the hardcoded field sections inside the 变更申请单 and 变更方案 cards with:

```tsx
{/* Dynamic field rendering */}
{doc.fieldConfig ? (
  <>
    {/* Group fields into sections based on which template section they belong to.
        For now, render all in-form fields sequentially. */}
    <section className="border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-base">{doc.templateName ?? '变更内容'}</h2>
        {isDraft && (
          <Button variant="outline" size="sm" onClick={handleAiGenerate} disabled={aiLoading}>
            {aiLoading ? 'AI 生成中...' : '✨ AI 辅助生成'}
          </Button>
        )}
      </div>
      <div className="space-y-3">
        {doc.fieldConfig.filter(f => f.inForm).map(field => (
          <div key={field.fieldKey} className="space-y-1.5">
            <Label>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
            {isDraft ? (
              field.fieldType === 'textarea' ? (
                <Textarea
                  value={form.fieldsData?.[field.fieldKey] ?? ''}
                  onChange={e => setForm(f => ({
                    ...f,
                    fieldsData: { ...(f.fieldsData ?? {}), [field.fieldKey]: e.target.value }
                  }))}
                  placeholder={field.placeholder ?? ''}
                  rows={3}
                />
              ) : field.fieldType === 'date' ? (
                <Input
                  type="date"
                  value={form.fieldsData?.[field.fieldKey] ?? ''}
                  onChange={e => setForm(f => ({
                    ...f,
                    fieldsData: { ...(f.fieldsData ?? {}), [field.fieldKey]: e.target.value }
                  }))}
                />
              ) : (
                <Input
                  value={form.fieldsData?.[field.fieldKey] ?? ''}
                  onChange={e => setForm(f => ({
                    ...f,
                    fieldsData: { ...(f.fieldsData ?? {}), [field.fieldKey]: e.target.value }
                  }))}
                  placeholder={field.placeholder ?? ''}
                />
              )
            ) : (
              <p className="text-sm whitespace-pre-wrap">
                {doc.fieldsData?.[field.fieldKey] || <span className="text-muted-foreground">—</span>}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  </>
) : (
  // Fallback: render fieldsData as key-value pairs for old docs without fieldConfig
  <section className="border rounded-lg p-5">
    <h2 className="font-semibold text-base mb-4">变更内容</h2>
    <div className="space-y-3">
      {Object.entries(doc.fieldsData ?? {}).map(([key, val]) => (
        <div key={key} className="space-y-1">
          <Label className="text-muted-foreground">{key}</Label>
          <p className="text-sm whitespace-pre-wrap">{val || '—'}</p>
        </div>
      ))}
    </div>
  </section>
)}
```

Also update the save mutation to use `fieldsData`:

```tsx
const saveMutation = useMutation({
  mutationFn: () => api.put(`/change-docs/${id}`, { fields_data: form.fieldsData }),
  // ... rest unchanged
})
```

And update the AI generate handler to pass fields from fieldsData:

```tsx
const handleAiGenerate = async () => {
  const fd = doc?.fieldsData ?? {}
  const res = await api.post(`/change-docs/${id}/ai-generate`, {
    changeDesc: fd['change_desc'] ?? fd['change_description'] ?? '',
    impactScope: fd['impact_scope'] ?? '',
    changeWindow: fd['change_window'] ?? '',
  })
  // ... rest unchanged
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | tail -10
```

Expected: 0 errors.

- [ ] **Step 4: Full rebuild and smoke test**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend frontend 2>&1 | tail -5
docker compose up -d
sleep 25

TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | jq -r '.data.token')

# List templates
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost/api/admin/change-doc-templates | jq '.data[] | {id, name, hasDocx, fieldCount: (.fields | length)}'

# Create a doc with dynamic fields
DOC=$(curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  http://localhost/api/change-docs \
  -d '{"template_id":1,"fields_data":{"title":"测试动态字段","change_desc":"升级数据库","impact_scope":"数据库服务器","change_window":"2026-06-01 02:00-04:00"}}')
echo $DOC | jq '{code, id: .data.id, changeNo: .data.changeNo}'

# Get the doc and check fieldsData
DOC_ID=$(echo $DOC | jq -r '.data.id')
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost/api/change-docs/$DOC_ID" | jq '{code, fieldsData: .data.fieldsData, fieldCount: (.data.fieldConfig | length)}'
```

Expected: Template with 11 fields listed; doc created; `fieldsData` has the values; `fieldConfig` has 11 field definitions.

- [ ] **Step 5: Commit + tag**

```bash
git add .
git commit -m "feat: dynamic change doc form rendering + template-based export"
git tag v0.7.0-template-engine
echo "Phase: Change Doc Template Engine complete"
```

---

## RBAC Checklist

- [x] `change_doc_template:read` and `change_doc_template:write` — added in V12 migration
- [x] Only `super_admin` and `admin` get template management permissions
- [x] All controller endpoints have `@PreAuthorize`
- [x] Frontend template pages redirect if missing `change_doc_template:read`
- [x] Sidebar nav item gated by `change_doc_template:read`

---

## Self-Review

### Spec coverage
- ✅ Upload .docx template to MinIO
- ✅ Parse `{{field_key}}` bookmarks from .docx, auto-create field configs
- ✅ Admin UI to configure field label, type, required, in-form, sort order
- ✅ Multiple template support (admin creates N templates, each with own fields)
- ✅ Template enable/disable (only active templates shown in new-doc form)
- ✅ Dynamic form rendering driven by `change_doc_field` table
- ✅ `fieldsData JSONB` on change_doc — no schema change needed for new fields
- ✅ Export: fill template .docx bookmarks from `fieldsData`; fallback to programmatic if no .docx
- ✅ Migration of existing records to `fields_data` JSONB + default template
- ✅ Backward compat: old docs without fieldConfig fall back to key-value display

### No placeholders found.

### Type consistency
- `ChangeDocVO.fieldsData` → `Map<String, String>` (Java) / `Record<string, string>` (TS)
- `ChangeDocVO.fieldConfig` → `List<FieldConfigVO>` — populated by `get()`, null in `list()`
- `CreateChangeDocRequest.fieldsData` → `Map<String, String>`
- `UpdateChangeDocRequest.fieldsData` → `Map<String, String>` (partial patch, merged server-side)
- `ChangeDocTemplateService.fillDocx(tenantId, templateId, fieldsData)` → `byte[]`
- `ExportService.exportDocx(doc, tenantId)` calls `templateService.fillDocx` when `doc.templateId != null`
- Frontend `form.fieldsData` matches `Map<string,string>` — `setForm` updates nested map correctly
