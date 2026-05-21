# Phase 2a — 日报系统 + Flowable 审批流 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现日报填写/提交/审批完整流程，以及基于 Flowable 7 的可配置审批流引擎。

**Architecture:** 后端新增 `daily_report` 模块和 `workflow` 模块。Flowable 负责流程编排，日报模块通过 Flowable API 发起/推进流程实例。审批流定义由管理员在页面上配置（预置日报审批流 BPMN），或签逻辑通过 Flowable 的 candidateGroups 实现（组内任意组长可审批）。前端新增日报填写页、待审批列表、审批操作页。

**Tech Stack:** Spring Boot 3.4.5, Java 24, Flowable 7.1.0, MyBatis-Plus 3.5.12, Next.js 16, TanStack Query v5, shadcn/ui

---

## RBAC 检查（新增模块必做）

本计划新增两个资源，实施完成前必须：
1. V4 迁移脚本注册 `daily_report` 和 `workflow` 资源
2. 前端权限配置页自动渲染（无需额外代码，后端接口已动态返回）
3. 所有新接口加 `@PreAuthorize("hasPermission(...)")`
4. 默认角色无新模块权限，由超级管理员手动分配

---

## 文件结构

### 后端新增

```
backend/src/main/java/com/cwgsyw/platform/
├── module/
│   ├── daily/
│   │   ├── entity/DailyReport.java          # 日报实体
│   │   ├── DailyReportMapper.java
│   │   ├── DailyReportService.java
│   │   ├── DailyReportController.java       # /api/daily-reports
│   │   └── dto/
│   │       ├── CreateDailyReportRequest.java
│   │       └── DailyReportVO.java
│   └── workflow/
│       ├── WorkflowService.java             # Flowable 封装：发起/审批/查询
│       ├── WorkflowController.java          # /api/workflow/tasks, /approve, /reject
│       └── dto/
│           ├── ApproveRequest.java
│           └── TaskVO.java
└── config/
    └── FlowableConfig.java                  # Flowable 数据源配置

backend/src/main/resources/
├── db/migration/
│   └── V4__create_daily_report_tables.sql
└── processes/
    └── daily-report-approval.bpmn20.xml     # 日报审批流 BPMN 定义
```

### 前端新增

```
frontend/src/
├── app/(dashboard)/
│   ├── daily/
│   │   ├── page.tsx                         # 日报列表（我的日报）
│   │   ├── new/page.tsx                     # 新建日报
│   │   └── [id]/page.tsx                    # 日报详情
│   └── workflow/
│       └── tasks/page.tsx                   # 我的待审批任务
└── components/daily/
    ├── DailyReportForm.tsx                  # 日报表单组件
    └── ApprovalActions.tsx                  # 审批操作组件（通过/拒绝）
```

---

## Task 1: 添加 Flowable 依赖 + 数据库迁移

**Files:**
- Modify: `backend/pom.xml`
- Create: `backend/src/main/resources/db/migration/V4__create_daily_report_tables.sql`

- [ ] **Step 1: 在 pom.xml 添加 Flowable 依赖**

在 `<dependencies>` 中添加（在 Lombok 依赖之前）：

```xml
<!-- Flowable -->
<dependency>
    <groupId>org.flowable</groupId>
    <artifactId>flowable-spring-boot-starter</artifactId>
    <version>7.1.0</version>
    <exclusions>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </exclusion>
    </exclusions>
</dependency>
```

- [ ] **Step 2: 在 application.yml 添加 Flowable 配置**

在 `mybatis-plus` 配置块之前添加：

```yaml
flowable:
  database-schema-update: true
  async-executor-activate: false
  history-level: full
  check-process-definitions: true
  process-definition-location-prefix: classpath:/processes/
  process-definition-location-suffixes:
    - "**.bpmn20.xml"
    - "**.bpmn"
```

- [ ] **Step 3: 创建 V4 迁移脚本**

```sql
-- V4: 日报表 + 新增资源权限

-- 日报主表
CREATE TABLE daily_report (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    group_id        BIGINT NOT NULL REFERENCES sys_group(id),
    reporter_id     BIGINT NOT NULL REFERENCES sys_user(id),
    report_date     DATE NOT NULL,
    completed_items TEXT NOT NULL,
    issues          TEXT,
    tomorrow_plan   TEXT NOT NULL,
    work_hours      NUMERIC(4,1),
    status          VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    process_inst_id VARCHAR(128),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by      BIGINT,
    updated_by      BIGINT
);
CREATE INDEX idx_daily_report_reporter ON daily_report(reporter_id, report_date DESC);
CREATE INDEX idx_daily_report_group ON daily_report(group_id, report_date DESC);
CREATE INDEX idx_daily_report_status ON daily_report(status) WHERE NOT is_deleted;

-- 日报审批历史（Flowable 自己也记录，这里是业务层记录）
CREATE TABLE daily_report_approval (
    id              BIGSERIAL PRIMARY KEY,
    report_id       BIGINT NOT NULL REFERENCES daily_report(id),
    approver_id     BIGINT NOT NULL REFERENCES sys_user(id),
    action          VARCHAR(32) NOT NULL,   -- APPROVE / REJECT
    comment         TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 注册新资源
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
('daily_report', '日报管理', '["create","read","update","submit","approve","export"]', 60),
('workflow',     '审批流',   '["read","configure"]', 70);

-- 自动生成权限记录
INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code IN ('daily_report', 'workflow');

-- 给超级管理员和管理员赋予新权限
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin')
  AND p.code LIKE 'daily_report:%'
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin')
  AND p.code LIKE 'workflow:%'
ON CONFLICT DO NOTHING;

-- 组长可以审批日报
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'group_leader'
  AND p.code IN ('daily_report:read', 'daily_report:approve');

-- 组员可以创建/查看/提交日报
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'member'
  AND p.code IN ('daily_report:create', 'daily_report:read', 'daily_report:update', 'daily_report:submit');
```

