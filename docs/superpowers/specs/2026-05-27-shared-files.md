# 共享文档模块设计规格（Phase A）

**日期：** 2026-05-27
**状态：** 已批准，待实施
**分支：** `feature/cmdb`

---

## 目标

新增独立的"共享文档"模块，支持文件上传/下载/预览/搜索，文件夹树形组织，按组权限控制。Word 上传后异步转 Markdown 存档。变更文档审批通过后自动归档到文件库。

**Phase A 范围：** 文件库基础（上传/下载/预览/文件夹/搜索/权限）+ 变更文档自动归档
**Phase B（后续）：** 变更文档创建页手动附件上传

---

## 数据层

### V17 Migration

```sql
-- 文件夹
CREATE TABLE shared_folder (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    name        VARCHAR(255) NOT NULL,
    parent_id   BIGINT,                        -- NULL = 根目录
    created_by  BIGINT       NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMP,
    deleted_by  BIGINT
);

-- 文件
CREATE TABLE shared_file (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      VARCHAR(64)  NOT NULL DEFAULT 'default',
    folder_id      BIGINT,                    -- NULL = 根目录
    name           VARCHAR(255) NOT NULL,     -- 显示名称
    original_name  VARCHAR(255) NOT NULL,     -- 原始文件名
    file_type      VARCHAR(32)  NOT NULL,     -- pdf/docx/xlsx/other
    size_bytes     BIGINT       NOT NULL,
    minio_key      VARCHAR(512) NOT NULL,     -- MinIO 对象 key
    md_key         VARCHAR(512),             -- pandoc 转换的 .md key（仅 docx）
    visible_groups JSONB        NOT NULL DEFAULT '[]', -- 可见组 ID 列表
    source_type    VARCHAR(32),              -- 来源类型：change_doc / null
    source_id      BIGINT,                   -- 来源 ID（如 change_doc.id）
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
```

### RBAC（V17 同步插入）

新增 `shared_file` 资源：

| action | 说明 | 分配角色 |
|--------|------|---------|
| `read` | 查看/下载文件 | viewer, member, group_leader, admin, super_admin |
| `upload` | 上传文件 | member, group_leader, admin, super_admin |
| `delete` | 删除文件 | group_leader, admin, super_admin |
| `manage` | 创建/删除文件夹 | admin, super_admin |

---

## 后端

### 新增模块 `module/sharedfile/`

| 文件 | 说明 |
|------|------|
| `entity/SharedFolder.java` | 文件夹实体 |
| `entity/SharedFile.java` | 文件实体（含 sourceType, sourceId, mdKey） |
| `SharedFolderMapper.java` | 文件夹 CRUD |
| `SharedFileMapper.java` | 文件 CRUD + 全文搜索 |
| `dto/SharedFileVO.java` | 文件响应 VO |
| `dto/SharedFolderVO.java` | 文件夹响应 VO（含子文件夹列表） |
| `dto/UploadFileRequest.java` | 上传请求（folderId, visibleGroups） |
| `SharedFileService.java` | 上传/下载/删除/搜索 + pandoc 异步转 MD |
| `SharedFolderService.java` | 文件夹 CRUD + 树形结构构建 |
| `SharedFileController.java` | REST 端点 |

