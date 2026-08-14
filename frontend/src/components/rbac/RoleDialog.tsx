'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  Button,
  Checkbox,
  Field,
  Input,
  NeutralDialog,
  Textarea,
} from '@/design-system/figma-neutral/components'

interface Permission {
  id: number
  code: string
  name: string
}

interface EditableRole {
  id: number
  name: string
  code: string
  description?: string
}

interface RoleDialogProps {
  open: boolean
  role: EditableRole | null
  onClose: () => void
  onSuccess: () => void
}

interface PermissionGroup {
  key: string
  label: string
  permissions: Permission[]
}

const permissionModules = [
  { key: 'identity', label: '身份与权限', resources: ['user', 'group', 'role', 'resource'] },
  { key: 'knowledge', label: '知识与文档', resources: ['wiki', 'shared_file', 'change_doc', 'change_doc_template'] },
  { key: 'cmdb', label: 'CMDB 配置管理', resources: ['cmdb_alert', 'cmdb_attribute', 'cmdb_change', 'cmdb_impact', 'cmdb_import', 'cmdb_instance', 'cmdb_model', 'cmdb_relation', 'cmdb_topology'] },
  { key: 'operations', label: '运维与协作', resources: ['task', 'task_template', 'task_plan', 'task_analytics', 'approval', 'work_item', 'calendar_settings', 'workflow', 'notification'] },
  { key: 'infrastructure', label: '基础设施', resources: ['device', 'ip_pool', 'backup'] },
  { key: 'platform', label: '平台治理', resources: ['ai_config', 'audit'] },
] as const

const actionLabels: Record<string, string> = {
  acknowledge: '确认告警',
  approve: '审批',
  assign: '分配权限',
  complete: '完成',
  configure: '配置',
  create: '新建',
  delete: '删除',
  execute: '执行',
  export: '导出',
  impact: '影响分析',
  import: '导入',
  manage: '管理',
  manage_acl: '管理访问权限',
  publish: '发布',
  read: '查看',
  read_all: '查看全部',
  read_group: '查看本组',
  restore: '恢复',
  submit: '提交',
  update: '编辑',
  upload: '上传',
  view_password: '查看密码',
  write: '编辑',
}

function getPermissionResource(permission: Permission) {
  return permission.code.split(':', 1)[0]
}

function getPermissionAction(permission: Permission) {
  return permission.code.split(':')[1] ?? permission.code
}

function getPermissionName(permission: Permission) {
  const action = getPermissionAction(permission)
  const suffixes = [`-${action}`, `-${actionLabels[action]}`]
  return suffixes.reduce((name, suffix) => name.endsWith(suffix) ? name.slice(0, -suffix.length) : name, permission.name)
}

function groupPermissions(permissions: Permission[]): PermissionGroup[] {
  const assignedResources = new Set<string>(permissionModules.flatMap((module) => [...module.resources]))
  const groups: PermissionGroup[] = permissionModules.map((module) => ({
    key: module.key,
    label: module.label,
    permissions: permissions.filter((permission) => (module.resources as readonly string[]).includes(getPermissionResource(permission))),
  }))
  const otherPermissions = permissions.filter((permission) => !assignedResources.has(getPermissionResource(permission)))
  if (otherPermissions.length > 0) groups.push({ key: 'other', label: '其他功能', permissions: otherPermissions })
  return groups.filter((group) => group.permissions.length > 0)
}

export function RoleDialog({ open, role, onClose, onSuccess }: RoleDialogProps) {
  const { data: permissions = [] } = useQuery({
    queryKey: ['all-permissions'],
    queryFn: () => api.get('/rbac/permissions').then((response) => response.data.data as Permission[]),
    enabled: open,
  })

  const { data: assignedPermissions = [] } = useQuery({
    queryKey: ['role-permissions', role?.id],
    queryFn: () => api.get(`/rbac/roles/${role!.id}/permissions`).then((response) => response.data.data as Permission[]),
    enabled: open && !!role,
  })

  const formKey = `${role?.id ?? 'new'}:${assignedPermissions.map((permission) => permission.id).join(',')}`

  return (
    <RoleDialogForm
      key={formKey}
      open={open}
      role={role}
      permissions={permissions}
      initialPermissionIds={assignedPermissions.map((permission) => permission.id)}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  )
}

