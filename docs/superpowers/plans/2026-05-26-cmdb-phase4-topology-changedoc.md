# CMDB Phase 4: 拓扑树 + 变更文档影响范围打通 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 BFS 拓扑接口，用 React Flow 在实例详情页和独立页面可视化 CI 关联图；同时在变更文档模板中支持 `ci_selector` 字段类型，让用户在变更文档中选择受影响的 CI 并自动建议关联 CI。

**Architecture:** 后端新增 `GET /api/cmdb/topology/{instanceId}?depth=2`，做 BFS 遍历并批量获取节点/边/标签，返回 React Flow 直接可用的 `{nodes, edges}` 结构；前端 `CiTopologyGraph` 组件封装 React Flow，内嵌于实例详情页（只读预览）和独立全屏页；`ci_selector` 字段类型不需要 DB 迁移，在 `fieldsData` 存 JSON 快照，使用同一拓扑接口获取关联建议。

**Tech Stack:** Spring Boot 3.4.5, MyBatis-Plus 3.5.12, Next.js 15, React 19, @xyflow/react (React Flow v12), Tailwind v4

---

## File Map

**后端（5 个新文件）：**
- Create: `backend/.../module/cmdb/dto/TopologyNodeVO.java`
- Create: `backend/.../module/cmdb/dto/TopologyEdgeVO.java`
- Create: `backend/.../module/cmdb/dto/CiTopologyResult.java`
- Create: `backend/.../module/cmdb/CiTopologyService.java`
- Create: `backend/.../module/cmdb/CiTopologyController.java`

**前端（2 个新建 + 4 个修改）：**
- Create: `frontend/src/components/cmdb/CiTopologyGraph.tsx`
- Create: `frontend/src/app/(dashboard)/cmdb/topology/[instanceId]/page.tsx`
- Modify: `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/page.tsx`
- Modify: `frontend/src/app/(dashboard)/change-docs/new/page.tsx`
- Modify: `frontend/src/app/(dashboard)/admin/change-doc-templates/[id]/page.tsx`

---

## Task 1: 后端拓扑 DTOs + Service + Controller

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/TopologyNodeVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/TopologyEdgeVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiTopologyResult.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiTopologyService.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiTopologyController.java`

- [ ] **Step 1: 创建 TopologyNodeVO**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/TopologyNodeVO.java
package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;

@Data
public class TopologyNodeVO {
    private Long id;
    private String name;
    private String modelId;
    private String modelName;
    private Boolean isRoot;
}
```

- [ ] **Step 2: 创建 TopologyEdgeVO**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/TopologyEdgeVO.java
package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;

@Data
public class TopologyEdgeVO {
    private Long id;
    private Long srcId;
    private Long dstId;
    private String label;   // kind.srcToDst（关联种类的方向标签）
    private String defId;
}
```

- [ ] **Step 3: 创建 CiTopologyResult**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiTopologyResult.java
package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.util.List;

@Data
public class CiTopologyResult {
    private List<TopologyNodeVO> nodes;
    private List<TopologyEdgeVO> edges;
}
```

