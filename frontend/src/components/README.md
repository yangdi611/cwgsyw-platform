# 组件库结构说明

本目录记录当前前端共享组件入口。它只用于消费者和运行时能力盘点，不是 Figma Neutral 新设计的视觉、Token 或组件 API 来源。

## 📂 目录结构

```
components/
├── design-system/ # 基础 UI 唯一公开入口
├── shared/        # 业务共享布局组件
├── ui/            # design-system 迁移期内部实现
├── v2/            # design-system 迁移期兼容入口
└── layout/        # 全局布局组件
```

---

## 🎨 `design-system/` - 当前基础 UI 公开入口

这是当前系统的基础 UI 公开入口。未来迁移切片必须按正式 Figma 资产建立 React 映射并迁移消费者；在对应切片通过前，不得把当前 Props、Token 或外观反向定义为新设计。

### 已实现组件

| 组件 | 文件 | 用途 |
|------|------|------|
| `Button` | `design-system/Button.tsx` | 按钮（primary/secondary/ghost/danger） |
| `Card` | `design-system/Card.tsx` | 卡片容器及子组件（Header/Title/Description/Content） |
| `StatusBadge` | `design-system/StatusBadge.tsx` | 状态标签（ok/warn/danger/neutral） |

### 使用示例

```tsx
import { Button, Card, CardHeader, CardTitle, CardContent, StatusBadge } from '@/components/design-system'

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

- 当前实现包含历史 Token 和视觉语义，仅用于运行时基线盘点
- 新设计的普通 UI 只使用 Neutral，Status 色只表达真实状态
- 支持完整的 TypeScript 类型
- 使用 `forwardRef` 支持 ref 传递

### 待实现组件

- [x] `Input` - 输入框
- [x] `Select` - 下拉选择
- [x] `Dialog` - 对话框
- [x] `Table` - 表格
- [ ] `Tabs` - 标签页
- [x] `Checkbox` - 复选框
- [ ] `Radio` - 单选框
- [x] `Switch` - 开关

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
import { Button } from '@/components/design-system'

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

- 统一页面布局模式（遵循 `docs/migration/figma-neutral-frontend/` 中的 Pattern 与页面矩阵）
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
import { Button, StatusBadge } from '@/components/design-system'

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

用于应用级布局，包括 Sidebar、Header、Footer 等。未来由正式 Page Pattern 和对应迁移切片逐步替换，不能沿用旧显色作为目标。

### 现有组件

- `Sidebar.tsx` - 左侧导航（待重组为 8 模块架构）
- `Header.tsx` - 顶部栏（已升级：面包屑 + 搜索 + 快捷操作）
- `NotificationBell.tsx` - 通知铃铛

---

## 🔄 迁移策略

### 何时使用哪个组件库？

| 场景 | 使用 |
|------|------|
| **非迁移功能变更** | 保持现有入口，不顺带改变视觉或扩大旧入口消费者 |
| **Figma Neutral 迁移切片** | 使用该切片建立并验证的正式 React 组件与 Pattern |
| **全局布局迁移** | 按正式 Page Pattern 独立实施和验证 |

### 导入路径

```tsx
// 基础组件唯一公开入口
import { Button, Card } from '@/components/design-system'

// 共享布局组件
import { PageHeader, FilterBar } from '@/components/shared'

// ui/v2 是历史兼容入口；Figma Neutral 迁移不得新增其消费者。
```

### 迁移检查清单

新页面/组件开发时：
- [ ] 只消费当前迁移切片已实现的正式 Figma Token 和 React API
- [ ] 不新增 `ui/`、`v2/` 或其他历史视觉入口消费者
- [ ] 遵循 `docs/migration/figma-neutral-frontend/` 中的 Pattern 与页面迁移规范
- [ ] 实现加载/空态/错误态
- [ ] 响应式适配（桌面/平板/手机）
- [ ] 键盘导航和无障碍

---

## 📚 相关文档

- [Figma Neutral 设计与迁移资料包](../../../docs/migration/figma-neutral-frontend/README.md) - 正式设计源、迁移计划与验证入口

---

**最后更新**：2026-06-21  
**维护者**：Byron + Claude
