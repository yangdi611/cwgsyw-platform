# 重构实施计划 v1

## 视觉方向

采用成熟 B2B 工具台风格：

- 背景：浅灰工作区 + 白色内容面板
- 主色：深蓝 / 靛蓝，用于主行动和当前状态
- 辅色：青绿色，用于成功、联通、健康状态
- 风险色：琥珀和红色，仅用于告警
- 字体：系统 sans，强调清晰和稳定
- 装饰：少阴影、细边框、清晰密度，不做营销页式大渐变

## 新一级导航

1. 工作台
2. CMDB
3. 变更文档
4. 资源管理
5. 流程中心
6. 报表分析
7. 身份与权限
8. 系统管理

## 页面类型规范

### 工作台页

适用：

- `/`

布局：

- 顶部：欢迎语 + 全局搜索 + 快捷操作
- 第一行：待办、告警、变更、资产健康
- 主体：左侧业务动态，右侧我的任务
- 底部：常用模块入口

### 列表管理页

适用：

- `/cmdb/instances`
- `/devices`
- `/ipam`
- `/change-docs`
- `/users`
- `/groups`
- `/workflow/tasks`

布局：

- PageHeader
- FilterBar
- Toolbar
- DataTable
- DetailDrawer

### 详情页

适用：

- `/devices/[id]`
- `/ipam/[id]`
- `/daily/[id]`
- `/change-docs/[id]`
- `/cmdb/instances/by-model/[modelCode]/[id]`

布局：

- 顶部状态栏
- 主信息卡
- Tab 内容区
- 右侧操作 / 审计 / 关联对象

### 全宽画布页

适用：

- `/cmdb/topology/[instanceId]`
- `/cmdb/instances/2d-view`
- `/workflow/design`
- `/files/preview/[id]`

布局：

- 顶部工具栏
- 左侧资源树 / 对象列表
- 中间画布
- 右侧属性面板
- 不使用 `max-w-*` 限宽

## 响应式规则

### ≥ 1440px

- Sidebar 固定 260px
- 主内容全宽
- 表格 + 右侧详情抽屉并排
- 工作台使用 12 栅格

### 1024px - 1439px

- Sidebar 可折叠
- 筛选区两行
- 详情抽屉宽度 420px

### 768px - 1023px

- Sidebar 改为窄图标栏或抽屉
- 工作台双栏
- 表格保留关键列

### < 768px

- Sidebar 改为底部/抽屉导航
- 表格转卡片
- 复杂画布提供只读摘要和桌面提示
