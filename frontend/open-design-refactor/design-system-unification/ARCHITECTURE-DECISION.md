# UI / V2 合并架构决策 v1.0

## 1. 决策结论

项目收敛为两层公开组件体系：

1. `components/design-system`：基础交互组件和少量语义组件的唯一入口。
2. `components/shared`：页面级、业务级组合组件，继续保留。

`components/ui` 和 `components/v2` 不再作为业务页面的长期公开入口。迁移期间保留它们，作为内部实现或兼容转发层，避免一次性重写所有页面。

## 2. 职责边界

### 2.1 Design System 基础组件

负责稳定、可复用、无业务知识的组件：

- Button、Input、Textarea、Label
- Select、Checkbox、Switch、Radio
- Dialog、AlertDialog、Popover、DropdownMenu、Tooltip
- Card、Badge、StatusBadge、Chip
- Table、Skeleton、Avatar、Separator、Toast

基础组件可以包含视觉 token、键盘行为、焦点管理和 aria 属性，但不得请求 API、读取权限、拼接业务路由或依赖领域状态机。

### 2.2 Shared 页面组合组件

负责页面结构和跨页面交互模式：

- PageHeader、DetailHeader
- PageShell、FormShell、WorkspaceShell、WorkspaceToolbar
- FilterBar、Toolbar、DataTable、Pagination
- DetailDrawer、LoadingState、ErrorState、EmptyState
- MetricCard、PermissionGuard

这些组件可以组合基础组件，但不得反向把业务 API 和领域状态塞回基础组件。

### 2.3 领域组件

Wiki Markdown、React Flow、BPMN、Konva、文件预览、CMDB 空间布局和任务模板设计器继续留在领域目录。它们只使用统一的基础组件和页面 Shell，不被强行改造成普通 Card 或 DataTable。

## 3. 公开导入规则

```tsx
import { Button, Dialog, StatusBadge } from '@/components/design-system'
import { DataTable, PageShell } from '@/components/shared'
```

禁止新代码：

```tsx
import { Button } from '@/components/ui/button'
import { Button } from '@/components/v2/Button'
```

迁移期间旧页面可以保留直接引用，但每个迁移批次必须减少 legacy 引用，不能新增新的 `ui`/`v2` 业务引用。

## 4. 兼容策略

- 先以当前 V2 token 和行为为目标，不先改变业务页面视觉语言。
- `v2` 组件迁移后可以改为从 `design-system` re-export，保持旧导入路径短期可用。
- `ui` 组件保留底层实现，直到没有业务页面直接引用。
- 组件 API 优先兼容现有 V2 API；有冲突时新增显式适配，而不是通过 `any` 或隐式 prop 兼容。
- 组件内部底层实现可以从 Base UI 切换到 React Aria，但页面调用合同不应随底层替换而改变。

## 5. 不可变业务边界

迁移不得改变：

- API、DTO、请求方法和响应处理。
- React Query query key、分页参数、筛选参数和 URL 结构。
- 权限判断、资源类型、路由地址和重定向。
- 审批、发布、归档、删除、保存等状态机。
- Wiki、BPMN、React Flow、空间布局和文件预览的领域交互。

## 6. 为什么不合成一个超大文件

统一管理不等于把所有组件写进一个文件。每个基础组件单独维护，加一个 `index.ts` 统一导出，能够同时满足：

- 页面只有一个稳定入口。
- 单个组件有清晰责任和测试边界。
- Intent UI 或 Base UI 可以替换内部实现。
- 迁移冲突不会集中到一个超大文件。
