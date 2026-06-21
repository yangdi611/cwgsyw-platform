# 前端 UX 重构迁移计划

**目标**：在不破坏现有功能的前提下，重新设计用户体验，使交互友好、信息获取清晰、逻辑流畅。

**策略**：增量迁移，新旧组件共存，逐页升级，最终统一。

---

## 📐 设计原则

### 用户体验核心目标

1. **信息获取清晰**
   - 面包屑 + 页面标题 + 辅助说明，用户始终知道"我在哪"
   - 关键指标前置，次要信息渐进展示
   - 状态一目了然（成功/警告/危险/进行中）

2. **交互逻辑友好**
   - 主操作突出（primary button），次要操作内敛
   - 批量操作前先选择，再显示工具栏
   - 确认对话框说明后果，提供撤销或回退
   - 加载/空态/错误态统一，减少用户困惑

3. **工作流顺畅**
   - 列表 → 详情 → 编辑 → 保存 → 返回列表，闭环清晰
   - 关联对象可快速跳转（CI ↔ 变更文档 ↔ 设备）
   - 筛选条件持久化（URL query params），分享链接即可复现视图

4. **响应式体验**
   - 桌面：全宽工作区，详情抽屉并排
   - 平板：双栏布局，详情抽屉变窄或底部面板
   - 手机：卡片化列表，详情独立页

---

## 🎨 视觉系统（Design Token）

### 色彩系统

| Token | 用途 | 值（参考） |
|-------|------|------------|
| `--primary` | 主操作、当前状态、链接 | `#1d4ed8`（深蓝） |
| `--primary-hover` | 悬停态 | `#1e40af` |
| `--primary-soft` | 淡背景 | `#eff6ff` |
| `--success` | 成功、健康、联通 | `#067647`（青绿） |
| `--warning` | 警告、待确认 | `#b54708`（琥珀） |
| `--danger` | 错误、高危、删除 | `#b42318`（红色） |
| `--bg` | 全局背景 | `#f5f7fb`（浅灰） |
| `--surface` | 卡片/面板背景 | `#ffffff` |
| `--border` | 边框 | `#e4e7ec` |
| `--fg` | 主文本 | `#101828` |
| `--muted` | 次要文本 | `#667085` |

### 间距与圆角

- 卡片圆角：`12px` (md) / `16px` (lg)
- 按钮圆角：`10px`
- 间距：4/8/12/16/20/28px

### 阴影

- 卡片：`0 1px 2px rgba(16, 24, 40, 0.06)`
- 悬停：`0 8px 24px rgba(16, 24, 40, 0.08)`

### 字体

- Sans: `-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`
- Mono: `"SF Mono", "Cascadia Code", monospace`

---

## 🗂️ 新信息架构

### 一级导航（8 大模块）

1. **工作台** - 待办、指标、近期事项、常用入口
2. **CMDB** - 模型、实例、关联、拓扑、影响分析、告警、变更记录
3. **变更文档** - 列表、新建、详情、模板管理
4. **资源管理** - 设备密码库、IP 地址池、共享文档
5. **流程中心** - 我的任务、流程实例、流程设计、统计
6. **报表分析** - 综合报表、趋势分析
7. **身份与权限** - 用户、用户组、角色、权限
8. **系统管理** - 系统配置、AI 配置、审计日志、通知中心

### 与当前路由的映射

| 当前路由 | 新归属模块 | 迁移优先级 |
|---------|-----------|-----------|
| `/` | 工作台 | P0 - 第一批 |
| `/cmdb/instances` | CMDB - 实例管理 | P0 - 第一批 |
| `/cmdb/topology/[id]` | CMDB - 拓扑视图 | P1 - 第二批 |
| `/change-docs` | 变更文档 - 列表 | P0 - 第一批 |
| `/change-docs/[id]` | 变更文档 - 详情 | P1 - 第二批 |
| `/devices` | 资源管理 - 设备 | P0 - 第一批 |
| `/ipam` | 资源管理 - IPAM | P1 - 第二批 |
| `/files` | 资源管理 - 文档 | P2 - 第三批 |
| `/workflow/tasks` | 流程中心 - 任务 | P1 - 第二批 |
| `/users` | 身份与权限 - 用户 | P0 - 第一批 |
| `/groups` | 身份与权限 - 组 | P0 - 第一批 |
| `/admin/*` | 系统管理 | P2 - 第三批 |

