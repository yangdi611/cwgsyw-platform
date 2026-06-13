# 技术 Spec: CMDB Tier 3 — 可视化（变更历史增强 + 统计面板 + 拓扑图增强 + 2D 视图）

> 基于 PRD: `specs/2026-06-13-cmdb-tier3-prd.md`
> 前置 Spec: `specs/2026-06-13-cmdb-tier2-tech-spec.md`
> 日期: 2026-06-13
> 作者: Architect
> 状态: Draft — 等待工程审查

---

## 1. 架构决策

### AD-1: 变更历史 diff — 保留完整 JSONB + 运行时计算 changed_fields

**决策**: 不改变现有 `audit_log` 存储策略（`before_json`/`after_json` 仍存完整快照）。`changed_fields[]` 在后端运行时计算（比较两个 JSON 的 key 集合），通过新增 DTO 字段返回前端。

**替代方案**: 新建 `cmdb_change_log` 表仅存 diff（减存储）。

**选择理由**:
- 现有 `audit_log` 已满足需求（V19 已建 `idx_audit_cmdb_target` 复合索引）
- 完整快照对未来扩展更有价值（回滚、审计追溯）
- 变更历史查询已有 `CiInstanceService.getInstanceHistory()` 和 `getGlobalChanges()`，只需增强 DTO + 查询参数
- 100k 条记录规模下，JSONB 存储开销可忽略（单条 < 2KB）

**性能**: 复合索引 `(tenant_id, module, target_type, target_id, created_at DESC)` 已存在，P95 < 300ms 可达标。

### AD-2: 拓扑图对比 — 基于 audit_log 重建历史快照（无快照表）

**决策**: 对比模式从 `audit_log` 反推历史拓扑。给定时间点 T，从当前拓扑出发，逆向 apply undo（对 created_at > T 的变更记录做反向操作），得到 T 时刻的快照。

**替代方案**: 新建 `cmdb_topology_snapshot` 表定期快照。

**选择理由**:
- 快照表引入存储膨胀（每 N 分钟全量拓扑快照）和调度复杂度
- 当前拓扑规模（< 500 节点）下，从 audit_log 重建开销可接受（< 2s）
- 对比频率低（手动操作），不需要高频查询优化
- Phase 4 如规模增长，可引入增量快照策略

**重建算法**:
```
function reconstructTopology(targetTime):
    // 1. 取当前拓扑
    currentNodes = allActiveInstances()
    currentEdges = allActiveRelations()
    
    // 2. 取 targetTime 之后的所有变更记录
    changes = auditLog.query(
        module='cmdb',
        targetType IN ('ci_instance', 'ci_instance_rel'),
        createdAt > targetTime
    )
    
    // 3. 逆向 apply（从最新到最早）
    for change in changes.reverse():
        if change.action == 'create_instance':
            currentNodes.remove(change.targetId)
        elif change.action == 'delete_instance':
            currentNodes.add(restoreFromBeforeJson(change))
        elif change.action == 'create_relation':
            currentEdges.remove(change.targetId)
        elif change.action == 'delete_relation':
            currentEdges.add(restoreFromBeforeJson(change))
        // update_instance 不影响拓扑结构（节点仍在）
    
    return { nodes: currentNodes, edges: currentEdges }
```

### AD-3: 变更统计缓存 — 全局 Redis 缓存（不区分权限）

**决策**: 统计 API 走全局 Redis 缓存（key: `cmdb:stats:{modelId}:{from}:{to}`，TTL 5min），不区分用户权限。

**选择理由**:
- MVP 单租户场景，所有 CMDB 用户看到的统计结果相同
- 统计只返回计数（不暴露具体字段值），无信息泄露风险
- 全局缓存命中率 > 95%（同时间段 + 同模型的查询几乎必命中）

**失效策略**: 实例写操作（create/update/delete）后，删除 `cmdb:stats:*` 匹配的所有 key（使用 Redis SCAN + DEL）。

### AD-4: 2D 视图 group_by — 仅支持 string + enum 类型属性

**决策**: `group_by` 下拉仅展示 `field_type IN ('singlechar', 'enum')` 的属性。

**选择理由**:
- `int`/`bool`/`list`/`date` 不适合做分组维度（int 分组太多、bool 仅 2 组无意义）
- `reference` 类型（如果未来引入）需要 JOIN 查询，复杂度过高
- `singlechar` + `enum` 覆盖所有合理分组场景（idc、rack、os_type、status）

### AD-5: 拓扑图性能 — 前端 Canvas 渲染（react-flow 升级到 @xyflow/react v12）

**决策**: 500 节点 + 1000 边场景使用 `@xyflow/react` (react-flow) 的虚拟化渲染，配合 `minZoom=0.1` + `maxZoom=2` 限制视口范围。

