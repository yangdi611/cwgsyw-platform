# 组成员管理 — 设计规格

> 为组管理页面增加组成员管理功能，允许配置、加入、移动、删除用户与组之间的归属关系。

## 数据模型

`sys_user.group_id BIGINT REFERENCES sys_group(id)` — 一个用户只属于一个组，通过修改 `group_id` 实现加入/移动/移除。

## 后端 API

在 `GroupController` 中新增三个端点，复用 `group` 资源权限（不新增 resource）。

### GET /api/groups/{id}/members

列出组成员。

- **权限**: `@PreAuthorize("hasAuthority('group:read')")`
- **返回**: `R<List<GroupMemberVO>>`
- **GroupMemberVO 字段**: `userId, username, realName, email, roleNames`
- **实现**: 查询 `sys_user` 表中 `group_id = {id} AND is_deleted = false`，JOIN `sys_user_role` 和 `sys_role` 获取角色名列表

### POST /api/groups/{id}/members

加入组（若用户已在其他组，则移动到当前组）。

- **权限**: `@PreAuthorize("hasAuthority('group:update')")`
- **请求体**: `{ "userId": Long }`
- **实现**: 
  1. 校验 user 存在且未删除
  2. `user.setGroupId(id)`，若 userId 是当前操作者本人则拒绝（防止自己把自己移出组导致权限异常）
  3. `userMapper.updateById(user)`
  4. 写 audit_log（module=group, action=add_member）

### DELETE /api/groups/{id}/members/{userId}

从组移除（设 `group_id = null`）。

- **权限**: `@PreAuthorize("hasAuthority('group:update')")`
- **实现**:
  1. 校验 user 存在且当前 `group_id = id`
  2. 若 userId 是当前操作者本人则拒绝
  3. `user.setGroupId(null)`，`userMapper.updateById(user)`
  4. 写 audit_log（module=group, action=remove_member）

### 约束

- 不允许自己移除自己（防止操作者失去组权限后无法管理）
- 移除时仅清空 `group_id`，不删除用户
- 加入时若用户已有组则自动移动（旧组的成员记录自动消失）

## 前端

### 新组件：MemberDialog

文件: `frontend/src/components/group/MemberDialog.tsx`

弹窗布局 — 左右分栏（方案 A）：

- **左侧面板**：当前成员列表
  - 每行：头像 + 真实姓名 + @用户名 + "移除"按钮（红色文字链接）
  - 空列表显示"暂无成员"
- **右侧面板**：搜索 + 添加
  - 顶部搜索框，实时过滤未加入组的用户
  - 用户列表，每行"加入"按钮（蓝色）
  - 搜索无结果显示"无匹配用户"
- 移除操作弹出二次确认（AlertDialog）
- 加入/移除后即时刷新两侧列表

**Props**: `{ groupId: number; groupName: string; open: boolean; onOpenChange: (open: boolean) => void }`

**数据流**:
- 打开弹窗 → `GET /api/groups/{id}/members` 加载成员
- 搜索用户 → `GET /api/users?keyword=xxx&page=1&size=20`（复用现有用户列表 API，过滤已有组成员）
- 加入 → `POST /api/groups/{id}/members` → 刷新
- 移除 → `DELETE /api/groups/{id}/members/{userId}` → 刷新

### 改动：groups/page.tsx

- 表格操作列新增"成员"按钮
- 点击打开 MemberDialog
- 按钮权限：查看成员用 `hasPermission('group', 'read')`，加入/移除用 `hasPermission('group', 'update')`

### API 函数（@/lib/api）

```typescript
getGroupMembers(groupId: number): Promise<GroupMember[]>
addGroupMember(groupId: number, userId: number): Promise<void>
removeGroupMember(groupId: number, userId: number): Promise<void>
```

## 非功能需求

- 审计日志：所有加入/移除操作写 `audit_log`，module=group，action=add_member / remove_member
- 权限：复用 `group` 资源的 `read` 和 `update` 权限
- 不新增 Flyway 迁移（数据模型不变）
