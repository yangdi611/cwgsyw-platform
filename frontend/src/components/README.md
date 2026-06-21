# 组件库结构说明

本目录包含三个组件集合，用于支持前端 UX 重构的增量迁移策略。

## 📂 目录结构

```
components/
├── ui/          # 原有 shadcn/ui 组件（保持不变，逐步废弃）
├── v2/          # V2 设计系统基础组件（新建）
├── shared/      # 业务共享布局组件（新建）
└── layout/      # 全局布局组件（直接升级）
```

---

## 🎨 `v2/` - V2 设计系统基础组件

基于 V2 Design Token 的基础 UI 组件，用于替代 `ui/` 中的组件。

### 已实现组件

| 组件 | 文件 | 用途 |
|------|------|------|
| `Button` | `Button.tsx` | 按钮（primary/secondary/ghost/danger） |
| `Card` | `Card.tsx` | 卡片容器及子组件（Header/Title/Description/Content） |
| `StatusBadge` | `StatusBadge.tsx` | 状态标签（ok/warn/danger/neutral） |

### 使用示例

```tsx
import { Button, Card, CardHeader, CardTitle, CardContent, StatusBadge } from '@/components/v2'

export function ExamplePage() {
  return (
    <Card hover>
      <CardHeader>
        <CardTitle>标题</CardTitle>
      </CardHeader>
      <CardContent>
        <StatusBadge status="ok">健康</StatusBadge>
        <Button variant="primary" size="md">保存</Button>
      </CardContent>
    </Card>
  )
}
```

### 设计特点

- 使用 V2 Design Token（`bg-v2-primary`, `text-v2-fg` 等）
- 遵循 OD 原型的视觉规范（深蓝主色、圆角、阴影）
- 支持完整的 TypeScript 类型
- 使用 `forwardRef` 支持 ref 传递

### 待实现组件

- [ ] `Input` - 输入框
- [ ] `Select` - 下拉选择
- [ ] `Dialog` - 对话框
- [ ] `Table` - 表格
- [ ] `Tabs` - 标签页
- [ ] `Checkbox` - 复选框
- [ ] `Radio` - 单选框
- [ ] `Switch` - 开关

---

## 🧩 `shared/` - 业务共享布局组件

专用于构建统一页面布局模式的组件，支持列表页、详情页、工作台等场景。

### 已实现组件

| 组件 | 文件 | 用途 |
|------|------|------|
| `PageHeader` | `PageHeader.tsx` | 页面头部（标题/副标题/眼标/操作按钮） |
| `FilterBar` | `FilterBar.tsx` | 筛选栏（搜索框 + 筛选标签） |
| `EmptyState` | `EmptyState.tsx` | 空状态（图标 + 标题 + 描述 + 操作） |
| `Toolbar` | `Toolbar.tsx` | 工具栏（左右操作组 + 选中提示条） |
| `DataTable` | `DataTable.tsx` | 数据表格（排序/选择/分页/加载态/空态/错误态） |
| `DetailDrawer` | `DetailDrawer.tsx` | 详情抽屉（右侧滑出面板，自定义宽度） |
| `LoadingState` | `LoadingState.tsx` | 加载占位（骨架屏：表格/卡片/列表/详情） |
| `ErrorState` | `ErrorState.tsx` | 错误展示（图标 + 标题 + 描述 + 重试） |
| `MetricCard` | `MetricCard.tsx` | 指标卡（数值 + 趋势 + 描述，可交互） |

### 使用示例

```tsx
import { PageHeader, FilterBar, FilterChip, EmptyState } from '@/components/shared'
import { Button } from '@/components/v2'

export function ListPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CMDB"
        title="实例管理"
        subtitle="查询、筛选、维护实例，并从详情抽屉查看拓扑、告警和变更历史。"
        actions={<Button variant="primary">新建实例</Button>}
      />

      <FilterBar>
        <FilterChip active>全部</FilterChip>
        <FilterChip>生产环境</FilterChip>
        <FilterChip>测试环境</FilterChip>
      </FilterBar>

      <EmptyState
        title="暂无实例"
        description="当前筛选条件没有匹配的实例，请调整筛选条件或新建实例。"
        action={<Button variant="primary">新建实例</Button>}
      />
    </div>
  )
}
```

### 设计特点

- 统一页面布局模式（遵循 MIGRATION.md 中的页面类型规范）
- 响应式设计
- 可组合性强

### 完整使用示例

```tsx
import {
  PageHeader, FilterBar, FilterChip,
  Toolbar, DataTable, DetailDrawer,
  LoadingState, ErrorState, EmptyState,
  MetricCard,
} from '@/components/shared'
import { Button, StatusBadge } from '@/components/v2'

export function CmdbInstancesPage() {
  const [selected, setSelected] = useState<string[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CMDB"
        title="实例管理"
        actions={<Button variant="primary">新建实例</Button>}
      />

      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="总实例数" value="1,247" trend={{ label: "+12 本月", variant: "ok" }} />
      </div>

      <FilterBar>
        <FilterChip active>全部</FilterChip>
        <FilterChip>生产环境</FilterChip>
      </FilterBar>

      <Toolbar
        selectedCount={selected.length}
        onClearSelection={() => setSelected([])}
        right={<Button variant="secondary">导出</Button>}
      />

      <DataTable
        columns={[
          { key: 'name', label: '名称' },
          { key: 'status', label: '状态', render: (row) => <StatusBadge status="ok">在线</StatusBadge> },
        ]}
        data={instances}
        selectable
        onSelectionChange={setSelected}
        onRowClick={() => setDrawerOpen(true)}
      />

      <DetailDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="实例详情">
        {/* 详情内容 */}
      </DetailDrawer>
    </div>
  )
}
```

---

## 🏗️ `layout/` - 全局布局组件

用于应用级布局，包括 Sidebar、Header、Footer 等。这些组件会直接升级到 V2 设计系统。

### 现有组件

- `Sidebar.tsx` - 左侧导航（待重组为 8 模块架构）
- `Header.tsx` - 顶部栏（已升级：面包屑 + 搜索 + 快捷操作）
- `NotificationBell.tsx` - 通知铃铛

---

## 🔄 迁移策略

### 何时使用哪个组件库？

| 场景 | 使用 |
|------|------|
| **新建页面/组件** | `v2/` + `shared/` |
| **修改旧页面** | 保持 `ui/`，等待统一迁移 |
| **全局布局** | 直接升级 `layout/` |

### 导入路径

```tsx
// V2 基础组件
import { Button, Card } from '@/components/v2'

// 共享布局组件
import { PageHeader, FilterBar } from '@/components/shared'

// 旧组件（保持不变）
import { Button as OldButton } from '@/components/ui/button'
```

### 迁移检查清单

新页面/组件开发时：
- [ ] 使用 V2 Design Token（`bg-v2-*`, `text-v2-*`）
- [ ] 使用 `v2/` 和 `shared/` 组件
- [ ] 遵循 MIGRATION.md 中的页面类型规范
- [ ] 实现加载/空态/错误态
- [ ] 响应式适配（桌面/平板/手机）
- [ ] 键盘导航和无障碍

---

## 📚 相关文档

- [Design Token 指南](../../DESIGN_TOKENS.md) - 完整的 token 参考和示例
- [迁移计划](../../MIGRATION.md) - UX 重构路线图
- [OD 原型](../../open-design-refactor/wireframes/) - 设计原型文件

---

**最后更新**：2026-06-21  
**维护者**：Byron + Claude
