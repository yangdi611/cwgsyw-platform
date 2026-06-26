# RBAC 权限

## 资源与权限

V53 迁移注册了 `wiki` 资源及 6 个权限（已通过 API 验收确认全部 seed 成功）：

| 权限 code | 动作 | 说明 |
|-----------|------|------|
| `wiki:read` | read | 查看空间/页面、搜索、图谱、导出 |
| `wiki:create` | create | 新建空间、新建页面 |
| `wiki:update` | update | 编辑页面、移动/排序、提交审批、回滚版本 |
| `wiki:delete` | delete | 删除页面/空间 |
| `wiki:publish` | publish | 直接发布（跳过审批） |
| `wiki:manage_acl` | manage_acl | 读写页面 ACL |

## 角色默认分配

V53 seed 的默认分配：

| 角色 | 默认权限 |
|------|---------|
| `super_admin` | 全部 6 项 |
| `admin` | 全部 6 项 |
| `group_leader`（组长） | create / read / update / delete |
| `member`（组员） | create / read / update |
| `viewer`（只读） | read |

> `publish` 与 `manage_acl` 默认仅 admin / super_admin 持有。

## 调整分配

在 **RBAC 管理 → 权限分配**（`/rbac/permissions`）中，可把任意 `wiki:*` 权限分配给任意角色。例如：

- 给某业务组组长加 `wiki:publish`，让其可直接发布无需上级审批
- 给特定角色加 `wiki:manage_acl`，下放页面权限管理

## 全局权限 vs 页面 ACL

两层权限叠加，**两者都通过才放行**：

1. **全局 RBAC**（`@PreAuthorize`）：粗粒度，控制「能否调用这类接口」
2. **页面 ACL**：细粒度，控制「能否操作这个具体页面」（见 [页面 ACL 配置](./02-页面ACL配置.md)）

注意权限动词的层级差异：

- 全局编辑权限是 `wiki:update`
- 页面 ACL 的编辑动词是 `write`（ACL 内部语义：read/write/delete/publish）

> admin / super_admin（groupScope = tenant/platform）**绕过页面 ACL 检查**，始终可访问任意页面。