**替代方案**: 纯 Canvas/WebGL 自研渲染。

**选择理由**:
- react-flow 已内置虚拟化（viewport culling），仅渲染可见节点
- 500 节点在 1920×1080 视口下可见约 80~120 个，其余由虚拟化跳过
- 自研 Canvas 方案开发成本高（布局算法、交互事件），不值得为 MVP 投入
- `@xyflow/react` v12 支持自定义节点渲染、mini-map、fit-view，满足所有 AC

### AD-6: Flyway V27–V29 迁移策略

- **V27**: `ci_model` 新增 `color`、`enable_2d_view` 列
- **V28**: `cmdb_change:read` 权限 seed（新增资源 + 分配角色）
- **V29**: 变更历史复合索引确认（如 V19 已覆盖则跳过，否则补建）

**向后兼容**: `color` 默认值 `NULL`（前端按模型 name hash 分配默认颜色）；`enable_2d_view` 默认 `FALSE`（现有模型不展示 2D 视图 tab）。

---

## 2. 数据模型变更

### 2.1 修改现有表

#### `ci_model` — 新增 `color` + `enable_2d_view`

```sql
ALTER TABLE ci_model
ADD COLUMN IF NOT EXISTS color VARCHAR(7),           -- e.g. '#1890FF'
ADD COLUMN IF NOT EXISTS enable_2d_view BOOLEAN NOT NULL DEFAULT FALSE;
```

**向后兼容**:
- `color = NULL`: 前端按模型 name 的 hash 自动生成颜色（deterministic，同模型同颜色）
- `enable_2d_view = FALSE`: 现有模型不展示 2D 视图 tab

### 2.2 索引确认

```sql
-- V19 已建: idx_audit_cmdb_target (tenant_id, module, target_type, target_id, created_at DESC)
-- 此索引已覆盖变更历史查询场景，无需新建

-- 确认: 如 V19 未包含 entity_type + entity_id 的查询模式，补充:
CREATE INDEX IF NOT EXISTS idx_audit_cmdb_changes
ON audit_log(tenant_id, module, target_type, target_id, created_at DESC)
WHERE module = 'cmdb' AND target_type = 'ci_instance';
```

**说明**: 此索引为 partial index（仅 cmdb 模块的 ci_instance），减小索引体积，加速变更历史分页查询。

---

## 3. API 契约

### 3.1 变更历史（增强现有 API）

#### GET /api/cmdb/instances/{instanceId}/history — 实例变更历史（增强）

```
Permission: cmdb_change:read (新增)

Query Params (全部可选):
  from:     string  (ISO 8601, e.g. "2026-06-01T00:00:00")
  to:       string  (ISO 8601)
  operatorId: Long
  action:   string  (create_instance|update_instance|delete_instance)
  page:     int     (default=1)
  size:     int     (default=20, max=100)

Response: R<PageResult<ChangeHistoryV2VO>>
  ChangeHistoryV2VO (扩展 ChangeHistoryVO):
    id:             Long
    action:         string
    operatorId:     Long
    operatorName:   string
    beforeJson:     Map<String, Object>?
    afterJson:      Map<String, Object>?
    changedFields:  List<String>          (新增: 变更字段列表)
    summary:        string               (新增: 如 "修改了 3 个字段: hostname, inner_ip, status")
    createdAt:      LocalDateTime

Changed Fields 计算:
  if beforeJson == null && afterJson != null:
    changedFields = afterJson.keySet()   // 创建操作
    summary = "创建了实例"
  elif beforeJson != null && afterJson == null:
    changedFields = beforeJson.keySet()  // 删除操作
    summary = "删除了实例"
  else:
    changedFields = []
    for key in union(beforeJson.keys, afterJson.keys):
      if beforeJson[key] != afterJson[key]:
        changedFields.append(key)
    summary = "修改了 {N} 个字段: {field1}, {field2}, ..."
```

#### GET /api/cmdb/changes — 全局变更历史（增强）

```
Permission: cmdb_change:read

Query Params:
  entityType: string  (ci_instance|ci_instance_rel, default=ci_instance)
  entityId:   Long?
  modelId:    string? (按模型过滤, entityType=ci_instance 时有效)
  from:       string
  to:         string
  operatorId: Long?
  action:     string?
  page:       int     (default=1)
  size:       int     (default=20, max=100)

Response: R<PageResult<ChangeHistoryV2VO>>

Implementation:
  - entityType=ci_instance: 查 audit_log WHERE module='cmdb' AND target_type='ci_instance'
  - entityType=ci_instance_rel: 查 audit_log WHERE module='cmdb' AND target_type='ci_instance_rel'
  - modelId 过滤: JOIN ci_instance 表按 model_id 过滤（或在 afterJson/beforeJson 中匹配 modelId 字段）
```