### API 路由

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/api/files/folders` | `shared_file:read` | 获取文件夹树 |
| `POST` | `/api/files/folders` | `shared_file:manage` | 创建文件夹 |
| `DELETE` | `/api/files/folders/{id}` | `shared_file:manage` | 删除文件夹（含文件软删） |
| `GET` | `/api/files` | `shared_file:read` | 列出文件（params: folderId, keyword） |
| `POST` | `/api/files/upload` | `shared_file:upload` | 上传文件（multipart/form-data） |
| `GET` | `/api/files/{id}/download-url` | `shared_file:read` | 获取下载预签名 URL（5分钟有效） |
| `GET` | `/api/files/{id}/preview-url` | `shared_file:read` | 获取预览预签名 URL（30分钟有效） |
| `DELETE` | `/api/files/{id}` | `shared_file:delete` | 软删除文件 |

### pandoc 异步转 Markdown

- 上传 `.docx` 后，`@Async` 任务调用 `pandoc input.docx -o output.md`
- Docker 容器安装 `pandoc`（`Dockerfile` 加 `RUN apt-get install -y pandoc`）
- 转换结果存 MinIO，更新 `shared_file.md_key`
- 转换失败不影响文件上传成功，仅记录日志

### 变更文档自动归档

- `WorkflowService` 审批通过回调中，调用 `SharedFileService.archiveFromChangeDoc(changeDocId, operatorId)`
- 自动导出 Word + PDF（复用现有 `ExportService`）
- 存入 `/变更文档/YYYY-MM/` 文件夹（不存在则自动创建）
- `source_type='change_doc'`, `source_id=changeDocId`
- `visible_groups=[]`（空数组 = 所有人可见，由 admin 管理）

### 权限过滤规则

- `visible_groups` 为空数组 `[]` = 所有登录用户可见
- `visible_groups` 非空 = 只有 `groupId` 在列表中的用户可见
- `admin/super_admin` 始终可见所有文件（groupScope = tenant/platform）

---

## 前端

### 侧边栏

在"IT 运维工具"分组中新增：
```
📂 共享文档   /files   shared_file:read
```

### 新增页面

| 路径 | 说明 |
|------|------|
| `/files` | 主页面：左侧文件夹树 + 右侧文件列表 |
| `/files/preview/[id]` | 文件预览全屏页 |

### 主页面布局

```
┌─ 左侧文件夹树（220px）─┬─ 右侧文件区域 ──────────────────────┐
│ 📁 根目录              │ [搜索框]  [上传文件] [新建文件夹]     │
│  ├ 📁 运维文档         │                                       │
│  │  ├ 📁 SOP           │ 名称      类型  大小  上传者  操作    │
│  │  └ 📁 网络拓扑      │ 📄 xxx.pdf  PDF  2MB  张三   👁 ⬇ 🗑 │
│  └ 📁 变更文档         │ 📄 yyy.docx DOC  1MB  李四   👁 ⬇ 🗑 │
│     └ 📁 2026-05       │ 📄 zzz.xlsx XLS  3MB  王五   👁 ⬇ 🗑 │
└────────────────────────┴───────────────────────────────────────┘
```

### 预览页

| 文件类型 | 预览方式 |
|---------|---------|
| `.pdf` | `<iframe>` 渲染预签名 URL |
| `.docx` | `docx-preview` 库前端渲染 |
| `.xlsx` | `SheetJS` 渲染为 HTML 表格 |
| 其他 | 文件信息 + 下载按钮 |

### 前端依赖

```bash
npm install docx-preview xlsx
```

---

## Docker 变更

`backend/Dockerfile` 新增：
```dockerfile
RUN apt-get update && apt-get install -y pandoc && rm -rf /var/lib/apt/lists/*
```

---

## 不在本期范围

- 变更文档创建页手动附件上传（Phase B）
- 文件版本历史
- 文件在线编辑
- 文件分享链接（外部访问）
- 文件夹权限独立设置（当前权限在文件级别）

---

## 文件变更清单

**后端（10 个新文件 + 2 个修改）：**
- 新建：`db/migration/V17__shared_file.sql`
- 新建：`module/sharedfile/entity/SharedFolder.java`
- 新建：`module/sharedfile/entity/SharedFile.java`
- 新建：`module/sharedfile/SharedFolderMapper.java`
- 新建：`module/sharedfile/SharedFileMapper.java`
- 新建：`module/sharedfile/dto/SharedFileVO.java`
- 新建：`module/sharedfile/dto/SharedFolderVO.java`
- 新建：`module/sharedfile/dto/UploadFileRequest.java`
- 新建：`module/sharedfile/SharedFileService.java`
- 新建：`module/sharedfile/SharedFolderService.java`
- 新建：`module/sharedfile/SharedFileController.java`
- 修改：`module/workflow/WorkflowService.java`（审批通过回调）
- 修改：`backend/Dockerfile`（安装 pandoc）

**前端（2 个新建 + 1 个修改）：**
- 新建：`app/(dashboard)/files/page.tsx`
- 新建：`app/(dashboard)/files/preview/[id]/page.tsx`
- 修改：`components/layout/Sidebar.tsx`（新增共享文档入口）
