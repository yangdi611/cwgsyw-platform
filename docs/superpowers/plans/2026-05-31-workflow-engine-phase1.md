# 流程引擎/流程设计器 Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建可视化流程设计器和管理页面，支持 BPMN 2.0 流程定义的 CRUD 和拖拽设计

**Architecture:** 后端封装 Flowable RepositoryService 提供 RESTful CRUD API；前端使用 bpmn.js 实现可视化流程编辑器，提供流程定义列表页和设计页。与现有 Flowable 7.1.0 集成无缝对接。

**Tech Stack:** Backend: Spring Boot 3.4.5 + Flowable 7.1.0 RepositoryService; Frontend: Next.js 15 + bpmn.js + shadcn/ui + Tailwind v4; DB: Flowable ACT_RE_* tables (已有)

---

## 文件结构

```
backend/
├── src/main/java/com/cwgsyw/platform/module/workflow/
│   ├── WorkflowController.java          # 修改: 添加流程定义 CRUD 端点
│   ├── WorkflowService.java             # 修改: 添加流程定义 CRUD 方法
│   ├── dto/
│   │   ├── ProcessDefinitionVO.java     # 新建: 流程定义列表项
│   │   ├── SaveProcessDefinitionReq.java # 新建: 创建/更新请求
│   │   └── ProcessDefinitionDetailVO.java # 新建: 流程详情 (含 BPMN XML)
│   └── entity/                           # 无需新建, Flowable ACT_RE_* 表已存在

frontend/
├── src/
│   ├── app/(dashboard)/workflow/
│   │   ├── design/                       # 新建目录
│   │   │   ├── page.tsx                  # 流程设计页 /workflow/design/[id]
│   │   │   └── [id]/page.tsx            # 编辑已有流程
│   │   └── admin/                        # 新建目录
│   │       └── page.tsx                  # 流程定义管理页 /workflow/admin
│   ├── components/workflow/
│   │   ├── BpmnEditor.tsx               # 新建: bpmn.js 编辑器组件
│   │   └── ProcessDefinitionTable.tsx   # 新建: 流程定义列表表格
│   └── lib/
│       └── bpmn.ts                       # 新建: bpmn.js 工具函数

docs/superpowers/specs/
└── 2026-05-31-workflow-engine-phase1.md  # 设计规格
```

---

### Task 1: 后端 — 流程定义 CRUD API (WorkflowService)

**Files:**
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowService.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/workflow/dto/ProcessDefinitionVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/workflow/dto/SaveProcessDefinitionReq.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/workflow/dto/ProcessDefinitionDetailVO.java`

- [ ] **Step 1: 创建 ProcessDefinitionVO.java**

```java
package com.cwgsyw.platform.module.workflow.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ProcessDefinitionVO {
    private String id;            // ACT_RE_PROCDEF.ID_
    private String name;          // ACT_RE_PROCDEF.NAME_
    private String key;           // ACT_RE_PROCDEF.KEY_
    private int version;          // ACT_RE_PROCDEF.VERSION_
    private String description;   // ACT_RE_PROCDEF.DESCRIPTION_ (custom — see builder notes)
    private String category;      // ACT_RE_PROCDEF.CATEGORY_
    private String deploymentId;  // ACT_RE_PROCDEF.DEPLOYMENT_ID_
    private LocalDateTime deploymentTime; // ACT_RE_DEPLOYMENT.DEPLOY_TIME_
    private boolean suspended;    // ACT_RE_PROCDEF.SUSPENSION_STATE_
    private String tenantId;      // ACT_RE_PROCDEF.TENANT_ID_
}
```

- [ ] **Step 2: 创建 SaveProcessDefinitionReq.java**

```java
package com.cwgsyw.platform.module.workflow.dto;

import lombok.Data;