- [ ] **Step 4: 创建 CiTopologyService**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiTopologyService.java
package com.cwgsyw.platform.module.cmdb;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.cmdb.dto.*;
import com.cwgsyw.platform.module.cmdb.entity.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CiTopologyService {

    private final CiInstanceRelMapper relMapper;
    private final CiInstanceMapper instanceMapper;
    private final CiModelMapper modelMapper;
    private final CiAssociationDefMapper defMapper;
    private final CiAssociationKindMapper kindMapper;

    public CiTopologyResult getTopology(String tenantId, Long rootId, int depth) {
        depth = Math.min(Math.max(depth, 1), 5);

        // BFS: collect visited nodes and edges
        Map<Long, Integer> visitedNodes = new LinkedHashMap<>();  // id -> depth
        Map<Long, CiInstanceRel> collectedRels = new LinkedHashMap<>();  // relId -> rel

        Queue<Long> queue = new LinkedList<>();
        queue.add(rootId);
        visitedNodes.put(rootId, 0);

        while (!queue.isEmpty()) {
            Long current = queue.poll();
            int currentDepth = visitedNodes.get(current);
            if (currentDepth >= depth) continue;

            List<CiInstanceRel> rels = relMapper.findByInstance(tenantId, current);
            for (CiInstanceRel rel : rels) {
                if (collectedRels.containsKey(rel.getId())) continue;
                collectedRels.put(rel.getId(), rel);

                Long peerId = current.equals(rel.getSrcId()) ? rel.getDstId() : rel.getSrcId();
                if (!visitedNodes.containsKey(peerId)) {
                    visitedNodes.put(peerId, currentDepth + 1);
                    queue.add(peerId);
                }
            }
        }

        // Batch-fetch instances
        Map<Long, CiInstance> instMap = instanceMapper.selectBatchIds(visitedNodes.keySet())
                .stream().collect(Collectors.toMap(CiInstance::getId, i -> i));

        // Batch-fetch model names
        Set<String> modelIds = instMap.values().stream()
                .map(CiInstance::getModelId).collect(Collectors.toSet());
        Map<String, String> modelNameMap = modelMapper.selectList(
                        new LambdaQueryWrapper<CiModel>().in(CiModel::getModelId, modelIds))
                .stream().collect(Collectors.toMap(CiModel::getModelId, CiModel::getName));

        // Batch-fetch def -> kindId mapping
        Set<String> defIds = collectedRels.values().stream()
                .map(CiInstanceRel::getDefId).collect(Collectors.toSet());
        Map<String, String> defKindMap = defIds.isEmpty() ? Map.of() :
                defMapper.selectList(new LambdaQueryWrapper<CiAssociationDef>()
                                .in(CiAssociationDef::getDefId, defIds))
                        .stream().collect(Collectors.toMap(CiAssociationDef::getDefId, CiAssociationDef::getKindId));

        // Batch-fetch kinds
        Set<String> kindIds = new HashSet<>(defKindMap.values());
        Map<String, CiAssociationKind> kindMap = kindIds.isEmpty() ? Map.of() :
                kindMapper.selectList(new LambdaQueryWrapper<CiAssociationKind>()
                                .in(CiAssociationKind::getKindId, kindIds))
                        .stream().collect(Collectors.toMap(CiAssociationKind::getKindId, k -> k));

        // Build nodes
        List<TopologyNodeVO> nodes = visitedNodes.keySet().stream().map(id -> {
            CiInstance inst = instMap.get(id);
            TopologyNodeVO n = new TopologyNodeVO();
            n.setId(id);
            n.setName(inst != null && inst.getName() != null ? inst.getName() : "#" + id);
            n.setModelId(inst != null ? inst.getModelId() : null);
            n.setModelName(inst != null
                    ? modelNameMap.getOrDefault(inst.getModelId(), inst.getModelId())
                    : null);
            n.setIsRoot(id.equals(rootId));
            return n;
        }).collect(Collectors.toList());

        // Build edges
        List<TopologyEdgeVO> edges = collectedRels.values().stream().map(rel -> {
            String kindId = defKindMap.get(rel.getDefId());
            CiAssociationKind kind = kindId != null ? kindMap.get(kindId) : null;
            TopologyEdgeVO e = new TopologyEdgeVO();
            e.setId(rel.getId());
            e.setSrcId(rel.getSrcId());
            e.setDstId(rel.getDstId());
            e.setLabel(kind != null ? kind.getSrcToDst() : "");
            e.setDefId(rel.getDefId());
            return e;
        }).collect(Collectors.toList());

        CiTopologyResult result = new CiTopologyResult();
        result.setNodes(nodes);
        result.setEdges(edges);
        return result;
    }
}
```

- [ ] **Step 5: 创建 CiTopologyController**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiTopologyController.java
package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.CiTopologyResult;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cmdb/topology")
@RequiredArgsConstructor
public class CiTopologyController {

    private final CiTopologyService topologyService;

    @GetMapping("/{instanceId}")
    @PreAuthorize("hasAuthority('cmdb_instance:read')")
    public R<CiTopologyResult> getTopology(
            @PathVariable Long instanceId,
            @RequestParam(defaultValue = "2") int depth,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(topologyService.getTopology(user.getTenantId(), instanceId, depth));
    }
}
```