- [ ] **Step 4: 验证迁移脚本语法**

```bash
docker exec cwgsyw-platform-postgres-1 psql -U platform_user -d cwgsyw_platform -c "SELECT count(*) FROM sys_resource;"
```

Expected: `count: 5`（迁移还没执行，这一步确认数据库连接正常）

- [ ] **Step 5: Commit**

```bash
git add backend/pom.xml backend/src/main/resources/
git commit -m "feat: add Flowable dependency and daily report migration V4"
```

---

## Task 2: BPMN 日报审批流定义 + Flowable 配置

**Files:**
- Create: `backend/src/main/resources/processes/daily-report-approval.bpmn20.xml`
- Create: `backend/src/main/java/com/cwgsyw/platform/config/FlowableConfig.java`

- [ ] **Step 1: 创建日报审批 BPMN 流程定义**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
             xmlns:flowable="http://flowable.org/bpmn"
             targetNamespace="http://cwgsyw.com/processes">

  <process id="dailyReportApproval" name="日报审批流" isExecutable="true">

    <startEvent id="start" name="提交日报"/>

    <sequenceFlow id="flow1" sourceRef="start" targetRef="groupLeaderApproval"/>

    <userTask id="groupLeaderApproval" name="组长审批"
              flowable:candidateGroups="${groupId}"
              flowable:assignee="">
      <documentation>组内任意组长审批即可通过（或签）</documentation>
      <extensionElements>
        <flowable:taskListener event="create"
          class="org.flowable.engine.impl.bpmn.behavior.UserTaskActivityBehavior"/>
      </extensionElements>
    </userTask>

    <sequenceFlow id="flow2" sourceRef="groupLeaderApproval" targetRef="approvalGateway"/>

    <exclusiveGateway id="approvalGateway" name="审批结果"/>

    <sequenceFlow id="flowApproved" sourceRef="approvalGateway" targetRef="approved">
      <conditionExpression>${approved == true}</conditionExpression>
    </sequenceFlow>

    <sequenceFlow id="flowRejected" sourceRef="approvalGateway" targetRef="rejected">
      <conditionExpression>${approved == false}</conditionExpression>
    </sequenceFlow>

    <endEvent id="approved" name="审批通过"/>
    <endEvent id="rejected" name="审批拒绝"/>

  </process>
</definitions>
```

- [ ] **Step 2: 创建 FlowableConfig**

```java
// config/FlowableConfig.java
package com.cwgsyw.platform.config;

import org.springframework.context.annotation.Configuration;

@Configuration
public class FlowableConfig {
    // Flowable 通过 Spring Boot auto-configuration 自动配置
    // 使用主数据源（PostgreSQL），无需额外配置
}
```

- [ ] **Step 3: 编译验证**

```bash
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-24.jdk/Contents/Home mvn compile -q 2>&1 | tail -5
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/processes/ backend/src/main/java/com/cwgsyw/platform/config/FlowableConfig.java
git commit -m "feat: daily report BPMN process definition"
```

---

## Task 3: WorkflowService + WorkflowController

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowService.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowController.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/workflow/dto/ApproveRequest.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/workflow/dto/TaskVO.java`

- [ ] **Step 1: 创建 TaskVO**

```java
// module/workflow/dto/TaskVO.java
package com.cwgsyw.platform.module.workflow.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class TaskVO {
    private String taskId;
    private String processInstanceId;
    private String taskName;
    private String businessKey;    // 业务单据ID，如 "dailyReport:123"
    private String businessType;   // "daily_report"
    private Long   businessId;
    private String assignee;
    private LocalDateTime createTime;
}
```

- [ ] **Step 2: 创建 ApproveRequest**

```java
// module/workflow/dto/ApproveRequest.java
package com.cwgsyw.platform.module.workflow.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ApproveRequest {
    @NotBlank private String taskId;
    private boolean approved;
    private String comment;
}
```

- [ ] **Step 3: 创建 WorkflowService**