### 3.2 变更统计面板

#### GET /api/cmdb/changes/stats — 变更统计

```
Permission: cmdb_change:read

Query Params:
  from:     string?  (默认 30 天前)
  to:       string?  (默认当前)
  modelId:  string?  (按模型过滤)

Response: R<ChangeStatsVO>
  ChangeStatsVO:
    today:      ActionCountVO
    thisWeek:   ActionCountVO
    thisMonth:  ActionCountVO
    dailyBreakdown: List<DailyCountVO>  (每日统计, 用于前端折线图)
    top10Instances: List<TopInstanceVO> (过去 30 天变更最频繁的 10 个实例)

  ActionCountVO:
    created:  int
    updated:  int
    deleted:  int
    total:    int

  DailyCountVO:
    date:     string  (yyyy-MM-dd)
    created:  int
    updated:  int
    deleted:  int

  TopInstanceVO:
    instanceId:   Long
    instanceName: string
    modelId:      string
    modelName:    string
    changeCount:  int

Caching:
  Redis key: cmdb:stats:{modelId}:{from}:{to}  (modelId 为空时用 "_all")
  TTL: 300s (5 min)
  Invalidation: 实例写操作后 SCAN cmdb:stats:* → DEL

SQL:
  -- dailyBreakdown
  SELECT DATE(created_at) as date, action, COUNT(*) as cnt
  FROM audit_log
  WHERE module = 'cmdb'
    AND target_type = 'ci_instance'
    AND tenant_id = :tenantId
    AND created_at >= :from
    AND created_at < :to
  GROUP BY DATE(created_at), action
  ORDER BY date

  -- top10Instances
  SELECT target_id, COUNT(*) as change_count
  FROM audit_log
  WHERE module = 'cmdb'
    AND target_type = 'ci_instance'
    AND tenant_id = :tenantId
    AND created_at >= NOW() - INTERVAL '30 days'
  GROUP BY target_id
  ORDER BY change_count DESC
  LIMIT 10
```

### 3.3 拓扑图增强

#### GET /api/cmdb/topology/{instanceId} — 拓扑图（增强响应）

```
Permission: cmdb_instance:read (复用现有)

Response: R<TopologyResultV2VO>
  TopologyResultV2VO (扩展 TopologyResultVO):
    nodes: List<TopologyNodeV2VO>
    edges: List<TopologyEdgeV2VO>

  TopologyNodeV2VO (扩展 TopologyNodeVO):
    id:          Long
    name:        string
    modelId:     string
    modelName:   string
    modelColor:  string?    (新增: ci_model.color, null 时前端 hash 生成)
    status:      string     (新增: online|offline|maintenance)
    owner:       string?    (新增)
    isRoot:      boolean
    keyAttrs:    Map<String, Object>  (新增: is_list_show=true 的属性)

  TopologyEdgeV2VO (同 TopologyEdgeVO, 无变更):
    src:    Long
    dst:    Long
    kind:   string
    label:  string

说明: 后端仅扩展响应字段，展开/折叠/过滤/灰显由前端实现。
```

#### GET /api/cmdb/topology/{instanceId}/compare — 拓扑对比

```
Permission: cmdb_instance:read

Query Params:
  fromTime:  string  (ISO 8601, 时间点 A)
  toTime:    string  (ISO 8601, 时间点 B)
  depth:     int     (default=5)

Response: R<TopologyCompareVO>
  TopologyCompareVO:
    added:     List<TopologyNodeV2VO>   (fromTime 不存在, toTime 存在 → 新增)
    removed:   List<TopologyNodeV2VO>   (fromTime 存在, toTime 不存在 → 删除)
    modified:  List<TopologyNodeV2VO>   (两时间点都存在, fieldsData 不同 → 修改)
    unchanged: List<TopologyNodeV2VO>   (两时间点完全一致)
    edges:     List<TopologyCompareEdgeVO>

  TopologyCompareEdgeVO:
    src:       Long
    dst:       Long
    kind:      string
    label:     string
    status:    string  (added|removed|unchanged)

Timeout: 5 秒, 超时返回 { error: "对比超时，请缩小时间范围或减小 depth" }

Implementation:
  1. snapshotA = reconstructTopology(instanceId, fromTime, depth)
  2. snapshotB = reconstructTopology(instanceId, toTime, depth)
  3. diff = compareSnapshots(snapshotA, snapshotB)
  4. 标记每个节点的 diff 状态 (added/removed/modified/unchanged)
```

### 3.4 模型管理（扩展）

#### PUT /api/cmdb/models/{modelId} — 更新模型（扩展字段）

