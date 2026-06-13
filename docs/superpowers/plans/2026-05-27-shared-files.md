# 共享文档模块实施计划（Phase A）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增独立的"共享文档"模块，支持文件夹树形组织、文件上传/下载/预览/搜索，按组权限控制，Word 上传后异步转 Markdown，变更文档审批后自动归档。

**Architecture:** 独立 `sharedfile` 模块，PostgreSQL 存元数据（`shared_folder` + `shared_file` 表），MinIO 存文件内容，Spring `@Async` 处理 pandoc 转 Markdown，前端左右分栏布局（文件夹树 + 文件列表），预览页按文件类型分流（PDF/docx/xlsx）。

**Tech Stack:** Spring Boot 3.4.5, MyBatis-Plus 3.5.12, PostgreSQL 16 (JSONB), MinIO, pandoc, Next.js 15, docx-preview, SheetJS (xlsx)

---

## File Map

**Backend — new:**
- `backend/src/main/resources/db/migration/V17__shared_file.sql`
- `backend/src/main/java/com/cwgsyw/platform/module/sharedfile/entity/SharedFolder.java`
- `backend/src/main/java/com/cwgsyw/platform/module/sharedfile/entity/SharedFile.java`
- `backend/src/main/java/com/cwgsyw/platform/module/sharedfile/SharedFolderMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/sharedfile/SharedFileMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/sharedfile/dto/SharedFileVO.java`
- `backend/src/main/java/com/cwgsyw/platform/module/sharedfile/dto/SharedFolderVO.java`
- `backend/src/main/java/com/cwgsyw/platform/module/sharedfile/dto/UploadFileRequest.java`
- `backend/src/main/java/com/cwgsyw/platform/module/sharedfile/SharedFileService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/sharedfile/SharedFolderService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/sharedfile/SharedFileController.java`

**Backend — modified:**
- `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowService.java`
- `backend/Dockerfile`

**Frontend — new:**
- `frontend/src/app/(dashboard)/files/page.tsx`
- `frontend/src/app/(dashboard)/files/preview/[id]/page.tsx`

**Frontend — modified:**
- `frontend/src/components/layout/Sidebar.tsx`

---

## Task 1: V17 Database Migration

**Files:**
- Create: `backend/src/main/resources/db/migration/V17__shared_file.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- V17: 共享文档模块

CREATE TABLE shared_folder (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    name        VARCHAR(255) NOT NULL,
    parent_id   BIGINT,
    created_by  BIGINT       NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMP,
    deleted_by  BIGINT
);

CREATE TABLE shared_file (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      VARCHAR(64)  NOT NULL DEFAULT 'default',
    folder_id      BIGINT,
    name           VARCHAR(255) NOT NULL,
    original_name  VARCHAR(255) NOT NULL,
    file_type      VARCHAR(32)  NOT NULL,
    size_bytes     BIGINT       NOT NULL,
    minio_key      VARCHAR(512) NOT NULL,
    md_key         VARCHAR(512),
    visible_groups JSONB        NOT NULL DEFAULT '[]',
    source_type    VARCHAR(32),
    source_id      BIGINT,
    created_by     BIGINT       NOT NULL DEFAULT 0,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    is_deleted     BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at     TIMESTAMP,
    deleted_by     BIGINT
);

CREATE INDEX idx_shared_file_folder ON shared_file(tenant_id, folder_id) WHERE NOT is_deleted;
CREATE INDEX idx_shared_file_name_fts ON shared_file USING GIN(to_tsvector('simple', name)) WHERE NOT is_deleted;
CREATE INDEX idx_shared_file_source ON shared_file(tenant_id, source_type, source_id) WHERE NOT is_deleted;

-- RBAC: 新增 shared_file 资源
INSERT INTO sys_resource (tenant_id, code, name, description, created_at, updated_at, created_by, updated_by, is_deleted)
VALUES ('default', 'shared_file', '共享文档', '文件库管理', NOW(), NOW(), 0, 0, FALSE);

-- Permissions
INSERT INTO sys_permission (tenant_id, resource, action, name, created_at, updated_at, created_by, updated_by, is_deleted)
VALUES
  ('default', 'shared_file', 'read',   '查看文件',   NOW(), NOW(), 0, 0, FALSE),
  ('default', 'shared_file', 'upload', '上传文件',   NOW(), NOW(), 0, 0, FALSE),
  ('default', 'shared_file', 'delete', '删除文件',   NOW(), NOW(), 0, 0, FALSE),
  ('default', 'shared_file', 'manage', '管理文件夹', NOW(), NOW(), 0, 0, FALSE);

-- Assign to roles: viewer/member/group_leader/admin/super_admin → read
-- member/group_leader/admin/super_admin → upload
-- group_leader/admin/super_admin → delete
-- admin/super_admin → manage
INSERT INTO sys_role_permission (tenant_id, role_code, permission_id, created_at, updated_at, created_by, updated_by, is_deleted)
SELECT 'default', r.role_code, p.id, NOW(), NOW(), 0, 0, FALSE
FROM sys_permission p
CROSS JOIN (
  SELECT 'viewer'       AS role_code, 'shared_file:read' AS perm UNION ALL
  SELECT 'member',       'shared_file:read'   UNION ALL
  SELECT 'member',       'shared_file:upload' UNION ALL
  SELECT 'group_leader', 'shared_file:read'   UNION ALL
  SELECT 'group_leader', 'shared_file:upload' UNION ALL
  SELECT 'group_leader', 'shared_file:delete' UNION ALL
  SELECT 'admin',        'shared_file:read'   UNION ALL
  SELECT 'admin',        'shared_file:upload' UNION ALL
  SELECT 'admin',        'shared_file:delete' UNION ALL
  SELECT 'admin',        'shared_file:manage' UNION ALL
  SELECT 'super_admin',  'shared_file:read'   UNION ALL
  SELECT 'super_admin',  'shared_file:upload' UNION ALL
  SELECT 'super_admin',  'shared_file:delete' UNION ALL
  SELECT 'super_admin',  'shared_file:manage'
) r
WHERE p.resource = 'shared_file' AND p.action = split_part(r.perm, ':', 2);
```

- [ ] **Step 2: Apply migration**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build --no-cache backend 2>&1 | tail -3
docker compose up -d backend
sleep 25
docker compose logs backend --tail=10 2>&1 | grep -E "V17|migration|Started|ERROR"
```

Expected: `Current version of schema "public": 17` and `Started PlatformApplication`

- [ ] **Step 3: Verify tables exist**

```bash
docker compose exec postgres psql -U platform_user -d cwgsyw_platform \
  -c "\dt shared_*" 2>&1
```

Expected: `shared_file` and `shared_folder` tables listed.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/migration/V17__shared_file.sql
git commit -m "feat: V17 migration - shared_folder + shared_file tables + RBAC"
```

---