---

## 📦 组件共存机制

### 目录结构

```
frontend/src/components/
├── ui/              # 现有 shadcn/ui 组件（保持不变，逐步废弃）
├── v2/              # 新风格基础组件
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Badge.tsx
│   ├── Table.tsx
│   └── ...
├── layout/          # 全局布局（直接替换）
│   ├── AppShell.tsx
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   └── ...
└── shared/          # 业务共享组件（新建）
    ├── PageHeader.tsx
    ├── FilterBar.tsx
    ├── DataWorkspace.tsx
    ├── DetailDrawer.tsx
    ├── EmptyState.tsx
    └── ...
```

### 迁移规则

- **新页面**：直接使用 `components/v2/` 和 `components/shared/`
- **旧页面**：保持 `components/ui/`，等待迁移
- **全局布局**：直接替换 `Sidebar` 和 `Header`，不影响页面内容

---

## 🎯 页面类型与模板

### 1. 工作台页（Dashboard）

**适用页面**：`/`

**布局特征**：
- 顶部：面包屑 + 页面标题 + 全局操作
- 第一行：4 个关键指标卡片（待办、告警、变更、健康度）
- 主体：左侧表格（近期关键事项）+ 右侧任务面板（我的任务）
- 底部：常用业务入口（快捷卡片）

**UX 要点**：
- 指标卡片可点击跳转到详细列表
- 表格支持筛选（全部/高风险/待审批/CMDB）
- 任务按 SLA 排序，进度条可视化
- 常用入口提供快速跳转

### 2. 列表管理页（List + Detail Drawer）

**适用页面**：`/cmdb/instances`, `/change-docs`, `/devices`, `/users`, `/groups`

**布局特征**：
- 顶部：PageHeader（标题 + 统计 + 主操作）
- 筛选区：FilterBar（搜索 + 多维筛选 + 清除）
- 工具栏：批量操作 + 视图切换 + 列配置
- 表格：可选择、可排序、悬停高亮
- 详情抽屉：右侧滑出，分 Tab 展示详情、关联、历史

**UX 要点**：
- 筛选条件同步到 URL，可分享
- 表格选择行后，工具栏显示批量操作
- 点击行展开详情抽屉，不跳转页面
- 抽屉内可直接编辑、关联、查看拓扑
- 加载态：骨架屏（不要闪烁）
- 空态：说明原因 + 清除筛选 / 新建入口
- 错误态：重试按钮 + 问题追踪

### 3. 详情页（Detail + Tabs）

**适用页面**：`/devices/[id]`, `/cmdb/instances/by-model/[modelCode]/[id]`, `/change-docs/[id]`

**布局特征**：
- 顶部：状态栏（状态标签 + 创建/更新时间）
- 主信息卡：核心字段展示
- Tab 内容区：基本信息 / 关联对象 / 变更历史 / 审批记录
- 右侧：操作按钮组 + 审计日志 + 相关链接

**UX 要点**：
- 顶部状态栏固定，始终可见
- Tab 切换不重新加载页面
- 编辑模式：就地编辑（inline edit）或抽屉编辑
- 关联对象支持快速跳转
- 操作确认：删除/归档前弹出确认对话框

### 4. 全宽画布页（Canvas + Panels）

**适用页面**：`/cmdb/topology/[id]`, `/workflow/design`, `/files/preview/[id]`, `/cmdb/instances/2d-view`

**布局特征**：
- 顶部工具栏：模式切换 + 操作 + 导出
- 左侧：资源树 / 对象列表（可折叠）
- 中间：全宽画布（拓扑 / BPMN / 文件预览）
- 右侧：属性面板 / 图例（可折叠）

**UX 要点**：
- 不使用 `max-w-*` 限宽
- 画布支持缩放、平移、框选
- 左右面板可折叠，释放更多空间
- 移动端：提供只读摘要 + 桌面端提示

### 5. 表单页（Form）

**适用页面**：`/change-docs/new`, `/devices/new`, `/daily/new`

**布局特征**：
- 单列表单：`max-w-3xl` 居中
- 分步表单：顶部步骤条 + 内容区 + 底部操作
- 左右分栏：左侧表单 + 右侧预览

**UX 要点**：
- 必填字段标记清晰
- 实时校验，错误提示在字段下方
- 保存草稿功能
- 离开前提示未保存

---

## 🔄 迁移阶段与检查清单