@Data
public class SaveProcessDefinitionReq {
    private String name;         // 流程名称
    private String key;          // 流程唯一标识 (如 "changeDocApproval")
    private String description;  // 流程描述
    private String category;     // 分类
    private String xml;          // BPMN 2.0 XML 内容
}
```

- [ ] **Step 3: 创建 ProcessDefinitionDetailVO.java**

```java
package com.cwgsyw.platform.module.workflow.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ProcessDefinitionDetailVO {
    private String id;
    private String name;
    private String key;
    private int version;
    private String description;
    private String category;
    private String deploymentId;
    private LocalDateTime deploymentTime;
    private boolean suspended;
    private String tenantId;
    private String xml;           // BPMN 2.0 XML (from ACT_GE_BYTEARRAY)
}
```

- [ ] **Step 4: 扩展 WorkflowService — 添加 RepositoryService 注入和 CRUD 方法**

在 `WorkflowService.java` 中添加注入:

```java
private final RepositoryService repositoryService;
```

`@RequiredArgsConstructor` 会自动生成构造函数。

添加以下方法到 `WorkflowService.java`:

```java
// 导入添加:
// import org.flowable.engine.repository.Deployment;
// import org.flowable.engine.repository.ProcessDefinition;
// import com.cwgsyw.platform.common.PageResult;
// import java.nio.charset.StandardCharsets;
// import java.util.Base64;
// import com.cwgsyw.platform.module.workflow.dto.*;
// import org.flowable.engine.repository.DeploymentBuilder;

/**
 * 列出所有流程定义（最新版本）
 */
public PageResult<ProcessDefinitionVO> listDefinitions(int page, int size) {
    var query = repositoryService.createProcessDefinitionQuery()
        .latestVersion()
        .orderByProcessDefinitionName().asc();
    
    long total = query.count();
    var definitions = query.listPage((page - 1) * size, size);
    
    List<ProcessDefinitionVO> vos = definitions.stream().map(def -> {
        var vo = new ProcessDefinitionVO();
        vo.setId(def.getId());
        vo.setName(def.getName());
        vo.setKey(def.getKey());
        vo.setVersion(def.getVersion());
        vo.setDescription(def.getDescription());
        vo.setCategory(def.getCategory());
        vo.setDeploymentId(def.getDeploymentId());
        vo.setSuspended(def.isSuspended());
        vo.setTenantId(def.getTenantId());
        return vo;
    }).toList();
    
    return new PageResult<>(vos, total, page, size);
}

/**
 * 获取单个流程定义详情（含 BPMN XML）
 */
public ProcessDefinitionDetailVO getDefinition(String definitionId) {
    var def = repositoryService.createProcessDefinitionQuery()
        .processDefinitionId(definitionId).singleResult();
    if (def == null) throw new IllegalArgumentException("流程定义不存在: " + definitionId);
    
    // 获取 BPMN XML
    var bis = repositoryService.getProcessModel(definitionId);
    String xml = new String(bis.readAllBytes(), StandardCharsets.UTF_8);
    
    var vo = new ProcessDefinitionDetailVO();
    vo.setId(def.getId());
    vo.setName(def.getName());
    vo.setKey(def.getKey());
    vo.setVersion(def.getVersion());
    vo.setDescription(def.getDescription());
    vo.setCategory(def.getCategory());
    vo.setDeploymentId(def.getDeploymentId());
    vo.setSuspended(def.isSuspended());
    vo.setTenantId(def.getTenantId());
    vo.setXml(xml);
    return vo;
}

/**
 * 创建/部署新的流程定义
 */
