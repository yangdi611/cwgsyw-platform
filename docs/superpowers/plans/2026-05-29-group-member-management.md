# 组成员管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为组管理页面增加组成员管理弹窗，支持查看、加入、移除组成员（通过修改 sys_user.group_id 实现）。

**Architecture:** 后端在 GroupController 新增 3 个成员管理端点，通过 UserMapper 操作 sys_user.group_id；前端新建 MemberDialog 组件（左右分栏布局），在 groups/page.tsx 操作列添加"成员"按钮入口。

**Tech Stack:** Spring Boot 3.4.5 / MyBatis-Plus / React 19 / react-hook-form / @base-ui/react/dialog

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `backend/.../module/org/GroupController.java` | 修改 | 新增 3 个成员管理端点 |
| `backend/.../module/org/dto/GroupMemberVO.java` | 新建 | 组成员返回对象 |
| `frontend/src/components/group/MemberDialog.tsx` | 新建 | 组成员管理弹窗（左右分栏） |
| `frontend/src/app/(dashboard)/groups/page.tsx` | 修改 | 操作列添加"成员"按钮 |
| `backend/.../common/AuditLogMapper.java` | 不变 | 复用现有审计日志写入 |

---

### Task 1: GroupMemberVO + 后端查询端点

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/org/dto/GroupMemberVO.java`
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/org/GroupController.java`

- [ ] **Step 1: 创建 GroupMemberVO**

```java
package com.cwgsyw.platform.module.org.dto;

import lombok.Data;
import java.util.List;

@Data
public class GroupMemberVO {
    private Long userId;
    private String username;
    private String realName;
    private String email;
    private List<String> roleNames;
}
```

- [ ] **Step 2: 在 GroupController 添加成员查询方法**

修改 `backend/src/main/java/com/cwgsyw/platform/module/org/GroupController.java`，注入 `UserMapper`，添加以下方法：

在类顶部添加 import：

```java
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.org.dto.GroupMemberVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.user.entity.User;
import java.util.stream.Collectors;
```

修改构造函数注入 `UserMapper`：

```java
private final GroupMapper groupMapper;
private final UserMapper userMapper;
```

在 `delete` 方法之前添加 GET 端点：

```java
@GetMapping("/{id}/members")
@PreAuthorize("hasPermission('group', 'read')")
public R<List<GroupMemberVO>> getMembers(@PathVariable Long id,
                                          @AuthenticationPrincipal SecurityUser cu) {
    List<User> members = userMapper.selectList(
        new LambdaQueryWrapper<User>()
            .eq(User::getTenantId, cu.getTenantId())
            .eq(User::getGroupId, id));
    List<GroupMemberVO> vos = members.stream().map(u -> {
        GroupMemberVO vo = new GroupMemberVO();
        vo.setUserId(u.getId());
        vo.setUsername(u.getUsername());
        vo.setRealName(u.getRealName());
        vo.setEmail(u.getEmail());
        // 角色列表留空，前端不需要展示角色
        vo.setRoleNames(List.of());
        return vo;
    }).collect(Collectors.toList());
    return R.ok(vos);
}
```

- [ ] **Step 3: 编译验证**

Run: `cd backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL（若 Gradle 不支持则用 `mvn compile`）

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/org/dto/GroupMemberVO.java \
        backend/src/main/java/com/cwgsyw/platform/module/org/GroupController.java
git commit -m "feat: add GET /api/groups/{id}/members endpoint with GroupMemberVO"
```

---

### Task 2: 后端加入/移除成员端点

**Files:**
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/org/GroupController.java`
- Modify: `backend/src/main/java/com/cwgsyw/platform/common/AuditLogMapper.java` (不变，仅直接使用)

- [ ] **Step 1: 在 GroupController 添加加入/移除方法**

修改 `backend/src/main/java/com/cwgsyw/platform/module/org/GroupController.java`，在 `getMembers` 方法之后添加：

添加 import：

```java
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.common.AuditLogMapper;
import java.util.Map;
```

修改构造函数注入 `AuditLogMapper`：

```java
private final GroupMapper groupMapper;
private final UserMapper userMapper;
private final AuditLogMapper auditLogMapper;
```

添加 POST 和 DELETE 端点：

```java
@PostMapping("/{id}/members")
@PreAuthorize("hasPermission('group', 'update')")
public R<Void> addMember(@PathVariable Long id,
                          @RequestBody Map<String, Long> body,
                          @AuthenticationPrincipal SecurityUser cu) {
    Long userId = body.get("userId");
    if (userId == null) throw new IllegalArgumentException("userId is required");

    // 不允许自己操作自己
    if (cu.getUserId().equals(userId)) {
        throw new IllegalArgumentException("不能添加或移动自己的组成员关系");
    }

    User user = userMapper.selectById(userId);
    if (user == null) throw new IllegalArgumentException("用户不存在: " + userId);

    String beforeJson = "{\"group_id\":" + user.getGroupId() + "}";
    user.setGroupId(id);
    userMapper.updateById(user);
    String afterJson = "{\"group_id\":" + id + "}";

    // 审计日志
    AuditLog log = new AuditLog();
    log.setTenantId(cu.getTenantId());
    log.setModule("group");
    log.setAction("add_member");
    log.setTargetId(userId);
    log.setTargetType("user");
    log.setOperatorId(cu.getUserId());
    log.setBeforeJson(beforeJson);
    log.setAfterJson(afterJson);
    log.setRemark("添加到组: " + id);
    auditLogMapper.insert(log);

    return R.ok();
}