### Phase 0: 基础设施（不破坏现有页面）

- [ ] **Task #5** - 创建 `MIGRATION.md`（本文档）
- [ ] **Task #4** - Design Token：新增 CSS 变量到 `globals.css` 或 Tailwind 配置
- [ ] **Task #6** - 建立 `components/v2/` 和 `components/shared/`
- [ ] **Task #1** - 重组 Sidebar 导航结构（全局替换）
- [ ] 升级 Header：面包屑 + 搜索 + 快捷操作（全局替换）

### Phase 1: 核心页面（P0）

#### 1.1 工作台首页 `/`
- [ ] **Task #2** - 实现工作台首页
  - [ ] 关键指标卡片组件
  - [ ] 近期关键事项表格
  - [ ] 我的任务面板
  - [ ] 常用业务入口
  - [ ] 响应式适配

#### 1.2 CMDB 实例列表 `/cmdb/instances`
- [ ] PageHeader 组件
- [ ] FilterBar 组件（搜索 + 模型筛选）
- [ ] 实例表格（支持列配置）
- [ ] DetailDrawer 组件（详情 + 关联 + 历史）
- [ ] 加载/空态/错误态

#### 1.3 变更文档列表 `/change-docs`
- [ ] 复用 PageHeader + FilterBar
- [ ] 变更文档表格（状态筛选）
- [ ] DetailDrawer（预览 + 审批记录）
- [ ] 状态标签统一

#### 1.4 设备列表 `/devices`
- [ ] 复用 PageHeader + FilterBar
- [ ] 设备表格（分组筛选）
- [ ] DetailDrawer（凭证展示）

#### 1.5 用户 & 组管理 `/users`, `/groups`
- [ ] 复用列表管理页模板
- [ ] 权限矩阵展示
- [ ] 批量操作

### Phase 2: 详情页与画布页（P1）

#### 2.1 CMDB 实例详情 `/cmdb/instances/by-model/[modelCode]/[id]`
- [ ] 状态栏 + 主信息卡
- [ ] Tab 组件（基本信息/关联/历史）
- [ ] 拓扑预览面板集成
- [ ] 就地编辑

#### 2.2 CMDB 拓扑全屏 `/cmdb/topology/[id]`
- [ ] 全宽画布布局
- [ ] 左侧资源树（可折叠）
- [ ] 右侧属性面板（可折叠）
- [ ] 工具栏（深度选择/对比/导出）

#### 2.3 变更文档详情 `/change-docs/[id]`
- [ ] 状态栏 + 审批进度
- [ ] Tab（基本信息/影响分析/审批记录/关联 CI）
- [ ] Word/PDF 导出

#### 2.4 流程任务 `/workflow/tasks`
- [ ] 任务列表（按 SLA 排序）
- [ ] 任务卡片（审批/转派/驳回）
- [ ] 流程实例跳转

### Phase 3: 低频页面（P2）

- [ ] IPAM `/ipam`
- [ ] 共享文档 `/files`
- [ ] 流程设计 `/workflow/design`
- [ ] 报表分析 `/reports`
- [ ] 系统管理 `/admin/*`

### Phase 4: 清理与优化

- [ ] 移除 `components/ui/` 中未使用的组件
- [ ] 将 `components/v2/` 重命名为 `components/ui/`
- [ ] 统一状态处理（Suspense + Error Boundary）
- [ ] 性能优化（代码分割、图片懒加载）
- [ ] 无障碍审计（ARIA 标签、键盘导航）

---

## 🧩 新旧组件对照表

| 用途 | 旧组件（ui/） | 新组件（v2/ 或 shared/） | 迁移状态 |
|------|--------------|------------------------|---------|
| 按钮 | `Button` | `v2/Button` | 待迁移 |
| 卡片 | `Card` | `v2/Card` | 待迁移 |
| 徽章 | `Badge` | `v2/Badge` | 待迁移 |
| 表格 | 原生 `<table>` | `v2/Table` | 待迁移 |
| 对话框 | `Dialog` | `v2/Dialog` | 待迁移 |
| 抽屉 | 无 | `shared/DetailDrawer` | 新建 |
| 页头 | 无 | `shared/PageHeader` | 新建 |
| 筛选栏 | 无 | `shared/FilterBar` | 新建 |
| 空态 | 无 | `shared/EmptyState` | 新建 |
| 状态标签 | 自定义 | `v2/StatusBadge` | 新建 |