```
Permission: cmdb_model:update (复用现有)

Request (UpdateModelRequest 扩展):
  displayName:    string?
  group:          string?
  color:          string?   (新增: VARCHAR(7), 正则 ^#[0-9A-Fa-f]{6}$)
  enable2dView:   boolean?  (新增)

Response: R<CiModelVO>

Validation:
  - color 必须符合 hex color 格式 (#RRGGBB)
  - 写 audit_log (before/after 含 color + enable2dView)
```

### 3.5 2D 视图

#### GET /api/cmdb/instances/2d-view — 2D 网格视图

```
Permission: cmdb_instance:read (复用现有)

Query Params:
  modelId:   string  @NotBlank
  groupBy:   string  @NotBlank  (属性 field_key, 必须 field_type IN ('singlechar', 'enum'))

Response: R<TwoDimensionViewVO>
  TwoDimensionViewVO:
    modelId:      string
    modelName:    string
    groupBy:      string
    groups:       List<TwoDimGroupVO>
    groupableAttrs: List<GroupableAttrVO>  (可供 group_by 选择的属性列表)

  TwoDimGroupVO:
    groupValue:  string  (e.g. "北京机房", "A-01")
    instances:   List<TwoDimCellVO>

  TwoDimCellVO:
    id:          Long
    name:        string
    status:      string
    owner:       string?

  GroupableAttrVO:
    fieldKey:    string
    name:        string
    fieldType:   string

Validation:
  - modelId 对应的 ci_model.enable_2d_view 必须为 true (否则 400)
  - groupBy 必须是该模型的属性, 且 field_type IN ('singlechar', 'enum')
  - 如 groupBy 的属性值在实例中为 null, 归入 "__未分组__" group

Implementation:
  1. 查询 ci_model, 确认 enable_2d_view=true
  2. 查询 ci_attribute 列表, 筛选 groupable attrs
  3. 查询该模型所有实例 (is_deleted=false)
  4. 按 fields_data[groupBy] 分组 (null → "__未分组__")
  5. 每组内按 name 排序
```

---

## 4. 关键算法

### 4.1 changed_fields 计算

```
function computeChangedFields(beforeJson, afterJson):
    if beforeJson == null && afterJson != null:
        return { fields: afterJson.keySet(), summary: "创建了实例" }
    
    if beforeJson != null && afterJson == null:
        return { fields: beforeJson.keySet(), summary: "删除了实例" }
    
    changedKeys = []
    allKeys = union(beforeJson.keySet(), afterJson.keySet())
    
    for key in allKeys:
        beforeVal = beforeJson.get(key)
        afterVal = afterJson.get(key)
        if !Objects.equals(beforeVal, afterVal):
            changedKeys.add(key)
    
    if changedKeys.isEmpty():
        summary = "无实质变更"
    elif changedKeys.size() <= 3:
        summary = "修改了 " + changedKeys.size() + " 个字段: " + changedKeys.join(", ")
    else:
        summary = "修改了 " + changedKeys.size() + " 个字段: "
              + changedKeys.take(3).join(", ") + " 等"
    
    return { fields: changedKeys, summary }
```

### 4.2 拓扑快照重建（用于对比模式）

```
function reconstructTopology(rootId, targetTime, depth, tenantId):
    // 从当前拓扑出发，逆向撤销 targetTime 之后的所有变更
    
    // 1. 取当前活跃拓扑 (复用 CiTopologyService.getTopology)
    currentTopology = ciTopologyService.getTopology(rootId, depth, tenantId)
    nodes = currentTopology.nodes.toMap(n -> n.id)
    edges = currentTopology.edges.toSet()
    
    // 2. 取 targetTime 之后的所有变更记录
    changes = auditLogMapper.queryChanges(
        tenantId, "cmdb",
        targetTypes=["ci_instance", "ci_instance_rel"],
        after=targetTime
    )
    
    // 3. 按 createdAt DESC 排序，逆向 apply
    changes.sortByDesc(c -> c.createdAt)
    
    for change in changes:
        switch change.targetType:
            case "ci_instance":
                switch change.action:
                    case "create_instance":
                        // 在 targetTime 时此实例不存在 → 移除
                        nodes.remove(change.targetId)
                    case "delete_instance":
                        // 在 targetTime 时此实例存在 → 从 beforeJson 恢复
                        if change.beforeJson != null:
                            node = parseBeforeJson(change)
                            nodes.put(node.id, node)
                    case "update_instance":
                        // 不影响拓扑结构（节点位置/连接不变）
                        // 但 fieldsData 可能变化，更新节点属性
                        if nodes.contains(change.targetId):
                            nodes[change.targetId].keyAttrs = parseBeforeFields(change)
            
            case "ci_instance_rel":
                switch change.action:
                    case "create_relation":
                        // 在 targetTime 时此关系不存在 → 移除
                        edges.removeIf(e -> e.src == change.beforeJson.src
                                         && e.dst == change.beforeJson.dst)
                    case "delete_relation":
                        // 在 targetTime 时此关系存在 → 恢复
                        if change.beforeJson != null:
                            edges.add(parseRelation(change.beforeJson))
    
    return { nodes: nodes.values(), edges: edges.toList() }
```

