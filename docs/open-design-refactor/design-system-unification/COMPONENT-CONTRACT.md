# Design System 组件合同 v1.0

## 1. 通用合同

所有基础组件必须：

- 使用 TypeScript，公开 props 不使用无边界 `any`。
- 支持 `className`，并使用项目 `cn` 合并 Tailwind 类。
- 保持 `ref` 转发或使用底层组件等价的 ref 能力。
- 明确 disabled、loading、invalid、focus-visible 和 dark mode 状态。
- 不读取 API、权限、路由或全局业务 store。
- 不通过内部默认值改变调用方已有的业务语义。

## 2. 目标 API 约定

### Button

```tsx
<Button variant="primary|secondary|ghost|danger" size="sm|md|lg" loading={false}>
  保存
</Button>
```

- `primary` 只用于当前页面的主要动作。
- `danger` 用于删除、撤销等不可逆动作。
- `loading` 时禁止重复提交并保留按钮尺寸。
- 不能通过 loading 导致布局跳动。

### Input / Textarea / Label

- 原生 value、defaultValue、onChange、name、id、disabled、readOnly、required 语义保持兼容。
- 错误状态通过 `aria-invalid` 和显式描述关联，不只依赖红色边框。
- Label 与控件必须保持可访问关联。

### Select

- 保留 controlled/uncontrolled 两种使用方式。
- 支持 placeholder、disabled、invalid、键盘上下选择、Escape 关闭和焦点回收。
- 长选项列表只能由 Select 内部滚动，不得撑高页面。

### Dialog / AlertDialog

- 打开时焦点进入内容区，关闭时回到触发元素。
- Escape 和点击遮罩行为必须符合组件合同。
- 长内容使用内部滚动，不能产生 Dashboard 外层双滚动。
- AlertDialog 必须明确 destructive 操作语义，不能把普通 Dialog 当确认框替代。

### Card / Badge / StatusBadge / Chip

- Card 只负责表面、边框、圆角和内间距，不承载 API 或导航。
- StatusBadge 的状态集合必须有限、可枚举，并与业务状态映射分离。
- 不通过自由字符串拼接任意颜色类。

### Table

- 基础 Table 只负责结构和可访问标记。
- 排序、分页、请求和权限留在页面或 `shared/DataTable`。
- 宽表必须有明确的内部横向滚动容器，不能撑破主页面。

## 3. 统一 token 规则

颜色、圆角、阴影和字体集中定义在 `frontend/src/app/globals.css` 的 `--v2-*` token。基础组件优先引用 `bg-v2-*`、`text-v2-*`、`border-v2-*` 等工具类，不在组件内部大量写硬编码颜色。

当前浅色全局背景已经调整为 `#f7f8fa`，本次组件合并不重新设计颜色体系；视觉变更需要单独记录为 token 变更。

## 4. 命名和目录

- 文件名使用 PascalCase。
- 公开导出集中在 `components/design-system/index.ts`。
- 兼容 re-export 不新增第二套行为，只转发到 design-system。
- `components/shared` 不从 `design-system` 反向导出，避免基础层依赖页面层。