- [ ] **Step 6: 构建部署验证**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | tail -3
docker compose up -d backend && sleep 25
docker compose logs backend --tail=3 2>&1 | grep -E "Started|ERROR"
```

- [ ] **Step 7: Smoke test**

```bash
TOKEN=$(/usr/bin/curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# Get an existing instance ID
INST_ID=$(/usr/bin/curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost/api/cmdb/instances/host" | \
  python3 -c "import sys,json; recs=json.load(sys.stdin)['data']['records']; print(recs[0]['id'] if recs else 'NO_INSTANCES')")

echo "Testing topology for instance $INST_ID"
/usr/bin/curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost/api/cmdb/topology/$INST_ID?depth=2" | \
  python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('nodes:', len(d['nodes']), 'edges:', len(d['edges']))"
```

Expected: `nodes: N edges: M` (at least 1 node for the root, 0+ edges)

- [ ] **Step 8: 提交**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/cmdb/
git commit -m "feat: CiTopologyService + CiTopologyController - BFS topology API with depth parameter"
```

---

## Task 2: 前端 — 安装 @xyflow/react + CiTopologyGraph 组件

**Files:**
- Create: `frontend/src/components/cmdb/CiTopologyGraph.tsx`

- [ ] **Step 1: 安装依赖**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend
npm install @xyflow/react
```

- [ ] **Step 2: 创建 CiTopologyGraph 组件**

```tsx
// frontend/src/components/cmdb/CiTopologyGraph.tsx
'use client'
import { useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType,
  Handle, Position, NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// ── Types ───────────────────────────────────────────────────────────────────

export interface TopologyNodeData {
  name: string
  modelId: string | null
  modelName: string | null
  isRoot: boolean
}

export interface TopologyNode {
  id: number
  name: string
  model_id: string | null
  model_name: string | null
  is_root: boolean
}

export interface TopologyEdge {
  id: number
  src_id: number
  dst_id: number
  label: string
  def_id: string
}

// ── Color palette by model_id hash ──────────────────────────────────────────

const MODEL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  host:    { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd' },
  app:     { bg: '#1e3f2a', border: '#22c55e', text: '#86efac' },
  default: { bg: '#1e293b', border: '#64748b', text: '#94a3b8' },
}
function modelColor(modelId: string | null) {
  if (!modelId) return MODEL_COLORS.default
  return MODEL_COLORS[modelId] ?? MODEL_COLORS.default
}

// ── Custom CI node ───────────────────────────────────────────────────────────

function CiNode({ data }: NodeProps) {
  const d = data as TopologyNodeData
  const c = modelColor(d.modelId)
  return (
    <div
      style={{
        background: c.bg,
        border: `2px solid ${d.isRoot ? '#f59e0b' : c.border}`,
        borderRadius: 8,
        padding: '6px 12px',
        minWidth: 120,
        boxShadow: d.isRoot ? '0 0 0 3px rgba(245,158,11,0.3)' : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: c.border }} />
      <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>{d.name}</div>
      {d.modelName && (
        <div style={{
          fontSize: 10, marginTop: 2, padding: '1px 6px', borderRadius: 4,
          background: c.border + '33', color: c.text, display: 'inline-block',
        }}>
          {d.modelName}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: c.border }} />
    </div>
  )
}

const NODE_TYPES = { ciNode: CiNode }

// ── Auto-layout: BFS-level based left-to-right ───────────────────────────────

function layoutNodes(
  topoNodes: TopologyNode[],
  topoEdges: TopologyEdge[],
  rootId: number,
): Map<number, { x: number; y: number }> {
  const levels = new Map<number, number>()
  const queue: number[] = [rootId]
  levels.set(rootId, 0)
  while (queue.length > 0) {
    const cur = queue.shift()!
    const curLevel = levels.get(cur)!
    topoEdges.forEach(e => {
      const peer = e.src_id === cur ? e.dst_id : e.src_id
      if (!levels.has(peer)) { levels.set(peer, curLevel + 1); queue.push(peer) }
    })
  }
  const byLevel = new Map<number, number[]>()
  levels.forEach((lv, id) => {
    if (!byLevel.has(lv)) byLevel.set(lv, [])
    byLevel.get(lv)!.push(id)
  })
  const pos = new Map<number, { x: number; y: number }>()
  byLevel.forEach((ids, lv) => {
    ids.forEach((id, i) => {
      pos.set(id, { x: lv * 220, y: (i - (ids.length - 1) / 2) * 110 })
    })
  })
  return pos
}

// ── Main component ───────────────────────────────────────────────────────────

interface CiTopologyGraphProps {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
  rootId: number
  preview?: boolean         // true = embedded preview (fixed 280px, no pan/zoom)
  onNodeClick?: (node: TopologyNode) => void
}

export function CiTopologyGraph({
  nodes: topoNodes, edges: topoEdges, rootId, preview = false, onNodeClick,
}: CiTopologyGraphProps) {
  const positions = layoutNodes(topoNodes, topoEdges, rootId)

  const rfNodes: Node[] = topoNodes.map(n => ({
    id: String(n.id),
    type: 'ciNode',
    position: positions.get(n.id) ?? { x: 0, y: 0 },
    data: { name: n.name, modelId: n.model_id, modelName: n.model_name, isRoot: n.is_root } as TopologyNodeData,
  }))

  const rfEdges: Edge[] = topoEdges.map(e => ({
    id: String(e.id),
    source: String(e.src_id),
    target: String(e.dst_id),
    label: e.label || undefined,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
    style: { stroke: '#475569' },
    labelStyle: { fontSize: 10, fill: '#94a3b8' },
    labelBgStyle: { fill: '#1e293b' },
  }))

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges)

  useEffect(() => {
    const pos = layoutNodes(topoNodes, topoEdges, rootId)
    setNodes(topoNodes.map(n => ({
      id: String(n.id), type: 'ciNode',
      position: pos.get(n.id) ?? { x: 0, y: 0 },
      data: { name: n.name, modelId: n.model_id, modelName: n.model_name, isRoot: n.is_root },
    })))
    setEdges(topoEdges.map(e => ({
      id: String(e.id), source: String(e.src_id), target: String(e.dst_id),
      label: e.label || undefined,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
      style: { stroke: '#475569' },
      labelStyle: { fontSize: 10, fill: '#94a3b8' },
      labelBgStyle: { fill: '#1e293b' },
    })))
  }, [topoNodes, topoEdges, rootId])

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (onNodeClick) {
      const orig = topoNodes.find(n => String(n.id) === node.id)
      if (orig) onNodeClick(orig)
    }
  }, [onNodeClick, topoNodes])

  return (
    <div style={{ height: preview ? 280 : '100%', width: '100%', background: '#0f172a', borderRadius: 8 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        panOnDrag={!preview}
        zoomOnScroll={!preview}
        zoomOnPinch={!preview}
        panOnScroll={false}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        colorMode="dark"
      >
        <Background color="#1e293b" gap={20} />
        {!preview && <Controls />}
        {!preview && <MiniMap nodeColor={() => '#334155'} maskColor="rgba(0,0,0,0.4)" />}
      </ReactFlow>
    </div>
  )
}
```

- [ ] **Step 3: TypeScript 检查**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: 0 errors

- [ ] **Step 4: 提交**

```bash
git add frontend/src/components/cmdb/CiTopologyGraph.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: CiTopologyGraph - React Flow component with auto-layout and preview/fullscreen modes"
```

---

## Task 3: 全屏拓扑页 `/cmdb/topology/[instanceId]`

**Files:**
- Create: `frontend/src/app/(dashboard)/cmdb/topology/[instanceId]/page.tsx`

- [ ] **Step 1: 创建全屏拓扑页**

```tsx
// frontend/src/app/(dashboard)/cmdb/topology/[instanceId]/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { CiTopologyGraph, TopologyNode, TopologyEdge } from '@/components/cmdb/CiTopologyGraph'
import { cn } from '@/lib/utils'

interface CiTopologyResult {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
}

export default function TopologyPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { hasPermission } = usePermission()
  const router = useRouter()
  const [depth, setDepth] = useState(2)
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null)

  useEffect(() => {
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data, isLoading } = useQuery<CiTopologyResult>({
    queryKey: ['cmdb-topology', instanceId, depth],
    queryFn: () => api.get(`/cmdb/topology/${instanceId}`, { params: { depth } }).then(r => r.data.data),
  })

  const rootNode = data?.nodes.find(n => n.is_root)

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-background flex-shrink-0">
        <Link
          href={`/cmdb/instances/${rootNode?.model_id ?? 'host'}/${instanceId}`}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />返回实例
        </Link>
        <div className="flex-1">
          <span className="font-semibold text-sm">
            {rootNode?.name ?? `#${instanceId}`} 的拓扑图
          </span>
          <span className="text-xs text-muted-foreground ml-2">
            {data?.nodes.length ?? 0} 个节点，{data?.edges.length ?? 0} 条关联
          </span>
        </div>
        {/* 深度选择器 */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">深度：</span>
          {[1, 2, 3].map(d => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className={cn(
                'w-7 h-7 rounded text-xs font-medium transition-colors',
                depth === d
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* 图区域 + 右侧节点信息面板 */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">加载中...</div>
          ) : !data || data.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">暂无关联数据</div>
          ) : (
            <CiTopologyGraph
              nodes={data.nodes}
              edges={data.edges}
              rootId={Number(instanceId)}
              preview={false}
              onNodeClick={setSelectedNode}
            />
          )}
        </div>

        {/* 右侧节点详情面板 */}
        {selectedNode && (
          <div className="w-64 border-l bg-background flex-shrink-0 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">节点详情</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">名称</p>
                <p className="font-medium">{selectedNode.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">模型</p>
                <p>{selectedNode.model_name ?? selectedNode.model_id ?? '—'}</p>
              </div>
              {selectedNode.is_root && (
                <div className="px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-600 dark:text-amber-400">
                  当前根节点
                </div>
              )}
              <Link
                href={`/cmdb/instances/${selectedNode.model_id}/${selectedNode.id}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full mt-2')}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />访问实例
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript 检查**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -5
```

Expected: 0 errors

- [ ] **Step 3: 构建前端，验证 HTTP 200**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build frontend 2>&1 | tail -3
docker compose up -d frontend && sleep 15
# 用已知 instance ID 测试（上一 task 测试时获得的 ID）
/usr/bin/curl -s -o /dev/null -w "%{http_code}" http://localhost/cmdb/topology/2 && echo ""
```

Expected: `200`

- [ ] **Step 4: 提交**

```bash
git add "frontend/src/app/(dashboard)/cmdb/topology/"
git commit -m "feat: /cmdb/topology/[instanceId] - full-screen topology page with depth selector and node detail panel"
```

---

## Task 4: 实例详情页 — 内嵌拓扑预览面板

**Files:**
- Modify: `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/page.tsx`

- [ ] **Step 1: 读取现有文件，找到关联面板末尾**

读取文件，找到关联面板（`{/* Association Panel */}` 区块）的结束位置（即关联 `<Dialog>` 之前）。

- [ ] **Step 2: 添加拓扑预览区块**

在文件顶部 import 区添加：

```tsx
import Link from 'next/link'  // 已存在，跳过
import { CiTopologyGraph, TopologyNode, TopologyEdge } from '@/components/cmdb/CiTopologyGraph'
import { GitBranch } from 'lucide-react'
```

在关联面板结束标签（`{/* Add Relation Dialog */}` 之前）插入：

```tsx
      {/* Topology Preview Panel */}
      <div className="mt-4 border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
          onClick={() => setTopoPanelOpen(v => !v)}
        >
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            拓扑图
          </div>
          <div className="flex items-center gap-2">
            {topoPanelOpen && (
              <Link
                href={`/cmdb/topology/${id}`}
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={e => e.stopPropagation()}
              >
                全屏展开 →
              </Link>
            )}
            {topoPanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {topoPanelOpen && (
          <div className="border-t">
            {topoLoading ? (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">加载中...</div>
            ) : !topoData || topoData.nodes.length === 0 ? (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">暂无关联数据</div>
            ) : (
              <CiTopologyGraph
                nodes={topoData.nodes}
                edges={topoData.edges}
                rootId={Number(id)}
                preview={true}
              />
            )}
          </div>
        )}
      </div>
```

在组件 state 声明区（`relPanelOpen` 附近）添加：

```tsx
  const [topoPanelOpen, setTopoPanelOpen] = useState(false)
```

在 query 声明区（`relGroups` 附近）添加：

```tsx
  const { data: topoData, isLoading: topoLoading } = useQuery<{ nodes: TopologyNode[]; edges: TopologyEdge[] }>({
    queryKey: ['cmdb-topology', id],
    queryFn: () => api.get(`/cmdb/topology/${id}`, { params: { depth: 2 } }).then(r => r.data.data),
    enabled: topoPanelOpen,
  })
```

- [ ] **Step 3: TypeScript 检查**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -5
```

Expected: 0 errors

- [ ] **Step 4: 构建验证**

```bash
cd /Volumes/Work/AI/cwgsyw-platform && docker compose build frontend 2>&1 | tail -3
docker compose up -d frontend && sleep 15
/usr/bin/curl -s -o /dev/null -w "%{http_code}" http://localhost/cmdb/instances/host/2 && echo ""
```

Expected: `200`

- [ ] **Step 5: 提交**

```bash
git add "frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/page.tsx"
git commit -m "feat: instance detail page - embedded topology preview panel with full-screen link"
```

---

## Task 5: 模板管理页 — 新增 ci_selector 字段类型 + 用法说明

**Files:**
- Modify: `frontend/src/app/(dashboard)/admin/change-doc-templates/[id]/page.tsx`

- [ ] **Step 1: 读取现有文件**

读取 `frontend/src/app/(dashboard)/admin/change-doc-templates/[id]/page.tsx` 全文，找到：
- `const FIELD_TYPES` 数组（第 33 行）
- 字段类型 Select 的渲染区域（第 152-160 行区域）

- [ ] **Step 2: 添加 ci_selector 到 FIELD_TYPES**

将：
```tsx
const FIELD_TYPES = [
  { value: 'text',     label: '单行文本' },
  { value: 'textarea', label: '多行文本' },
  { value: 'date',     label: '日期' },
  { value: 'readonly', label: '只读（导出用）' },
]
```

改为：
```tsx
const FIELD_TYPES = [
  { value: 'text',        label: '单行文本' },
  { value: 'textarea',    label: '多行文本' },
  { value: 'date',        label: '日期' },
  { value: 'readonly',    label: '只读（导出用）' },
  { value: 'ci_selector', label: 'CI 选择器' },
]
```

- [ ] **Step 3: 添加 ci_selector 用法说明**

在字段类型 Select 之后（`</div>` 关闭该 grid-cols-2 col 之后），找到下一个 `<div className="space-y-1">` 区块（用于 required/in_form 等设置），在 Select 的父 div 内部（字段类型 select 下方）添加条件渲染的说明卡片：

找到字段类型 Select 的关闭标签后，添加：

```tsx
                {field.field_type === 'ci_selector' && (
                  <div className="col-span-2 mt-1 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <p className="font-semibold">CI 选择器用法说明</p>
                    <p>允许填写人在变更文档中搜索并选择受影响的 CI 实例。</p>
                    <ul className="list-disc list-inside space-y-0.5 text-blue-600/80 dark:text-blue-400/80">
                      <li>选中一个 CI 后，自动展示其 2 层关联 CI 作为候选建议</li>
                      <li>存储选中时的 CI 名称快照，CI 删除后仍可查看历史记录</li>
                      <li>变更文档详情页中以 CI 卡片列表呈现，可点击跳转 CMDB</li>
                    </ul>
                  </div>
                )}
```

**具体位置：** 在 `<div className="space-y-1">` 包裹 `field_type Select` 的那个 div 关闭后，仍在 `<div className="grid grid-cols-2 gap-2 flex-1 min-w-0">` 内部添加（`col-span-2` 使说明占满两列）。

- [ ] **Step 4: TypeScript 检查**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -5
```

Expected: 0 errors

- [ ] **Step 5: 提交**

```bash
git add "frontend/src/app/(dashboard)/admin/change-doc-templates/[id]/page.tsx"
git commit -m "feat: change doc template admin - add ci_selector field type with usage help card"
```

---

## Task 6: 变更文档创建页 — ci_selector 字段渲染器

**Files:**
- Modify: `frontend/src/app/(dashboard)/change-docs/new/page.tsx`

- [ ] **Step 1: 读取现有文件，理解结构**

读取 `frontend/src/app/(dashboard)/change-docs/new/page.tsx` 全文，找到：
- `renderField` 函数（第 98 行）
- `fieldsData` state 及其 setter
- 现有 import 列表

- [ ] **Step 2: 添加 ci_selector 相关 state 和 query**

在组件顶部 state 声明区（`fieldsData` 附近）添加：

```tsx
  // ci_selector 状态
  const [ciSelectorOpen, setCiSelectorOpen] = useState<string | null>(null)  // field_key of open selector
  const [ciSearch, setCiSearch] = useState('')
  const [ciSearchModel, setCiSearchModel] = useState('')  // modelId 过滤（可为空）
  const [ciTopoInstanceId, setCiTopoInstanceId] = useState<number | null>(null)
  const [selectedCis, setSelectedCis] = useState<Record<string, CiSnapshot[]>>({})  // field_key -> []
```

在 query/mutation 区添加：

```tsx
  interface CiSnapshot { id: number; name: string; model_name: string; model_id: string }

  const { data: ciSearchResult } = useQuery<{ records: { id: number; name: string; model_id: string; model_name: string }[] }>({
    queryKey: ['ci-selector-search', ciSearch],
    queryFn: () => api.get('/cmdb/instances/search', {
      params: { keyword: ciSearch, modelId: ciSearchModel, size: 10 }
    }).then(r => r.data.data),
    enabled: !!ciSelectorOpen && ciSearch.length >= 1,
  })

  const { data: ciTopoResult } = useQuery<{ nodes: { id: number; name: string; model_id: string; model_name: string; is_root: boolean }[] }>({
    queryKey: ['ci-selector-topo', ciTopoInstanceId],
    queryFn: () => api.get(`/cmdb/topology/${ciTopoInstanceId}`, { params: { depth: 2 } }).then(r => r.data.data),
    enabled: !!ciTopoInstanceId,
  })

  const toggleCiSelection = (fieldKey: string, ci: CiSnapshot) => {
    setSelectedCis(prev => {
      const current = prev[fieldKey] ?? []
      const exists = current.some(c => c.id === ci.id)
      const next = exists ? current.filter(c => c.id !== ci.id) : [...current, ci]
      // Persist to fieldsData as JSON string
      setFieldsData(fd => ({ ...fd, [fieldKey]: JSON.stringify(next) }))
      return { ...prev, [fieldKey]: next }
    })
  }
```

- [ ] **Step 3: 在 renderField 函数中添加 ci_selector 分支**

在 `renderField` 函数中，在 `f.field_type === 'textarea'` 条件的上方（或在最后的 else 之前）添加：

```tsx
    if (f.field_type === 'ci_selector') {
      const selected = selectedCis[f.field_key] ?? []
      return (
        <div key={f.field_key} className="space-y-1.5">
          <Label>{f.label}{f.required && <span className="text-destructive ml-1">*</span>}</Label>

          {/* 已选 CI 卡片 */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {selected.map(ci => (
                <div key={ci.id} className="flex items-center gap-1.5 border rounded-md px-2 py-1 text-xs bg-muted/30">
                  <span className="font-medium">{ci.name}</span>
                  <span className="text-muted-foreground">({ci.model_name})</span>
                  <button
                    onClick={() => toggleCiSelection(f.field_key, ci)}
                    className="text-muted-foreground hover:text-destructive ml-1"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {/* 搜索入口 */}
          {ciSelectorOpen === f.field_key ? (
            <div className="border rounded-lg p-3 space-y-2 bg-muted/10">
              <input
                autoFocus
                className="w-full border rounded px-3 py-1.5 text-sm bg-background"
                placeholder="搜索 CI 名称..."
                value={ciSearch}
                onChange={e => { setCiSearch(e.target.value); setCiTopoInstanceId(null) }}
              />

              {/* 搜索结果 */}
              {ciSearch.length >= 1 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {(ciSearchResult?.records ?? []).map(ci => (
                    <button
                      key={ci.id}
                      onClick={() => {
                        toggleCiSelection(f.field_key, { id: ci.id, name: ci.name, model_id: ci.model_id, model_name: ci.model_name })
                        setCiTopoInstanceId(ci.id)
                        setCiSearch('')
                      }}
                      className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded text-sm hover:bg-muted/50"
                    >
                      <span>{ci.name}</span>
                      <span className="text-xs text-muted-foreground">{ci.model_name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 关联建议 */}
              {ciTopoResult && ciTopoResult.nodes.filter(n => !n.is_root).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">关联 CI 建议（2层内）：</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {ciTopoResult.nodes.filter(n => !n.is_root).map(n => {
                      const isSelected = selected.some(c => c.id === n.id)
                      return (
                        <label key={n.id} className="flex items-center gap-2 px-2 py-1 rounded text-sm hover:bg-muted/50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCiSelection(f.field_key, { id: n.id, name: n.name, model_id: n.model_id ?? '', model_name: n.model_name ?? '' })}
                          />
                          <span>{n.name}</span>
                          <span className="text-xs text-muted-foreground">{n.model_name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              <button
                onClick={() => { setCiSelectorOpen(null); setCiSearch(''); setCiTopoInstanceId(null) }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                收起
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCiSelectorOpen(f.field_key)}
              className="w-full border rounded-md px-3 py-2 text-sm text-left text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              + 添加受影响的 CI
            </button>
          )}
        </div>
      )
    }
```

- [ ] **Step 4: TypeScript 检查**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: 0 errors

- [ ] **Step 5: 构建前端**

```bash
cd /Volumes/Work/AI/cwgsyw-platform && docker compose build frontend 2>&1 | tail -3
docker compose up -d frontend && sleep 15
```

- [ ] **Step 6: Smoke test**

```bash
for path in "cmdb/topology/2" "change-docs/new" "admin/change-doc-templates"; do
  code=$(/usr/bin/curl -s -o /dev/null -w "%{http_code}" "http://localhost/$path")
  echo "/$path → $code"
done
```

Expected: 全部 200

- [ ] **Step 7: 提交 + 打 tag**

```bash
git add "frontend/src/app/(dashboard)/change-docs/new/page.tsx"
git commit -m "feat: change doc form - ci_selector field renderer with topology-based CI suggestions"
git tag v0.12.0-cmdb-phase4
echo "CMDB Phase 4 complete"
```

---

## Self-Review

### Spec coverage

| 规格要求 | 任务 |
|---------|------|
| BFS 拓扑接口 `GET /api/cmdb/topology/{instanceId}?depth` | Task 1 |
| depth clamp 1-5 | Task 1 (service 第一行) |
| 边去重（双向关联不重复） | Task 1 (collectedRels Map) |
| 边 label 来自 kind.srcToDst | Task 1 |
| 节点 isRoot 标记 | Task 1 |
| React Flow + 自动布局 | Task 2 |
| preview 模式（禁止 pan/zoom） | Task 2 |
| 全屏拓扑页 `/cmdb/topology/[instanceId]` | Task 3 |
| 深度选择器 1/2/3 | Task 3 |
| 点击节点展示详情 + 访问实例链接 | Task 3 |
| 根节点高亮（金色边框） | Task 2 (CiNode) |
| 实例详情页内嵌预览（默认折叠） | Task 4 |
| "全屏展开 →" 链接 | Task 4 |
| 模板 admin 新增 ci_selector 类型 | Task 5 |
| ci_selector 用法说明卡片 | Task 5 |
| 变更文档表单 ci_selector 渲染 | Task 6 |
| 选 CI → 触发拓扑 API → 建议关联 CI | Task 6 |
| 存储 ID + 快照到 fieldsData | Task 6 (toggleCiSelection) |

### Placeholder scan

无 TBD/TODO。每个步骤均有完整代码。

### Type consistency

- `TopologyNode`（Task 2 定义）在 Task 3、4、6 中均以相同接口使用：`id, name, model_id, model_name, is_root`
- `CiTopologyResult` 在后端（Task 1）和前端 query 响应类型中字段名一致（SNAKE_CASE：`nodes, edges, is_root, src_id, dst_id`）
- `CiSnapshot`（Task 6）字段 `id, name, model_id, model_name` 与 `TopologyNode` 结构兼容
- `toggleCiSelection` 在 Task 6 中定义并调用，签名一致