```java
// module/workflow/WorkflowService.java
package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.module.workflow.dto.TaskVO;
import lombok.RequiredArgsConstructor;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.task.api.Task;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkflowService {
    private final RuntimeService runtimeService;
    private final TaskService taskService;

    @Transactional
    public String startDailyReportApproval(Long reportId, Long groupId) {
        Map<String, Object> vars = new HashMap<>();
        vars.put("reportId", reportId);
        vars.put("groupId", "group_" + groupId);  // candidateGroup 名称
        vars.put("approved", false);

        ProcessInstance pi = runtimeService.startProcessInstanceByKey(
            "dailyReportApproval",
            "dailyReport:" + reportId,
            vars
        );
        return pi.getId();
    }

    @Transactional
    public void approve(String taskId, Long approverId, boolean approved, String comment) {
        Task task = taskService.createTaskQuery()
            .taskId(taskId)
            .singleResult();
        if (task == null) throw new IllegalArgumentException("任务不存在: " + taskId);

        taskService.claim(taskId, String.valueOf(approverId));

        Map<String, Object> vars = new HashMap<>();
        vars.put("approved", approved);
        if (comment != null) vars.put("comment", comment);

        taskService.complete(taskId, vars);
    }

    public List<TaskVO> getPendingTasksByGroup(Long groupId) {
        String candidateGroup = "group_" + groupId;
        List<Task> tasks = taskService.createTaskQuery()
            .taskCandidateGroup(candidateGroup)
            .orderByTaskCreateTime().desc()
            .list();
        return tasks.stream().map(this::toVO).collect(Collectors.toList());
    }

    public List<TaskVO> getPendingTasksByUser(Long userId) {
        List<Task> tasks = taskService.createTaskQuery()
            .taskCandidateOrAssigned(String.valueOf(userId))
            .orderByTaskCreateTime().desc()
            .list();
        return tasks.stream().map(this::toVO).collect(Collectors.toList());
    }

    private TaskVO toVO(Task task) {
        TaskVO vo = new TaskVO();
        vo.setTaskId(task.getId());
        vo.setProcessInstanceId(task.getProcessInstanceId());
        vo.setTaskName(task.getName());
        vo.setCreateTime(task.getCreateTime() != null
            ? task.getCreateTime().toInstant()
                .atZone(java.time.ZoneId.systemDefault())
                .toLocalDateTime()
            : null);

        String businessKey = runtimeService
            .createProcessInstanceQuery()
            .processInstanceId(task.getProcessInstanceId())
            .singleResult()
            .getBusinessKey();
        vo.setBusinessKey(businessKey);
        if (businessKey != null && businessKey.startsWith("dailyReport:")) {
            vo.setBusinessType("daily_report");
            vo.setBusinessId(Long.parseLong(businessKey.split(":")[1]));
        }
        return vo;
    }
}
```

- [ ] **Step 4: 创建 WorkflowController**

```java
// module/workflow/WorkflowController.java
package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.workflow.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/workflow")
@RequiredArgsConstructor
public class WorkflowController {
    private final WorkflowService workflowService;

    @GetMapping("/tasks/my")
    @PreAuthorize("hasPermission('workflow', 'read')")
    public R<List<TaskVO>> myTasks(@AuthenticationPrincipal SecurityUser cu) {
        return R.ok(workflowService.getPendingTasksByUser(cu.getUserId()));
    }

    @GetMapping("/tasks/group")
    @PreAuthorize("hasPermission('daily_report', 'approve')")
    public R<List<TaskVO>> groupTasks(@AuthenticationPrincipal SecurityUser cu) {
        return R.ok(workflowService.getPendingTasksByGroup(cu.getGroupId()));
    }

    @PostMapping("/approve")
    @PreAuthorize("hasPermission('daily_report', 'approve')")
    public R<Void> approve(@Valid @RequestBody ApproveRequest req,
                           @AuthenticationPrincipal SecurityUser cu) {
        workflowService.approve(req.getTaskId(), cu.getUserId(),
            req.isApproved(), req.getComment());
        return R.ok();
    }
}
```

- [ ] **Step 5: 编译验证**

```bash
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-24.jdk/Contents/Home mvn compile -q 2>&1 | tail -3
```

Expected: `BUILD SUCCESS`

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/workflow/
git commit -m "feat: workflow service and controller with Flowable integration"
```

---

## Task 4: 日报实体 + Service + Controller

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/daily/entity/DailyReport.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/daily/dto/CreateDailyReportRequest.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/daily/dto/DailyReportVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportService.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportController.java`

- [ ] **Step 1: 创建 DailyReport 实体**

```java
// module/daily/entity/DailyReport.java
package com.cwgsyw.platform.module.daily.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("daily_report")
public class DailyReport extends BaseEntity {
    private Long groupId;
    private Long reporterId;
    private LocalDate reportDate;
    private String completedItems;
    private String issues;
    private String tomorrowPlan;
    private BigDecimal workHours;
    private String status;           // DRAFT / SUBMITTED / APPROVED / REJECTED
    private String processInstId;
}
```

- [ ] **Step 2: 创建 DailyReportMapper**

```java
// module/daily/DailyReportMapper.java
package com.cwgsyw.platform.module.daily;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Mapper
public interface DailyReportMapper extends BaseMapper<DailyReport> {
    @Select("SELECT * FROM daily_report WHERE reporter_id = #{reporterId} AND report_date = #{date} AND is_deleted = false")
    Optional<DailyReport> findByReporterAndDate(Long reporterId, LocalDate date);

    @Select("SELECT * FROM daily_report WHERE group_id = #{groupId} AND status = #{status} AND is_deleted = false ORDER BY report_date DESC")
    List<DailyReport> findByGroupAndStatus(Long groupId, String status);
}
```

