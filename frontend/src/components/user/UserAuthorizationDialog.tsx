'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/design-system'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/api-error'
import { Plus, Trash2 } from 'lucide-react'

interface Group {
  id: number
  name: string
  groupType: 'business' | 'unassigned'
}

interface Role {
  id: number
  name: string
  code: string
  roleType: string
  isBuiltin: boolean
}

interface Membership {
  id: number
  groupId: number
  groupName?: string
  membershipRole: 'leader' | 'member'
  primary: boolean
  originType: string
}

interface RoleAssignment {
  id: number
  roleId: number
  roleName?: string
  roleCode?: string
  scopeType: 'tenant' | 'group'
  scopeId?: number
  scopeName?: string
  originType: string
}

interface UserAuthorizationDialogProps {
  user: { id: number; username: string } | null
  open: boolean
  onClose: () => void
}

export function UserAuthorizationDialog({ user, open, onClose }: UserAuthorizationDialogProps) {
  const [groupId, setGroupId] = useState('')
  const [membershipRole, setMembershipRole] = useState<'leader' | 'member'>('member')
  const [roleId, setRoleId] = useState('')
  const [scopeType, setScopeType] = useState<'tenant' | 'group'>('group')
  const [scopeId, setScopeId] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then((response) => response.data.data as Group[]),
    enabled: open,
  })
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/rbac/roles').then((response) => response.data.data.records as Role[]),
    enabled: open,
  })
  const membershipsQuery = useQuery({
    queryKey: ['user-group-memberships', user?.id],
    queryFn: () => api.get(`/users/${user!.id}/group-memberships`)
      .then((response) => response.data.data as Membership[]),
    enabled: open && !!user,
  })
  const assignmentsQuery = useQuery({
    queryKey: ['user-role-assignments', user?.id],
    queryFn: () => api.get(`/users/${user!.id}/role-assignments`)
      .then((response) => response.data.data as RoleAssignment[]),
    enabled: open && !!user,
  })

  const addMembership = async () => {
    if (!user || !groupId) return
    setSaving(true)
    try {
      await api.post(`/users/${user.id}/group-memberships`, {
        groupId: Number(groupId), membershipRole, primary: false,
      })
      toast.success('组织成员关系已添加')
      setGroupId('')
      membershipsQuery.refetch()
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '添加成员关系失败'))
    } finally {
      setSaving(false)
    }
  }

  const removeMembership = async (membershipId: number) => {
    if (!user) return
    try {
      await api.delete(`/users/${user.id}/group-memberships/${membershipId}`)
      toast.success('组织成员关系已移除')
      membershipsQuery.refetch()
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '移除成员关系失败'))
    }
  }

  const addAssignment = async () => {
    if (!user || !roleId || (scopeType === 'group' && !scopeId)) return
    setSaving(true)
    try {
      await api.post(`/users/${user.id}/role-assignments`, {
        roleId: Number(roleId),
        scopeType,
        scopeId: scopeType === 'group' ? Number(scopeId) : null,
        validUntil: null,
      })
      toast.success('作用域角色已分配')
      setRoleId('')
      assignmentsQuery.refetch()
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '角色分配失败'))
    } finally {
      setSaving(false)
    }
  }

  const removeAssignment = async (assignmentId: number) => {
    if (!user) return
    try {
      await api.delete(`/users/${user.id}/role-assignments/${assignmentId}`)
      toast.success('作用域角色已撤销')
      assignmentsQuery.refetch()
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '撤销角色分配失败'))
    }
  }

  const assignableRoles = roles.filter((role) => role.roleType === 'functional' && !role.isBuiltin)
  const businessGroups = groups.filter((group) => group.groupType === 'business')

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader><DialogTitle>@{user?.username} — 组织与作用域授权</DialogTitle></DialogHeader>
        <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
          <section className="space-y-3">
            <div>
              <h3 className="font-semibold text-v2-fg">组织成员关系</h3>
              <p className="text-sm text-v2-muted">用户可以属于多个组，并在每个组中分别担任组长或组员。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select className="h-9 rounded-v2-md border border-v2-border bg-v2-surface px-3 text-sm" value={groupId} onChange={(event) => setGroupId(event.target.value)}>
                <option value="">选择用户组</option>
                {businessGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
              <select className="h-9 rounded-v2-md border border-v2-border bg-v2-surface px-3 text-sm" value={membershipRole} onChange={(event) => setMembershipRole(event.target.value as 'leader' | 'member')}>
                <option value="member">组员</option><option value="leader">组长</option>
              </select>
              <Button size="sm" variant="primary" disabled={saving || !groupId} onClick={addMembership}><Plus className="h-3.5 w-3.5" />添加</Button>
            </div>
            <div className="divide-y divide-v2-border rounded-v2-md border border-v2-border">
              {(membershipsQuery.data ?? []).map((membership) => (
                <div key={membership.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span><strong>{membership.groupName ?? `组 #${membership.groupId}`}</strong><span className="ml-2 text-v2-muted">{membership.membershipRole === 'leader' ? '组长' : '组员'}{membership.primary ? ' · 主组' : ''}</span></span>
                  <Button variant="ghost" size="sm" className="text-v2-danger" onClick={() => removeMembership(membership.id)}><Trash2 className="h-3.5 w-3.5" />移除</Button>
                </div>
              ))}
              {(membershipsQuery.data ?? []).length === 0 && <p className="px-3 py-5 text-center text-sm text-v2-muted">暂无成员关系</p>}
            </div>
          </section>

          <section className="space-y-3 border-t border-v2-border pt-5">
            <div>
              <h3 className="font-semibold text-v2-fg">作用域功能角色</h3>
              <p className="text-sm text-v2-muted">功能角色必须绑定租户或具体用户组；新分配先进入影子数据，账户通过迁移对账并切换后生效。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select className="h-9 rounded-v2-md border border-v2-border bg-v2-surface px-3 text-sm" value={roleId} onChange={(event) => setRoleId(event.target.value)}>
                <option value="">选择功能角色</option>
                {assignableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
              <select className="h-9 rounded-v2-md border border-v2-border bg-v2-surface px-3 text-sm" value={scopeType} onChange={(event) => setScopeType(event.target.value as 'tenant' | 'group')}>
                <option value="group">用户组范围</option><option value="tenant">当前租户</option>
              </select>
              {scopeType === 'group' && (
                <select className="h-9 rounded-v2-md border border-v2-border bg-v2-surface px-3 text-sm" value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
                  <option value="">选择作用域组</option>
                  {businessGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              )}
              <Button size="sm" variant="primary" disabled={saving || !roleId || (scopeType === 'group' && !scopeId)} onClick={addAssignment}><Plus className="h-3.5 w-3.5" />分配</Button>
            </div>
            <div className="divide-y divide-v2-border rounded-v2-md border border-v2-border">
              {(assignmentsQuery.data ?? []).map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span><strong>{assignment.roleName ?? assignment.roleCode}</strong><span className="ml-2 text-v2-muted">{assignment.scopeType === 'tenant' ? '当前租户' : assignment.scopeName ?? `组 #${assignment.scopeId}`}</span></span>
                  <Button variant="ghost" size="sm" className="text-v2-danger" onClick={() => removeAssignment(assignment.id)}><Trash2 className="h-3.5 w-3.5" />撤销</Button>
                </div>
              ))}
              {(assignmentsQuery.data ?? []).length === 0 && <p className="px-3 py-5 text-center text-sm text-v2-muted">暂无作用域角色</p>}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