@Transactional
public ProcessDefinitionVO createDefinition(SaveProcessDefinitionReq req, String tenantId) {
    // 检查 key 是否已存在
    long existingCount = repositoryService.createProcessDefinitionQuery()
        .processDefinitionKey(req.getKey()).count();
    if (existingCount > 0) {
        throw new IllegalArgumentException("流程 Key 已存在: " + req.getKey());
    }
    
    String resourceName = req.getKey() + ".bpmn20.xml";
    
    DeploymentBuilder builder = repositoryService.createDeployment()
        .name(req.getName())
        .key(req.getKey())
        .category(req.getCategory())
        .tenantId(tenantId)
        .addString(resourceName, req.getXml());
    
    Deployment deployment = builder.deploy();
    
    var def = repositoryService.createProcessDefinitionQuery()
        .deploymentId(deployment.getId()).singleResult();
    
    var vo = new ProcessDefinitionVO();
    vo.setId(def.getId());
    vo.setName(def.getName());
    vo.setKey(def.getKey());
    vo.setVersion(def.getVersion());
    vo.setDescription(req.getDescription());
    vo.setCategory(def.getCategory());
    vo.setDeploymentId(deployment.getId());
    vo.setDeploymentTime(deployment.getDeploymentTime());
    vo.setSuspended(false);
    vo.setTenantId(tenantId);
    return vo;
}

/**
 * 更新流程定义（新版本部署 + 旧版本挂起）
 */
@Transactional
public ProcessDefinitionVO updateDefinition(String definitionId, SaveProcessDefinitionReq req, String tenantId) {
    var oldDef = repositoryService.createProcessDefinitionQuery()
        .processDefinitionId(definitionId).singleResult();
    if (oldDef == null) throw new IllegalArgumentException("流程定义不存在: " + definitionId);
    
    // 挂起旧版本
    repositoryService.suspendProcessDefinitionById(definitionId, true, null);
    
    // 部署新版本（使用相同的 key）
    String resourceName = req.getKey() + ".bpmn20.xml";
    Deployment deployment = repositoryService.createDeployment()
        .name(req.getName())
        .key(req.getKey())
        .category(req.getCategory())
        .tenantId(tenantId)
        .addString(resourceName, req.getXml())
        .deploy();
    
    var newDef = repositoryService.createProcessDefinitionQuery()
        .deploymentId(deployment.getId()).singleResult();
    
    var vo = new ProcessDefinitionVO();
    vo.setId(newDef.getId());
    vo.setName(newDef.getName());
    vo.setKey(newDef.getKey());
    vo.setVersion(newDef.getVersion());
    vo.setDescription(req.getDescription());
    vo.setCategory(newDef.getCategory());
    vo.setDeploymentId(deployment.getId());
    vo.setDeploymentTime(deployment.getDeploymentTime());
    vo.setSuspended(false);
    vo.setTenantId(tenantId);
    return vo;
}

/**
 * 删除流程定义及所有版本
 */
@Transactional
public void deleteDefinition(String definitionId) {
    var def = repositoryService.createProcessDefinitionQuery()
        .processDefinitionId(definitionId).singleResult();
    if (def == null) throw new IllegalArgumentException("流程定义不存在: " + definitionId);
    
    // Flowable cascade delete: 删除所有版本 + 运行时数据
    repositoryService.deleteDeployment(def.getDeploymentId(), true);
}

/**
 * 获取某 key 的所有历史版本
 */
public List<ProcessDefinitionVO> getDefinitionVersions(String key) {
    return repositoryService.createProcessDefinitionQuery()
        .processDefinitionKey(key)
        .orderByProcessDefinitionVersion().desc()
        .list().stream().map(def -> {
            var vo = new ProcessDefinitionVO();
            vo.setId(def.getId());
            vo.setName(def.getName());
            vo.setKey(def.getKey());
            vo.setVersion(def.getVersion());
            vo.setDescription(def.getDescription());
            vo.setCategory(def.getCategory());
            vo.setDeploymentId(def.getDeploymentId());
            vo.setSuspended(def.isSuspended());
            vo.setTenantId(def.getTenantId());
            return vo;
        }).toList();
}
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/workflow/
git commit -m "feat(workflow): add process definition CRUD service and DTOs"
```

---

### Task 2: 后端 — WorkflowController 流程定义端点

**Files:**
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowController.java`

- [ ] **Step 1: 添加流程定义 CRUD 端点**

将以下方法添加到 `WorkflowController.java` 中（现有方法保持不变）:

