# 流程引擎 Phase 2 — 运行时 + 通用审批 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** 让 Phase 1 设计的流程真正跑起来——通用启动、实例管理、任务处理、历史追踪

**Architecture:** 后端新增通用启动端点 + 历史查询；前端新增实例管理页 + 通用审批面板 + 流程高亮查看器

**Tech Stack:** 同 Phase 1 — Flowable 7.1 RuntimeService / HistoryService + bpmn.js Viewer

---

## 文件结构 (增量)

```
backend/src/main/java/com/cwgsyw/platform/module/workflow/
├── WorkflowService.java          # 修改: +通用启动, +历史查询, +实例管理
├── WorkflowController.java       # 修改: +实例端点, +历史端点
├── dto/
│   ├── StartProcessRequest.java  # 新建
│   ├── InstanceVO.java           # 新建
│   └── TaskVO.java               # 修改: +process_name
frontend/src/
├── app/(dashboard)/workflow/
│   ├── admin/page.tsx            # 修改: +实例列表Tab
│   ├── tasks/page.tsx            # 修改: 通用审批(不硬编码daily_report)
│   └── instances/                # 新建
│       └── page.tsx              # 运行中的实例列表
├── components/workflow/
│   └── BpmnViewer.tsx            # 新建: 只读查看器(流程图高亮)
```

---

### Task 1: 后端 — 通用流程启动 + 实例管理

**Files:** WorkflowService.java + StartProcessRequest + InstanceVO

- [ ] **Step 1: 创建 `StartProcessRequest.java`**

```java
package com.cwgsyw.platform.module.workflow.dto;
import lombok.Data;
import java.util.Map;

@Data
public class StartProcessRequest {
    private String processDefinitionKey;  // 流程定义 key
    private String businessKey;           // 业务标识 (如 "changeDoc:123")
    private Map<String, Object> variables; // 流程变量
}
```

- [ ] **Step 2: 创建 `InstanceVO.java`**

```java
package com.cwgsyw.platform.module.workflow.dto;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
public class InstanceVO {
    private String id;
    private String processDefinitionId;
    private String processDefinitionName;
    private String processDefinitionKey;
    private String businessKey;
    private String startUserId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private boolean ended;
    private boolean suspended;
    private Map<String, Object> variables;
}
```

- [ ] **Step 3: WorkflowService 新增方法**

