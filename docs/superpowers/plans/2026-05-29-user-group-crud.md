# 用户/组管理 CRUD 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为用户管理和组管理页面补充完整的增删改功能（Dialog 弹窗表单 + 后端 DELETE 端点）

**Architecture:** 后端补充 GroupController DELETE 端点。前端新建 UserDialog/GroupDialog 弹窗组件（react-hook-form），重构 users/page.tsx 和 groups/page.tsx，用 shadcn/ui (@base-ui/react) Dialog + 表格操作列模式。

**Tech Stack:** Java 24 + Spring Boot + MyBatis-Plus / Next.js 15 + React 19 + react-hook-form 7.76 + @base-ui/react Dialog

**Source spec:** `docs/superpowers/specs/2026-05-29-user-group-crud-design.md`

---

### Task 1: 后端 — GroupController 新增 DELETE 端点

**Files:**
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/org/GroupController.java`

- [ ] **Step 1: 添加 deleteGroup 方法**

在 `GroupController.java` 的 `update` 方法之后、类的结尾 `}` 之前，插入：

```java
    @DeleteMapping("/{id}")
    @PreAuthorize("hasPermission('group', 'delete')")
    public R<Void> delete(@PathVariable Long id,
                          @AuthenticationPrincipal SecurityUser cu) {
        Group group = groupMapper.selectById(id);
        if (group == null) throw new IllegalArgumentException("组不存在: " + id);
        groupMapper.deleteById(id);
        return R.ok();
    }
```

需要新增 import：
```java
import org.springframework.security.access.prepost.PreAuthorize;
```
（如果已存在则不需要重复添加 — 检查文件中已有 `@PreAuthorize` 注解在 list/create/update 上，说明 import 已存在。）

- [ ] **Step 2: 验证编译**

```bash
docker compose build --no-cache backend && docker compose up -d backend
```

Expected: BUILD SUCCESS, backend starts without error.

- [ ] **Step 3: 测试 DELETE 端点**

```bash
# 先查组列表
curl -s -H "Authorization: Bearer $(TOKEN)" http://localhost:8080/api/groups | jq '.data | length'
# 删除一个组
curl -s -X DELETE -H "Authorization: Bearer $(TOKEN)" http://localhost:8080/api/groups/3
# 预期: {"code":200,"data":null,"message":"ok"}
```

- [ ] **Step 4: 提交**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/org/GroupController.java
git commit -m "feat: add DELETE endpoint for group management"
```

---

### Task 2: 前端 — UserDialog 组件

**Files:**
- Create: `frontend/src/components/user/UserDialog.tsx`

- [ ] **Step 1: 创建 UserDialog 组件**

```tsx
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

interface Role {
  id: number
  code: string
  name: string
}

interface UserFormData {
  username: string
  real_name: string
  email: string
  password: string
  status: number
  role_ids: number[]
}

interface UserDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  user?: { id: number; username: string; real_name: string; email: string; status: number } | null
  onClose: () => void
  onSuccess: () => void
}

export default function UserDialog({ open, mode, user, onClose, onSuccess }: UserDialogProps) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<UserFormData>({
    defaultValues: { username: '', real_name: '', email: '', password: '', status: 1, role_ids: [] }
  })

  const status = watch('status')
  const selectedRoles = watch('role_ids')

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/rbac/roles').then(r => r.data.data as Role[]),
    enabled: open
  })

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && user) {
        reset({
          username: user.username,
          real_name: user.real_name || '',
          email: user.email || '',
          password: '',
          status: user.status,
          role_ids: []
        })
      } else {
        reset({ username: '', real_name: '', email: '', password: '', status: 1, role_ids: [] })
      }
    }
  }, [open, mode, user, reset])

  const onSubmit = async (data: UserFormData) => {
    try {
      if (mode === 'create') {
        await api.post('/users', {
          username: data.username,
          real_name: data.real_name,
          email: data.email,
          password: data.password,
          role_ids: data.role_ids
        })
        toast.success('用户创建成功')
      } else {
        await api.put(`/users/${user!.id}`, {
          real_name: data.real_name,
          email: data.email,
          status: data.status,
          password: data.password || undefined,
          role_ids: data.role_ids
        })
        toast.success('用户更新成功')
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      const msg = err.response?.data?.message || '操作失败'
      toast.error(msg)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新建用户' : '编辑用户'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              {...register('username', { required: '用户名不能为空' })}
              disabled={mode === 'edit'}
              placeholder="请输入用户名"
            />
            {errors.username && <p className="text-sm text-red-500">{errors.username.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="real_name">真实姓名</Label>
            <Input id="real_name" {...register('real_name')} placeholder="请输入真实姓名" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" type="email" {...register('email')} placeholder="请输入邮箱" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              密码{mode === 'edit' ? '（留空则不修改）' : ''}
            </Label>
            <Input
              id="password"
              type="password"
              {...register('password', { required: mode === 'create' ? '密码不能为空' : false, minLength: { value: 6, message: '密码至少6位' } })}
              placeholder={mode === 'edit' ? '留空不修改' : '请输入密码'}
            />
            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
          </div>

          {mode === 'edit' && (
            <div className="flex items-center justify-between">
              <Label htmlFor="status">启用状态</Label>
              <Switch
                id="status"
                checked={status === 1}
                onCheckedChange={(c) => setValue('status', c ? 1 : 0)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>角色分配</Label>
            <div className="max-h-32 overflow-y-auto space-y-1 border rounded p-2">
              {(rolesData || []).map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedRoles.includes(role.id)}
                    onCheckedChange={(c) => {
                      if (c) {
                        setValue('role_ids', [...selectedRoles, role.id])
                      } else {
                        setValue('role_ids', selectedRoles.filter(id => id !== role.id))
                      }
                    }}
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/components/user/UserDialog.tsx
git commit -m "feat: add UserDialog component for create/edit user"
```