function RoleDialogForm({
  open,
  role,
  permissions,
  initialPermissionIds,
  onClose,
  onSuccess,
}: RoleDialogProps & { permissions: Permission[]; initialPermissionIds: number[] }) {
  const [name, setName] = useState(role?.name ?? '')
  const [code, setCode] = useState(role?.code ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [permissionIds, setPermissionIds] = useState(initialPermissionIds)
  const [saving, setSaving] = useState(false)
  const permissionGroups = useMemo(() => groupPermissions(permissions), [permissions])

  const togglePermission = (permissionId: number) => {
    setPermissionIds((current) => current.includes(permissionId)
      ? current.filter((id) => id !== permissionId)
      : [...current, permissionId])
  }

  const toggleGroup = (group: PermissionGroup) => {
    const groupIds = group.permissions.map((permission) => permission.id)
    const isFullySelected = groupIds.every((id) => permissionIds.includes(id))
    setPermissionIds((current) => isFullySelected
      ? current.filter((id) => !groupIds.includes(id))
      : [...new Set([...current, ...groupIds])])
  }

  const save = async () => {
    if (!name.trim() || (!role && !/^[a-z][a-z0-9_]{2,63}$/.test(code))) {
      toast.error('请填写角色名称和合法编码')
      return
    }
    setSaving(true)
    try {
      const payload = { name: name.trim(), code, description: description.trim(), permissionIds }
      if (role) await api.put(`/rbac/roles/${role.id}`, payload)
      else await api.post('/rbac/roles', payload)
      toast.success(role ? '角色已更新' : '角色已创建')
      onSuccess()
      onClose()
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '保存角色失败'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <NeutralDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
      title={role ? '编辑功能角色' : '新建功能角色'}
      size="lg"
      showClose={false}
      footer={
        <div className="cwgsyw-form__actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="button" variant="primary" loading={saving} onClick={save}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </div>
      }
    >
      <div className="cwgsyw-form">
        <Field htmlFor="role-name" label="角色名称" required>
          <Input id="role-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：Wiki 只读测试员" />
        </Field>
        <Field
          htmlFor="role-code"
          label="角色编码"
          helperText="小写字母开头，只能包含小写字母、数字和下划线。"
          state={role ? 'disabled' : 'default'}
        >
          <Input
            id="role-code"
            value={code}
            disabled={!!role}
            onChange={(event) => setCode(event.target.value)}
            placeholder="例如：wiki_readonly_tester"
          />
        </Field>
        <Field htmlFor="role-description" label="描述">
          <Textarea id="role-description" value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <div>
          <div className="cwgsyw-inline-controls">
            <div className="cwgsyw-type-label-sm">功能权限</div>
            <span className="cwgsyw-type-label-xs">已选 {permissionIds.length} / {permissions.length} 项</span>
          </div>
          <div className="cwgsyw-stack-list">
            {permissionGroups.map((group) => {
              const selectedCount = group.permissions.filter((permission) => permissionIds.includes(permission.id)).length
              const isFullySelected = selectedCount === group.permissions.length
              return (
                <section key={group.key} className="cwgsyw-permission-group">
                  <div className="cwgsyw-permission-group__head">
                    <div>
                      <h3 className="cwgsyw-type-title-sm">{group.label}</h3>
                      <p className="cwgsyw-type-label-xs">已选 {selectedCount} / {group.permissions.length} 项</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleGroup(group)}>
                      {isFullySelected ? '取消全选' : '全选本组'}
                    </Button>
                  </div>
                  <div className="cwgsyw-permission-group__body cwgsyw-permission-grid">
                    {group.permissions.map((permission) => {
                      const action = getPermissionAction(permission)
                      return (
                        <Checkbox
                          key={permission.id}
                          checked={permissionIds.includes(permission.id)}
                          onChange={() => togglePermission(permission.id)}
                          label={`${getPermissionName(permission)} · ${actionLabels[action] ?? action}（${permission.code}）`}
                        />
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      </div>
    </NeutralDialog>
  )
}
