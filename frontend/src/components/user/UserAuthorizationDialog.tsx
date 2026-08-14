'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button, NeutralDialog, Select } from '@/design-system/figma-neutral/components'

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
    queryFn: () => api.get(`/users/${user!.id}/group-memberships`).then((response) => response.data.data as Membership[]),
    enabled: open && !!user,
  })
  const assignmentsQuery = useQuery({
    queryKey: ['user-role-assignments', user?.id],
    queryFn: () => api.get(`/users/${user!.id}/role-assignments`).then((response) => response.data.data as RoleAssignment[]),
    enabled: open && !!user,
  })

  const addMembership = async () => {
    if (!user || !groupId) return
    setSaving(true)
    try {
      await api.post(`/users/${user.id}/group-memberships`, {
        groupId: Number(groupId),
        membershipRole,
        primary: false,
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
    <NeutralDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={`@${user?.username ?? ''} — 组织与作用域授权`}
      size="lg"
      showClose
    >
      <section className="cwgsyw-form">
        <div>
          <h3 className="cwgsyw-type-title-sm">组织成员关系</h3>
          <p className="cwgsyw-type-body-sm">用户可以属于多个组，并在每个组中分别担任组长或组员。</p>
        </div>
        <div className="cwgsyw-inline-controls">
          <Select
            aria-label="选择用户组"
            placeholder="选择用户组"
            value={groupId}
            options={[{ value: '', label: '选择用户组' }, ...businessGroups.map((group) => ({ value: String(group.id), label: group.name }))]}
            onChange={setGroupId}
          />
          <Select
            aria-label="成员角色"
            value={membershipRole}
            options={[{ value: 'member', label: '组员' }, { value: 'leader', label: '组长' }]}
            onChange={(value) => setMembershipRole(value as 'leader' | 'member')}
          />
          <Button type="button" size="sm" variant="primary" disabled={saving || !groupId} onClick={addMembership}>
            添加
          </Button>
        </div>
        <div className="cwgsyw-stack-list">
          {(membershipsQuery.data ?? []).map((membership) => (
            <div key={membership.id} className="cwgsyw-stack-list__item">
              <span>
                <strong>{membership.groupName ?? `组 #${membership.groupId}`}</strong>
                <span className="cwgsyw-type-label-xs">
                  {membership.membershipRole === 'leader' ? '组长' : '组员'}
                  {membership.primary ? ' · 主组' : ''}
                </span>
              </span>
              <Button type="button" variant="ghost" size="sm" leadingIcon="trash" onClick={() => removeMembership(membership.id)}>
                移除
              </Button>
            </div>
          ))}
          {(membershipsQuery.data ?? []).length === 0 ? <p className="cwgsyw-stack-list__empty">暂无成员关系</p> : null}
        </div>
      </section>

      <section className="cwgsyw-form">
        <div>
          <h3 className="cwgsyw-type-title-sm">作用域功能角色</h3>
          <p className="cwgsyw-type-body-sm">功能角色必须绑定租户或具体用户组；新分配先进入影子数据，账户通过迁移对账并切换后生效。</p>
        </div>
        <div className="cwgsyw-inline-controls">
          <Select
            aria-label="选择功能角色"
            placeholder="选择功能角色"
            value={roleId}
            options={[{ value: '', label: '选择功能角色' }, ...assignableRoles.map((role) => ({ value: String(role.id), label: role.name }))]}
            onChange={setRoleId}
          />
          <Select
            aria-label="作用域类型"
            value={scopeType}
            options={[{ value: 'group', label: '用户组范围' }, { value: 'tenant', label: '当前租户' }]}
            onChange={(value) => setScopeType(value as 'tenant' | 'group')}
          />
          {scopeType === 'group' ? (
            <Select
              aria-label="选择作用域组"
              placeholder="选择作用域组"
              value={scopeId}
              options={[{ value: '', label: '选择作用域组' }, ...businessGroups.map((group) => ({ value: String(group.id), label: group.name }))]}
              onChange={setScopeId}
            />
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={saving || !roleId || (scopeType === 'group' && !scopeId)}
            onClick={addAssignment}
          >
            分配
          </Button>
        </div>
        <div className="cwgsyw-stack-list">
          {(assignmentsQuery.data ?? []).map((assignment) => (
            <div key={assignment.id} className="cwgsyw-stack-list__item">
              <span>
                <strong>{assignment.roleName ?? assignment.roleCode}</strong>
                <span className="cwgsyw-type-label-xs">
                  {assignment.scopeType === 'tenant' ? '当前租户' : assignment.scopeName ?? `组 #${assignment.scopeId}`}
                </span>
              </span>
              <Button type="button" variant="ghost" size="sm" leadingIcon="trash" onClick={() => removeAssignment(assignment.id)}>
                撤销
              </Button>
            </div>
          ))}
          {(assignmentsQuery.data ?? []).length === 0 ? <p className="cwgsyw-stack-list__empty">暂无作用域角色</p> : null}
        </div>
      </section>
    </NeutralDialog>
  )
}