- [ ] **Step 3: 创建 CreateDailyReportRequest**

```java
// module/daily/dto/CreateDailyReportRequest.java
package com.cwgsyw.platform.module.daily.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreateDailyReportRequest {
    @NotNull  private LocalDate reportDate;
    @NotBlank private String completedItems;
    private String issues;
    @NotBlank private String tomorrowPlan;
    private BigDecimal workHours;
}
```

- [ ] **Step 4: 创建 DailyReportVO**

```java
// module/daily/dto/DailyReportVO.java
package com.cwgsyw.platform.module.daily.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class DailyReportVO {
    private Long id;
    private Long groupId;
    private String groupName;
    private Long reporterId;
    private String reporterName;
    private LocalDate reportDate;
    private String completedItems;
    private String issues;
    private String tomorrowPlan;
    private BigDecimal workHours;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

- [ ] **Step 5: 创建 DailyReportService**

```java
// module/daily/DailyReportService.java
package com.cwgsyw.platform.module.daily;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.daily.dto.*;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.workflow.WorkflowService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DailyReportService {
    private final DailyReportMapper reportMapper;
    private final WorkflowService workflowService;
    private final UserMapper userMapper;
    private final GroupMapper groupMapper;

    public PageResult<DailyReportVO> listMyReports(Long userId, int page, int size) {
        Page<DailyReport> p = reportMapper.selectPage(new Page<>(page, size),
            new LambdaQueryWrapper<DailyReport>()
                .eq(DailyReport::getReporterId, userId)
                .eq(DailyReport::getIsDeleted, false)
                .orderByDesc(DailyReport::getReportDate));
        Page<DailyReportVO> voPage = p.convert(this::toVO);
        return PageResult.of(voPage);
    }

    public PageResult<DailyReportVO> listGroupReports(Long groupId, String status, int page, int size) {
        LambdaQueryWrapper<DailyReport> query = new LambdaQueryWrapper<DailyReport>()
            .eq(DailyReport::getGroupId, groupId)
            .eq(DailyReport::getIsDeleted, false)
            .orderByDesc(DailyReport::getReportDate);
        if (status != null) query.eq(DailyReport::getStatus, status);
        Page<DailyReport> p = reportMapper.selectPage(new Page<>(page, size), query);
        return PageResult.of(p.convert(this::toVO));
    }

    @Transactional
    public DailyReport create(CreateDailyReportRequest req, Long userId, Long groupId, String tenantId) {
        reportMapper.findByReporterAndDate(userId, req.getReportDate()).ifPresent(r -> {
            throw new IllegalArgumentException("该日期已有日报，请编辑现有日报");
        });
        DailyReport report = new DailyReport();
        report.setTenantId(tenantId);
        report.setGroupId(groupId);
        report.setReporterId(userId);
        report.setReportDate(req.getReportDate());
        report.setCompletedItems(req.getCompletedItems());
        report.setIssues(req.getIssues());
        report.setTomorrowPlan(req.getTomorrowPlan());
        report.setWorkHours(req.getWorkHours());
        report.setStatus("DRAFT");
        reportMapper.insert(report);
        return report;
    }

    @Transactional
    public void update(Long id, CreateDailyReportRequest req, Long userId) {
        DailyReport report = getAndCheckOwner(id, userId);
        if (!"DRAFT".equals(report.getStatus()) && !"REJECTED".equals(report.getStatus())) {
            throw new IllegalArgumentException("只能修改草稿或被拒绝的日报");
        }
        report.setCompletedItems(req.getCompletedItems());
        report.setIssues(req.getIssues());
        report.setTomorrowPlan(req.getTomorrowPlan());
        report.setWorkHours(req.getWorkHours());
        reportMapper.updateById(report);
    }

    @Transactional
    public void submit(Long id, Long userId) {
        DailyReport report = getAndCheckOwner(id, userId);
        if (!"DRAFT".equals(report.getStatus()) && !"REJECTED".equals(report.getStatus())) {
            throw new IllegalArgumentException("只能提交草稿或被拒绝的日报");
        }
        String processInstId = workflowService.startDailyReportApproval(id, report.getGroupId());
        report.setStatus("SUBMITTED");
        report.setProcessInstId(processInstId);
        reportMapper.updateById(report);
    }

    public void updateStatusByProcessInst(String processInstId, String status) {
        DailyReport report = reportMapper.selectOne(
            new LambdaQueryWrapper<DailyReport>()
                .eq(DailyReport::getProcessInstId, processInstId));
        if (report != null) {
            report.setStatus(status);
            reportMapper.updateById(report);
        }
    }

    public DailyReportVO getById(Long id) {
        DailyReport report = reportMapper.selectById(id);
        if (report == null || report.getIsDeleted()) {
            throw new IllegalArgumentException("日报不存在");
        }
        return toVO(report);
    }

    private DailyReport getAndCheckOwner(Long id, Long userId) {
        DailyReport report = reportMapper.selectById(id);
        if (report == null || report.getIsDeleted()) throw new IllegalArgumentException("日报不存在");
        if (!report.getReporterId().equals(userId)) throw new IllegalArgumentException("无权操作他人日报");
        return report;
    }

    private DailyReportVO toVO(DailyReport r) {
        DailyReportVO vo = new DailyReportVO();
        vo.setId(r.getId());
        vo.setGroupId(r.getGroupId());
        vo.setReporterId(r.getReporterId());
        vo.setReportDate(r.getReportDate());
        vo.setCompletedItems(r.getCompletedItems());
        vo.setIssues(r.getIssues());
        vo.setTomorrowPlan(r.getTomorrowPlan());
        vo.setWorkHours(r.getWorkHours());
        vo.setStatus(r.getStatus());
        vo.setCreatedAt(r.getCreatedAt());
        vo.setUpdatedAt(r.getUpdatedAt());
        // 异步加载名称（简化：直接查）
        userMapper.selectById(r.getReporterId()).ifPresent(
            // MyBatis-Plus selectById 返回 T 不是 Optional，修正如下：
        );
        var user = userMapper.selectById(r.getReporterId());
        if (user != null) vo.setReporterName(user.getRealName() != null ? user.getRealName() : user.getUsername());
        var group = groupMapper.selectById(r.getGroupId());
        if (group != null) vo.setGroupName(group.getName());
        return vo;
    }
}
```

- [ ] **Step 6: 修正 toVO 方法（移除错误的 ifPresent）**

```java
    private DailyReportVO toVO(DailyReport r) {
        DailyReportVO vo = new DailyReportVO();
        vo.setId(r.getId());
        vo.setGroupId(r.getGroupId());
        vo.setReporterId(r.getReporterId());
        vo.setReportDate(r.getReportDate());
        vo.setCompletedItems(r.getCompletedItems());
        vo.setIssues(r.getIssues());
        vo.setTomorrowPlan(r.getTomorrowPlan());
        vo.setWorkHours(r.getWorkHours());
        vo.setStatus(r.getStatus());
        vo.setCreatedAt(r.getCreatedAt());
        vo.setUpdatedAt(r.getUpdatedAt());
        var user = userMapper.selectById(r.getReporterId());
        if (user != null) vo.setReporterName(user.getRealName() != null ? user.getRealName() : user.getUsername());
        var group = groupMapper.selectById(r.getGroupId());
        if (group != null) vo.setGroupName(group.getName());
        return vo;
    }
