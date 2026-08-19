'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  Button,
  Checkbox,
  Field,
  IconButton,
  Input,
  LoadingState,
  NeutralDialog,
  NeutralTooltip,
  Select,
} from '@/design-system/figma-neutral/components'

type SubjectType = 'user' | 'group' | 'role'
type PermissionBit = 'r' | 'w' | 'x'

interface AclEntry {
  entryType?: 'access' | 'default'
  subjectType: SubjectType
  subjectId: number
  permissions: string
}

interface ResourceAccess {
  ownerUserId: number
  ownerGroupId: number
  version: number
  mode: string
  entries: AclEntry[]
  defaultEntries: AclEntry[]
}

interface Option {
  id: number
  name?: string
  realName?: string
  username?: string
}

const bitValues: Record<PermissionBit, number> = { r: 4, w: 2, x: 1 }
const bitLabels: Record<PermissionBit, string> = { r: '读取', w: '写入', x: '进入' }

function permissionString(value: number) {
  return `${value & 4 ? 'r' : '-'}${value & 2 ? 'w' : '-'}${value & 1 ? 'x' : '-'}`
}

function permissionValue(value: string) {
  return (value[0] === 'r' ? 4 : 0) | (value[1] === 'w' ? 2 : 0) | (value[2] === 'x' ? 1 : 0)
}

function modeParts(mode: string) {
  const normalized = /^(0|2)[0-7]{3}$/.test(mode) ? mode : '0660'
  return {
    special: normalized[0],
    owner: Number(normalized[1]),
    group: Number(normalized[2]),
    others: Number(normalized[3]),
  }
}