### 4.3 快照对比 diff

```
function compareSnapshots(snapshotA, snapshotB):
    nodeIdsA = snapshotA.nodes.map(n -> n.id).toSet()
    nodeIdsB = snapshotB.nodes.map(n -> n.id).toSet()
    
    added = snapshotB.nodes.filter(n -> n.id !in nodeIdsA)
    removed = snapshotA.nodes.filter(n -> n.id !in nodeIdsB)
    
    common = nodeIdsA.intersect(nodeIdsB)
    modified = []
    unchanged = []
    
    for id in common:
        nodeA = snapshotA.nodes.findById(id)
        nodeB = snapshotB.nodes.findById(id)
        if nodeA.fieldsData != nodeB.fieldsData
           || nodeA.status != nodeB.status:
            modified.add(nodeB)  // 返回最新状态
        else:
            unchanged.add(nodeB)
    
    // 边对比
    edgeKeysA = snapshotA.edges.map(e -> "${e.src}-${e.dst}-${e.kind}").toSet()
    edgeKeysB = snapshotB.edges.map(e -> "${e.src}-${e.dst}-${e.kind}").toSet()
    
    compareEdges = []
    for edge in snapshotB.edges:
        key = "${edge.src}-${edge.dst}-${edge.kind}"
        if key !in edgeKeysA:
            compareEdges.add({ ...edge, status: "added" })
        else:
            compareEdges.add({ ...edge, status: "unchanged" })
    for edge in snapshotA.edges:
        key = "${edge.src}-${edge.dst}-${edge.kind}"
        if key !in edgeKeysB:
            compareEdges.add({ ...edge, status: "removed" })
    
    return { added, removed, modified, unchanged, edges: compareEdges }
```

### 4.4 2D 视图分组聚合

```
function build2DView(modelId, groupBy, tenantId):
    // 1. 加载模型 + 校验
    model = ciModelMapper.findByName(modelId, tenantId)
    if !model.enable2dView:
        throw new BadRequestException("该模型未启用 2D 视图")
    
    // 2. 获取可分组属性
    attrs = ciAttributeMapper.listByModel(modelId, tenantId)
    groupableAttrs = attrs.filter(a -> a.fieldType in ['singlechar', 'enum'])
    
    groupByAttr = groupableAttrs.find(a -> a.fieldKey == groupBy)
    if groupByAttr == null:
        throw new BadRequestException("属性 {groupBy} 不支持分组（仅 string/enum 类型可分组）")
    
    // 3. 查询所有实例
    instances = ciInstanceMapper.selectList(
        tenantId=tenantId, modelId=modelId, isDeleted=false
    )
    
    // 4. 分组
    groups = LinkedHashMap<String, List<TwoDimCellVO>>()
    for inst in instances:
        groupValue = inst.fieldsData?.get(groupBy)?.toString() ?: "__未分组__"
        groups.computeIfAbsent(groupValue, k -> new ArrayList<>())
            .add(TwoDimCellVO(inst.id, inst.name, inst.status, inst.owner))
    
    // 5. 组内按 name 排序
    for group in groups.values():
        group.sortBy(cell -> cell.name)
    
    return TwoDimensionViewVO(modelId, model.displayName, groupBy,
        groups.entries().map(e -> TwoDimGroupVO(e.key, e.value)),
        groupableAttrs.map(a -> GroupableAttrVO(a.fieldKey, a.name, a.fieldType)))
```

---

## 5. Flyway 迁移

### V27: ci_model 新增可视化字段

```sql
-- V27__ci_model_visualization_fields.sql

ALTER TABLE ci_model
ADD COLUMN IF NOT EXISTS color VARCHAR(7),
ADD COLUMN IF NOT EXISTS enable_2d_view BOOLEAN NOT NULL DEFAULT FALSE;

-- 为内置模型分配默认颜色
UPDATE ci_model SET color = '#1890FF' WHERE name = 'host' AND color IS NULL;
UPDATE ci_model SET color = '#52C41A' WHERE name = 'app'  AND color IS NULL;

-- 主机模型默认启用 2D 视图（有 idc/rack 属性，适合网格展示）
UPDATE ci_model SET enable_2d_view = TRUE WHERE name = 'host';
```

### V28: 变更历史查询权限