```java
// 注入 HistoryService + ProcessInstance
private final org.flowable.engine.HistoryService historyService;

// === 通用流程启动 ===
@Transactional
public InstanceVO startProcess(StartProcessRequest req, Long userId, String tenantId) {
    ProcessInstance pi = runtimeService.startProcessInstanceByKey(
        req.getProcessDefinitionKey(),
        req.getBusinessKey(),
        req.getVariables() != null ? req.getVariables() : Map.of());
    return toInstanceVO(pi);
}

// === 运行中的实例列表 ===
public PageResult<InstanceVO> listRunningInstances(String key, int page, int size) {
    var query = runtimeService.createProcessInstanceQuery();
    if (key != null && !key.isEmpty()) query.processDefinitionKey(key);
    query.orderByStartTime().desc();
    long total = query.count();
    var pis = query.listPage((page - 1) * size, size);
    return new PageResult<>(
        pis.stream().map(this::toInstanceVO).toList(), total, page, size);
}

// === 挂起/激活实例 ===
@Transactional
public void suspendInstance(String instanceId) {
    runtimeService.suspendProcessInstanceById(instanceId);
}
@Transactional
public void activateInstance(String instanceId) {
    runtimeService.activateProcessInstanceById(instanceId);
}

// === 终止实例 ===
@Transactional
public void deleteInstance(String instanceId, String reason) {
    runtimeService.deleteProcessInstance(instanceId, reason);
}

// === 已完成实例列表 ===
public PageResult<InstanceVO> listFinishedInstances(String key, int page, int size) {
    var query = historyService.createHistoricProcessInstanceQuery().finished();
    if (key != null && !key.isEmpty()) query.processDefinitionKey(key);
    query.orderByProcessInstanceEndTime().desc();
    long total = query.count();
    var pis = query.listPage((page - 1) * size, size);
    return new PageResult<>(
        pis.stream().map(hpi -> {
            var vo = new InstanceVO();
            vo.setId(hpi.getId()); vo.setBusinessKey(hpi.getBusinessKey());
            vo.setStartTime(dateToLocal(hpi.getStartTime()));
            vo.setEndTime(dateToLocal(hpi.getEndTime())); vo.setEnded(true);
            return vo;
        }).toList(), total, page, size);
}

// === 历史活动 (用于流程图高亮) ===
public List<Map<String, Object>> getHistoricActivities(String instanceId) {
    return historyService.createHistoricActivityInstanceQuery()
        .processInstanceId(instanceId).orderByHistoricActivityInstanceStartTime().asc()
        .list().stream().map(a -> Map.<String,Object>of(
            "activityId", a.getActivityId(), "activityName", a.getActivityName(),
            "activityType", a.getActivityType(), "startTime", dateToLocal(a.getStartTime()),
            "endTime", dateToLocal(a.getEndTime()), "assignee", a.getAssignee() != null ? a.getAssignee() : ""
        )).toList();
}

// 辅助
private InstanceVO toInstanceVO(ProcessInstance pi) {
    var vo = new InstanceVO(); vo.setId(pi.getId()); vo.setBusinessKey(pi.getBusinessKey());
    vo.setProcessDefinitionId(pi.getProcessDefinitionId());
    vo.setProcessDefinitionKey(pi.getProcessDefinitionKey());
    vo.setProcessDefinitionName(pi.getProcessDefinitionName());
    vo.setStartTime(dateToLocal(pi.getStartTime())); vo.setEnded(pi.isEnded());
    vo.setSuspended(pi.isSuspended());
    return vo;
}
private LocalDateTime dateToLocal(java.util.Date d) {
    return d != null ? d.toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDateTime() : null;
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/workflow/
git commit -m "feat(workflow): add generic process start, instance management, and history queries"
```

---

### Task 2: 后端 — WorkflowController 新端点

**Files:** WorkflowController.java

新增端点 (在现有 definitions 端点之后):

```java
// POST /api/workflow/instances — 启动流程
@PostMapping("/instances")
@PreAuthorize("hasPermission('workflow', 'read')")
public R<InstanceVO> startProcess(@RequestBody StartProcessRequest req,
                                   @AuthenticationPrincipal SecurityUser cu) {
    InstanceVO vo = workflowService.startProcess(req, cu.getUserId(), cu.getTenantId());
    auditLogMapper.insert(AuditLog.builder()
        .tenantId(cu.getTenantId()).module("workflow").action("start_process")
        .targetId(0L).targetType("process_instance")
        .operatorId(cu.getUserId())
        .afterJson("{\"instanceId\":\"" + vo.getId() + "\",\"key\":\"" + req.getProcessDefinitionKey() + "\"}")
        .remark("启动流程: " + req.getProcessDefinitionKey())
        .build());
    return R.ok(vo);
}

// GET /api/workflow/instances/running — 运行中实例
@GetMapping("/instances/running")
@PreAuthorize("hasPermission('workflow', 'read')")
public R<PageResult<InstanceVO>> runningInstances(
        @RequestParam(required = false) String key,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size) {
    return R.ok(workflowService.listRunningInstances(key, page, size));
}

// GET /api/workflow/instances/finished — 已完成实例
@GetMapping("/instances/finished")
@PreAuthorize("hasPermission('workflow', 'read')")
public R<PageResult<InstanceVO>> finishedInstances(
        @RequestParam(required = false) String key,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size) {
    return R.ok(workflowService.listFinishedInstances(key, page, size));
}

// PUT /api/workflow/instances/{id}/suspend
@PutMapping("/instances/{id}/suspend")
@PreAuthorize("hasPermission('workflow', 'configure')")
public R<Void> suspendInstance(@PathVariable String id) {
    workflowService.suspendInstance(id); return R.ok();
}

// PUT /api/workflow/instances/{id}/activate
@PutMapping("/instances/{id}/activate")
@PreAuthorize("hasPermission('workflow', 'configure')")
public R<Void> activateInstance(@PathVariable String id) {
    workflowService.activateInstance(id); return R.ok();
}

// DELETE /api/workflow/instances/{id}
@DeleteMapping("/instances/{id}")
@PreAuthorize("hasPermission('workflow', 'configure')")
public R<Void> deleteInstance(@PathVariable String id,
                               @RequestParam(defaultValue = "手动终止") String reason,
                               @AuthenticationPrincipal SecurityUser cu) {
    workflowService.deleteInstance(id, reason);
    auditLogMapper.insert(AuditLog.builder()
        .tenantId(cu.getTenantId()).module("workflow").action("delete_instance")
        .targetId(0L).targetType("process_instance")
        .operatorId(cu.getUserId())
        .remark("终止流程实例: " + id + " reason=" + reason)
        .build());
    return R.ok();
}

// GET /api/workflow/instances/{id}/activities — 历史活动
@GetMapping("/instances/{id}/activities")
@PreAuthorize("hasPermission('workflow', 'read')")
public R<List<Map<String, Object>>> activities(@PathVariable String id) {
    return R.ok(workflowService.getHistoricActivities(id));
}
```