```java
// 新增 imports:
// import com.cwgsyw.platform.common.PageResult;
// import com.cwgsyw.platform.common.AuditLogMapper;
// import com.cwgsyw.platform.common.entity.AuditLog;
// import com.cwgsyw.platform.module.workflow.dto.*;

private final AuditLogMapper auditLogMapper;  // 新增字段 (与现有的共同注入, @RequiredArgsConstructor 自动处理)

/**
 * 流程定义列表
 */
@GetMapping("/definitions")
@PreAuthorize("hasPermission('workflow', 'configure')")
public R<PageResult<ProcessDefinitionVO>> listDefinitions(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size) {
    return R.ok(workflowService.listDefinitions(page, size));
}

/**
 * 流程定义详情（含 BPMN XML）
 */
@GetMapping("/definitions/{definitionId}")
@PreAuthorize("hasPermission('workflow', 'configure')")
public R<ProcessDefinitionDetailVO> getDefinition(@PathVariable String definitionId) {
    return R.ok(workflowService.getDefinition(definitionId));
}

/**
 * 创建/部署流程定义
 */
@PostMapping("/definitions")
@PreAuthorize("hasPermission('workflow', 'configure')")
public R<ProcessDefinitionVO> createDefinition(
        @RequestBody SaveProcessDefinitionReq req,
        @AuthenticationPrincipal SecurityUser cu) {
    ProcessDefinitionVO vo = workflowService.createDefinition(req, cu.getTenantId());
    auditLogMapper.insert(AuditLog.builder()
        .tenantId(cu.getTenantId())
        .module("workflow")
        .action("create_definition")
        .targetId(vo.getId())
        .targetType("process_definition")
        .operatorId(cu.getUserId())
        .afterJson("{\"key\":\"" + vo.getKey() + "\",\"name\":\"" + vo.getName() + "\"}")
        .remark("部署流程定义: " + vo.getName())
        .build());
    return R.ok(vo);
}

/**
 * 更新流程定义（新版本）
 */
@PutMapping("/definitions/{definitionId}")
@PreAuthorize("hasPermission('workflow', 'configure')")
public R<ProcessDefinitionVO> updateDefinition(
        @PathVariable String definitionId,
        @RequestBody SaveProcessDefinitionReq req,
        @AuthenticationPrincipal SecurityUser cu) {
    ProcessDefinitionVO vo = workflowService.updateDefinition(definitionId, req, cu.getTenantId());
    auditLogMapper.insert(AuditLog.builder()
        .tenantId(cu.getTenantId())
        .module("workflow")
        .action("update_definition")
        .targetId(definitionId)
        .targetType("process_definition")
        .operatorId(cu.getUserId())
        .afterJson("{\"key\":\"" + vo.getKey() + "\",\"version\":" + vo.getVersion() + "}")
        .remark("更新流程定义: " + vo.getName() + " v" + vo.getVersion())
        .build());
    return R.ok(vo);
}

/**
 * 删除流程定义（所有版本）
 */
@DeleteMapping("/definitions/{definitionId}")
@PreAuthorize("hasPermission('workflow', 'configure')")
public R<Void> deleteDefinition(
        @PathVariable String definitionId,
        @AuthenticationPrincipal SecurityUser cu) {
    var def = workflowService.getDefinition(definitionId);
    workflowService.deleteDefinition(definitionId);
    auditLogMapper.insert(AuditLog.builder()
        .tenantId(cu.getTenantId())
        .module("workflow")
        .action("delete_definition")
        .targetId(definitionId)
        .targetType("process_definition")
        .operatorId(cu.getUserId())
        .beforeJson("{\"key\":\"" + def.getKey() + "\",\"name\":\"" + def.getName() + "\"}")
        .remark("删除流程定义: " + def.getName())
        .build());
    return R.ok();
}
```

- [ ] **Step 2: 构建验证**

```bash
docker compose build backend 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowController.java
git commit -m "feat(workflow): add process definition CRUD REST endpoints"
```

---

### Task 3: 数据库 — RBAC 权限种子数据

**Files:**
- Create: `backend/src/main/resources/db/migration/V19__workflow_engine_permissions.sql`