---

## 🚨 Breaking Changes 记录

### 2026-06-21

- **Sidebar 导航结构重组**：一级导航从 12 项减少到 8 项，部分路由归属变化
  - 影响：用户需要适应新导航位置
  - 缓解：保留所有路由，只改变入口位置

- **全局布局宽度调整**：移除 `max-w-5xl` 限制
  - 影响：部分页面视觉宽度显著增加
  - 缓解：保持内容区合理的 padding 和间距

---

## 📊 迁移进度追踪

### 页面迁移状态

| 页面路径 | 页面类型 | 优先级 | 状态 | 负责人 | 完成日期 |
|---------|---------|-------|------|--------|---------|
| `/` | 工作台 | P0 | 未开始 | - | - |
| `/cmdb/instances` | 列表管理 | P0 | 未开始 | - | - |
| `/change-docs` | 列表管理 | P0 | 未开始 | - | - |
| `/devices` | 列表管理 | P0 | 未开始 | - | - |
| `/users` | 列表管理 | P0 | 未开始 | - | - |
| `/groups` | 列表管理 | P0 | 未开始 | - | - |
| `/cmdb/instances/by-model/[modelCode]/[id]` | 详情页 | P1 | 未开始 | - | - |
| `/cmdb/topology/[id]` | 画布页 | P1 | 未开始 | - | - |
| `/change-docs/[id]` | 详情页 | P1 | 未开始 | - | - |
| `/workflow/tasks` | 列表管理 | P1 | 未开始 | - | - |
| `/ipam` | 列表管理 | P2 | 未开始 | - | - |
| `/files` | 列表管理 | P2 | 未开始 | - | - |
| `/admin/*` | 配置页 | P2 | 未开始 | - | - |

### 组件开发状态

| 组件 | 路径 | 状态 | 测试覆盖 |
|------|------|------|---------|
| Button | `v2/Button` | 未开始 | - |
| Card | `v2/Card` | 未开始 | - |
| Badge | `v2/Badge` | 未开始 | - |
| Table | `v2/Table` | 未开始 | - |
| StatusBadge | `v2/StatusBadge` | 未开始 | - |
| PageHeader | `shared/PageHeader` | 未开始 | - |
| FilterBar | `shared/FilterBar` | 未开始 | - |
| DetailDrawer | `shared/DetailDrawer` | 未开始 | - |
| EmptyState | `shared/EmptyState` | 未开始 | - |

---

## 📝 UX 设计决策记录

### 2026-06-21

**决策 1：为什么采用详情抽屉而非独立详情页？**
- **原因**：企业用户常需要对比多个实例，抽屉可以保持列表上下文，快速切换
- **权衡**：复杂详情页仍需独立路由，抽屉内容不宜过长
- **实施**：列表页点击行打开抽屉，抽屉内提供"打开完整详情"按钮

**决策 2：为什么筛选条件同步到 URL？**
- **原因**：用户分享链接时能复现筛选视图，刷新页面保持状态
- **权衡**：URL 可能较长，需要考虑 URL 长度限制
- **实施**：使用 `useSearchParams` + `router.push`

**决策 3：为什么关键指标卡片可点击？**
- **原因**：从总览快速下钻到详细列表，减少导航跳转
- **权衡**：卡片既是展示又是链接，需要明确视觉暗示
- **实施**：悬停时显示箭头 icon + 卡片轻微抬升

---

## 🔗 相关文档

- [设计审计 v1](./open-design-refactor/audit.md)
- [重构计划 v1](./open-design-refactor/redesign-plan.md)
- [路由审计 v1](./open-design-refactor/notes/route-audit-v1.md)
- [OD 原型](./open-design-refactor/wireframes/)
- [CLAUDE.md 前端约定](../CLAUDE.md#前端约定)

---

## 💡 下一步行动

1. ✅ 完成本文档（MIGRATION.md）
2. ⏭️ Task #4：应用 Design Token 到 `globals.css` 和 Tailwind 配置
3. ⏭️ Task #6：建立 `components/v2/` 和 `components/shared/` 目录
4. ⏭️ Task #1：重组 Sidebar 导航结构
5. ⏭️ Task #2：实现工作台首页
6. ⏭️ 逐页迁移（按优先级 P0 → P1 → P2）

---

**最后更新**：2026-06-21  
**维护者**：Byron + Claude  
**状态**：✅ 初版完成，等待审阅
