# 侧边栏重构设计规格

**日期：** 2026-05-26
**状态：** 已批准，待实施
**分支：** `feat/sidebar-redesign`

---

## 目标

将现有 14 个顶层侧边栏条目整理为 3 个语义分组，减少认知负担，同时保持与现有 CMDB 分组完全一致的视觉风格。

---

## 分组结构

### 顶层（不分组）

| 条目 | 路由 | 权限 |
|------|------|------|
| 🏠 首页 | `/` | 无 |

### 📋 日常工作（默认展开）

| 条目 | 路由 | 权限 |
|------|------|------|
| 我的日报 | `/daily` | `daily_report:read` |
| 待审批 | `/workflow/tasks` | `workflow:read` |
| 通知中心 | `/notifications` | `notification:read` |

### 🔧 IT 运维工具（默认展开）

| 条目 | 路由 | 权限 |
|------|------|------|
| CMDB（子组保留） | `/cmdb` | `cmdb_instance:read` |
| 设备密码库 | `/devices` | `device:read` |
| 变更文档 | `/change-docs` | `change_doc:read` |
| 报表导出 | `/reports` | `daily_report:export` |

### ⚙️ 配置（默认折叠）

| 条目 | 路由 | 权限 |
|------|------|------|
| 用户管理 | `/users` | `user:read` |
| 组管理 | `/groups` | `group:read` |
| 角色权限 | `/rbac/roles` | `role:read` |
| 变更模板 | `/admin/change-doc-templates` | `change_doc_template:read` |
| 系统配置 | `/admin/config` | `notification:manage` |
| 审计日志 | `/admin/audit` | `audit:read` |

---

## 技术实现

### 文件

- 修改：`frontend/src/components/layout/Sidebar.tsx`

### 实现方式

复用现有 `NavGroup` / `NavGroupItem` / `usePersistState` 机制，与 CMDB 分组完全一致：

```typescript
// 新增两个 NavGroup 条目
{
  label: '日常工作',
  icon: ClipboardList,
  resource: 'daily_report',
  action: 'read',
  storageKey: 'sidebar_daily_open',   // localStorage key，默认 true
  children: [
    { href: '/daily',          label: '我的日报', icon: FileText,  resource: 'daily_report', action: 'read' },
    { href: '/workflow/tasks', label: '待审批',   icon: CheckSquare, resource: 'workflow',   action: 'read' },
    { href: '/notifications',  label: '通知中心', icon: Bell,      resource: 'notification', action: 'read' },
  ],
},
{
  label: 'IT 运维工具',
  icon: Wrench,
  resource: 'device',
  action: 'read',
  storageKey: 'sidebar_ops_open',     // localStorage key，默认 true
  children: [
    // CMDB 保持现有 NavGroup 嵌套（CMDB 本身仍是子分组）
    { href: '/devices',      label: '设备密码库', icon: KeyRound, resource: 'device',      action: 'read' },
    { href: '/change-docs',  label: '变更文档',   icon: FileText, resource: 'change_doc',  action: 'read' },
    { href: '/reports',      label: '报表导出',   icon: BarChart2, resource: 'daily_report', action: 'export' },
  ],
},
{
  label: '配置',
  icon: Settings,
  resource: 'user',
  action: 'read',
  storageKey: 'sidebar_config_open',  // localStorage key，默认 false
  children: [
    { href: '/users',                        label: '用户管理', icon: Users,       resource: 'user',                 action: 'read' },
    { href: '/groups',                       label: '组管理',   icon: Building2,   resource: 'group',                action: 'read' },
    { href: '/rbac/roles',                   label: '角色权限', icon: Shield,      resource: 'role',                 action: 'read' },
    { href: '/admin/change-doc-templates',   label: '变更模板', icon: FileCode,    resource: 'change_doc_template',  action: 'read' },
    { href: '/admin/config',                 label: '系统配置', icon: Settings,    resource: 'notification',         action: 'manage' },
    { href: '/admin/audit',                  label: '审计日志', icon: ClipboardList, resource: 'audit',              action: 'read' },
  ],
},
```

### CMDB 嵌套处理

CMDB 本身是 `NavGroup`（有子项：搜索/CI资源/配置管理），它作为 "IT 运维工具" 分组的一个子条目。由于 `NavGroupItem` 目前只支持 `NavItem` 子项，需要将 CMDB 作为特殊子项处理：

**注意：** 父级 `resource/action` 仅用于判断分组是否对当前用户可见。"IT 运维工具"和"配置"分组的父级权限应设为子项中最宽松的一个（即任一子项有权限则显示分组）。实施时 `NavGroupItem` 已有 `visibleChildren.length === 0` 的隐藏逻辑，父级 resource/action 可设为子项中最基础的权限（如 `device:read`），实际子项仍各自独立守卫。

### 默认展开状态

`usePersistState` 的 `initial` 参数控制默认状态：
- `sidebar_daily_open` → `initial = true`（默认展开）
- `sidebar_ops_open` → `initial = true`（默认展开）
- `sidebar_config_open` → `initial = false`（默认折叠）

---

## 不在本次范围

- 侧边栏宽度调整
- 图标更换（保持现有 lucide-react 图标）
- 移动端响应式
- 侧边栏收起/展开切换

---

## 文件变更

- 修改：`frontend/src/components/layout/Sidebar.tsx`（约 50 行改动）