- [ ] **Step 1: 创建 Flyway 迁移**

```sql
-- V19: 流程引擎管理权限

-- 资源已存在 (workflow)，但补充 description
UPDATE sys_resource SET description = '流程引擎 — 流程定义和审批管理'
WHERE code = 'workflow';

-- 确保 super_admin 拥有 workflow:configure
INSERT INTO sys_permission (tenant_id, resource_id, action, description, created_at, updated_at)
SELECT 'default', r.id, 'configure', '流程定义管理（CRUD 部署）', NOW(), NOW()
FROM sys_resource r
WHERE r.code = 'workflow'
  AND NOT EXISTS (
    SELECT 1 FROM sys_permission p
    WHERE p.resource_id = r.id AND p.action = 'configure'
  );

-- 赋权: super_admin, admin 拥有 workflow:configure
INSERT INTO sys_role_permission (tenant_id, role_id, permission_id, created_at, updated_at)
SELECT 'default', sr.id, sp.id, NOW(), NOW()
FROM sys_role sr
CROSS JOIN sys_permission sp
JOIN sys_resource r ON sp.resource_id = r.id
WHERE sr.code IN ('super_admin', 'admin')
  AND r.code = 'workflow' AND sp.action = 'configure'
  AND NOT EXISTS (
    SELECT 1 FROM sys_role_permission rp
    WHERE rp.role_id = sr.id AND rp.permission_id = sp.id
  );
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/main/resources/db/migration/V19__workflow_engine_permissions.sql
git commit -m "feat(workflow): add workflow:configure permission seed data"
```

---

### Task 4: 前端 — bpmn.js 编辑器组件 (BpmnEditor)

**Files:**
- Create: `frontend/src/components/workflow/BpmnEditor.tsx`
- Create: `frontend/src/lib/bpmn.ts`

- [ ] **Step 1: 安装 bpmn.js 依赖**

```bash
cd frontend && npm install bpmn-js@18 bpmn-js-properties-panel@5 2>&1
```

- [ ] **Step 2: 创建 `frontend/src/lib/bpmn.ts`**

```typescript
// bpmn.js 工具函数

/** 空 BPMN 模板 */
export const EMPTY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:flowable="http://flowable.org/bpmn"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" name="新流程" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="开始" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1" />
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/** 提取 BPMN XML 中的 process id */
export function extractProcessId(xml: string): string {
  const match = xml.match(/<bpmn:process[^>]*id="([^"]*)"/);
  return match?.[1] ?? 'Process_1';
}

/** 提取 BPMN XML 中的 process name */
export function extractProcessName(xml: string): string {
  const match = xml.match(/<bpmn:process[^>]*name="([^"]*)"/);
  return match?.[1] ?? '未命名流程';
}
```

- [ ] **Step 3: 创建 `frontend/src/components/workflow/BpmnEditor.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import { EMPTY_BPMN } from '@/lib/bpmn';

interface BpmnEditorProps {
  /** 初始 BPMN XML, undefined 则用空模板 */
  initialXml?: string;
  /** 编辑器内容变化回调 */
  onChange?: (xml: string) => void;
  /** 是否只读 */
  readOnly?: boolean;
}

export default function BpmnEditor({ initialXml, onChange, readOnly = false }: BpmnEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || modelerRef.current) return;

    const modeler = new BpmnModeler({
      container: containerRef.current,
      keyboard: { bindTo: document },
    });

    modeler.on('import.done', () => {
      setReady(true);
      const canvas = modeler.get('canvas') as any;
      canvas.zoom('fit-viewport');
    });

    modeler.on('commandStack.changed', async () => {
      try {
        const { xml } = await modeler.saveXML({ format: true });
        onChange?.(xml ?? '');
      } catch {
        // ignore save errors during editing
      }
    });

    modelerRef.current = modeler;

    // 导入初始 XML
    const xml = initialXml || EMPTY_BPMN;
    modeler.importXML(xml).catch(() => {
      modeler.importXML(EMPTY_BPMN);
    });

    return () => {
      modeler.destroy();
      modelerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 当 initialXml 变化时重新导入
  useEffect(() => {
    if (!modelerRef.current || !initialXml) return;
    modelerRef.current.importXML(initialXml);
    const canvas = modelerRef.current.get('canvas') as any;
    canvas.zoom('fit-viewport');
  }, [initialXml]);

  return (
    <div className="relative w-full h-full min-h-[500px] border rounded-lg bg-white">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <span className="text-muted-foreground">加载编辑器中...</span>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full min-h-[500px]" />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/workflow/ frontend/src/lib/bpmn.ts frontend/package.json frontend/package-lock.json
git commit -m "feat(workflow): add bpmn.js editor component and empty template"
```