function ModeMatrix({ mode, container, onChange }: { mode: string; container: boolean; onChange: (mode: string) => void }) {
  const parts = modeParts(mode)
  const rows = [
    { key: 'owner' as const, label: '属主', value: parts.owner },
    { key: 'group' as const, label: '属组', value: parts.group },
    { key: 'others' as const, label: '其他人', value: parts.others },
  ]
  const toggle = (row: (typeof rows)[number], bit: PermissionBit) => {
    const next = row.value ^ bitValues[bit]
    const values = { owner: parts.owner, group: parts.group, others: parts.others, [row.key]: next }
    onChange(`${parts.special}${values.owner}${values.group}${values.others}`)
  }
  return (
    <div className="cwgsyw-resource-access__matrix">
      <div className="cwgsyw-resource-access__matrix-head">
        <span>主体</span>
        {(['r', 'w', 'x'] as PermissionBit[]).map((bit) => (
          <span key={bit}>{bitLabels[bit]}</span>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row.key} className="cwgsyw-resource-access__matrix-row">
          <span>{row.label}</span>
          {(['r', 'w', 'x'] as PermissionBit[]).map((bit) => (
            <span key={bit} className="cwgsyw-resource-access__matrix-cell">
              <Checkbox
                label={bitLabels[bit]}
                showLabel={false}
                checked={Boolean(row.value & bitValues[bit])}
                disabled={!container && bit === 'x'}
                onChange={() => toggle(row, bit)}
              />
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

export function ResourceAccessDialog({ resourceType, resourceId, title, container, open, onOpenChange }: {
  resourceType: 'wiki_space' | 'wiki_page' | 'shared_folder' | 'shared_file'
  resourceId: number
  title: string
  container: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [ownerUserId, setOwnerUserId] = useState('')
  const [ownerGroupId, setOwnerGroupId] = useState('')
  const [mode, setMode] = useState(container ? '2770' : '0660')
  const [entries, setEntries] = useState<AclEntry[]>([])
  const [defaultEntries, setDefaultEntries] = useState<AclEntry[]>([])
  const [advanced, setAdvanced] = useState(false)
  const queryKey = ['resource-access', resourceType, resourceId]
  const { data, isLoading } = useQuery<ResourceAccess>({ queryKey, queryFn: () => api.get(`/access/${resourceType}/${resourceId}`).then((response) => response.data.data), enabled: open })
  const { data: users = [] } = useQuery<Option[]>({ queryKey: ['authorization-users'], queryFn: () => api.get('/users', { params: { page: 1, size: 200 } }).then((response) => response.data.data?.records ?? []), enabled: open })
  const { data: groups = [] } = useQuery<Option[]>({ queryKey: ['authorization-groups'], queryFn: () => api.get('/groups').then((response) => response.data.data ?? []), enabled: open })
  const { data: roles = [] } = useQuery<Option[]>({ queryKey: ['authorization-roles'], queryFn: () => api.get('/roles', { params: { page: 1, size: 200 } }).then((response) => response.data.data?.records ?? []), enabled: open })

  useEffect(() => {
    if (!data) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOwnerUserId(String(data.ownerUserId)); setOwnerGroupId(String(data.ownerGroupId)); setMode(data.mode)
    setEntries(data.entries ?? []); setDefaultEntries(data.defaultEntries ?? [])
  }, [data])

  const subjects = useMemo(() => ({ user: users, group: groups, role: roles }), [users, groups, roles])
  const save = useMutation({
    mutationFn: () => api.put(`/access/${resourceType}/${resourceId}`, { ownerUserId: Number(ownerUserId), ownerGroupId: Number(ownerGroupId), version: data?.version, mode, entries, defaultEntries: container ? defaultEntries : [] }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('资源权限已保存'); onOpenChange(false) },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '保存资源权限失败')),
  })

  const updateEntry = (kind: 'access' | 'default', index: number, patch: Partial<AclEntry>) => {
    const setter = kind === 'access' ? setEntries : setDefaultEntries
    setter((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry))
  }

  const entryEditor = (kind: 'access' | 'default', values: AclEntry[]) => (
    <section className="cwgsyw-resource-access__section">
      <header className="cwgsyw-resource-access__section-head">
        <div>
          <p>{kind === 'access' ? '指定用户和组' : '新建子项默认权限'}</p>
          {kind === 'default' ? <span>仅复制给以后创建的子项，不修改现有内容。</span> : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => (kind === 'access' ? setEntries : setDefaultEntries)((current) => [...current, { subjectType: 'group', subjectId: groups[0]?.id ?? 0, permissions: container ? 'r-x' : 'r--' }])}
        >
          添加
        </Button>
      </header>
      {values.map((entry, index) => (
        <div key={`${kind}-${index}`} className="cwgsyw-resource-access__entry">
          <div className="cwgsyw-resource-access__entry-row">
            <Select
              size="sm"
              overlay
              aria-label="授权主体类型"
              value={entry.subjectType}
              options={[{ value: 'user', label: '用户' }, { value: 'group', label: '组' }, { value: 'role', label: '角色' }]}
              onChange={(value) => updateEntry(kind, index, { subjectType: value as SubjectType, subjectId: 0 })}
            />
            <Select
              size="sm"
              overlay
              aria-label="授权主体"
              placeholder="请选择主体"
              value={entry.subjectId ? String(entry.subjectId) : '0'}
              options={[{ value: '0', label: '请选择主体' }, ...subjects[entry.subjectType].map((option) => ({ value: String(option.id), label: String(option.name ?? option.realName ?? option.username ?? option.id) }))]}
              onChange={(value) => updateEntry(kind, index, { subjectId: Number(value) })}
            />
            <NeutralTooltip content="删除" className="cwgsyw-tooltip--pill" followCursor>
              <IconButton
                type="button"
                variant="ghost"
                size="sm"
                className="cwgsyw-cmdb-admin__delete-action"
                icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--trash" />}
                aria-label="删除授权"
                onClick={() => (kind === 'access' ? setEntries : setDefaultEntries)((current) => current.filter((_, entryIndex) => entryIndex !== index))}
              />
            </NeutralTooltip>
          </div>
          <div className="cwgsyw-resource-access__bits">
            {(['r', 'w', 'x'] as PermissionBit[]).map((bit) => (
              <Checkbox
                key={bit}
                label={bitLabels[bit]}
                checked={Boolean(permissionValue(entry.permissions) & bitValues[bit])}
                disabled={!container && bit === 'x'}
                onChange={() => updateEntry(kind, index, { permissions: permissionString(permissionValue(entry.permissions) ^ bitValues[bit]) })}
              />
            ))}
          </div>
        </div>
      ))}
      {values.length === 0 ? <p className="cwgsyw-resource-access__empty">未添加额外授权</p> : null}
    </section>
  )

  return (
    <NeutralDialog
      open={open}
      onOpenChange={onOpenChange}
      title="资源授权"
      description="功能角色决定能否使用功能；这里决定谁可以访问这一个具体资源。"
      className="cwgsyw-resource-access-dialog"
      size="lg"
      footer={
        <div className="cwgsyw-inline-controls">
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>取消</Button>
          <Button type="button" size="sm" disabled={!data || save.isPending || !/^(0|2)[0-7]{3}$/.test(mode)} onClick={() => save.mutate()}>
            {save.isPending ? '保存中…' : '保存'}
          </Button>
        </div>
      }
    >
      <div className="cwgsyw-resource-access">
        <p className="cwgsyw-resource-access__title">资源权限：{title}</p>
        {isLoading ? (
          <LoadingState label="正在加载资源权限…" />
        ) : (
          <div className="cwgsyw-resource-access__stack">
            <div className="cwgsyw-resource-access__owners">
              <Field label="属主">
                <Select
                  size="sm"
                  overlay
                  aria-label="属主"
                  value={ownerUserId}
                  options={users.map((user) => ({ value: String(user.id), label: String(user.realName ?? user.username ?? user.id) }))}
                  onChange={setOwnerUserId}
                />
              </Field>
              <Field label="属组">
                <Select
                  size="sm"
                  overlay
                  aria-label="属组"
                  value={ownerGroupId}
                  options={groups.map((group) => ({ value: String(group.id), label: String(group.name ?? group.id) }))}
                  onChange={setOwnerGroupId}
                />
              </Field>
            </div>
            <section className="cwgsyw-resource-access__section">
              <header className="cwgsyw-resource-access__section-head">
                <p>基础权限</p>
                <span>权限码 {mode}</span>
              </header>
              <ModeMatrix mode={mode} container={container} onChange={setMode} />
              {container ? <p className="cwgsyw-resource-access__hint">“进入”表示可浏览容器内容；2xxx 表示新建子项继承属组。</p> : null}
            </section>
            {entryEditor('access', entries)}
            {container ? entryEditor('default', defaultEntries) : null}
            <section className="cwgsyw-resource-access__advanced">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="cwgsyw-resource-access__advanced-toggle"
                aria-expanded={advanced}
                onClick={() => setAdvanced((value) => !value)}
              >
                {advanced ? '收起高级模式' : '展开高级模式'}
              </Button>
              {advanced ? (
                <Field htmlFor="resource-access-mode" label="四位八进制权限码" helperText="允许 0xxx 或 2xxx；保存前由服务端再次校验。">
                  <Input id="resource-access-mode" size="sm" value={mode} maxLength={4} onChange={(event) => setMode(event.target.value)} placeholder={container ? '2770' : '0660'} />
                </Field>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </NeutralDialog>
  )
}