---

### Task 3: 前端 — GroupDialog 组件

**Files:**
- Create: `frontend/src/components/group/GroupDialog.tsx`

- [ ] **Step 1: 创建 GroupDialog 组件**

```tsx
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import api from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface GroupFormData {
  name: string
}

interface GroupDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  group?: { id: number; name: string } | null
  onClose: () => void
  onSuccess: () => void
}

export default function GroupDialog({ open, mode, group, onClose, onSuccess }: GroupDialogProps) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<GroupFormData>({
    defaultValues: { name: '' }
  })

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && group) {
        reset({ name: group.name })
      } else {
        reset({ name: '' })
      }
    }
  }, [open, mode, group, reset])

  const onSubmit = async (data: GroupFormData) => {
    try {
      if (mode === 'create') {
        await api.post('/groups', { name: data.name })
        toast.success('组创建成功')
      } else {
        await api.put(`/groups/${group!.id}`, { name: data.name })
        toast.success('组更新成功')
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message || '操作失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新建组' : '编辑组'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">组名称</Label>
            <Input
              id="name"
              {...register('name', { required: '组名称不能为空' })}
              placeholder="请输入组名称"
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/components/group/GroupDialog.tsx
git commit -m "feat: add GroupDialog component for create/edit group"
```

---

### Task 4: 前端 — 重构 users/page.tsx

**Files:**
- Modify: `frontend/src/app/(dashboard)/users/page.tsx`

- [ ] **Step 1: 重写 users/page.tsx — 表格 + 操作列 + 搜索 + 分页 + Dialog + 删除确认**