---

### Task 5: 前端 — 流程设计页 (Workflow Design Page)

**Files:**
- Create: `frontend/src/app/(dashboard)/workflow/design/page.tsx` (新建流程)
- Create: `frontend/src/app/(dashboard)/workflow/design/[id]/page.tsx` (编辑已有流程)

- [ ] **Step 1: 创建新建流程页 `frontend/src/app/(dashboard)/workflow/design/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// bpmn.js 需要浏览器 API, 动态导入禁用 SSR
const BpmnEditor = dynamic(() => import('@/components/workflow/BpmnEditor'), {
  ssr: false,
  loading: () => <div className="h-[500px] border rounded-lg bg-muted/20 flex items-center justify-center text-muted-foreground">加载编辑器...</div>,
});

export default function NewWorkflowDesignPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [xml, setXml] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !key) {
      toast.error('请填写流程名称和 Key');
      return;
    }
    if (!xml) {
      toast.error('请设计流程画布内容');
      return;
    }
    setSaving(true);
    try {
      await api.post('/workflow/definitions', {
        name,
        key,
        category,
        description,
        xml,
      });
      toast.success('流程定义已保存');
      router.push('/workflow/admin');
    } catch (err: any) {
      toast.error(err.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">设计新流程</h1>
      <p className="text-sm text-muted-foreground mb-6">
        使用可视化编辑器设计 BPMN 2.0 流程，支持拖拽节点和连线
      </p>

      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="space-y-2">
          <Label htmlFor="flowName">流程名称 *</Label>
          <Input id="flowName" value={name} onChange={e => setName(e.target.value)} placeholder="如: 变更审批流" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="flowKey">流程 Key *</Label>
          <Input id="flowKey" value={key} onChange={e => setKey(e.target.value)} placeholder="如: changeDocApproval" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">分类</Label>
          <Input id="category" value={category} onChange={e => setCategory(e.target.value)} placeholder="如: 审批流程" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">描述</Label>
          <Input id="desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="流程用途说明" />
        </div>
      </div>

      <div className="mb-4">
        <BpmnEditor onChange={setXml} />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? '部署中...' : '保存并部署'}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>取消</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建编辑已有流程页 `frontend/src/app/(dashboard)/workflow/design/[id]/page.tsx`**

```tsx
'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const BpmnEditor = dynamic(() => import('@/components/workflow/BpmnEditor'), {
  ssr: false,
  loading: () => <div className="h-[500px] border rounded-lg bg-muted/20 flex items-center justify-center text-muted-foreground">加载编辑器...</div>,
});

interface DefDetail {
  id: string; name: string; key: string; category: string; description: string; version: number; xml: string;
}

