# 组件库结构说明

视觉组件的唯一来源是 `@/design-system/figma-neutral/components`。
本目录只保留业务共享非视觉能力和全局布局。

## 目录

```
components/
├── shared/        # PermissionGuard
├── layout/        # Header / Sidebar / CommandPalette
└── ui/            # 无业务消费者，待后续从仓库移除
```

旧 `@/components/design-system`、`@/components/v2` 和 `@/components/ui` 已在 M8 删除。
eslint 禁止业务代码再引用它们。

```tsx
import { Button, Card, StatusBadge } from '@/design-system/figma-neutral/components'
```