```

- [ ] **Step 7: 创建 DailyReportController**

```java
// module/daily/DailyReportController.java
package com.cwgsyw.platform.module.daily;

import com.cwgsyw.platform.common.*;
import com.cwgsyw.platform.module.daily.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/daily-reports")
@RequiredArgsConstructor
public class DailyReportController {
    private final DailyReportService reportService;

    @GetMapping("/my")
    @PreAuthorize("hasPermission('daily_report', 'read')")
    public R<PageResult<DailyReportVO>> myReports(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(reportService.listMyReports(cu.getUserId(), page, size));
    }

    @GetMapping("/group")
    @PreAuthorize("hasPermission('daily_report', 'approve')")
    public R<PageResult<DailyReportVO>> groupReports(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(reportService.listGroupReports(cu.getGroupId(), status, page, size));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasPermission('daily_report', 'read')")
    public R<DailyReportVO> getById(@PathVariable Long id) {
        return R.ok(reportService.getById(id));
    }

    @PostMapping
    @PreAuthorize("hasPermission('daily_report', 'create')")
    public R<DailyReportVO> create(@Valid @RequestBody CreateDailyReportRequest req,
                                   @AuthenticationPrincipal SecurityUser cu) {
        var report = reportService.create(req, cu.getUserId(), cu.getGroupId(), cu.getTenantId());
        return R.ok(reportService.getById(report.getId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('daily_report', 'update')")
    public R<Void> update(@PathVariable Long id,
                          @Valid @RequestBody CreateDailyReportRequest req,
                          @AuthenticationPrincipal SecurityUser cu) {
        reportService.update(id, req, cu.getUserId());
        return R.ok();
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasPermission('daily_report', 'submit')")
    public R<Void> submit(@PathVariable Long id,
                          @AuthenticationPrincipal SecurityUser cu) {
        reportService.submit(id, cu.getUserId());
        return R.ok();
    }
}
```

- [ ] **Step 8: 编译验证**

```bash
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-24.jdk/Contents/Home mvn compile -q 2>&1 | tail -3
```

Expected: `BUILD SUCCESS`

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/daily/
git commit -m "feat: daily report entity, service and controller"
```

---

## Task 5: Flowable 审批结果回调 + 状态同步

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/workflow/DailyReportApprovalListener.java`
- Modify: `backend/src/main/resources/processes/daily-report-approval.bpmn20.xml`

- [ ] **Step 1: 创建审批结束监听器**

```java
// module/workflow/DailyReportApprovalListener.java
package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.module.daily.DailyReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.ExecutionListener;
import org.springframework.stereotype.Component;

@Component("dailyReportApprovalListener")
@RequiredArgsConstructor
@Slf4j
public class DailyReportApprovalListener implements ExecutionListener {
    private final DailyReportService dailyReportService;

    @Override
    public void notify(DelegateExecution execution) {
        String processInstId = execution.getProcessInstanceId();
        Boolean approved = (Boolean) execution.getVariable("approved");
        String status = Boolean.TRUE.equals(approved) ? "APPROVED" : "REJECTED";
        log.info("Daily report approval finished: processInst={}, status={}", processInstId, status);
        dailyReportService.updateStatusByProcessInst(processInstId, status);
    }
}
```

- [ ] **Step 2: 更新 BPMN 在结束事件添加监听器**

将 `daily-report-approval.bpmn20.xml` 中两个 `endEvent` 替换为：

```xml
    <endEvent id="approved" name="审批通过">
      <extensionElements>
        <flowable:executionListener event="start"
          delegateExpression="${dailyReportApprovalListener}"/>
      </extensionElements>
    </endEvent>

    <endEvent id="rejected" name="审批拒绝">
      <extensionElements>
        <flowable:executionListener event="start"
          delegateExpression="${dailyReportApprovalListener}"/>
      </extensionElements>
    </endEvent>
```

- [ ] **Step 3: 编译验证**

```bash
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-24.jdk/Contents/Home mvn compile -q 2>&1 | tail -3
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: 重新构建后端容器验证迁移和 Flowable 启动**

```bash
docker compose up -d --build backend 2>&1 | tail -5
sleep 15
docker logs cwgsyw-platform-backend-1 2>&1 | grep -E "Started|Flowable|ERROR" | tail -10
```

Expected: `Started PlatformApplication` 且无 ERROR

- [ ] **Step 5: Commit**

```bash
git add backend/src/
git commit -m "feat: Flowable approval result listener syncs daily report status"
```

---

## Task 6: 前端日报模块

**Files:**
- Create: `frontend/src/app/(dashboard)/daily/page.tsx`
- Create: `frontend/src/app/(dashboard)/daily/new/page.tsx`
- Create: `frontend/src/app/(dashboard)/daily/[id]/page.tsx`
- Create: `frontend/src/components/daily/DailyReportForm.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: 创建日报表单组件**

```tsx
// components/daily/DailyReportForm.tsx
'use client'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface FormData {
  reportDate: string
  completedItems: string
  issues: string
  tomorrowPlan: string
  workHours: string
}

interface Props {
  defaultValues?: Partial<FormData>
  onSubmit: (data: FormData) => Promise<void>
  submitLabel?: string
}

export function DailyReportForm({ defaultValues, onSubmit, submitLabel = '保存草稿' }: Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      reportDate: new Date().toISOString().split('T')[0],
      ...defaultValues,
    },
  })

  const handleFormSubmit = async (data: FormData) => {
    try {
      await onSubmit(data)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '操作失败')
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="reportDate">日报日期</Label>
        <Input id="reportDate" type="date" {...register('reportDate', { required: '请选择日期' })} />
        {errors.reportDate && <p className="text-sm text-destructive">{errors.reportDate.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="completedItems">今日完成事项 *</Label>
        <Textarea id="completedItems" rows={5} placeholder="请描述今日完成的工作内容..."
          {...register('completedItems', { required: '请填写今日完成事项' })} />
        {errors.completedItems && <p className="text-sm text-destructive">{errors.completedItems.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="issues">遇到的问题及处理结果</Label>
        <Textarea id="issues" rows={3} placeholder="如无问题可填写"无"..."
          {...register('issues')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tomorrowPlan">明日工作计划 *</Label>
        <Textarea id="tomorrowPlan" rows={4} placeholder="请描述明日计划..."
          {...register('tomorrowPlan', { required: '请填写明日计划' })} />
        {errors.tomorrowPlan && <p className="text-sm text-destructive">{errors.tomorrowPlan.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="workHours">工时（小时）</Label>
        <Input id="workHours" type="number" step="0.5" min="0" max="24"
          placeholder="8.0" {...register('workHours')} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '保存中...' : submitLabel}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: 安装 react-hook-form 和 textarea shadcn 组件**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend
npm install react-hook-form
npx shadcn@latest add textarea --yes
```

- [ ] **Step 3: 创建新建日报页**

```tsx
// app/(dashboard)/daily/new/page.tsx
'use client'
import { useRouter } from 'next/navigation'
import { DailyReportForm } from '@/components/daily/DailyReportForm'
import api from '@/lib/api'
import { toast } from 'sonner'

export default function NewDailyReportPage() {
  const router = useRouter()

  const handleSave = async (data: any) => {
    await api.post('/daily-reports', {
      report_date: data.reportDate,
      completed_items: data.completedItems,
      issues: data.issues,
      tomorrow_plan: data.tomorrowPlan,
      work_hours: data.workHours ? parseFloat(data.workHours) : null,
    })
    toast.success('日报已保存')
    router.push('/daily')
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">新建日报</h1>
      <DailyReportForm onSubmit={handleSave} />
    </div>
  )
}
```

- [ ] **Step 4: 创建日报列表页**

```tsx
// app/(dashboard)/daily/page.tsx
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { toast } from 'sonner'

interface DailyReport {
  id: number
  report_date: string
  completed_items: string
  status: string
  work_hours: number
}

const statusLabel: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT:     { label: '草稿',   variant: 'secondary' },
  SUBMITTED: { label: '待审批', variant: 'default' },
  APPROVED:  { label: '已通过', variant: 'outline' },
  REJECTED:  { label: '已拒绝', variant: 'destructive' },
}

export default function DailyReportsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['my-daily-reports'],
    queryFn: () => api.get('/daily-reports/my').then(r => r.data.data.records as DailyReport[]),
  })

  const submitMutation = useMutation({
    mutationFn: (id: number) => api.post(`/daily-reports/${id}/submit`),
    onSuccess: () => {
      toast.success('日报已提交审批')
      queryClient.invalidateQueries({ queryKey: ['my-daily-reports'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '提交失败'),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">我的日报</h1>
        <Button asChild><Link href="/daily/new">新建日报</Link></Button>
      </div>

      {isLoading ? <p className="text-muted-foreground">加载中...</p> : (
        <div className="space-y-3">
          {(data ?? []).map(report => {
            const s = statusLabel[report.status] ?? { label: report.status, variant: 'secondary' as const }
            return (
              <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{report.report_date}</span>
                    <Badge variant={s.variant}>{s.label}</Badge>
                    {report.work_hours && <span className="text-sm text-muted-foreground">{report.work_hours}h</span>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{report.completed_items}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/daily/${report.id}`}>查看</Link>
                  </Button>
                  {(report.status === 'DRAFT' || report.status === 'REJECTED') && (
                    <Button size="sm"
                      onClick={() => submitMutation.mutate(report.id)}
                      disabled={submitMutation.isPending}>
                      提交审批
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
          {(data ?? []).length === 0 && (
            <p className="text-muted-foreground text-center py-12">暂无日报，点击右上角新建</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: 创建日报详情页**

```tsx
// app/(dashboard)/daily/[id]/page.tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DailyReport {
  id: number
  reporter_name: string
  group_name: string
  report_date: string
  completed_items: string
  issues: string
  tomorrow_plan: string
  work_hours: number
  status: string
}

export default function DailyReportDetailPage() {
  const { id } = useParams()
  const { data: report, isLoading } = useQuery({
    queryKey: ['daily-report', id],
    queryFn: () => api.get(`/daily-reports/${id}`).then(r => r.data.data as DailyReport),
  })

  if (isLoading) return <p className="text-muted-foreground">加载中...</p>
  if (!report) return <p className="text-destructive">日报不存在</p>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">{report.report_date} 日报</h1>
        <Badge>{report.status}</Badge>
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">提交人 / 组别</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {report.reporter_name} · {report.group_name}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">今日完成事项</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{report.completed_items}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">遇到的问题</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{report.issues || '无'}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">明日计划</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{report.tomorrow_plan}</CardContent>
        </Card>
        {report.work_hours && (
          <Card>
            <CardHeader><CardTitle className="text-sm">工时</CardTitle></CardHeader>
            <CardContent className="text-sm">{report.work_hours} 小时</CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 更新 Sidebar 添加日报入口**

在 `frontend/src/components/layout/Sidebar.tsx` 的 `navItems` 数组中添加：

```tsx
import { FileText, CheckSquare, Users, Building2, Shield, LayoutDashboard } from 'lucide-react'

const navItems = [
  { href: '/',            label: '首页',     icon: LayoutDashboard, resource: null,           action: null },
  { href: '/daily',       label: '我的日报', icon: FileText,        resource: 'daily_report', action: 'read' },
  { href: '/workflow/tasks', label: '待审批', icon: CheckSquare,   resource: 'workflow',      action: 'read' },
  { href: '/users',       label: '用户管理', icon: Users,           resource: 'user',          action: 'read' },
  { href: '/groups',      label: '组管理',   icon: Building2,       resource: 'group',         action: 'read' },
  { href: '/rbac/roles',  label: '角色权限', icon: Shield,          resource: 'role',          action: 'read' },
]
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: daily report list, create and detail pages"
```

---

## Task 7: 前端待审批任务页

**Files:**
- Create: `frontend/src/app/(dashboard)/workflow/tasks/page.tsx`
- Create: `frontend/src/components/daily/ApprovalActions.tsx`

- [ ] **Step 1: 创建审批操作组件**

```tsx
// components/daily/ApprovalActions.tsx
'use client'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import api from '@/lib/api'
import { toast } from 'sonner'

interface Props {
  taskId: string
  onDone: () => void
}

export function ApprovalActions({ taskId, onDone }: Props) {
  const [comment, setComment] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (approved: boolean) =>
      api.post('/workflow/approve', { task_id: taskId, approved, comment }),
    onSuccess: (_, approved) => {
      toast.success(approved ? '已通过审批' : '已拒绝')
      queryClient.invalidateQueries({ queryKey: ['workflow-tasks'] })
      onDone()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '操作失败'),
  })

  return (
    <div className="space-y-3 mt-4 p-4 border rounded-lg bg-muted/50">
      <div className="space-y-1">
        <Label>审批意见（可选）</Label>
        <Textarea value={comment} onChange={e => setComment(e.target.value)}
          placeholder="填写审批意见..." rows={2} />
      </div>
      <div className="flex gap-2">
        <Button onClick={() => mutation.mutate(true)} disabled={mutation.isPending}
          className="flex-1">
          通过
        </Button>
        <Button variant="destructive" onClick={() => mutation.mutate(false)}
          disabled={mutation.isPending} className="flex-1">
          拒绝
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建待审批任务列表页**

```tsx
// app/(dashboard)/workflow/tasks/page.tsx
'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ApprovalActions } from '@/components/daily/ApprovalActions'
import Link from 'next/link'

interface TaskVO {
  task_id: string
  task_name: string
  business_type: string
  business_id: number
  create_time: string
}

export default function WorkflowTasksPage() {
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['workflow-tasks'],
    queryFn: () => api.get('/workflow/tasks/group').then(r => r.data.data as TaskVO[]),
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">待审批任务</h1>
      {isLoading ? <p className="text-muted-foreground">加载中...</p> : (
        <div className="space-y-3">
          {(data ?? []).map(task => (
            <div key={task.task_id} className="p-4 border rounded-lg bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{task.task_name}</span>
                    <Badge variant="outline">{task.business_type === 'daily_report' ? '日报审批' : task.business_type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(task.create_time).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex gap-2">
                  {task.business_type === 'daily_report' && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/daily/${task.business_id}`} target="_blank">查看日报</Link>
                    </Button>
                  )}
                  <Button variant="outline" size="sm"
                    onClick={() => setExpandedTask(expandedTask === task.task_id ? null : task.task_id)}>
                    {expandedTask === task.task_id ? '收起' : '审批'}
                  </Button>
                </div>
              </div>
              {expandedTask === task.task_id && (
                <ApprovalActions taskId={task.task_id} onDone={() => setExpandedTask(null)} />
              )}
            </div>
          ))}
          {(data ?? []).length === 0 && (
            <p className="text-muted-foreground text-center py-12">暂无待审批任务</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 重新构建前端**

```bash
docker compose up -d --build frontend 2>&1 | tail -3
```

Expected: 构建完成，无 TypeScript 错误

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: workflow pending tasks page with approval actions"
```

---

## Task 8: 端到端验证

- [ ] **Step 1: 验证后端 V4 迁移已执行**

```bash
docker exec cwgsyw-platform-postgres-1 psql -U platform_user -d cwgsyw_platform -c \
  "SELECT code, name FROM sys_resource ORDER BY sort_order;"
```

Expected: 列出包含 `daily_report` 和 `workflow` 的 7 条记录

- [ ] **Step 2: 验证 Flowable 表已创建**

```bash
docker exec cwgsyw-platform-postgres-1 psql -U platform_user -d cwgsyw_platform -c \
  "SELECT tablename FROM pg_tables WHERE tablename LIKE 'act_%' ORDER BY tablename LIMIT 10;"
```

Expected: 列出 `act_ge_bytearray`, `act_hi_actinst` 等 Flowable 表

- [ ] **Step 3: 验证日报 API（需先给 superadmin 分配 group）**

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# superadmin 的 group_id 为 null，先更新为管理组(id=1)
docker exec cwgsyw-platform-postgres-1 psql -U platform_user -d cwgsyw_platform -c \
  "UPDATE sys_user SET group_id = 1 WHERE username = 'superadmin';"

# 创建日报
curl -s -X POST http://localhost/api/daily-reports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"report_date":"2026-05-21","completed_items":"完成测试","issues":"无","tomorrow_plan":"继续开发","work_hours":8}' | python3 -m json.tool
```

Expected: `{"code":200,"data":{"id":1,"status":"DRAFT",...}}`

- [ ] **Step 4: 验证提交审批**

```bash
curl -s -X POST http://localhost/api/daily-reports/1/submit \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Expected: `{"code":200,"message":"success"}`

- [ ] **Step 5: 验证待审批任务**

```bash
curl -s http://localhost/api/workflow/tasks/group \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Expected: 返回包含日报审批任务的列表

- [ ] **Step 6: 最终 Commit**

```bash
git add -A && git commit -m "feat: phase 2a complete - daily report system with Flowable approval"
git tag v0.2.0-daily
```

---

## 自检

### Spec 覆盖
- [x] 日报表单（今日完成、问题、明日计划、工时）→ Task 4, 6
- [x] 提交审批流程 → Task 4, 5
- [x] 组长或签（candidateGroups）→ Task 3
- [x] 审批通过/拒绝状态同步 → Task 5
- [x] 数据不物理删除（is_deleted）→ Task 1（V4 SQL）
- [x] RBAC 四步检查 → Task 1（V4 注册资源+权限）
- [x] 前端日报列表/新建/详情 → Task 6
- [x] 前端待审批任务 → Task 7

### 无 Placeholder
所有代码块完整，无 TBD。

### 类型一致性
- `DailyReport.status` 值：`DRAFT / SUBMITTED / APPROVED / REJECTED` 在 Service、Controller、前端均一致
- `WorkflowService.startDailyReportApproval` 的 candidateGroup 格式 `"group_" + groupId` 与 BPMN 中 `${groupId}` 配合（实际传入变量值为 `"group_1"` 等）