export default function EditWorkflowDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<DefDetail | null>(null);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [xml, setXml] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/workflow/definitions/${id}`).then(r => {
      const d: DefDetail = r.data.data;
      setDetail(d);
      setName(d.name);
      setKey(d.key);
      setCategory(d.category || '');
      setDescription(d.description || '');
      setXml(d.xml);
      setLoading(false);
    }).catch(() => {
      toast.error('获取流程定义失败');
      router.push('/workflow/admin');
    });
  }, [id, router]);

  const handleSave = async () => {
    if (!name || !key) { toast.error('请填写流程名称和 Key'); return; }
    if (!xml) { toast.error('流程画布不能为空'); return; }
    setSaving(true);
    try {
      await api.put(`/workflow/definitions/${id}`, { name, key, category, description, xml });
      toast.success(`流程定义已更新 (v${(detail?.version ?? 0) + 1})`);
      router.push('/workflow/admin');
    } catch (err: any) {
      toast.error(err.response?.data?.message || '更新失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">加载中...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">编辑流程: {name}</h1>
      <p className="text-sm text-muted-foreground mb-6">当前版本: v{detail?.version} | 修改后将创建新版本</p>

      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="space-y-2">
          <Label htmlFor="flowName">流程名称 *</Label>
          <Input id="flowName" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="flowKey">流程 Key</Label>
          <Input id="flowKey" value={key} disabled />
          <p className="text-xs text-muted-foreground">Key 不可修改</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">分类</Label>
          <Input id="category" value={category} onChange={e => setCategory(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">描述</Label>
          <Input id="desc" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
      </div>

      <div className="mb-4">
        <BpmnEditor initialXml={xml} onChange={setXml} />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? '部署中...' : '保存新版本'}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>取消</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/\(dashboard\)/workflow/design/
git commit -m "feat(workflow): add process design pages (create + edit)"
```

---

### Task 6: 前端 — 流程定义管理页 (Workflow Admin)

**Files:**
- Create: `frontend/src/app/(dashboard)/workflow/admin/page.tsx`
- Modify: `frontend/src/app/(dashboard)/layout.tsx` (sidebar link)

