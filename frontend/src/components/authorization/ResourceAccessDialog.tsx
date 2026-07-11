'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/v2/Button'
import { Checkbox } from '@/components/v2/Checkbox'
import { Input } from '@/components/v2/Input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/v2/Dialog'
import { Trash2 } from 'lucide-react'

type SubjectType = 'user' | 'group'
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
  const toggle = (row: typeof rows[number], bit: PermissionBit) => {
    const next = row.value ^ bitValues[bit]
    const values = { owner: parts.owner, group: parts.group, others: parts.others, [row.key]: next }
    onChange(`${parts.special}${values.owner}${values.group}${values.others}`)
  }
  return <div className="overflow-hidden rounded-v2-md border border-v2-border">
    <div className="grid grid-cols-[1fr_repeat(3,72px)] bg-v2-surface-soft px-3 py-2 text-xs font-medium text-v2-muted">
      <span>主体</span>{(['r', 'w', 'x'] as PermissionBit[]).map((bit) => <span key={bit} className="text-center">{bitLabels[bit]}</span>)}
    </div>
    {rows.map((row) => <div key={row.key} className="grid grid-cols-[1fr_repeat(3,72px)] items-center border-t border-v2-border px-3 py-2 text-sm">
      <span className="font-medium text-v2-fg">{row.label}</span>
      {(['r', 'w', 'x'] as PermissionBit[]).map((bit) => <div key={bit} className="flex justify-center">
        <Checkbox checked={Boolean(row.value & bitValues[bit])} disabled={!container && bit === 'x'} onCheckedChange={() => toggle(row, bit)} />
      </div>)}
    </div>)}
  </div>
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

  useEffect(() => {
    if (!data) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOwnerUserId(String(data.ownerUserId)); setOwnerGroupId(String(data.ownerGroupId)); setMode(data.mode)
    setEntries(data.entries ?? []); setDefaultEntries(data.defaultEntries ?? [])
  }, [data])

  const subjects = useMemo(() => ({ user: users, group: groups }), [users, groups])
  const save = useMutation({
    mutationFn: () => api.put(`/access/${resourceType}/${resourceId}`, { ownerUserId: Number(ownerUserId), ownerGroupId: Number(ownerGroupId), version: data?.version, mode, entries, defaultEntries: container ? defaultEntries : [] }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success('资源权限已保存'); onOpenChange(false) },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '保存资源权限失败')),
  })

  const updateEntry = (kind: 'access' | 'default', index: number, patch: Partial<AclEntry>) => {
    const setter = kind === 'access' ? setEntries : setDefaultEntries
    setter((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry))
  }
  const entryEditor = (kind: 'access' | 'default', values: AclEntry[]) => <div className="space-y-2">
    <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-v2-fg">{kind === 'access' ? '指定用户和组' : '新建子项默认权限'}</p>{kind === 'default' && <p className="text-xs text-v2-muted">仅复制给以后创建的子项，不修改现有内容。</p>}</div>
      <Button type="button" variant="secondary" size="sm" onClick={() => (kind === 'access' ? setEntries : setDefaultEntries)((current) => [...current, { subjectType: 'group', subjectId: groups[0]?.id ?? 0, permissions: container ? 'r-x' : 'r--' }])}>添加</Button></div>
    {values.map((entry, index) => <div key={`${kind}-${index}`} className="space-y-3 rounded-v2-md border border-v2-border p-3">
      <div className="grid min-w-0 grid-cols-[104px_minmax(0,1fr)_36px] items-center gap-2">
        <select className="h-9 w-full rounded-v2-sm border border-v2-border bg-v2-surface px-2 text-sm" value={entry.subjectType} onChange={(event) => updateEntry(kind, index, { subjectType: event.target.value as SubjectType, subjectId: 0 })}><option value="user">用户</option><option value="group">组</option></select>
        <select className="h-9 w-full min-w-0 rounded-v2-sm border border-v2-border bg-v2-surface px-2 text-sm" value={entry.subjectId} onChange={(event) => updateEntry(kind, index, { subjectId: Number(event.target.value) })}><option value={0}>请选择用户或组</option>{subjects[entry.subjectType].map((option) => <option key={option.id} value={option.id}>{option.name ?? option.realName ?? option.username ?? option.id}</option>)}</select>
        <Button type="button" variant="ghost" size="sm" className="h-9 w-9 px-0 text-v2-danger" title="删除授权" onClick={() => (kind === 'access' ? setEntries : setDefaultEntries)((current) => current.filter((_, entryIndex) => entryIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-3 rounded-v2-sm bg-v2-surface-soft px-3 py-2">
        {(['r', 'w', 'x'] as PermissionBit[]).map((bit) => <label key={bit} className="flex items-center justify-center gap-2 text-xs text-v2-muted"><Checkbox checked={Boolean(permissionValue(entry.permissions) & bitValues[bit])} disabled={!container && bit === 'x'} onCheckedChange={() => updateEntry(kind, index, { permissions: permissionString(permissionValue(entry.permissions) ^ bitValues[bit]) })} /><span>{bitLabels[bit]}</span></label>)}
      </div>
    </div>)}
    {values.length === 0 && <p className="rounded-v2-md border border-dashed border-v2-border py-4 text-center text-xs text-v2-muted">未添加额外授权</p>}
  </div>

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
    <DialogHeader><DialogTitle>资源权限：{title}</DialogTitle><DialogDescription>功能角色决定能否使用功能；这里决定谁可以访问这一个具体资源。</DialogDescription></DialogHeader>
    {isLoading ? <div className="py-8 text-center text-sm text-v2-muted">加载中…</div> : <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>属主</span><select className="h-9 w-full rounded-v2-sm border border-v2-border bg-v2-surface px-2" value={ownerUserId} onChange={(event) => setOwnerUserId(event.target.value)}>{users.map((user) => <option key={user.id} value={user.id}>{user.realName ?? user.username ?? user.id}</option>)}</select></label><label className="space-y-1 text-sm"><span>属组</span><select className="h-9 w-full rounded-v2-sm border border-v2-border bg-v2-surface px-2" value={ownerGroupId} onChange={(event) => setOwnerGroupId(event.target.value)}>{groups.map((group) => <option key={group.id} value={group.id}>{group.name ?? group.id}</option>)}</select></label></div>
      <div className="space-y-2"><div className="flex items-center justify-between"><p className="text-sm font-medium text-v2-fg">基础权限</p><span className="font-mono text-xs text-v2-muted">Mode: {mode}</span></div><ModeMatrix mode={mode} container={container} onChange={setMode} />{container && <p className="text-xs text-v2-muted">“进入”表示可浏览容器内容；2xxx 表示新建子项继承属组。</p>}</div>
      {entryEditor('access', entries)}
      {container && entryEditor('default', defaultEntries)}
      <div className="rounded-v2-md border border-v2-border"><button type="button" className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium" onClick={() => setAdvanced((value) => !value)}><span>高级模式</span><span className="text-v2-muted">{advanced ? '收起' : '展开'}</span></button>{advanced && <div className="border-t border-v2-border p-3"><label className="space-y-1 text-sm"><span>四位八进制 mode</span><Input value={mode} maxLength={4} onChange={(event) => setMode(event.target.value)} placeholder={container ? '2770' : '0660'} /></label><p className="mt-1 text-xs text-v2-muted">允许 0xxx 或 2xxx；保存前由服务端再次校验。</p></div>}</div>
    </div>}
    <DialogFooter><Button variant="secondary" onClick={() => onOpenChange(false)}>取消</Button><Button disabled={!data || save.isPending || !/^(0|2)[0-7]{3}$/.test(mode)} onClick={() => save.mutate()}>{save.isPending ? '保存中…' : '保存'}</Button></DialogFooter>
  </DialogContent></Dialog>
}