```sql
-- V28__cmdb_change_permissions.sql

-- 新增 cmdb_change 资源
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
    ('cmdb_change', 'CMDB 变更历史', '["read"]', 53)
ON CONFLICT DO NOTHING;

-- 自动生成权限记录
INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, 'read', 'cmdb_change:read', 'CMDB 变更历史-查看'
FROM sys_resource r
WHERE r.code = 'cmdb_change'
ON CONFLICT DO NOTHING;

-- 超级管理员 + 管理员 + 组长 + 组员均可查看变更历史
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin', 'group_leader', 'member')
  AND p.code = 'cmdb_change:read'
ON CONFLICT DO NOTHING;
```

### V29: 变更历史查询索引（防御性补建）

```sql
-- V29__cmdb_changes_index.sql

-- V19 已建 idx_audit_cmdb_target 覆盖通用场景
-- 此处补建 partial index 专用于变更历史分页查询
CREATE INDEX IF NOT EXISTS idx_audit_cmdb_instance_changes
ON audit_log(tenant_id, target_type, target_id, created_at DESC)
WHERE module = 'cmdb' AND target_type = 'ci_instance';

-- 统计查询用索引
CREATE INDEX IF NOT EXISTS idx_audit_cmdb_stats
ON audit_log(tenant_id, target_type, action, created_at)
WHERE module = 'cmdb';
```

---

## 6. 后端文件清单

### 6.1 新增文件

| 类别 | 文件 | 说明 |
|------|------|------|
| Service | `CiChangeService.java` | 变更历史查询 + 统计（从 CiInstanceService 拆分） |
| Service | `CiTopologyCompareService.java` | 拓扑对比（快照重建 + diff） |
| Service | `Ci2DViewService.java` | 2D 视图分组聚合 |
| Controller | `CiChangeController.java` | 变更历史 + 统计 API |
| DTO | `ChangeHistoryV2VO.java` | 扩展的变更历史 VO（含 changedFields + summary） |
| DTO | `ChangeStatsVO.java` | 变更统计 VO |
| DTO | `ActionCountVO.java` | 按动作类型计数的 VO |
| DTO | `DailyCountVO.java` | 每日统计 VO |
| DTO | `TopInstanceVO.java` | Top 活跃实例 VO |
| DTO | `TopologyResultV2VO.java` | 扩展拓扑结果 VO |
| DTO | `TopologyNodeV2VO.java` | 扩展拓扑节点 VO |
| DTO | `TopologyCompareVO.java` | 拓扑对比结果 VO |
| DTO | `TopologyCompareEdgeVO.java` | 拓扑对比边 VO |
| DTO | `TwoDimensionViewVO.java` | 2D 视图 VO |
| DTO | `TwoDimGroupVO.java` | 2D 分组 VO |
| DTO | `TwoDimCellVO.java` | 2D 单元格 VO |
| DTO | `GroupableAttrVO.java` | 可分组属性 VO |
| Migration | `V27__ci_model_visualization_fields.sql` | 模型可视化字段 |
| Migration | `V28__cmdb_change_permissions.sql` | 变更历史权限 |
| Migration | `V29__cmdb_changes_index.sql` | 变更历史索引 |

### 6.2 修改文件

| 文件 | 变更 |
|------|------|
| `CiModel.java` | 新增 `color` (String) + `enable2dView` (Boolean) 字段 |
| `CiModelVO.java` | 新增 `color` + `enable2dView` 字段 |
| `UpdateModelRequest.java` | 新增 `color` + `enable2dView` 字段 |
| `CiModelService.java` | `update()` 支持 color + enable2dView |
| `CiInstanceService.java` | 写操作后增加 Redis 缓存失效逻辑 |
| `CiTopologyService.java` | `getTopology()` 返回扩展字段（status, owner, keyAttrs, modelColor） |
| `TopologyNodeVO.java` | 新增 status, owner, modelColor, keyAttrs 字段（向后兼容） |
| `ChangeHistoryVO.java` | 新增 changedFields + summary 字段（向后兼容） |
| `AuditLogMapper.java` | 新增 `queryChanges()` 方法（支持 targetType 列表 + after 时间过滤） |

---

## 7. 前端影响范围

### 7.1 变更历史可视化

| 页面 | 变更 |
|------|------|
| 实例详情 → 变更历史 tab | 时间线视图 + diff 高亮（红=删, 绿=增, 黄=改） + 过滤侧边栏 + 分页 |
| CMDB 全局变更历史页 | 同上加全局视角 |

**新增组件**:
- `ChangeTimeline.tsx`: 时间线列表
- `JsonDiffView.tsx`: JSONB diff 渲染（递归比较, 红/绿/黄着色）
- `ChangeFilterSidebar.tsx`: 时间范围 + 操作人 + 动作类型过滤

### 7.2 变更统计面板

| 页面 | 变更 |
|------|------|
| CMDB 首页 | 新增"变更统计"卡片区域: 今日/本周/本月 + Top 10 |

