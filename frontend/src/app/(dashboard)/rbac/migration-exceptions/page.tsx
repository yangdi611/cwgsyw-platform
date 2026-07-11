'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Database,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  UserRoundCog,
} from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/api-error'
import { useAuthStore } from '@/store/authStore'
import { PageHeader, Pagination } from '@/components/shared'
import { Button } from '@/components/v2/Button'
import { Card } from '@/components/v2/Card'
import { Input } from '@/components/v2/Input'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { Textarea } from '@/components/v2/Textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/v2/Dialog'
import {
  type MigrationException,
  RoleAclRemediationDialog,
  RoleAclSummary,
} from '@/components/rbac/RoleAclRemediationDialog'
import {
  type PermissionDiff,
  PermissionDiffDetails,
} from '@/components/authorization/PermissionDiffDetails'

type ResolutionStatus = 'open' | 'resolved' | 'acceptedLegacy'
type ConfirmationAction = 'enforce' | 'rollback' | null

interface PageData {
  records: MigrationException[]
  total: number
  page: number
  size: number
}

interface PreflightIssue {
  reasonCode: string
  userId?: number
  sourceKey: string
  message: string
}

interface PreflightReport {
  eligible: boolean
  counts: Record<string, number>
  issues: PreflightIssue[]
  permissionDiffs: PermissionDiff[]
}

interface PendingUser {
  userId: number
  username: string
  realName?: string
  status: number
  primaryGroupId?: number
  primaryGroupName?: string
  reasonCodes: string[]
}

interface GroupOption {
  id: number
  name: string
  code: string
  groupType: 'business' | 'unassigned'
  isBuiltin: boolean
}

interface UserOption {
  id: number
  username: string
  realName?: string
}

interface CutoverStatus {
  configuredMode: 'legacy' | 'shadow' | 'enforced'
  effectiveMode: 'legacy' | 'shadow' | 'enforced'
  cutoverStatus: 'preparing' | 'frozen' | 'enforced' | 'rollback'
  cutoverEpoch: number
  enforcedAt?: string
}

interface CleanupResult {
  totalRelationships: number
  resolvedExceptions: number
}

const reasonLabels: Record<string, string> = {
  INVALID_PRIMARY_GROUP: '主组无效',
  INVALID_GROUP_LEADER: '组长关系无效',
  ORPHAN_USER_ROLE: '遗留角色关系异常',
  GROUP_SCOPE_WITHOUT_GROUP: '组级角色缺少主组',
  DUPLICATE_LOGIN_IDENTITY: '登录名跨租户重复',
  ROLE_ACL_NEEDS_REVIEW: '角色 ACL 需要转换',
  PRIMARY_GROUP_REQUIRED: '需要选择主组',
  PRIMARY_GROUP_MISMATCH: '主组数据不一致',
  UNASSIGNED_GROUP_SCOPE_ROLE: '组级角色不能使用未分配组',
  UNRESOLVED_MIGRATION_EXCEPTION: '迁移异常未清零',
  FUNCTION_PERMISSION_DIFF: '功能权限不一致',
  RESOURCE_NOT_MIGRATED: '资源字段未迁移',
  INVALID_RESOURCE_OWNER: '资源归属无效',
  SHADOW_DECISION_DIFF: 'Shadow 判定不一致',
  SHADOW_COVERAGE_INCOMPLETE: 'Shadow 覆盖不足',
  NO_ACTIVE_NEW_SUPER_ADMIN: '缺少新模型超级管理员',
  INVALID_MEMBERSHIP_RELATION: '成员关系无效',
  INVALID_ROLE_ASSIGNMENT: '角色分配无效',
  LEGACY_SCOPE_MISMATCH: '旧角色作用域不等价',
  INVALID_UNASSIGNED_MEMBERSHIP: '未分配组关系无效',
  SUPER_ADMIN_MUST_BE_GROUPLESS: '超级管理员必须无组',
  INVALID_RESOURCE_PARENT: '资源父链无效',
  INVALID_RESOURCE_ACL: '资源 ACL 主体无效',
}

