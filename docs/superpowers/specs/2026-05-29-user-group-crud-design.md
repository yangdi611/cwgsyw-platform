# 用户/组管理 CRUD 功能补充 — 设计规格

## 背景

超级管理员的用户管理和组管理前端页面目前是纯只读列表，缺少增删改的完整 UI。后端用户 API 完整但组管理缺少 DELETE 端点。

## 目标

补充用户管理和组管理的完整 CRUD 功能，包括后端 DELETE 端点和前端 Dialog 弹窗表单。

## 产出物

### 后端

| 文件 | 改动 |
|------|------|
| `GroupController.java` | 新增 `DELETE /api/groups/{id}` 端点 |

### 前端

| 文件 | 改动 |
|------|------|
| `users/page.tsx` | 表格加操作列（编辑/删除），新建按钮，搜索，分页 |
| `groups/page.tsx` | 表格加操作列（编辑/删除），新建按钮，分页 |
| `components/user/UserDialog.tsx` | 新建 — 新建/编辑用户 Dialog 组件 |
| `components/group/GroupDialog.tsx` | 新建 — 新建/编辑组 Dialog 组件 |

## 后端设计

### GroupController 新增 DELETE

```java
@DeleteMapping("/{id}")
@PreAuthorize("hasAuthority('group:delete')")
public R<Void> deleteGroup(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
    groupMapper.deleteById(id);
    auditLogMapper.insert(AuditLog.builder()
            .tenantId(user.getTenantId()).module("group").action("delete")
            .targetId(id).targetType("group")
            .operatorId(user.getUserId())
            .createdAt(LocalDateTime.now()).build());
    return R.ok(null);
}
```

使用 MyBatis-Plus `deleteById`（软删除，`@TableLogic`）。

## 前端设计

### 组件树

```
/users
  ├── 页面标题 + "新建用户" 按钮 (user:create)
  ├── 搜索输入框
  ├── 用户表格
  │   ├── 列: 用户名 / 真实姓名 / 邮箱 / 角色 / 状态
  │   └── 操作列: 编辑 (user:update) / 删除 (user:delete)
  ├── UserDialog (新建/编辑弹窗)
  ├── AlertDialog (删除确认)
  └── 分页

/groups
  ├── 页面标题 + "新建组" 按钮 (group:create)
  ├── 组表格
  │   ├── 列: 组名 / 成员数 / 创建时间
  │   └── 操作列: 编辑 (group:update) / 删除 (group:delete)
  ├── GroupDialog (新建/编辑弹窗)
  ├── AlertDialog (删除确认)
  └── 分页
```

### UserDialog 组件

| Prop | 类型 | 说明 |
|------|------|------|
| `open` | boolean | 控制显隐 |
| `mode` | 'create' \| 'edit' | 模式 |
| `user` | User \| null | 编辑时传当前用户 |
| `onClose` | () => void | 关闭回调 |
| `onSuccess` | () => void | 成功回调（刷新列表） |

表单字段（create 模式）：
- 用户名 (text, 必填)
- 真实姓名 (text)
- 邮箱 (email)
- 密码 (password, 仅 create 模式显示)
- 状态 (switch: 启用/禁用, 仅 edit 模式显示)
- 角色分配 (多选 checkboxes, 从 `/api/rbac/roles` 获取)

表单字段（edit 模式）：同上但无密码字段，用户名 disabled。

### GroupDialog 组件

| Prop | 类型 | 说明 |
|------|------|------|
| `open` | boolean | 控制显隐 |
| `mode` | 'create' \| 'edit' | 模式 |
| `group` | Group \| null | 编辑时传当前组 |
| `onClose` | () => void | 关闭回调 |
| `onSuccess` | () => void | 成功回调 |

表单字段：
- 组名称 (text, 必填)

### API 调用

| 操作 | 方法 | 路径 | 请求体字段 (snake_case) |
|------|------|------|------------------------|
| 用户列表 | GET | `/api/users?page=&size=&keyword=` | — |
| 新建用户 | POST | `/api/users` | `username, real_name, email, password, role_ids` |
| 编辑用户 | PUT | `/api/users/{id}` | `real_name, email, status, role_ids` |
| 删除用户 | DELETE | `/api/users/{id}` | — |
| 组列表 | GET | `/api/groups` | — |
| 新建组 | POST | `/api/groups` | `name` |
| 编辑组 | PUT | `/api/groups/{id}` | `name` |
| 删除组 | DELETE | `/api/groups/{id}` | — |
| 角色列表 | GET | `/api/rbac/roles` | — |

> 注意：POST/PUT 请求体使用 snake_case（Jackson SNAKE_CASE 配置）

### 权限守卫

所有操作按钮/列通过 `PermissionGuard` 或 `usePermission().hasPermission()` 守卫：
- 新建按钮: `user:create` / `group:create`
- 编辑按钮: `user:update` / `group:update`
- 删除按钮: `user:delete` / `group:delete`

### UI 框架

- Dialog: `@/components/ui/dialog` (shadcn/ui)
- Form: `react-hook-form` + `@hookform/resolvers` (zod)
- Table: 自定义 (跟随项目现有表格风格)
- Button: `@/components/ui/button` (base-ui/react)
- Toast: `sonner` (操作结果提示)

### 交互流程

1. 用户点击 "新建用户" → Dialog 打开 (mode=create) → 填写表单 → 提交 → POST API → toast 成功 → 关闭 Dialog → 刷新列表
2. 用户点击 "编辑" → Dialog 打开 (mode=edit, 传入 user) → 修改 → 提交 → PUT API → toast 成功 → 关闭 → 刷新
3. 用户点击 "删除" → AlertDialog 确认 → DELETE API → toast 成功 → 刷新列表

### 错误处理

- 网络错误: toast 提示 "操作失败，请重试"
- 409 用户名重复: 后端返回 409 → 表单字段显示错误信息
- 404 资源不存在: toast 提示 "用户/组不存在"
- 403 无权限: 不应出现（按钮已守卫），但 API 层仍返回 403

## 不覆盖

- 组成员管理（添加/移除成员）— 后续单独做
- 角色管理 CRUD — 已有页面
- 批量操作
- 导入/导出
