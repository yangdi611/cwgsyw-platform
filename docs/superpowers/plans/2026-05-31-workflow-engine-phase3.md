# 流程引擎 Phase 3 — 版本管理 + 统计 + 通知 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development

**Goal:** 流程版本历史 + 统计仪表盘 + 审批通知，补全流程引擎的高级能力

**Architecture:** 前端新增版本历史面板 + 简易统计页；后端新增统计查询端点 + 通用通知回调

---

## 文件结构

```
backend/
├── WorkflowService.java          # 修改: +统计查询
├── WorkflowController.java       # 修改: +统计端点 + 版本历史端点(已有data)
frontend/
├── workflow/admin/page.tsx       # 修改: +版本历史列/按钮
├── workflow/stats/               # 新建
│   └── page.tsx                  # 流程统计页
├── Sidebar.tsx                   # 修改: +统计入口
```

---

### Task 1: 后端 — 统计查询 + 版本历史端点

**Files:** WorkflowService.java + WorkflowController.java

新增方法:
- `getDefinitionVersions(key)` — 已有 (Phase 1)
- `getProcessStats(key)` — 总实例数、运行中数、已完成数、平均耗时
- Controller 加 `GET /api/workflow/stats` + `GET /api/workflow/definitions/{key}/versions`

### Task 2: 前端 — 版本历史面板

在 `/workflow/admin` 页面中，每个流程定义增加"版本历史"按钮，点击展开该 key 所有历史版本列表(版本号、部署时间、状态)。

### Task 3: 前端 — 统计页

新建 `/workflow/stats` — 展示每个流程定义的统计数据(总实例、运行中、已完成、平均审批时长)。

### Task 4: 构建验证