const resolutionHints: Record<string, string> = {
  INVALID_PRIMARY_GROUP: '在待迁移账户中选择有效业务组，再重跑账户回填。',
  INVALID_GROUP_LEADER: '在用户组管理中修正组长关系，再重跑账户回填。',
  ORPHAN_USER_ROLE: '若账户或角色已失效，请使用“系统清理”；有效关系需先恢复一致性。',
  GROUP_SCOPE_WITHOUT_GROUP: '选择真实业务组后，系统会重建组作用域 assignment。',
  DUPLICATE_LOGIN_IDENTITY: '先消除跨租户登录名冲突。',
  ROLE_ACL_NEEDS_REVIEW: '有有效账户时转换为指定用户或组；无有效账户时可由系统安全清理。',
  INVALID_MEMBERSHIP_RELATION: '修正孤儿或跨租户成员关系后重新预检。',
  INVALID_ROLE_ASSIGNMENT: '撤销或修正孤儿、跨租户或无效作用域 assignment。',
  LEGACY_SCOPE_MISMATCH: '重跑账户回填，确保旧角色存在等价的新 assignment。',
  INVALID_UNASSIGNED_MEMBERSHIP: '未分配组仅允许无业务组、无组级角色的普通主组成员。',
  SUPER_ADMIN_MUST_BE_GROUPLESS: '移除超级管理员的主组和全部成员关系。',
  INVALID_RESOURCE_PARENT: '修正跨空间或孤儿父资源关系。',
  INVALID_RESOURCE_ACL: '移除跨租户、无效或指向未分配组的 ACL 主体。',
}

const countLabels: Record<string, string> = {
  activeUsers: '有效账户',
  pendingUsers: '待处理账户',
  unresolvedExceptions: '未解决异常',
  duplicateLoginIdentities: '重复登录身份',
  invalidGroupLeaders: '无效组长关系',
  invalidLegacyUserRoles: '无效旧角色关系',
  invalidMemberships: '无效成员关系',
  invalidRoleAssignments: '无效角色分配',
  legacyScopeMismatches: '旧作用域不等价',
  invalidUnassignedMemberships: '无效未分配关系',
  groupedSuperAdmins: '有组超级管理员',
  invalidResourceParents: '无效资源父链',
  invalidResourceAcls: '无效资源 ACL',
  permissionDiffUsers: '权限差异账户',
  incompleteResources: '未迁移资源',
  invalidResourceOwners: '无效资源归属',
  legacyRoleAcls: '旧角色 ACL',
  latestDecisionDiffs: '最新判定差异',
  unobservedPermissionGrants: '未观测授权',
  activeNewSuperAdmins: '新模型超级管理员',
  rolloutRows: 'Rollout 记录',
}

function statusBadge(status: ResolutionStatus) {
  if (status === 'resolved') return <StatusBadge status="ok">已解决</StatusBadge>
  if (status === 'acceptedLegacy') return <StatusBadge status="warn">暂缓迁移</StatusBadge>
  return <StatusBadge status="danger">待处理</StatusBadge>
}