@DeleteMapping("/{id}/members/{userId}")
@PreAuthorize("hasPermission('group', 'update')")
public R<Void> removeMember(@PathVariable Long id,
                             @PathVariable Long userId,
                             @AuthenticationPrincipal SecurityUser cu) {
    // 不允许自己操作自己
    if (cu.getUserId().equals(userId)) {
        throw new IllegalArgumentException("不能移除自己的组成员关系");
    }

    User user = userMapper.selectById(userId);
    if (user == null) throw new IllegalArgumentException("用户不存在: " + userId);
    if (!id.equals(user.getGroupId())) {
        throw new IllegalArgumentException("用户不在当前组中");
    }

    String beforeJson = "{\"group_id\":" + user.getGroupId() + "}";
    user.setGroupId(null);
    userMapper.updateById(user);

    // 审计日志
    AuditLog log = new AuditLog();
    log.setTenantId(cu.getTenantId());
    log.setModule("group");
    log.setAction("remove_member");
    log.setTargetId(userId);
    log.setTargetType("user");
    log.setOperatorId(cu.getUserId());
    log.setBeforeJson(beforeJson);
    log.setAfterJson("{\"group_id\":null}");
    log.setRemark("从组移除: " + id);
    auditLogMapper.insert(log);

    return R.ok();
}
```

- [ ] **Step 2: 编译验证**

Run: `cd backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/org/GroupController.java
git commit -m "feat: add POST/DELETE /api/groups/{id}/members endpoints with audit log"
```

---

### Task 3: 前端 MemberDialog 组件

**Files:**
- Create: `frontend/src/components/group/MemberDialog.tsx`

- [ ] **Step 1: 创建 MemberDialog 组件**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface GroupMember {
  user_id: number
  username: string
  real_name: string
  email: string
  role_names: string[]
}

interface SearchUser {
  id: number
  username: string
  real_name: string
  group_id: number | null
}

interface MemberDialogProps {
  groupId: number
  groupName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function MemberDialog({ groupId, groupName, open, onOpenChange }: MemberDialogProps) {
  const [members, setMembers] = useState<GroupMember[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [loading, setLoading] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<GroupMember | null>(null)

  const loadMembers = useCallback(async () => {
    try {
      const res = await api.get(`/groups/${groupId}/members`)
      setMembers(res.data.data as GroupMember[])
    } catch {
      toast.error('加载成员列表失败')
    }
  }, [groupId])

  const searchUsers = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults([])
      return
    }
    try {
      const res = await api.get('/users', { params: { keyword, page: 1, size: 20 } })
      const allUsers = res.data.data?.records ?? []
      const memberIds = new Set(members.map(m => m.user_id))
      const available = (allUsers as SearchUser[]).filter(u => !memberIds.has(u.id))
      setSearchResults(available)
    } catch {
      // 搜索静默失败
    }
  }, [members])

  useEffect(() => {
    if (open) {
      loadMembers()
      setSearchKeyword('')
      setSearchResults([])
    }
  }, [open, loadMembers])

  useEffect(() => {
    searchUsers(searchKeyword)
  }, [searchKeyword, searchUsers])

  const handleAdd = async (userId: number) => {
    setLoading(true)
    try {
      await api.post(`/groups/${groupId}/members`, { userId })
      toast.success('成员已加入')
      loadMembers()
    } catch (err: any) {
      toast.error(err.response?.data?.message || '加入失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setLoading(true)
    try {
      await api.delete(`/groups/${groupId}/members/${removeTarget.user_id}`)
      toast.success('成员已移除')
      setRemoveTarget(null)
      loadMembers()
    } catch (err: any) {
      toast.error(err.response?.data?.message || '移除失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{groupName} — 成员管理</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 min-h-[300px] max-h-[400px]">
          {/* Left: current members */}
          <div className="flex-1 border rounded-md flex flex-col">
            <div className="bg-muted px-3 py-2 text-sm font-medium border-b">
              当前成员 ({members.length})
            </div>
            <div className="flex-1 overflow-y-auto">
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">暂无成员</p>
              ) : (
                members.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between px-3 py-2 border-b last:border-0">
                    <div>
                      <span className="text-sm font-medium">{m.real_name || m.username}</span>
                      <span className="text-xs text-muted-foreground ml-1">@{m.username}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 h-auto px-1 py-0 text-xs"
                      disabled={loading}
                      onClick={() => setRemoveTarget(m)}
                    >
                      移除
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: search + add */}
          <div className="flex-1 flex flex-col gap-2">
            <Input
              placeholder="搜索用户..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex-1 border rounded-md overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {searchKeyword ? '无匹配用户' : '输入关键词搜索'}
                </p>
              ) : (
                searchResults.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-3 py-2 border-b last:border-0">
                    <div>
                      <span className="text-sm font-medium">{u.real_name || u.username}</span>
                      <span className="text-xs text-muted-foreground ml-1">@{u.username}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-500 h-auto px-1 py-0 text-xs"
                      disabled={loading}
                      onClick={() => handleAdd(u.id)}
                    >
                      加入
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Remove confirmation */}
      <Dialog open={!!removeTarget} onOpenChange={(o) => { if (!o) setRemoveTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认移除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要将 <strong>{removeTarget?.real_name || removeTarget?.username}</strong> 从 {groupName} 移除吗？
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>取消</Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={handleRemove}>移除</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
```

