# V2 Design Token 使用指南

V2 Design Token 已添加到 `src/app/globals.css`，可通过 CSS 变量或 Tailwind 工具类使用。

---

## 🎨 色彩系统

### 背景与表面

| Token | CSS 变量 | Tailwind 类 | 用途 |
|-------|---------|------------|------|
| 全局背景 | `var(--v2-bg)` | `bg-v2-bg` | 页面整体背景 `#f5f7fb` |
| 卡片表面 | `var(--v2-surface)` | `bg-v2-surface` | 卡片/面板背景 `#ffffff` |
| 柔和表面 | `var(--v2-surface-soft)` | `bg-v2-surface-soft` | 输入框、表头 `#f8fafc` |
| 悬停表面 | `var(--v2-surface-hover)` | `hover:bg-v2-surface-hover` | 行悬停态 `#f9fbff` |

**示例**：
```tsx
// 页面容器
<div className="min-h-screen bg-v2-bg">
  {/* 卡片 */}
  <div className="bg-v2-surface rounded-v2-lg border border-v2-border p-6">
    {/* 内容 */}
  </div>
</div>
```

### 文本颜色

| Token | CSS 变量 | Tailwind 类 | 用途 |
|-------|---------|------------|------|
| 主文本 | `var(--v2-fg)` | `text-v2-fg` | 标题、正文 `#101828` |
| 次要文本 | `var(--v2-muted)` | `text-v2-muted` | 辅助说明、标签 `#667085` |
| 淡文本 | `var(--v2-subtle)` | `text-v2-subtle` | 占位符、禁用 `#98a2b3` |

**示例**：
```tsx
<div>
  <h2 className="text-xl font-bold text-v2-fg">标题</h2>
  <p className="text-sm text-v2-muted">这是辅助说明文本</p>
</div>
```

### 边框

| Token | CSS 变量 | Tailwind 类 | 用途 |
|-------|---------|------------|------|
| 常规边框 | `var(--v2-border)` | `border-v2-border` | 卡片、输入框 `#e4e7ec` |
| 加强边框 | `var(--v2-border-strong)` | `border-v2-border-strong` | 悬停态、分隔 `#d0d5dd` |

**示例**：
```tsx
<button className="border border-v2-border hover:border-v2-border-strong">
  按钮
</button>
```

### 主色（深蓝）

| Token | CSS 变量 | Tailwind 类 | 用途 |
|-------|---------|------------|------|
| 主色 | `var(--v2-primary)` | `bg-v2-primary` `text-v2-primary` | 主按钮、链接、活动状态 `#1d4ed8` |
| 悬停 | `var(--v2-primary-hover)` | `hover:bg-v2-primary-hover` | 按钮悬停 `#1e40af` |
| 淡背景 | `var(--v2-primary-soft)` | `bg-v2-primary-soft` | Tag、选中背景 `#eff6ff` |
| 淡边框 | `var(--v2-primary-border)` | `border-v2-primary-border` | Tag 边框 `#bfdbfe` |

**示例**：
```tsx
{/* Primary Button */}
<button className="bg-v2-primary hover:bg-v2-primary-hover text-white px-4 py-2 rounded-v2-md">
  新建变更
</button>

{/* Primary Tag */}
<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-v2-primary-soft text-v2-primary border border-v2-primary-border">
  进行中
</span>
```

### 成功（青绿）

| Token | CSS 变量 | Tailwind 类 | 用途 |
|-------|---------|------------|------|
| 成功色 | `var(--v2-success)` | `text-v2-success` | 成功文本 `#067647` |
| 淡背景 | `var(--v2-success-soft)` | `bg-v2-success-soft` | 成功标签背景 `#ecfdf3` |
| 淡边框 | `var(--v2-success-border)` | `border-v2-success-border` | 成功标签边框 `#abefc6` |

**示例**：
```tsx
<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-v2-success-soft text-v2-success border border-v2-success-border">
  健康
</span>
```

### 警告（琥珀）

| Token | CSS 变量 | Tailwind 类 | 用途 |
|-------|---------|------------|------|
| 警告色 | `var(--v2-warning)` | `text-v2-warning` | 警告文本 `#b54708` |
| 淡背景 | `var(--v2-warning-soft)` | `bg-v2-warning-soft` | 警告标签背景 `#fffaeb` |
| 淡边框 | `var(--v2-warning-border)` | `border-v2-warning-border` | 警告标签边框 `#fedf89` |

