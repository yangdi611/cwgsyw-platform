# 技术 Spec: CMDB Tier 2 — 关联增强 + CSV 导入 + 影响分析

> 基于 PRD: `specs/2026-06-13-cmdb-tier2-prd.md`
> 前置 Spec: `specs/2026-06-12-cmdb-tier1-tech-spec.md`
> 日期: 2026-06-13
> 作者: Architect
> 状态: Draft — 等待工程审查

---

## 1. 架构决策

### AD-1: 关联元数据存储 — `ci_instance_rel.metadata JSONB`

**决策**: 在 `ci_instance_rel` 表新增 `metadata JSONB DEFAULT '{}'` 列，存储关联的扩展属性值。Schema 定义存于新表 `ci_association_attr_def`。

**替代方案**: 新建 `ci_instance_rel_attr` 行存表（每属性一行）。

**选择理由**:
- 关联元数据查询频率低，主要用于展示（拓扑悬浮、详情查看）
- JSONB 与现有 `ci_instance.fields_data` 模式一致，复用 SchemaValidator
- 避免 N+1 JOIN；单表查询即可获取关联全部信息
- 向后兼容：现有数据 metadata 默认 `{}`，无需迁移

**Schema 校验策略**: 复用 Tier 1 的 `SchemaValidator`，在创建/编辑关联时对 metadata 执行 type/required/enum 校验。

### AD-2: CSV 导入 — 同步处理 + 分段事务 + 轮询进度

**决策**: 
- 上传后同步解析、校验、返回预览（< 5000 行，内存处理）
- 用户确认后，同步执行导入，每 100 条一个事务分段
- 前端轮询 `GET /api/cmdb/import/{batchId}/progress` 获取进度
- 进度存于 Redis（key: `cmdb:import:progress:{batchId}`，TTL 10min）

**替代方案**: WebSocket/SSE 推送进度。

**选择理由**:
- 当前 MVP 单节点部署，轮询足够（1s 间隔）
- WebSocket 引入额外复杂度（连接管理、断线重连）
- Phase 4 如需长任务导出，再统一升级 SSE