```tsx
'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import UserDialog from '@/components/user/UserDialog'

interface User {
  id: number
  username: string
  real_name: string
  email: string
  status: number
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()
  const canCreate = hasPermission('user', 'create')
  const canUpdate = hasPermission('user', 'update')
  const canDelete = hasPermission('user', 'delete')

  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['users', page, keyword],
    queryFn: () =>
      api.get('/users', { params: { page, size: 20 } }).then((r) => ({
        records: (r.data.data?.records ?? r.data.data) as User[],
        total: r.data.data?.total ?? 0,
      })),
  })

  const users = data?.records ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 20)

  const handleNew = () => {
    setDialogMode('create')
    setEditUser(null)
    setDialogOpen(true)
  }

  const handleEdit = (user: User) => {
    setDialogMode('edit')
    setEditUser(user)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/users/${deleteTarget.id}`)
      toast.success('用户已删除')
      setDeleteTarget(null)
      refetch()
    } catch {
      toast.error('删除失败')
    }
  }

  const handleDialogSuccess = () => {
    refetch()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">用户管理</h1>
        {canCreate && (
          <Button onClick={handleNew}>+ 新建用户</Button>
        )}
      </div>

      <div className="mb-4">
        <Input
          placeholder="搜索用户名..."
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1) }}
          className="max-w-xs"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : users.length === 0 ? (
        <p className="text-muted-foreground">暂无用户</p>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 text-sm font-medium">用户名</th>
                  <th className="text-left p-3 text-sm font-medium">真实姓名</th>
                  <th className="text-left p-3 text-sm font-medium">邮箱</th>
                  <th className="text-left p-3 text-sm font-medium">状态</th>
                  {(canUpdate || canDelete) && (
                    <th className="text-right p-3 text-sm font-medium">操作</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="p-3 text-sm font-medium">@{user.username}</td>
                    <td className="p-3 text-sm">{user.real_name || '-'}</td>
                    <td className="p-3 text-sm text-muted-foreground">{user.email || '-'}</td>
                    <td className="p-3">
                      <Badge variant={user.status === 1 ? 'default' : 'secondary'}>
                        {user.status === 1 ? '启用' : '禁用'}
                      </Badge>
                    </td>
                    {(canUpdate || canDelete) && (
                      <td className="p-3 text-right">
                        {canUpdate && (
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                            编辑
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteTarget(user)}>
                            删除
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <span>共 {total} 条</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  上一页
                </Button>
                <span className="px-3 py-1">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  下一页
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <UserDialog
        open={dialogOpen}
        mode={dialogMode}
        user={editUser}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleDialogSuccess}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除用户 <strong>@{deleteTarget?.username}</strong> 吗？此操作不可撤销。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/app/\(dashboard\)/users/page.tsx
git commit -m "feat: add CRUD UI to users page — table, dialog, pagination"
```

---

### Task 5: 前端 — 重构 groups/page.tsx

**Files:**
- Modify: `frontend/src/app/(dashboard)/groups/page.tsx`

- [ ] **Step 1: 重写 groups/page.tsx — 表格 + 操作列 + 分页 + Dialog + 删除确认**

```tsx
'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import GroupDialog from '@/components/group/GroupDialog'

interface Group {
  id: number
  name: string
  description: string
}

export default function GroupsPage() {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()
  const canCreate = hasPermission('group', 'create')
  const canUpdate = hasPermission('group', 'update')
  const canDelete = hasPermission('group', 'delete')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editGroup, setEditGroup] = useState<Group | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then((r) => {
      const items = r.data.data as Group[]
      return { records: items, total: items.length }
    }),
  })

  const groups = data?.records ?? []
  const total = data?.total ?? 0

  const handleNew = () => {
    setDialogMode('create')
    setEditGroup(null)
    setDialogOpen(true)
  }

  const handleEdit = (group: Group) => {
    setDialogMode('edit')
    setEditGroup(group)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/groups/${deleteTarget.id}`)
      toast.success('组已删除')
      setDeleteTarget(null)
      refetch()
    } catch {
      toast.error('删除失败')
    }
  }

  const handleDialogSuccess = () => {
    refetch()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">组管理</h1>
        {canCreate && (
          <Button onClick={handleNew}>+ 新建组</Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground">暂无组</p>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 text-sm font-medium">组名称</th>
                  <th className="text-left p-3 text-sm font-medium">描述</th>
                  {(canUpdate || canDelete) && (
                    <th className="text-right p-3 text-sm font-medium">操作</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id} className="border-b last:border-0">
                    <td className="p-3 text-sm font-medium">{group.name}</td>
                    <td className="p-3 text-sm text-muted-foreground">{group.description || '-'}</td>
                    {(canUpdate || canDelete) && (
                      <td className="p-3 text-right">
                        {canUpdate && (
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(group)}>
                            编辑
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteTarget(group)}>
                            删除
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            共 {total} 个组
          </div>
        </>
      )}

      <GroupDialog
        open={dialogOpen}
        mode={dialogMode}
        group={editGroup}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleDialogSuccess}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除组 <strong>{deleteTarget?.name}</strong> 吗？该组下的成员关联将一并清除。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/app/\(dashboard\)/groups/page.tsx
git commit -m "feat: add CRUD UI to groups page — table, dialog, delete"
```

---

### Task 6: 最终验证

- [ ] **Step 1: 重启前端容器**

```bash
docker compose build frontend && docker compose up -d frontend
```

- [ ] **Step 2: 浏览器验证**

1. 打开 http://localhost:3000
2. 用 superadmin / Admin@123 登录
3. 进入 用户管理 → 确认有"+ 新建用户"按钮 → 新建一个测试用户 → 确认列表出现 → 编辑 → 删除
4. 进入 组管理 → 确认有"+ 新建组"按钮 → 新建一个测试组 → 编辑 → 删除
5. 用 member1 登录 → 确认没有新建/编辑/删除按钮

- [ ] **Step 3: 检查 git status 并推送**

```bash
git status
git log --oneline -6
git push -u origin fix/user-group-crud-ui
```
