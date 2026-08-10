# 前端重构审计 v1

## 核心结论

当前前端是 Next.js App Router + shadcn/ui 风格组件，适合重构为成熟 B2B 运维工作台。第一阶段不建议逐页美化，而应先统一全局 Shell、导航信息架构、页面容器、表格页模式和工作台首页。

## 已发现的主要问题

### 1. 主内容宽度被限制

文件：`frontend/src/app/(dashboard)/layout.tsx`

当前主区域使用：

- `main` 有 `p-6`
- 子容器使用 `max-w-5xl mx-auto`

这会导致后台系统在大屏上大量留白，CMDB、BPMN、拓扑、表格、文件预览等复杂页面无法充分使用宽度。

建议改为：

- 默认后台页面：`w-full max-w-none`
- 列表 / 表格页：全宽工作区
- 拓扑 / BPMN / 文件预览：沉浸式画布
- 表单详情页：可保留合理最大宽度，例如 `max-w-4xl`

### 2. Header 信息密度不足

文件：`frontend/src/components/layout/Header.tsx`

当前左侧为空，只保留通知、头像、用户名、退出。企业后台建议 Header 承担：

- 当前模块 / 面包屑
- 全局搜索
- 环境标识
- 快捷创建
- 通知
- 用户菜单

### 3. Sidebar 分组已有基础，但业务架构需要升级

文件：`frontend/src/components/layout/Sidebar.tsx`

当前导航已经分组，但存在几个问题：

- CMDB 被包在「IT 运维工具」下，作为核心业务不够突出
- `IP 地址池` 顶层独立，但从业务上更适合归入资源管理
- 流程任务、日报、通知分散在日常工作中，可以保留但需要和工作台首页联动
- 系统管理、权限、模板、配置可以统一为后台配置域

### 4. 首页仍是占位页

文件：`frontend/src/app/(dashboard)/page.tsx`

当前首页卡片内容为“即将上线”，不适合作为企业用户入口。

建议首页改为企业工作台，包含：

- 我的待办
- CMDB 风险
- 变更文档状态
- 流程审批
- 近期告警
- 常用入口
- 系统健康摘要

## 第一阶段重构目标

1. 移除后台全局窄容器限制
2. 建立成熟 B2B AppShell
3. 重组一级导航
4. 首页从占位改为工作台
5. 为所有列表页建立统一模式：筛选区 + 工具栏 + 表格 + 详情抽屉
6. 为复杂页面建立全宽画布模式：拓扑、BPMN、文件预览
7. 建立响应式规则：桌面全宽、平板双栏、手机卡片化

## 建议优先修改文件

1. `frontend/src/app/(dashboard)/layout.tsx`
2. `frontend/src/components/layout/Header.tsx`
3. `frontend/src/components/layout/Sidebar.tsx`
4. `frontend/src/app/(dashboard)/page.tsx`
5. 新增共享布局组件：
   - `frontend/src/components/layout/PageShell.tsx`
   - `frontend/src/components/layout/PageHeader.tsx`
   - `frontend/src/components/layout/FilterBar.tsx`
   - `frontend/src/components/layout/DataWorkspace.tsx`