---

### Task 3: 前端 — bpmn.js 流程查看器 (BpmnViewer)

**Files:** Create `frontend/src/components/workflow/BpmnViewer.tsx`

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import BpmnViewerLib from 'bpmn-js/lib/NavigatedViewer';

interface Props {
  xml: string;
  highlightedActivities?: string[];  // 已完成/当前活动 ID
  currentActivities?: string[];      // 当前活动 (蓝色)
}

export default function BpmnViewer({ xml, highlightedActivities = [], currentActivities = [] }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    if (!ref.current || !xml) return;
    const viewer = new BpmnViewerLib({ container: ref.current });
    viewerRef.current = viewer;

    viewer.importXML(xml).then(() => {
      const canvas = viewer.get('canvas') as any;
      canvas.zoom('fit-viewport');
      // 高亮已完成的活动 (绿色)
      const overlays = viewer.get('overlays') as any;
      highlightedActivities.forEach(id => {
        try { overlays.add(id, { position: { top: 0, left: 0 }, html: '<div style="width:100%;height:100%;background:rgba(34,197,94,0.2);border:2px solid #22c55e;border-radius:4px"></div>' }); } catch {}
      });
      // 高亮当前活动 (蓝色)
      currentActivities.forEach(id => {
        try { overlays.add(id, { position: { top: 0, left: 0 }, html: '<div style="width:100%;height:100%;background:rgba(59,130,246,0.3);border:2px solid #3b82f6;border-radius:4px;animation:pulse 1.5s infinite"></div>' }); } catch {}
      });
    });

    return () => { viewer.destroy(); };
  }, [xml]);

  return <div ref={ref} className="w-full h-full min-h-[400px] border rounded-lg bg-white" />;
}
```

---

### Task 4: 前端 — 实例管理页

**Files:** Create `frontend/src/app/(dashboard)/workflow/instances/page.tsx`

页面功能：两个 Tab (运行中 / 已完成)，列表显示实例信息，支持查看流程进度图。

---

### Task 5: 前端 — 审批页面通用化

**Files:** Modify `frontend/src/app/(dashboard)/workflow/tasks/page.tsx`

将硬编码的 `business_type === 'daily_report'` 替换为通用链路处理：
- 显示 TaskVO 中的 `process_name`
- 通用审批展开（不依赖日报特定组件）
- 支持任意流程的审批操作

---

### Task 6: 构建验证

构建后端+前端，curl 测试通用启动流程。