**示例**：
```tsx
<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-v2-warning-soft text-v2-warning border border-v2-warning-border">
  待确认
</span>
```

### 危险（红色）

| Token | CSS 变量 | Tailwind 类 | 用途 |
|-------|---------|------------|------|
| 危险色 | `var(--v2-danger)` | `text-v2-danger` | 错误文本、删除 `#b42318` |
| 淡背景 | `var(--v2-danger-soft)` | `bg-v2-danger-soft` | 错误标签背景 `#fef3f2` |
| 淡边框 | `var(--v2-danger-border)` | `border-v2-danger-border` | 错误标签边框 `#fecdca` |

**示例**：
```tsx
<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-v2-danger-soft text-v2-danger border border-v2-danger-border">
  高危
</span>

<button className="bg-v2-danger hover:bg-red-700 text-white px-4 py-2 rounded-v2-md">
  删除
</button>
```

### Sidebar（深蓝黑）

| Token | CSS 变量 | Tailwind 类 | 用途 |
|-------|---------|------------|------|
| Sidebar 背景 | `var(--v2-sidebar)` | `bg-v2-sidebar` | 主背景 `#0f172a` |
| Sidebar 渐变2 | `var(--v2-sidebar-2)` | `bg-v2-sidebar-2` | 渐变底部 `#111c33` |
| Sidebar 边框 | `var(--v2-sidebar-border)` | `border-v2-sidebar-border` | 边框 `rgba(255,255,255,0.08)` |
| Sidebar 次要文本 | `var(--v2-sidebar-muted)` | `text-v2-sidebar-muted` | 分组标题 `#94a3b8` |
| Sidebar 前景 | `var(--v2-sidebar-fg)` | `text-v2-sidebar-fg` | 导航文字 `#e5e7eb` |

**示例**：
```tsx
<aside className="bg-gradient-to-b from-v2-sidebar to-v2-sidebar-2 text-v2-sidebar-fg border-r border-v2-sidebar-border">
  <div className="text-xs uppercase tracking-wider text-v2-sidebar-muted">
    核心工作
  </div>
  <button className="w-full text-left px-4 py-2 hover:bg-white/10">
    工作台
  </button>
</aside>
```

---

## 📐 间距与圆角

### 圆角

| Token | CSS 变量 | Tailwind 类 | 用途 | 值 |
|-------|---------|------------|------|-----|
| 小 | `var(--v2-radius-sm)` | `rounded-v2-sm` | Tag、小按钮 | `8px` |
| 中 | `var(--v2-radius-md)` | `rounded-v2-md` | 按钮、输入框 | `12px` |
| 大 | `var(--v2-radius-lg)` | `rounded-v2-lg` | 卡片、面板 | `16px` |

**示例**：
```tsx
<div className="bg-v2-surface border border-v2-border rounded-v2-lg p-6">
  <button className="bg-v2-primary text-white px-4 py-2 rounded-v2-md">
    保存
  </button>
</div>
```

### 阴影

| Token | CSS 变量 | Tailwind 类 | 用途 |
|-------|---------|------------|------|
| 小阴影 | `var(--v2-shadow-sm)` | `shadow-v2-sm` | 卡片、按钮 |
| 中阴影 | `var(--v2-shadow-md)` | `shadow-v2-md` | 悬停态、对话框 |

**示例**：
```tsx
<div className="bg-v2-surface rounded-v2-lg border border-v2-border shadow-v2-sm hover:shadow-v2-md transition-shadow">
  卡片内容
</div>
```

---

## 🔤 字体

| Token | CSS 变量 | Tailwind 类 | 用途 |
|-------|---------|------------|------|
| Sans | `var(--v2-font-sans)` | `font-v2-sans` | 正文、界面 |
| Mono | `var(--v2-font-mono)` | `font-v2-mono` | 代码、ID、数字 |

**字体栈**：
- Sans: `-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`
- Mono: `"SF Mono", "Cascadia Code", monospace`

**示例**：
```tsx
<div className="font-v2-sans">
  <h1 className="text-2xl font-bold">标题使用 Sans</h1>
  <code className="font-v2-mono text-sm">instance-id-12345</code>
</div>
```