注意：组件使用了两个 Dialog — 外层主弹窗 + 内层移除确认弹窗。内层 Dialog 嵌套是允许的（@base-ui/react/dialog 支持多层）。

- [ ] **Step 2: TypeScript 编译验证**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/group/MemberDialog.tsx
git commit -m "feat: add MemberDialog component for group member management"
```

---

### Task 4: groups/page.tsx 添加"成员"按钮入口

**Files:**
- Modify: `frontend/src/app/(dashboard)/groups/page.tsx`

- [ ] **Step 1: 在操作列添加"成员"按钮并集成 MemberDialog**

修改 `frontend/src/app/(dashboard)/groups/page.tsx`：

在第 12 行 `GroupDialog` import 之后添加：

```tsx
import MemberDialog from '@/components/group/MemberDialog'
```

在 `deleteTarget` state 之后添加：

```tsx
const [memberGroup, setMemberGroup] = useState<Group | null>(null)
```

在操作列 `<td>` 内（第 98-109 行），在"编辑"按钮之前添加：

```tsx
{canUpdate && (
  <Button variant="ghost" size="sm" onClick={() => setMemberGroup(group)}>
    成员
  </Button>
)}
```

在 `</Dialog>` 之后、`</div>` 之前添加 MemberDialog：

```tsx
<MemberDialog
  groupId={memberGroup?.id ?? 0}
  groupName={memberGroup?.name ?? ''}
  open={!!memberGroup}
  onOpenChange={(o) => { if (!o) setMemberGroup(null) }}
/>
```

- [ ] **Step 2: TypeScript 编译验证**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/\(dashboard\)/groups/page.tsx
git commit -m "feat: add member management button to groups page"
```

---

### Task 5: Docker 构建部署 + 浏览器验证

**Files:** 无（构建配置已有）

- [ ] **Step 1: 重新构建并启动后端**

```bash
docker compose build backend --no-cache && docker compose up -d backend
```

等待后端容器启动完成。

- [ ] **Step 2: 重新构建并启动前端**

```bash
docker compose build frontend && docker compose up -d frontend
```

- [ ] **Step 3: 浏览器验证**

打开 `http://localhost`，以 superadmin（Admin@123）登录：

1. 进入 `/groups` 页 — 验证操作列出现"成员"按钮
2. 点击"成员" — 验证弹窗打开，左侧显示当前成员，右侧可搜索
3. 搜索用户并点击"加入" — 验证成员出现在左侧
4. 点击"移除" — 验证确认弹窗出现，确认后成员消失
5. 验证"移除"按钮不出现（不能移除自己）

- [ ] **Step 4: Commit 任何修复（如需要）**

如有问题修复后提交。

---