**新增组件**:
- `ChangeStatsCards.tsx`: 3 个统计卡片（可点击跳转）
- `TopActiveInstances.tsx`: Top 10 列表
- `DailyChangeChart.tsx`: 折线图（可选, 用 recharts）

### 7.3 拓扑图增强

| 页面 | 变更 |
|------|------|
| 实例详情 → 拓扑图 tab | 节点着色 + 状态边框 + 悬浮卡片 + 展开折叠 + 过滤侧边栏 + 对比模式 + PNG 导出 |

**新增组件**:
- `TopologyCanvas.tsx`: 主画布（@xyflow/react, 虚拟化）
- `TopologyNode.tsx`: 自定义节点（颜色 + 状态边框 + 展开/折叠图标）
- `TopologyHoverCard.tsx`: 悬浮详情卡片
- `TopologyFilterSidebar.tsx`: 模型/状态/分组过滤
- `TopologyComparePanel.tsx`: 对比模式（时间选择器 + diff 渲染）
- `TopologyExportButton.tsx`: PNG 导出

**新增依赖**:
- `@xyflow/react` ^12.x (替代可能的旧版 react-flow)
- `html-to-image` (PNG 导出)

### 7.4 2D 视图

| 页面 | 变更 |
|------|------|
| 模型实例列表页 | 新增"2D 视图"tab（仅 enable_2d_view=true 时显示） |

**新增组件**:
- `TwoDimGrid.tsx`: 网格布局（CSS Grid, 按 group 分区）
- `TwoDimCell.tsx`: 单元格（名称 + 状态 + owner + 状态着色）
- `GroupBySelector.tsx`: 顶部 group_by 下拉

### 7.5 模型管理

| 页面 | 变更 |
|------|------|
| 模型编辑页 | 新增 color 颜色选择器 + enable_2d_view 开关 |

---

## 8. 数据流图

### 8.1 变更历史查询流

```
┌────────────┐    GET /changes        ┌──────────────────┐
│  前端      │ ──────────────────────→ │ CiChangeController│
│  Timeline  │                        │ @PreAuthorize     │
│  + Filter  │                        └────────┬─────────┘
└────────────┘                                 │
                                     ┌────────▼─────────┐
                                     │ CiChangeService   │
                                     │ computeChanged()  │
                                     └────────┬─────────┘
                                              │
                                     ┌────────▼─────────┐
                                     │ AuditLogMapper    │
                                     │ idx_audit_cmdb_*  │
                                     └────────┬─────────┘
                                              │
                                     ┌────────▼─────────┐
                                     │ audit_log table   │
                                     │ (V19+V29 indexes) │
                                     └──────────────────┘
```

### 8.2 变更统计流

```
┌────────────┐  GET /changes/stats   ┌──────────────────┐
│  前端      │ ────────────────────→ │ CiChangeController│
│  StatsCard │                       └────────┬─────────┘
└────────────┘                                │
                                    ┌─────────▼──────────┐
                                    │ Check Redis Cache   │
                                    │ cmdb:stats:{key}    │
                                    └────┬──────────┬────┘
                                         │          │
                                    HIT  │          │ MISS
                                         │    ┌─────▼─────────┐
                                         │    │ CiChangeService │
                                         │    │ SQL aggregate   │
                                         │    └─────┬─────────┘
                                         │          │
                                         │    ┌─────▼─────────┐
                                         │    │ Write Cache     │
                                         │    │ TTL=300s        │
                                         │    └─────┬─────────┘
                                         │          │
                                    ┌────▼──────────▼────┐
                                    │ Return ChangeStatsVO │
                                    └────────────────────┘
```

### 8.3 拓扑对比流

```
┌────────────┐  GET /topology/       ┌────────────────────────┐
│  前端      │  {id}/compare         │ CiTopologyController    │
│  Compare   │ ────────────────────→ │ @PreAuthorize           │
│  Panel     │                       └────────┬───────────────┘
└────────────┘                                │
                                    ┌─────────▼──────────────┐
                                    │ CiTopologyCompareService │
                                    │ timeout = 5s             │
                                    └────┬──────────┬────────┘
                                         │          │
                              ┌──────────▼──┐  ┌───▼─────────────┐
                              │ Reconstruct  │  │ Reconstruct      │
                              │ Snapshot A   │  │ Snapshot B       │
                              │ (fromTime)   │  │ (toTime)         │
                              └──────┬───────┘  └───────┬─────────┘
                                     │                  │
                              ┌──────▼──────────────────▼─────┐
                              │ compareSnapshots(A, B)         │
                              │ → added/removed/modified/      │
                              │   unchanged + edge diffs        │
                              └──────────────┬────────────────┘
                                             │
                              ┌──────────────▼────────────────┐
                              │ Return TopologyCompareVO       │
                              └────────────────────────────────┘
```

