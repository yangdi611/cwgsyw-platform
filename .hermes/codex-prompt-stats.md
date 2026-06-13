# Claude Code Task: CMDB 变更统计面板前端页面

## 任务
在 cwgsyw-platform 前端项目中创建 CMDB 变更统计面板页面。

## 路由
- 页面路径: `frontend/src/app/(dashboard)/cmdb/changes/stats/page.tsx`

## 后端 API
`GET /api/cmdb/changes/stats` 已存在，返回 `R<ChangeStatsVO>`:

```typescript
interface ChangeStatsVO {
  today: ActionCountVO;
  thisWeek: ActionCountVO;
  thisMonth: ActionCountVO;
  dailyBreakdown: DailyCountVO[];    // 每日统计，用于折线图
  top10Instances: TopInstanceVO[];   // 过去30天变更最频繁的10个实例
}

interface ActionCountVO {
  created: number;
  updated: number;
  deleted: number;
  total: number;
}

interface DailyCountVO {
  date: string;       // yyyy-MM-dd
  created: number;
  updated: number;
  deleted: number;
}

interface TopInstanceVO {
  instanceId: number;
  instanceName: string;
  modelId: string;
  modelName: string;
  changeCount: number;
}
```

## 要求

### 1. 创建页面文件
在 `frontend/src/app/(dashboard)/cmdb/changes/stats/page.tsx` 创建页面组件：

- 使用 `'use client'`
- 用 `@tanstack/react-query` 的 `useQuery` 调用 `GET /api/cmdb/changes/stats`
- 权限守卫：`useEffect` 检查 `hasPermission('cmdb_change', 'read')`，无权则 `router.replace('/')`
- 标题：CMDB 变更统计

### 2. 页面布局
使用 shadcn/ui 组件，展示以下统计信息：

#### 概览卡片 (3 个 Overview Card)
- **今日变更**: today.total (created/updated/deleted breakdown)
- **本周变更**: thisWeek.total
- **本月变更**: thisMonth.total
- 使用 shadcn `Card` 组件

#### 每日趋势图 (dailyBreakdown)
- 使用柱状图或折线图展示 dailyBreakdown 数据
- X 轴：日期，Y 轴：变更数量
- 三种颜色区分 created / updated / deleted
- 可以用简单的 CSS div 条形图，也可以使用 recharts（如果已安装）

#### Top10 变更频繁实例
- 表格展示 top10Instances
- 列：实例名称、模型名称、变更次数
- 使用 shadcn `Table` 组件

### 3. 加载状态
- 显示 Skeleton 加载状态

### 4. 空数据状态
- 没有数据时显示友好提示

### 5. Sidebar 导航
在 `frontend/src/components/layout/Sidebar.tsx` 添加：
```typescript
{ href: '/cmdb/changes/stats', label: 'CMDB 统计', icon: BarChart2, resource: 'cmdb_change', action: 'read' }
```
注意: `BarChart2` 已在 import 中。

## 约束（硬约束）
1. 只修改前端文件
2. 使用 API 前缀 `/api`（已在 axios instance 中配置 baseURL）
3. 使用 shadcn/ui 组件（`card.tsx`, `table.tsx`, `skeleton.tsx`, `badge.tsx` 等已安装）
4. 使用 Tailwind v4 样式
5. 图表不需要额外依赖 — 用纯 CSS + div 实现简单的柱状图即可（更轻量）
6. 不允许创建新的 npm 包依赖

## 验收标准
1. 页面在 `/cmdb/changes/stats` 路由可访问
2. 正确调用 `GET /api/cmdb/changes/stats` 并展示数据
3. 侧边栏有 CMDB 统计入口
4. 有加载状态和空数据状态处理
5. 无权限时跳转首页