---

## 🎯 完整示例

### 指标卡片（Metric Card）

```tsx
export function MetricCard({ label, value, trend, trendType }: MetricCardProps) {
  const trendColors = {
    ok: 'bg-v2-success-soft text-v2-success border-v2-success-border',
    warn: 'bg-v2-warning-soft text-v2-warning border-v2-warning-border',
    danger: 'bg-v2-danger-soft text-v2-danger border-v2-danger-border',
  }

  return (
    <div className="bg-v2-surface border border-v2-border rounded-v2-lg p-4 shadow-v2-sm hover:shadow-v2-md hover:border-v2-primary-border transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-v2-muted">{label}</span>
        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${trendColors[trendType]}`}>
          {trend}
        </span>
      </div>
      <div className="text-3xl font-bold text-v2-fg font-v2-mono">{value}</div>
    </div>
  )
}

// 使用
<MetricCard 
  label="待处理审批" 
  value={18} 
  trend="+5 超时" 
  trendType="warn"
/>
```

### 状态标签（Status Badge）

```tsx
export function StatusBadge({ status, children }: StatusBadgeProps) {
  const variants = {
    ok: 'bg-v2-success-soft text-v2-success border-v2-success-border',
    warn: 'bg-v2-warning-soft text-v2-warning border-v2-warning-border',
    danger: 'bg-v2-danger-soft text-v2-danger border-v2-danger-border',
    neutral: 'bg-v2-surface-soft text-v2-muted border-v2-border',
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${variants[status]}`}>
      {children}
    </span>
  )
}

// 使用
<StatusBadge status="ok">健康</StatusBadge>
<StatusBadge status="warn">待审批</StatusBadge>
<StatusBadge status="danger">高风险</StatusBadge>
```

### 主按钮（Primary Button）

```tsx
<button className="bg-v2-primary hover:bg-v2-primary-hover text-white px-4 py-2 rounded-v2-md shadow-v2-sm transition-colors font-semibold">
  新建变更
</button>
```

### 次要按钮（Secondary Button）

```tsx
<button className="bg-v2-surface border border-v2-border hover:border-v2-border-strong text-v2-fg px-4 py-2 rounded-v2-md shadow-v2-sm hover:bg-v2-surface-hover transition-colors">
  取消
</button>
```

### 卡片容器

```tsx
<div className="bg-v2-surface border border-v2-border rounded-v2-lg shadow-v2-sm">
  {/* 卡片头部 */}
  <div className="px-6 py-4 border-b border-v2-border">
    <h3 className="text-lg font-bold text-v2-fg">标题</h3>
    <p className="text-sm text-v2-muted mt-1">辅助说明</p>
  </div>

  {/* 卡片内容 */}
  <div className="p-6">
    内容区域
  </div>
</div>
```

### 表格行悬停

```tsx
<table className="w-full">
  <thead className="bg-v2-surface-soft">
    <tr>
      <th className="px-4 py-3 text-left text-xs font-bold text-v2-muted uppercase tracking-wider">
        名称
      </th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-v2-border hover:bg-v2-surface-hover transition-colors">
      <td className="px-4 py-3 text-sm text-v2-fg">数据行</td>
    </tr>
  </tbody>
</table>
```

---

## 🔄 迁移策略

### 旧组件（保持不变）

使用现有的 shadcn/ui token：
```tsx
// 旧组件继续使用这些
className="bg-background text-foreground border-border"
```

### 新组件（使用 V2）

使用 V2 Design Token：
```tsx
// 新组件使用 v2- 前缀
className="bg-v2-bg text-v2-fg border-v2-border"
```

### 何时使用哪个？

- **新建页面/组件** → 使用 V2 Token
- **修改旧页面/组件** → 暂时保持原 Token，等待统一迁移
- **全局布局（Sidebar/Header）** → 直接使用 V2 Token

---

## 📚 参考

- [迁移计划](./MIGRATION.md)
- [OD 原型](./open-design-refactor/wireframes/mqnvbkga-00-shell-2-2.html)
- [Tailwind CSS v4 文档](https://tailwindcss.com/docs)

---

**最后更新**：2026-06-21  
**维护者**：Byron + Claude