export default function MigrationExceptionsPage() {
  const queryClient = useQueryClient()
  const groupScope = useAuthStore((state) => state.groupScope)
  const [status, setStatus] = useState<'all' | ResolutionStatus>('open')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [target, setTarget] = useState<MigrationException | null>(null)
  const [cleanupTarget, setCleanupTarget] = useState<MigrationException | null>(null)
  const [roleAclTarget, setRoleAclTarget] = useState<MigrationException | null>(null)
  const [cleanupConfirmation, setCleanupConfirmation] = useState('')
  const [resolution, setResolution] = useState<'resolved' | 'acceptedLegacy'>('resolved')
  const [note, setNote] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<Record<number, string>>({})
  const [systemOwnerUserId, setSystemOwnerUserId] = useState('')
  const [systemOwnerGroupId, setSystemOwnerGroupId] = useState('')
  const [confirmationAction, setConfirmationAction] = useState<ConfirmationAction>(null)
  const [confirmation, setConfirmation] = useState('')
  const pageSize = 20

  const enabled = groupScope === 'platform'
  const exceptionsQuery = useQuery<PageData>({
    queryKey: ['authorization-migration-exceptions', status, keyword, page],
    queryFn: () => api.get('/rbac/migration/exceptions', {
      params: { status, keyword: keyword || undefined, page, size: pageSize },
    }).then((response) => response.data.data),
    enabled,
  })
  const preflightQuery = useQuery<PreflightReport>({
    queryKey: ['authorization-preflight'],
    queryFn: () => api.get('/rbac/migration/preflight').then((response) => response.data.data),
    enabled,
  })
  const pendingUsersQuery = useQuery<PendingUser[]>({
    queryKey: ['authorization-pending-users'],
    queryFn: () => api.get('/rbac/migration/pending-users').then((response) => response.data.data),
    enabled,
  })
  const cutoverQuery = useQuery<CutoverStatus>({
    queryKey: ['authorization-cutover'],
    queryFn: () => api.get('/rbac/migration/cutover').then((response) => response.data.data),
    enabled,
  })
  const groupsQuery = useQuery<GroupOption[]>({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then((response) => response.data.data),
    enabled,
  })
  const usersQuery = useQuery<UserOption[]>({
    queryKey: ['authorization-migration-users'],
    queryFn: () => api.get('/users', { params: { page: 1, size: 200 } })
      .then((response) => response.data.data?.records ?? response.data.data ?? []),
    enabled,
  })

  const refreshAll = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['authorization-migration-exceptions'] }),
    queryClient.invalidateQueries({ queryKey: ['authorization-preflight'] }),
    queryClient.invalidateQueries({ queryKey: ['authorization-pending-users'] }),
    queryClient.invalidateQueries({ queryKey: ['authorization-cutover'] }),
    queryClient.invalidateQueries({ queryKey: ['user-group-memberships'] }),
  ])

  const resolveMutation = useMutation({
    mutationFn: () => api.put(`/rbac/migration/exceptions/${target?.id}`, {
      status: resolution,
      note: note.trim(),
    }),
    onSuccess: () => {
      refreshAll()
      toast.success(resolution === 'resolved' ? '异常已标记解决' : '该异常已暂缓，并继续阻断全量切换')
      setTarget(null)
      setNote('')
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '处理迁移异常失败')),
  })
  const cleanupMutation = useMutation<CleanupResult>({
    mutationFn: () => api.post(`/rbac/migration/exceptions/${cleanupTarget?.id}/cleanup`, {
      confirmation: cleanupConfirmation,
    }).then((response) => response.data.data),
    onSuccess: (result) => {
      refreshAll()
      toast.success(`已清理 ${result.totalRelationships} 条失效关系，关闭 ${result.resolvedExceptions} 条同源异常`)
      setCleanupTarget(null)
      setCleanupConfirmation('')
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '系统清理失败')),
  })
  const groupMutation = useMutation({
    mutationFn: ({ userId, groupId }: { userId: number; groupId: number }) =>
      api.put(`/rbac/migration/pending-users/${userId}/primary-group`, { groupId }),
    onSuccess: (_, variables) => {
      setSelectedGroups((current) => ({ ...current, [variables.userId]: '' }))
      refreshAll()
      toast.success('账户主组和作用域授权已同步')
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '处理待迁移账户失败')),
  })
  const accountBackfillMutation = useMutation({
    mutationFn: () => api.post('/rbac/migration/backfill'),
    onSuccess: () => {
      refreshAll()
      toast.success('账户授权回填完成')
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '账户授权回填失败')),
  })
  const resourceBackfillMutation = useMutation({
    mutationFn: (module: 'wiki' | 'shared_file') => api.post(`/rbac/migration/resources/${module}/backfill`, {
      systemOwnerUserId: Number(systemOwnerUserId),
      systemOwnerGroupId: Number(systemOwnerGroupId),
    }),
    onSuccess: (_, module) => {
      refreshAll()
      toast.success(`${module === 'wiki' ? 'Wiki' : '共享文档'}资源回填完成`)
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '资源权限回填失败')),
  })
  const cutoverMutation = useMutation({
    mutationFn: (action: Exclude<ConfirmationAction, null>) => api.post(
      `/rbac/migration/cutover/${action}`,
      { confirmation: confirmation.trim() },
    ),
    onSuccess: (_, action) => {
      refreshAll()
      toast.success(action === 'enforce' ? '租户已严格切换至 Enforced' : '租户已回退至 Legacy')
      setConfirmationAction(null)
      setConfirmation('')
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '授权模式切换失败')),
  })

  const groups = groupsQuery.data ?? []
  const businessGroups = groups.filter((group) => group.groupType === 'business')
  const unassignedGroup = groups.find((group) => group.groupType === 'unassigned')
  const resourceGroups = businessGroups
  const preflight = preflightQuery.data
  const cutover = cutoverQuery.data
  const pendingUsers = pendingUsersQuery.data ?? []
  const records = exceptionsQuery.data?.records ?? []
  const blockers = preflight?.issues ?? []
  const resourceBackfillReady = Boolean(systemOwnerUserId && systemOwnerGroupId)
  const isBusy = accountBackfillMutation.isPending || resourceBackfillMutation.isPending
    || groupMutation.isPending || cutoverMutation.isPending || cleanupMutation.isPending
  const cutoverLabel = useMemo(() => {
    if (!cutover) return '读取中'
    if (cutover.effectiveMode === 'enforced') return '严格 Enforced'
    if (cutover.cutoverStatus === 'rollback') return '已回退 Legacy'
    return cutover.effectiveMode === 'shadow' ? 'Shadow 准备中' : 'Legacy'
  }, [cutover])

  if (!enabled) {
    return <Card className="p-8 text-center text-sm text-v2-muted">仅超级管理员可以管理授权迁移。</Card>
  }

  const openDialog = (item: MigrationException, nextStatus: 'resolved' | 'acceptedLegacy') => {
    setTarget(item)
    setResolution(nextStatus)
    setNote('')
  }

  const openConfirmation = (action: Exclude<ConfirmationAction, null>) => {
    setConfirmationAction(action)
    setConfirmation('')
  }

  return <div className="space-y-6">
    <PageHeader eyebrow="身份与权限" title="授权迁移工作台"
      subtitle="账户与资源完成对账后，统一切换严格权限模型。"
      actions={<Button variant="secondary" onClick={() => refreshAll()}>
        <RefreshCw className="h-4 w-4" />刷新
      </Button>} />

    <div className="grid gap-4 md:grid-cols-4">
      <Card className="p-4">
        <div className="text-xs text-v2-muted">当前裁决</div>
        <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
          {cutover?.effectiveMode === 'enforced'
            ? <CheckCircle2 className="h-5 w-5 text-v2-success" />
            : <ShieldAlert className="h-5 w-5 text-v2-warning" />}
          {cutoverLabel}
        </div>
      </Card>
      <Card className="p-4">
        <div className="text-xs text-v2-muted">严格切换门禁</div>
        <div className="mt-2 flex items-center gap-2 text-lg font-semibold">
          {preflight?.eligible
            ? <CheckCircle2 className="h-5 w-5 text-v2-success" />
            : <ShieldAlert className="h-5 w-5 text-v2-danger" />}
          {preflight?.eligible ? '通过' : '阻断'}
        </div>
      </Card>
      <Card className="p-4">
        <div className="text-xs text-v2-muted">待处理账户</div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">{pendingUsers.length}</div>
      </Card>
      <Card className="p-4">
        <div className="text-xs text-v2-muted">门禁问题</div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">{blockers.length}</div>
      </Card>
    </div>

    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-v2-muted" />
        <h2 className="font-semibold text-v2-fg">迁移准备</h2>
      </div>
      <Card className="p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <label className="space-y-1 text-sm">
              <span className="text-v2-muted">兜底资源属主</span>
              <select className="block h-9 min-w-56 rounded-v2-sm border border-v2-border bg-v2-surface px-3"
                value={systemOwnerUserId} onChange={(event) => setSystemOwnerUserId(event.target.value)}>
                <option value="">选择用户</option>
                {(usersQuery.data ?? []).map((user) => <option key={user.id} value={user.id}>
                  {user.realName || user.username} (@{user.username})
                </option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-v2-muted">兜底资源属组</span>
              <select className="block h-9 min-w-56 rounded-v2-sm border border-v2-border bg-v2-surface px-3"
                value={systemOwnerGroupId} onChange={(event) => setSystemOwnerGroupId(event.target.value)}>
                <option value="">选择业务组</option>
                {resourceGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={isBusy} onClick={() => accountBackfillMutation.mutate()}>
              <UserRoundCog className="h-4 w-4" />回填账户授权
            </Button>
            <Button variant="secondary" disabled={isBusy || !resourceBackfillReady}
              onClick={() => resourceBackfillMutation.mutate('wiki')}>回填 Wiki</Button>
            <Button variant="secondary" disabled={isBusy || !resourceBackfillReady}
              onClick={() => resourceBackfillMutation.mutate('shared_file')}>回填共享文档</Button>
          </div>
        </div>
      </Card>
    </section>

    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <UserRoundCog className="h-4 w-4 text-v2-muted" />
        <h2 className="font-semibold text-v2-fg">待迁移账户</h2>
      </div>
      {pendingUsers.length === 0
        ? <div className="border-y border-v2-border py-8 text-center text-sm text-v2-muted">没有待处理账户。</div>
        : <div className="divide-y divide-v2-border border-y border-v2-border">
          {pendingUsers.map((user) => <div key={user.userId}
            className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,360px)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="font-medium text-v2-fg">{user.realName || user.username}
                <span className="ml-2 text-sm font-normal text-v2-muted">@{user.username} · ID {user.userId}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                {user.reasonCodes.map((reason) => <StatusBadge key={reason} status="warn">
                  {reasonLabels[reason] ?? reason}
                </StatusBadge>)}
              </div>
            </div>
            <select className="h-9 w-full rounded-v2-sm border border-v2-border bg-v2-surface px-3 text-sm"
              value={selectedGroups[user.userId] ?? ''}
              onChange={(event) => setSelectedGroups((current) => ({
                ...current,
                [user.userId]: event.target.value,
              }))}>
              <option value="">选择主组</option>
              {businessGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              {unassignedGroup && <option value={unassignedGroup.id}>未分配组</option>}
            </select>
            <Button variant="primary" size="sm" disabled={isBusy || !selectedGroups[user.userId]}
              onClick={() => groupMutation.mutate({
                userId: user.userId,
                groupId: Number(selectedGroups[user.userId]),
              })}>确认归组</Button>
          </div>)}
        </div>}
    </section>

    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-v2-muted" />
        <h2 className="font-semibold text-v2-fg">严格切换门禁</h2>
      </div>
      <div className="grid gap-px overflow-hidden rounded-v2-sm border border-v2-border bg-v2-border sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(preflight?.counts ?? {}).map(([key, value]) => <div key={key}
          className="flex items-center justify-between gap-3 bg-v2-surface px-4 py-3 text-sm">
          <span className="text-v2-muted">{countLabels[key] ?? key}</span>
          <span className="font-semibold tabular-nums text-v2-fg">{value}</span>
        </div>)}
      </div>
      {blockers.length > 0 && <div className="divide-y divide-v2-border border-y border-v2-border">
        {blockers.map((issue, index) => <div key={`${issue.reasonCode}-${issue.sourceKey}-${index}`}
          className="flex gap-3 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-v2-warning" />
          <div><span className="font-medium text-v2-fg">{reasonLabels[issue.reasonCode] ?? issue.reasonCode}</span>
            <span className="ml-2 text-v2-muted">{issue.message}</span></div>
        </div>)}
      </div>}
      <PermissionDiffDetails details={preflight?.permissionDiffs ?? []} />
      <div className="flex flex-wrap justify-end gap-2">
        {cutover?.effectiveMode === 'enforced'
          ? <Button variant="danger" disabled={isBusy} onClick={() => openConfirmation('rollback')}>
            <RotateCcw className="h-4 w-4" />紧急回退
          </Button>
          : <Button variant="primary" disabled={isBusy || !preflight?.eligible}
            onClick={() => openConfirmation('enforce')}>
            <Play className="h-4 w-4" />全量切换 Enforced
          </Button>}
      </div>
    </section>

    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-v2-muted" />
        <h2 className="font-semibold text-v2-fg">迁移异常</h2>
      </div>
      <div className="flex flex-col gap-3 border-y border-v2-border py-3 md:flex-row">
        <select className="h-9 rounded-v2-sm border border-v2-border bg-v2-surface px-3 text-sm" value={status}
          onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1) }}>
          <option value="open">待处理</option><option value="resolved">已解决</option>
          <option value="acceptedLegacy">暂缓（仍阻断）</option><option value="all">全部</option>
        </select>
        <Input className="md:max-w-sm" placeholder="搜索用户名、姓名或来源键" value={keyword}
          onChange={(event) => { setKeyword(event.target.value); setPage(1) }} />
      </div>

      <div className="divide-y divide-v2-border border-y border-v2-border">
        {records.length === 0
          ? <div className="py-10 text-center text-sm text-v2-muted">当前筛选条件下没有迁移异常。</div>
          : records.map((item) => <div key={item.id} className="flex flex-col justify-between gap-4 py-4 lg:flex-row">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-v2-fg">{reasonLabels[item.reasonCode] ?? item.reasonCode}</span>
                {statusBadge(item.resolutionStatus)}
                <span className="text-xs text-v2-muted">#{item.id}</span>
              </div>
              {item.reasonCode === 'ROLE_ACL_NEEDS_REVIEW'
                ? <RoleAclSummary item={item} />
                : <div className="text-sm text-v2-fg">账户：{item.realName || item.username || '未关联账户'}
                  {item.username && <span className="text-v2-muted">（{item.username} / ID {item.userId}）</span>}
                </div>}
              <div className="break-all font-mono text-xs text-v2-muted">{item.sourceType} · {item.sourceKey}</div>
              <div className="text-sm text-v2-muted">{resolutionHints[item.reasonCode] ?? '修复源关系并重跑对应回填。'}</div>
              {item.resolutionNote && <div className="text-sm text-v2-muted">处理说明：{item.resolutionNote}
                {item.resolvedByName ? ` · ${item.resolvedByName}` : ''}</div>}
            </div>
            <div className="flex shrink-0 flex-wrap items-start gap-2">
              {item.reasonCode === 'ORPHAN_USER_ROLE' && item.resolutionStatus !== 'resolved' &&
                <Button variant="danger" size="sm" onClick={() => {
                  setCleanupTarget(item)
                  setCleanupConfirmation('')
                }}><Trash2 className="h-4 w-4" />系统清理</Button>}
              {item.reasonCode === 'ROLE_ACL_NEEDS_REVIEW' && item.resolutionStatus !== 'resolved' &&
                (item.canConvert || item.canSystemCleanup) && <Button variant="primary" size="sm"
                  onClick={() => setRoleAclTarget(item)}>
                  <ArrowRightLeft className="h-4 w-4" />处置角色 ACL
                </Button>}
              {item.resolutionStatus === 'open' && <>
                {item.reasonCode !== 'ORPHAN_USER_ROLE' && item.reasonCode !== 'ROLE_ACL_NEEDS_REVIEW' &&
                  <Button variant="secondary" size="sm" onClick={() => openDialog(item, 'resolved')}>标记已解决</Button>}
                <Button variant="ghost" size="sm" onClick={() => openDialog(item, 'acceptedLegacy')}>暂缓迁移</Button>
              </>}
              {item.resolutionStatus === 'acceptedLegacy' && !['ORPHAN_USER_ROLE', 'ROLE_ACL_NEEDS_REVIEW'].includes(item.reasonCode) && <Button variant="secondary" size="sm"
                onClick={() => openDialog(item, 'resolved')}>根因已修复</Button>}
            </div>
          </div>)}
      </div>
      <Pagination page={page} pageSize={pageSize} total={exceptionsQuery.data?.total ?? 0} onPageChange={setPage} />
    </section>

    <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open) setTarget(null) }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{resolution === 'resolved' ? '确认异常已解决' : '确认暂缓迁移'}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-v2-muted">{resolution === 'resolved'
            ? '确认后仍需通过严格切换门禁。'
            : '暂缓项会阻止全量 Enforced 切换。'}</p>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500}
            placeholder="填写处理依据" />
        </div>
        <DialogFooter><Button variant="secondary" onClick={() => setTarget(null)}>取消</Button>
          <Button variant={resolution === 'resolved' ? 'primary' : 'danger'}
            disabled={note.trim().length < 5 || resolveMutation.isPending}
            onClick={() => resolveMutation.mutate()}>确认</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(cleanupTarget)} onOpenChange={(open) => { if (!open) setCleanupTarget(null) }}>
      <DialogContent>
        <DialogHeader><DialogTitle>系统清理失效授权关系</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-v2-muted">系统会再次验证账户或角色确实已失效，只清理对应的遗留角色关系并自动关闭同源异常。有效关系会被拒绝清理。</p>
          <div className="break-all rounded-v2-sm bg-v2-surface-soft p-3 font-mono text-xs text-v2-muted">
            {cleanupTarget?.sourceKey}
          </div>
          <p className="text-v2-muted">输入 <strong>CLEANUP</strong> 确认。</p>
          <Input value={cleanupConfirmation} onChange={(event) => setCleanupConfirmation(event.target.value)}
            autoComplete="off" />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setCleanupTarget(null)}>取消</Button>
          <Button variant="danger" disabled={cleanupMutation.isPending || cleanupConfirmation !== 'CLEANUP'}
            onClick={() => cleanupMutation.mutate()}>{cleanupMutation.isPending ? '清理中…' : '确认系统清理'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {roleAclTarget && <RoleAclRemediationDialog key={roleAclTarget.id} target={roleAclTarget}
      open onOpenChange={(open) => { if (!open) setRoleAclTarget(null) }} />}

    <Dialog open={Boolean(confirmationAction)} onOpenChange={(open) => { if (!open) setConfirmationAction(null) }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{confirmationAction === 'enforce' ? '全量切换 Enforced' : '紧急回退 Legacy'}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-v2-muted">输入 <strong>{confirmationAction === 'enforce' ? 'ENFORCE' : 'ROLLBACK'}</strong> 确认。</p>
          <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setConfirmationAction(null)}>取消</Button>
          <Button variant={confirmationAction === 'enforce' ? 'primary' : 'danger'}
            disabled={cutoverMutation.isPending || confirmation !== (confirmationAction === 'enforce' ? 'ENFORCE' : 'ROLLBACK')}
            onClick={() => confirmationAction && cutoverMutation.mutate(confirmationAction)}>确认执行</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