### 8.4 2D 视图流

```
┌────────────┐  GET /instances/      ┌──────────────────┐
│  前端      │  2d-view              │ CiInstanceController│
│  2D Grid   │ ────────────────────→ │ @PreAuthorize      │
└────────────┘                       └────────┬──────────┘
                                              │
                                    ┌─────────▼──────────┐
                                    │ Ci2DViewService     │
                                    │ 1. load model       │
                                    │ 2. check enable_2d  │
                                    │ 3. load attrs       │
                                    │ 4. load instances   │
                                    │ 5. groupBy聚合      │
                                    └────────┬───────────┘
                                             │
                                    ┌────────▼───────────┐
                                    │ Return              │
                                    │ TwoDimensionViewVO  │
                                    └────────────────────┘
```

---

## 9. 风险评估

| # | 风险 | 影响 | 缓解措施 |
|---|------|------|---------|
| R1 | 拓扑对比重建耗时 > 5s | 对比超时 | 超时截断 + 提示用户缩小时间范围/depth |
| R2 | 500 节点拓扑渲染卡顿 | 用户体验差 | @xyflow/react 虚拟化 + minZoom 限制 + 默认折叠 3 跳外 |
| R3 | 变更统计缓存一致性 | 写操作后看到旧数据 | 写操作后主动 SCAN+DEL 缓存 key |
| R4 | audit_log.before_json 为空（旧数据） | 拓扑重建不完整 | 遇到 null before_json 时标记为"不完整快照"并降级 |
| R5 | 2D 视图 1000+ 单元格渲染慢 | 页面卡顿 | CSS Grid + 虚拟滚动（react-window）|
| R6 | changed_fields 计算在大 JSON 上慢 | P95 超标 | beforeJson/afterJson 通常 < 2KB，O(n) 比较 < 1ms |
| R7 | 拓扑对比中 update_instance 导致误判 | 节点标为 modified 但仅 fieldsData 微调 | modified 仅比较 status + keyAttrs（list_show=true 的属性）|

---

## 10. 安全检查点

- [x] 变更历史 API: `@PreAuthorize("hasAuthority('cmdb_change:read')")`
- [x] 统计 API: `@PreAuthorize("hasAuthority('cmdb_change:read')")`
- [x] 拓扑增强: 复用现有 `cmdb_instance:read`
- [x] 2D 视图: 复用现有 `cmdb_instance:read`
- [x] 模型 color/enable2dView 编辑: `@PreAuthorize("hasAuthority('cmdb_model:update')")`
- [ ] 拓扑对比中隐藏越权节点（同 Tier 2 影响分析策略）
- [ ] Redis 缓存 key 含 tenant_id 隔离
- [ ] 对比模式超时 5s 防止 DoS
- [ ] 所有写操作（模型更新 color/enable2dView）写 audit_log

---

## 11. 技术债务

| # | 债务项 | 触发条件 | 解决方案 |
|---|--------|---------|---------|
| 1 | 拓扑对比无快照表 | 拓扑 > 1000 节点且对比频繁 | 引入增量快照表（每小时定时任务）|
| 2 | 变更统计全局缓存 | 多租户场景权限差异 | 按 user/role 维度拆分缓存 key |
| 3 | 前端 diff 库未统一 | 多处需要 JSON diff 展示 | 抽取 `@/lib/json-diff.ts` 工具函数 |
| 4 | @xyflow/react 许可 | 商业使用需 Pro 许可 | 评估是否需要降级到 MIT 版 react-flow |

---

## 12. 开放问题（待工程反馈）

1. **@xyflow/react 版本**: v12 MIT 版是否满足需求？还是需 Pro 版的 `useReactFlow().fitView()` 高级 API？
2. **PNG 导出库**: `html-to-image` vs `html2canvas`？前者基于 SVG 中间格式更精确，后者兼容性更好。
3. **Redis SCAN 删缓存**: 是否需要 Lua 脚本保证原子性？当前 MVP 单线程场景下 SCAN+DEL 够用。
4. **2D 视图虚拟滚动**: 1000 单元格是否需要 react-window？还是 CSS Grid 原生渲染足够？

---

## 13. 下游 handoff

本 Spec 完成后:
- **Engineer** 按 API 契约实现后端代码（参照 `writing-plans` 拆解为 bite-sized tasks）
- **V27–V29 迁移文件**: Engineer 直接执行
- **前端**: 按 §7 实现 4 个功能模块（变更历史增强、统计面板、拓扑增强、2D 视图）
- **测试**: 集成测试覆盖所有新增 API 端点 + 拓扑对比边界 + 缓存失效 + 2D 视图分组