**唯一键策略** (回应 PRD 开放问题 #2): 
- 默认使用模型中 `is_unique=true` 的属性作为唯一键
- 导入时允许用户临时指定组合唯一键（如 `hostname,idc`）
- 前端在预览步骤前让用户选择"匹配字段"

**编码识别** (回应 PRD 开放问题 #5):
- 自动检测: 先尝试 UTF-8，失败则尝试 GBK
- 兜底: 预览步骤显示编码，用户可手动切换后重新解析

### AD-3: 影响分析 — Java BFS + 递归 CTE 混合

**决策**:
- 深度 ≤ 3 且预估节点 < 200: 使用递归 CTE（数据库层 BFS）
- 深度 > 3 或预估节点 > 200: Java BFS + visited set（避免 CTE 递归过深）
- 超时 5 秒，返回已收集部分 + `truncated=true`

**权限模型** (回应 PRD 开放问题 #3):
- 路径连通但节点信息屏蔽：越权节点返回 `{ id: null, name: "[已隐藏]", modelId: "hidden" }`
- 路径仍显示（如 A → [隐藏] → C），但无法看到隐藏节点的详情
- 理由：完全删除越权节点会导致拓扑断裂，影响分析失去意义

**算法伪代码**:
```
function impactAnalysis(rootId, direction, maxDepth, timeout):
    queue = [(rootId, 0)]  // (nodeId, depth)
    visited = {rootId}
    result = { 0: [rootNode] }  // depth → nodes
    
    startTime = now()
    while queue not empty:
        if now() - startTime > timeout:
            return { result, truncated: true }
        
        (nodeId, depth) = queue.dequeue()
        if depth == maxDepth: continue
        
        neighbors = queryNeighbors(nodeId, direction)
        for (neighbor, rel) in neighbors:
            if neighbor.id not in visited:
                visited.add(neighbor.id)
                result[depth+1].append(neighbor)
                queue.enqueue((neighbor.id, depth+1))
    
    return { result, truncated: false }
```

### AD-4: Flyway V24–V26 迁移策略

- **V24**: 关联元数据（`ci_instance_rel.metadata` + `ci_association_attr_def` 表）
- **V25**: CSV 导入权限 seed（`cmdb_instance:import` action）
- **V26**: 影响分析权限 seed（`cmdb_instance:impact` action）

**不新建 batch 表**: CSV 导入历史通过 `audit_log` 的 `batch_id` 字段聚合查询，无需独立表。

---

## 2. 数据模型变更

### 2.1 修改现有表

#### `ci_instance_rel` — 新增 `metadata` 列

```sql
ALTER TABLE ci_instance_rel
ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_ci_rel_metadata ON ci_instance_rel USING GIN(metadata);
```

**向后兼容**: 现有数据 `metadata = '{}'`，前端拓扑/关联列表无需迁移即可正常显示。

### 2.2 新增表

#### `ci_association_attr_def` — 关联类型扩展属性定义

```sql
CREATE TABLE IF NOT EXISTS ci_association_attr_def (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL DEFAULT 'default',
    association_kind  VARCHAR(64) NOT NULL,      -- 引用 ci_association_kind.code
    field_key         VARCHAR(64) NOT NULL,      -- e.g. "listen_port"
    name              VARCHAR(128) NOT NULL,     -- e.g. "监听端口"
    field_type        VARCHAR(32) NOT NULL,      -- singlechar/int/enum/list/bool/user/date
    is_required       BOOLEAN NOT NULL DEFAULT FALSE,
    enum_options      TEXT,                       -- JSON array for enum type
    default_value     VARCHAR(512),
    sort_order        INT NOT NULL DEFAULT 0,
    is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMP,
    deleted_by        BIGINT,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by        BIGINT,
    updated_by        BIGINT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ci_assoc_attr_kind_key
ON ci_association_attr_def(tenant_id, association_kind, field_key)
WHERE NOT is_deleted;
```

**设计说明**:
- `association_kind` 引用 `ci_association_kind.code`（非 FK，软引用）
- 字段类型与 `ci_attribute` 一致，复用 SchemaValidator
- 每个 `association_kind` 可独立定义自己的扩展属性 schema

---

## 3. API 契约

### 3.1 关联元数据管理

#### GET /api/cmdb/association-kinds/{kind}/attributes — 查询关联类型扩展属性

```
Permission: cmdb_model:read

Response: R<List<CiAssociationAttrDefVO>>
  CiAssociationAttrDefVO:
    id:              Long
    associationKind: string
    fieldKey:        string
    name:            string
    fieldType:       string
    isRequired:      boolean
    enumOptions:     string?  (JSON array)
    defaultValue:    string?
    sortOrder:       int
```

#### POST /api/cmdb/association-kinds/{kind}/attributes — 新增关联扩展属性

```
Permission: cmdb_model:update

Request (CreateAssociationAttrRequest):
  fieldKey:     string  @NotBlank @Pattern("^[a-z][a-z0-9_]*$")
  name:         string  @NotBlank
  fieldType:    string  @NotBlank (singlechar/int/enum/list/bool/user/date)
  isRequired:   boolean (default=false)
  enumOptions:  string? (required when fieldType=enum)
  defaultValue: string?
  sortOrder:    int     (default=0)

Response: R<CiAssociationAttrDefVO>

Validation:
  - associationKind 必须存在于 ci_association_kind
  - fieldKey 在同一 association_kind 内唯一
```

#### PUT /api/cmdb/association-kinds/{kind}/attributes/{attrId} — 编辑关联扩展属性

```
Permission: cmdb_model:update

Request (UpdateAssociationAttrRequest):
  name:          string?
  isRequired:    boolean?
  enumOptions:   string?
  defaultValue:  string?
  sortOrder:     int?

Response: R<CiAssociationAttrDefVO>

Constraint:
  - fieldKey 不可改
  - fieldType 不可改
```

#### DELETE /api/cmdb/association-kinds/{kind}/attributes/{attrId} — 删除关联扩展属性

```
Permission: cmdb_model:update

Response: R<Void>
  - 逻辑删除 (is_deleted=true)
  - 历史关联的 metadata 中该字段值保留（不自动清理）
```

### 3.2 关联关系（扩展 Tier 1 API）

#### PUT /api/cmdb/instances/{id}/relations/{relationId} — 编辑关联元数据

```
Permission: cmdb_relation:update (新增 action)

Request (UpdateRelationRequest):
  metadata:  Map<String, Object>  (增量合并, patch semantics)

Response: R<CiRelationVO>

Validation:
  - 加载该 association_kind 的 ci_association_attr_def 列表
  - SchemaValidator.validate(metadata, attrDefs)
  - 增量合并 metadata (patch semantics)
  - 记录 audit_log (before=旧 metadata, after=新 metadata)
```

#### GET /api/cmdb/instances/{id}/relations — 查询关联（扩展响应）

```
Response: R<List<CiRelationVO>>
  CiRelationVO (扩展):
    id:               Long
    srcInstanceId:    Long
    srcInstanceName:  string
    dstInstanceId:    Long
    dstInstanceName:  string
    associationKind:  string
    metadata:         Map<String, Object>  (新增)
    createdAt:        LocalDateTime
```

### 3.3 CSV 批量导入

#### POST /api/cmdb/instances/import/template — 下载导入模板

```
Permission: cmdb_instance:read

Query Params:
  model:  string  @NotBlank (模型 name)

Response: R<String> (download URL 或直接 stream CSV)
  - 内容: 空 CSV，表头为模型所有属性（is_list_show=true 或 is_required=true）
  - 枚举字段表头格式: "field_name (enum: online|offline|maintenance)"
  - 文件名: "{model_name}_import_template.csv"
```

#### POST /api/cmdb/instances/import/preview — 上传并预览

```
Permission: cmdb_instance:create, cmdb_instance:update

Request (multipart/form-data):
  file:              MultipartFile  (CSV, max 10MB)
  model:             string         (模型 name)
  conflictStrategy:  string         (override|skip|error, default=override)
  uniqueKeyFields:   string?        (逗号分隔, e.g. "hostname,idc"; 默认用 is_unique=true 的属性)
  encoding:          string?        (UTF-8|GBK, 默认自动检测)

Response: R<CsvImportPreviewVO>
  CsvImportPreviewVO:
    batchId:         string         (UUID, 用于后续确认/进度查询)
    totalRows:       int
    toCreate:        int            (待新增)
    toUpdate:        int            (待更新)
    toSkip:          int            (待跳过, conflictStrategy=skip 时)
    failedRows:      List<CsvFailedRowVO>
      rowNumber:     int
      reason:        string         (e.g. "字段 inner_ip 格式错误", "唯一键冲突")
    encoding:        string         (检测到的编码)
    previewData:     List<Map<String, Object>>  (前 10 行预览)

Validation:
  - 文件 > 10MB → 400 Bad Request
  - 行数 > 5000 → 400 Bad Request, message: "请分批导入，单次上限 5000 行"
  - 模型不存在 → 404 Not Found
  - 表头与模型属性不匹配 → 400 Bad Request, 列出缺失的必填字段
```

#### POST /api/cmdb/instances/import/execute — 确认导入

```
Permission: cmdb_instance:create, cmdb_instance:update

Request (CsvImportExecuteRequest):
  batchId:  string  @NotBlank (来自 preview 步骤)

Response: R<CsvImportResultVO>
  CsvImportResultVO:
    batchId:       string
    totalRows:     int
    created:       int
    updated:       int
    skipped:       int
    failed:        int
    failedRows:    List<CsvFailedRowVO>  (执行过程中新发现的失败行)
    durationMs:    long                  (耗时)

Implementation:
  1. 从 Redis 读取 preview 阶段的解析结果 (key: cmdb:import:preview:{batchId}, TTL 10min)
  2. 每 100 条一个事务分段:
     - 开启事务
     - 批量 insert/update ci_instance
     - 每条写 audit_log (remark="batch_id={batchId}")
     - 提交事务
     - 更新 Redis 进度 (key: cmdb:import:progress:{batchId})
  3. 完成后删除 Redis preview 数据
  4. 返回汇总结果
```

#### GET /api/cmdb/instances/import/{batchId}/progress — 查询导入进度

```
Permission: cmdb_instance:read

Response: R<CsvImportProgressVO>
  CsvImportProgressVO:
    batchId:      string
    status:       string  (pending|running|completed|failed)
    totalRows:    int
    processed:    int     (已处理)
    created:      int
    updated:      int
    skipped:      int
    failed:       int

Redis Structure:
  cmdb:import:progress:{batchId} = {
    "status": "running",
    "totalRows": 500,
    "processed": 320,
    "created": 300,
    "updated": 15,
    "skipped": 0,
    "failed": 5
  }
  TTL: 600s (10min)
```

#### GET /api/cmdb/instances/import/{batchId}/failed-rows — 下载失败行

```
Permission: cmdb_instance:read

Response: CSV stream
  - 表头: 原 CSV 表头 + "失败原因"
  - 内容: 所有 failedRows 的原始数据 + reason
  - 文件名: "{model_name}_import_failed_{batchId}.csv"
```

### 3.4 影响分析

#### POST /api/cmdb/instances/{id}/impact — 影响分析

```
Permission: cmdb_instance:read, cmdb_instance:impact (新增 action)

Request (ImpactAnalysisRequest):
  direction:  string  (upstream|downstream|bidirectional, default=bidirectional)
  maxDepth:   int     (1~5, default=3)

Response: R<ImpactAnalysisResultVO>
  ImpactAnalysisResultVO:
    rootId:        Long
    rootName:      string
    rootModelId:   string
    direction:     string
    maxDepth:      int
    truncated:     boolean  (true if timeout or node limit exceeded)
    layers:        List<ImpactLayerVO>
      depth:       int
      nodes:       List<ImpactNodeVO>
        id:           Long?       (null if hidden due to permission)
        name:         string      ("[已隐藏]" if no permission)
        modelId:      string      ("hidden" if no permission)
        modelName:    string
        status:       string?
        businessLevel: string?    (from fields_data, if exists)
    edges:         List<ImpactEdgeVO>
      src:          Long?
      dst:          Long?
      kind:         string
      label:        string

Permission Filtering:
  - 查询每个节点的 cmdb_instance:read 权限
  - 无权限节点: id=null, name="[已隐藏]", modelId="hidden"
  - 边仍保留 (src/dst 可能为 null)，路径连通
```

#### GET /api/cmdb/instances/{id}/impact/export — 导出影响分析图片

```
Permission: cmdb_instance:read

Query Params:
  direction:  string
  maxDepth:   int

Response: PNG image stream
  - 前端生成 SVG (复用拓扑渲染组件)
  - 调用 svg-to-png 库转换
  - 后端提供 API 仅为统一入口；实际 PNG 由前端生成后上传

Alternative (simpler):
  - 前端直接下载 SVG/PNG，无需后端 API
  - 后端仅提供 impact 数据 API
```

---

## 4. 关键算法

### 4.1 CSV 解析 + 校验 Pipeline

```
function parseAndValidateCsv(file, model, uniqueKeyFields, encoding):
    // 1. 编码检测
    if encoding == null:
        encoding = detectEncoding(file)  // UTF-8 first, then GBK
    
    // 2. 解析 CSV
    rows = csvParser.parse(file, encoding)
    if rows.size() > 5000:
        throw new LimitExceededException("单次导入上限 5000 行")
    
    // 3. 加载模型属性
    attributes = ciAttributeMapper.listByModel(model)
    requiredFields = attributes.filter(a -> a.isRequired).map(a -> a.fieldKey)
    uniqueFields = uniqueKeyFields ?: attributes.filter(a -> a.isUnique).map(a -> a.fieldKey)
    
    // 4. 逐行校验
    result = { toCreate: [], toUpdate: [], toSkip: [], failedRows: [] }
    existingInstances = loadExistingInstances(model, uniqueFields)  // 批量预加载
    
    for (rowNumber, row) in rows:
        errors = []
        
        // 4.1 必填校验
        for field in requiredFields:
            if row[field] == null || row[field].isEmpty():
                errors.add("字段 {field} 不能为空")
        
        // 4.2 类型校验
        for (fieldKey, value) in row:
            attr = attributes.find(a -> a.fieldKey == fieldKey)
            if attr == null: continue  // 忽略多余列
            typeError = validateFieldType(value, attr.fieldType, attr.enumOptions)
            if typeError: errors.add(typeError)
        
        // 4.3 唯一键冲突检测
        uniqueKeyValue = buildUniqueKey(row, uniqueFields)
        existing = existingInstances[uniqueKeyValue]
        
        if errors.isEmpty():
            if existing == null:
                result.toCreate.add({ rowNumber, row })
            else:
                if conflictStrategy == "override":
                    result.toUpdate.add({ rowNumber, row, existingId: existing.id })
                elif conflictStrategy == "skip":
                    result.toSkip.add({ rowNumber, row })
                elif conflictStrategy == "error":
                    errors.add("唯一键冲突: {uniqueKeyValue}")
                    result.failedRows.add({ rowNumber, row, reason: errors.join("; ") })
        else:
            result.failedRows.add({ rowNumber, row, reason: errors.join("; ") })
    
    return result
```

### 4.2 影响分析 BFS（混合策略）

```
function impactAnalysis(rootId, direction, maxDepth, timeout, tenantId, operatorPermissions):
    startTime = now()
    
    // 选择算法
    estimatedNodes = estimateNodeCount(rootId, maxDepth)  // 快速 count query
    if maxDepth <= 3 && estimatedNodes < 200:
        return impactAnalysisCte(rootId, direction, maxDepth, timeout, tenantId, operatorPermissions)
    else:
        return impactAnalysisJavaBfs(rootId, direction, maxDepth, timeout, tenantId, operatorPermissions)

function impactAnalysisCte(rootId, direction, maxDepth, timeout, tenantId, permissions):
    // 递归 CTE
    sql = """
    WITH RECURSIVE impact AS (
        -- anchor
        SELECT id, src_instance_id, dst_instance_id, association_kind, 0 AS depth
        FROM ci_instance_rel
        WHERE (src_instance_id = :rootId OR dst_instance_id = :rootId)
          AND NOT is_deleted
        UNION ALL
        -- recursive
        SELECT r.id, r.src_instance_id, r.dst_instance_id, r.association_kind, i.depth + 1
        FROM ci_instance_rel r
        INNER JOIN impact i ON (
            CASE WHEN :direction = 'downstream' THEN r.src_instance_id = i.dst_instance_id
                 WHEN :direction = 'upstream' THEN r.dst_instance_id = i.src_instance_id
                 ELSE (r.src_instance_id = i.dst_instance_id OR r.dst_instance_id = i.src_instance_id)
            END
        )
        WHERE i.depth < :maxDepth AND NOT r.is_deleted
    )
    SELECT DISTINCT * FROM impact
    """
    
    try:
        edges = jdbcTemplate.query(sql, { rootId, direction, maxDepth }, timeout=5s)
    catch TimeoutException:
        return { layers: partialResult, truncated: true }
    
    // 收集节点 + 权限过滤
    nodeIds = collectNodeIds(edges)
    instances = ciInstanceMapper.selectBatchIds(nodeIds)
    
    layers = groupByDepth(edges, instances, permissions)
    return { layers, truncated: false }

function impactAnalysisJavaBfs(rootId, direction, maxDepth, timeout, tenantId, permissions):
    queue = [(rootId, 0)]
    visited = {rootId}
    layers = { 0: [loadInstance(rootId)] }
    edges = []
    
    while queue not empty:
        if now() - startTime > timeout:
            return { layers, edges, truncated: true }
        
        (nodeId, depth) = queue.dequeue()
        if depth == maxDepth: continue
        
        // 查询邻居
        neighbors = queryNeighbors(nodeId, direction, tenantId)
        for (neighbor, rel) in neighbors:
            if neighbor.id not in visited:
                visited.add(neighbor.id)
                layers[depth+1].append(neighbor)
                edges.append(rel)
                queue.enqueue((neighbor.id, depth+1))
    
    // 权限过滤
    filterByPermission(layers, permissions)
    return { layers, edges, truncated: false }

function queryNeighbors(nodeId, direction, tenantId):
    if direction == "downstream":
        rels = ciInstanceRelMapper.selectList(srcInstanceId=nodeId, tenantId=tenantId)
        return rels.map(r -> (ciInstanceMapper.selectById(r.dstInstanceId), r))
    elif direction == "upstream":
        rels = ciInstanceRelMapper.selectList(dstInstanceId=nodeId, tenantId=tenantId)
        return rels.map(r -> (ciInstanceMapper.selectById(r.srcInstanceId), r))
    else:  // bidirectional
        rels = ciInstanceRelMapper.selectList(
            (srcInstanceId=nodeId OR dstInstanceId=nodeId), tenantId=tenantId
        )
        return rels.map(r -> (
            ciInstanceMapper.selectById(r.srcInstanceId == nodeId ? r.dstInstanceId : r.srcInstanceId),
            r
        ))

function filterByPermission(layers, permissions):
    for (depth, nodes) in layers:
        for node in nodes:
            if node.id not in permissions:
                node.id = null
                node.name = "[已隐藏]"
                node.modelId = "hidden"
```

---

## 5. Flyway 迁移

### V24: 关联元数据

```sql
-- V24__ci_association_metadata.sql

-- 1. ci_instance_rel 新增 metadata JSONB
ALTER TABLE ci_instance_rel
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_ci_rel_metadata ON ci_instance_rel USING GIN(metadata);

-- 2. ci_association_attr_def 表
CREATE TABLE IF NOT EXISTS ci_association_attr_def (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL DEFAULT 'default',
    association_kind  VARCHAR(64) NOT NULL,
    field_key         VARCHAR(64) NOT NULL,
    name              VARCHAR(128) NOT NULL,
    field_type        VARCHAR(32) NOT NULL,
    is_required       BOOLEAN NOT NULL DEFAULT FALSE,
    enum_options      TEXT,
    default_value     VARCHAR(512),
    sort_order        INT NOT NULL DEFAULT 0,
    is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMP,
    deleted_by        BIGINT,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by        BIGINT,
    updated_by        BIGINT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ci_assoc_attr_kind_key
ON ci_association_attr_def(tenant_id, association_kind, field_key)
WHERE NOT is_deleted;
```

### V25: CSV 导入权限

```sql
-- V25__cmdb_import_permissions.sql

-- 新增 cmdb_instance:import action
UPDATE sys_resource
SET actions = actions || '["import"]'::jsonb
WHERE code = 'cmdb_instance';

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, 'import', 'cmdb_instance:import', 'CSV 导入实例'
FROM sys_resource r
WHERE r.code = 'cmdb_instance'
ON CONFLICT DO NOTHING;

-- 超级管理员 + 管理员 + 组长可导入
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin', 'group_leader')
  AND p.code = 'cmdb_instance:import'
ON CONFLICT DO NOTHING;
```

### V26: 影响分析权限

```sql
-- V26__cmdb_impact_permissions.sql

-- 新增 cmdb_instance:impact action
UPDATE sys_resource
SET actions = actions || '["impact"]'::jsonb
WHERE code = 'cmdb_instance';

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, 'impact', 'cmdb_instance:impact', '影响分析'
FROM sys_resource r
WHERE r.code = 'cmdb_instance'
ON CONFLICT DO NOTHING;

-- 所有 CMDB 读权限角色均可执行影响分析
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin', 'group_leader', 'member')
  AND p.code = 'cmdb_instance:impact'
ON CONFLICT DO NOTHING;
```

---

## 6. 后端文件清单

### 6.1 新增文件

| 类别 | 文件 | 说明 |
|------|------|------|
| Entity | `CiAssociationAttrDef.java` | 关联扩展属性定义实体 |
| Mapper | `CiAssociationAttrDefMapper.java` | MyBatis-Plus Mapper |
| Service | `CiAssociationAttrDefService.java` | 关联属性定义 CRUD |
| Service | `CsvImportService.java` | CSV 解析、校验、执行导入 |
| Service | `ImpactAnalysisService.java` | 影响分析 BFS |
| Controller | `CiAssociationAttrDefController.java` | 关联属性定义 API |
| Controller | `CsvImportController.java` | CSV 导入 API |
| Controller | `ImpactAnalysisController.java` | 影响分析 API |
| DTO | `CiAssociationAttrDefVO.java` | 关联属性定义 VO |
| DTO | `CreateAssociationAttrRequest.java` | 创建关联属性请求 |
| DTO | `UpdateAssociationAttrRequest.java` | 编辑关联属性请求 |
| DTO | `UpdateRelationRequest.java` | 编辑关联元数据请求 |
| DTO | `CsvImportPreviewVO.java` | CSV 导入预览结果 |
| DTO | `CsvImportResultVO.java` | CSV 导入执行结果 |
| DTO | `CsvImportProgressVO.java` | CSV 导入进度 |
| DTO | `CsvFailedRowVO.java` | CSV 失败行 |
| DTO | `ImpactAnalysisRequest.java` | 影响分析请求 |
| DTO | `ImpactAnalysisResultVO.java` | 影响分析结果 |
| DTO | `ImpactLayerVO.java` | 影响分析层 |
| DTO | `ImpactNodeVO.java` | 影响分析节点 |
| DTO | `ImpactEdgeVO.java` | 影响分析边 |
| Util | `CsvParser.java` | CSV 解析 + 编码检测 |
| Migration | `V24__ci_association_metadata.sql` | 关联元数据迁移 |
| Migration | `V25__cmdb_import_permissions.sql` | CSV 导入权限 |
| Migration | `V26__cmdb_impact_permissions.sql` | 影响分析权限 |

### 6.2 修改文件

| 文件 | 变更 |
|------|------|
| `CiInstanceRel.java` | 新增 `metadata` 字段 (Map<String, Object>) |
| `CiRelationVO.java` | 新增 `metadata` 字段 |
| `CiRelationService.java` | `create()` 支持 metadata 参数；新增 `update()` 方法 |
| `CiRelationController.java` | 新增 `PUT /{relationId}` 端点 |
| `SchemaValidator.java` | 扩展支持 `CiAssociationAttrDef` 校验（复用逻辑） |

---

## 7. 前端影响范围（Tier 2 不做前端变更）

PRD 明确 Tier 2 仅后端 API。前端页面在后续 PRD 中处理。

**前端工作预估**（供后续参考）:
- 关联编辑弹窗：动态渲染 association_attr_def 表单
- CSV 导入向导：3 步（上传 → 预览 → 结果）
- 影响分析弹窗：方向/深度选择 + 清单视图 + 拓扑子图

---

## 8. 风险评估

| # | 风险 | 影响 | 缓解措施 |
|---|------|------|---------|
| R1 | CSV 编码检测失败 | 乱码数据导入 | 预览步骤显示检测到的编码，用户可手动切换 |
| R2 | CSV 导入长事务锁表 | 并发写入阻塞 | 每 100 条一个事务分段，避免长事务 |
| R3 | 影响分析递归 CTE 性能 | P95 > 3s | 混合策略（CTE + Java BFS），超时 5s 截断 |
| R4 | 权限过滤导致拓扑断裂 | 用户困惑 | 保留路径（边），节点显示"[已隐藏]" |
| R5 | Redis 进度数据丢失 | 前端轮询失败 | TTL 10min + 兜底查询 audit_log batch_id |
| R6 | 关联元数据 schema 变更 | 历史数据不兼容 | 删除属性时不自动清理 metadata，保留历史值 |

---

## 9. 安全检查点

- [ ] CSV 上传文件大小限制 10MB（Spring `MultipartResolver` 配置）
- [ ] CSV 解析防 CSV 注入（公式注入检测）
- [ ] 影响分析权限过滤（越权节点信息屏蔽）
- [ ] 所有写操作写 audit_log（CSV 导入每条实例各自一条 + batch_id）
- [ ] tenant_id 隔离：所有查询必须带 tenant_id
- [ ] 影响分析超时 5s 防止 DoS
- [ ] CSV 临时文件处理完即删除（`@Cleanup` + `finally` block）

---

## 10. 技术债务

| # | 债务项 | 触发条件 | 解决方案 |
|---|--------|---------|---------|
| 1 | CSV 导入进度轮询 | Phase 4 长任务导出 | 统一升级 SSE/WebSocket |
| 2 | 关联元数据查询性能 | metadata 字段频繁过滤 | 提取高频字段到独立列 |
| 3 | 影响分析缓存 | 并发 > 100 QPS | Redis 缓存 + TTL，写操作失效 |
| 4 | CSV 导入异步化 | 行数 > 5000 需求 | 后台任务 + 通知 |

---

## 11. 开放问题（待工程反馈）

1. **CSV 解析库选择**: Apache Commons CSV vs OpenCSV vs Jackson CSV？建议 Apache Commons CSV（轻量、流式解析）。
2. **编码检测库**: juniversalchardet vs ICU4J CharsetDetector？建议 juniversalchardet（零依赖）。
3. **Redis 进度数据结构**: Hash vs JSON string？建议 Hash（字段级更新，避免序列化开销）。
4. **影响分析 SVG 导出**: 前端生成 vs 后端生成？建议前端生成（复用拓扑渲染组件），后端仅提供数据 API。

---

## 12. 下游 handoff

本 Spec 完成后：
- **Engineer** 按 API 契约实现后端代码（参照 `writing-plans` 拆解为 bite-sized tasks）
- **V24–V26 迁移文件**: Engineer 直接执行
- **测试**: 集成测试覆盖所有 API 端点 + CSV 校验边界 + 影响分析深度/超时/权限过滤
