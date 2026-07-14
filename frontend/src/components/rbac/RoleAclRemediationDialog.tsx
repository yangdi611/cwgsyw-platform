'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/v2/Button'
import { Input } from '@/components/v2/Input'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/v2/Dialog'

export interface MigrationException {
  id: number
  runId: string
  userId?: number
  username?: string
  realName?: string
  subjectType?: string
  subjectId?: number
  subjectName?: string
  subjectCode?: string
  activeSubjectUsers?: number
  resourceType?: string
  resourceId?: number
  resourceName?: string
  sourcePermissions?: string[]
  sourceActive?: boolean
  resourceActive?: boolean
  canSystemCleanup?: boolean
  canConvert?: boolean
  sourceType: string
  sourceKey: string
  reasonCode: string
  resolutionStatus: 'open' | 'resolved' | 'acceptedLegacy'
  resolutionNote?: string
  resolvedByName?: string
  createdAt: string
}

interface UserOption {
  id: number
  username: string
  realName?: string
}

interface GroupOption {
  id: number
  name: string
  groupType?: 'business' | 'unassigned'
}

const resourceTypeLabels: Record<string, string> = {
  wiki_space: 'Wiki 空间',
  wiki_page: 'Wiki 页面',
  shared_folder: '共享文件夹',
}

const permissionLabels: Record<string, string> = {
  read: '读取',
  write: '写入',
  create: '新建',
  update: '修改',
  delete: '删除',
  publish: '发布',
}

export function RoleAclSummary({ item }: { item: MigrationException }) {
  const activeUsers = item.activeSubjectUsers ?? 0
  return <div className="space-y-1 text-sm">
    <div className="flex flex-wrap items-center gap-2 text-v2-fg">
      <span>角色主体：{item.subjectName || `角色 #${item.subjectId ?? '未知'}`}</span>
      {item.subjectCode && <span className="text-v2-muted">（{item.subjectCode} / ID {item.subjectId}）</span>}
      <StatusBadge status={activeUsers === 0 ? 'warn' : 'neutral'}>有效账户 {activeUsers}</StatusBadge>
    </div>
    <div className="text-v2-fg">
      资源：{resourceTypeLabels[item.resourceType ?? ''] ?? item.resourceType ?? '未知资源'}
      <span className="text-v2-muted"> · {item.resourceName || `ID ${item.resourceId ?? '未知'}`}</span>
    </div>
    {(item.sourcePermissions?.length ?? 0) > 0 && <div className="text-v2-muted">
      旧权限：{item.sourcePermissions?.map((permission) => permissionLabels[permission] ?? permission).join('、')}
    </div>}
    {item.canSystemCleanup && activeUsers === 0 && <div className="text-v2-warning">
      当前角色没有命中任何有效账户，可由系统复核后安全清理。
    </div>}
  </div>
}

export function RoleAclRemediationDialog({
  target,
  open,
  onOpenChange,
}: {
  target: MigrationException
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const cleanupPreferred = Boolean(target.canSystemCleanup && (target.activeSubjectUsers ?? 0) === 0)
  const [action, setAction] = useState<'convert' | 'cleanup'>(cleanupPreferred ? 'cleanup' : 'convert')
  const [subjectType, setSubjectType] = useState<'user' | 'group'>('group')
  const [subjectId, setSubjectId] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ['authorization-users'],
    queryFn: () => api.get('/users', { params: { page: 1, size: 200 } })
      .then((response) => response.data.data?.records ?? []),
    enabled: open && action === 'convert',
  })
  const { data: groups = [] } = useQuery<GroupOption[]>({
    queryKey: ['authorization-groups'],
    queryFn: () => api.get('/groups').then((response) => response.data.data ?? []),
    enabled: open && action === 'convert',
  })
  const businessGroups = groups.filter((group) => group.groupType !== 'unassigned')
  const expectedConfirmation = action === 'cleanup' ? 'CLEANUP' : 'CONVERT'
  const mutation = useMutation({
    mutationFn: () => action === 'cleanup'
      ? api.post(`/rbac/migration/exceptions/${target.id}/cleanup`, { confirmation })
      : api.post(`/rbac/migration/exceptions/${target.id}/convert-role-acl`, {
        subjectType,
        subjectId: Number(subjectId),
        confirmation,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['authorization-migration-exceptions'] }),
        queryClient.invalidateQueries({ queryKey: ['authorization-preflight'] }),
      ])
      toast.success(action === 'cleanup' ? '空角色 ACL 已安全清理' : '角色 ACL 已转换并关闭异常')
      onOpenChange(false)
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error,
      action === 'cleanup' ? '系统清理失败' : '角色 ACL 转换失败')),
  })
  const options = subjectType === 'user' ? users : businessGroups
  const canSubmit = confirmation === expectedConfirmation
    && (action === 'cleanup' || Boolean(subjectId))

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>处置遗留角色 ACL</DialogTitle></DialogHeader>
      <RoleAclSummary item={target} />
      <div className="grid grid-cols-2 gap-2 rounded-v2-md bg-v2-surface-soft p-1">
        {target.canConvert && <button type="button" onClick={() => {
          setAction('convert')
          setConfirmation('')
        }} className={`rounded-v2-sm px-3 py-2 text-sm ${action === 'convert'
          ? 'bg-v2-surface font-medium text-v2-fg shadow-sm' : 'text-v2-muted'}`}>
          <ArrowRightLeft className="mr-1 inline h-4 w-4" />转换为用户或组
        </button>}
        {target.canSystemCleanup && <button type="button" onClick={() => {
          setAction('cleanup')
          setConfirmation('')
        }} className={`rounded-v2-sm px-3 py-2 text-sm ${action === 'cleanup'
          ? 'bg-v2-surface font-medium text-v2-danger shadow-sm' : 'text-v2-muted'}`}>
          <Trash2 className="mr-1 inline h-4 w-4" />系统安全清理
        </button>}
      </div>
      {action === 'convert' ? <div className="space-y-3 text-sm">
        <p className="text-v2-muted">保留原权限位，将角色主体显式转换为一个有效用户或业务组。</p>
        <div className="grid gap-3 sm:grid-cols-[132px_minmax(0,1fr)]">
          <select className="h-9 rounded-v2-sm border border-v2-border bg-v2-surface px-3"
            value={subjectType} onChange={(event) => {
              setSubjectType(event.target.value as 'user' | 'group')
              setSubjectId('')
            }}>
            <option value="group">指定组</option><option value="user">指定用户</option>
          </select>
          <select className="h-9 min-w-0 rounded-v2-sm border border-v2-border bg-v2-surface px-3"
            value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            <option value="">请选择{subjectType === 'user' ? '用户' : '业务组'}</option>
            {options.map((option) => <option key={option.id} value={option.id}>
              {'username' in option ? option.realName || option.username : option.name}
            </option>)}
          </select>
        </div>
      </div> : <div className="rounded-v2-md border border-v2-danger/30 bg-v2-danger/5 p-3 text-sm">
        <p className="font-medium text-v2-danger">仅清理实时复核后仍无有效账户命中的 ACL。</p>
        <p className="mt-1 text-v2-muted">若角色在确认前重新获得有效用户，服务端会拒绝清理。</p>
      </div>}
      <div className="space-y-1 text-sm">
        <span className="text-v2-muted">输入 <strong>{expectedConfirmation}</strong> 确认</span>
        <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off" />
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>取消</Button>
        <Button variant={action === 'cleanup' ? 'danger' : 'primary'}
          disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? '处理中…' : action === 'cleanup' ? '确认系统清理' : '确认转换'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