- [ ] **Step 1: 创建管理页 `frontend/src/app/(dashboard)/workflow/admin/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import Link from 'next/link';

interface ProcessDef {
  id: string; name: string; key: string; version: number;
  description: string; category: string; suspended: boolean;
  deployment_time: string;
}

export default function WorkflowAdminPage() {
  const router = useRouter();
  const { hasPermission } = usePermission();
  const canConfigure = hasPermission('workflow', 'configure');
  const [deleteTarget, setDeleteTarget] = useState<ProcessDef | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['process-definitions', page],
    queryFn: () => api.get('/workflow/definitions', { params: { page, size: 20 } }).then(r => ({
      records: (r.data.data?.records ?? []) as ProcessDef[],
      total: r.data.data?.total ?? 0,
    })),
  });

  const definitions = data?.records ?? [];
  const totalPages = data?.total ? Math.ceil(data.total / 20) : 0;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/workflow/definitions/${deleteTarget.id}`);
      toast.success(`流程 "${deleteTarget.name}" 已删除`);
      setDeleteTarget(null);
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '删除失败');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">流程管理</h1>
          <p className="text-sm text-muted-foreground">管理 BPMN 流程定义，创建和编辑审批流程</p>
        </div>
        {canConfigure && (
          <Link href="/workflow/design" className={/* Button variant link styles */ undefined}>
            <Button>+ 新建流程</Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : definitions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg mb-2">暂无流程定义</p>
          <p className="text-sm text-muted-foreground mb-4">
            创建第一个 BPMN 流程定义来开始使用流程引擎
          </p>
          {canConfigure && (
            <Link href="/workflow/design">
              <Button>+ 新建流程</Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 text-sm font-medium">流程名称</th>
                  <th className="text-left p-3 text-sm font-medium">Key</th>
                  <th className="text-left p-3 text-sm font-medium">版本</th>
                  <th className="text-left p-3 text-sm font-medium">分类</th>
                  <th className="text-left p-3 text-sm font-medium">状态</th>
                  {canConfigure && (
                    <th className="text-right p-3 text-sm font-medium">操作</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {definitions.map((def) => (
                  <tr key={def.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 text-sm font-medium">{def.name}</td>
                    <td className="p-3 text-sm text-muted-foreground font-mono">{def.key}</td>
                    <td className="p-3 text-sm">v{def.version}</td>
                    <td className="p-3 text-sm">{def.category || '-'}</td>
                    <td className="p-3">
                      <Badge variant={def.suspended ? 'destructive' : 'default'}>
                        {def.suspended ? '已挂起' : '启用'}
                      </Badge>
                    </td>
                    {canConfigure && (
                      <td className="p-3 text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => router.push(`/workflow/design/${def.id}`)}>
                          编辑
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteTarget(def)}>
                          删除
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>共 {data?.total ?? 0} 条</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
                <span className="px-3 py-1">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除流程 <strong>{deleteTarget?.name}</strong> (v{deleteTarget?.version}) 吗？
            此操作不可撤销，将删除所有关联的运行时数据和历史记录。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: 添加侧边栏导航入口**

在 `frontend/src/app/(dashboard)/layout.tsx` 的 Sidebar 中，在 `workflow/tasks` 附近添加:

```tsx
{ href: '/workflow/admin', label: '流程管理', icon: GitBranch, resource: 'workflow', action: 'configure' },
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/\(dashboard\)/workflow/admin/ frontend/src/app/\(dashboard\)/layout.tsx
git commit -m "feat(workflow): add process definition admin page and sidebar link"
```

---

### Task 7: 构建验证 & 端到端测试

- [ ] **Step 1: 构建后端**

```bash
docker compose build backend 2>&1 | tail -10
# Expected: Successfully built
```

- [ ] **Step 2: 验证后端编译**

```bash
docker compose up -d backend
docker compose logs backend --tail=20 | grep "Started\|ERROR"
# Expected: Started PlatformApplication, no ERROR
```

- [ ] **Step 3: API 测试**

```bash
TOKEN=$(curl -s http://localhost:8080/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"superadmin","password":"Admin@123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# 1. 列出所有流程定义
curl -s http://localhost:8080/api/workflow/definitions \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json; d=json.load(sys.stdin)
print(f'code: {d[\"code\"]}, total: {d[\"data\"][\"total\"]}')
for r in d['data']['records'][:3]:
  print(f'  {r[\"name\"]} (key={r[\"key\"]}) v{r[\"version\"]}')
"
# Expected: at least 1 (dailyReportApproval), code=200

# 2. 获取流程详情
PROC_DEF_ID=$(curl -s http://localhost:8080/api/workflow/definitions \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['records'][0]['id'])")
curl -s "http://localhost:8080/api/workflow/definitions/${PROC_DEF_ID}" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json; d=json.load(sys.stdin)['data']
print(f'name={d[\"name\"]}, key={d[\"key\"]}, xml_length={len(d.get(\"xml\",\"\"))}')
"
# Expected: xml_length > 0
```

- [ ] **Step 4: 构建前端**

```bash
docker compose build frontend 2>&1 | tail -5
# Expected: Successfully built
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(workflow): process definition engine Phase 1 complete" --allow-empty
```

---

## 自检清单

**1. 规格覆盖:**
- ✅ 流程模板列表和 CRUD → Tasks 1-2 (后端) + Task 6 (前端)
- ✅ 基于 bpmn.js 的可视化编辑器 → Tasks 4-5
- ✅ 支持开始/审批/条件分支/结束节点 → bpmn.js 默认支持
- ✅ 保存为 BPMN 2.0 XML → Flowable DeploymentService
- ✅ RBAC 权限 → Task 3 (V19 migration)
- ✅ 审计日志 → Task 2 (所有写操作)
- ✅ 与现有 Flowable 集成无缝对接 → 复用 RepositoryService

**2. 无需 Touch:**
- 现有 WorkflowService 的 `startDailyReportApproval` / `approve` / `getPendingTasks*` 方法保持不变
- 现有流程审批端点 (`/api/workflow/tasks/*`, `/api/workflow/approve`) 保持不变
- 现有 BPMN 文件 `daily-report-approval.bpmn20.xml` 不受影响

**3. 类型一致性:**
- `ProcessDefinitionVO` 字段与 API 响应一致 (snake_case → 前端)
- `SaveProcessDefinitionReq` 字段与前端请求体一致
- `ProcessDefinitionDetailVO` 扩展了 `ProcessDefinitionVO`
