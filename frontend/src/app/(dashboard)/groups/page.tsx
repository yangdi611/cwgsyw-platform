'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/design-system'
import GroupDialog from '@/components/group/GroupDialog'
import MemberDialog from '@/components/group/MemberDialog'
import GroupLifecycleDialog, {
  type GroupLifecycleAction,
  type GroupLifecycleTarget,
} from '@/components/group/GroupLifecycleDialog'
import { ErrorState, PageHeader, PageShell, DataTable, type ColumnDef } from '@/components/shared'
import { Plus, Archive, Pencil, RotateCcw, Trash2, Users } from 'lucide-react'

interface Group {
  id: number
  code: string
  name: string
  description: string
  groupType: 'business' | 'unassigned'
  isBuiltin: boolean
  leaderId: number | null
  leaderRealName: string | null
  memberCount: number
  memberPreview: string[]
  state?: 'active' | 'archived'
  archivedAt?: string | null
  archivedByName?: string | null
  updatedAt?: string | null
}

type GroupListState = 'active' | 'archived'

interface LifecycleDialogState {
  action: GroupLifecycleAction
  target: GroupLifecycleTarget
}

export default function GroupsPage() {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermission()
  const groupScope = useAuthStore((state) => state.groupScope)
  const canCreate = hasPermission('group', 'create')
  const canUpdate = hasPermission('group', 'update')
  const canArchive = hasPermission('group', 'delete')
  const canPurge = hasPermission('group', 'purge') && groupScope === 'platform'
  const canViewArchived = groupScope === 'tenant' || groupScope === 'platform'

  const [listState, setListState] = useState<GroupListState>('active')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editGroup, setEditGroup] = useState<Group | null>(null)
  const [memberGroup, setMemberGroup] = useState<Group | null>(null)
  const [lifecycleDialog, setLifecycleDialog] = useState<LifecycleDialogState | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['groups', listState],
    queryFn: () => api.get('/groups', { params: { state: listState } }).then((r) => r.data.data as Group[]),
  })

  const groups = data ?? []
  const total = groups.length

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

  const openLifecycleDialog = (action: GroupLifecycleAction, group: Group) => {
    setLifecycleDialog({
      action,
      target: {
        id: group.id,
        name: group.name,
        state: group.state ?? listState,
        updatedAt: group.updatedAt,
        archivedAt: group.archivedAt,
      },
    })
  }

  const invalidateGroupQueries = async () => {
    const groupOptionQueryKeys = new Set([
      'groups',
      'authorization-groups',
      'acl-groups',
      'all-groups-for-dialog',
    ])
    await queryClient.invalidateQueries({
      predicate: (query) => groupOptionQueryKeys.has(String(query.queryKey[0] ?? '')),
    })
  }

  const columns: ColumnDef<Group>[] = [
    {
      key: 'name',
      title: '组名称',
      render: (r) => <span className="font-semibold text-v2-fg">{r.name}</span>,
    },
    {
      key: 'description',
      title: '描述',
      render: (r) => <span className="text-v2-muted">{r.description || '-'}</span>,
    },
    {
      key: 'leaderRealName',
      title: '组长',
      render: (r) => <span className="text-v2-fg">{r.leaderRealName || '-'}</span>,
    },
    {
      key: 'memberCount',
      title: '组员',
      render: (r) => (
        <div className="text-v2-muted">
          <span className="font-semibold text-v2-fg tabular-nums">{r.memberCount ?? 0}</span> 人
          {r.memberPreview && r.memberPreview.length > 0 && (
            <span className="ml-2 text-xs">
              {r.memberPreview.join(', ')}
              {(r.memberCount ?? 0) > 3 ? ', …' : ''}
            </span>
          )}
        </div>
      ),
    },
    ...(canUpdate || canArchive || canPurge
      ? [
          {
            key: 'actions',
            title: '操作',
            align: 'right' as const,
            render: (r: Group) => (
              <div className="flex items-center justify-end gap-1">
                {listState === 'active' && canUpdate && (
                  <Button variant="ghost" size="sm" disabled={r.isBuiltin} onClick={() => setMemberGroup(r)}>
                    <Users className="h-3.5 w-3.5" />
                    成员
                  </Button>
                )}
                {listState === 'active' && canUpdate && (
                  <Button variant="ghost" size="sm" disabled={r.isBuiltin} onClick={() => handleEdit(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                    编辑
                  </Button>
                )}
                {listState === 'active' && canArchive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-v2-danger"
                    disabled={r.isBuiltin}
                    aria-label={`归档用户组 ${r.name}`}
                    data-testid={`group-archive-${r.id}`}
                    onClick={() => openLifecycleDialog('archive', r)}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    归档
                  </Button>
                )}
                {listState === 'archived' && canUpdate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`恢复用户组 ${r.name}`}
                    data-testid={`group-restore-${r.id}`}
                    onClick={() => openLifecycleDialog('restore', r)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    恢复
                  </Button>
                )}
                {listState === 'archived' && canPurge && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-v2-danger"
                    aria-label={`永久清除用户组 ${r.name}`}
                    data-testid={`group-purge-${r.id}`}
                    onClick={() => openLifecycleDialog('purge', r)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    清除
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <PageShell width="full" density="comfortable">
      <PageHeader
        className="flex-wrap gap-4"
        eyebrow="身份与权限"
        title="用户组管理"
        subtitle="按业务团队组织用户，配置组长与成员，支撑日报审批与数据可见性范围。"
        actions={
          canCreate ? (
            <div className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto" variant="primary" onClick={handleNew}>
                <Plus className="h-4 w-4" />
                新建组
              </Button>
            </div>
          ) : undefined
        }
      />

      {canViewArchived && (
        <div className="flex w-fit max-w-full flex-wrap rounded-v2-md border border-v2-border bg-v2-surface p-1" role="tablist" aria-label="用户组状态">
          <button
            type="button"
            role="tab"
            aria-selected={listState === 'active'}
            data-testid="group-state-active"
            className={listState === 'active'
              ? 'rounded-v2-sm bg-v2-primary px-4 py-2 text-sm font-semibold text-white'
              : 'rounded-v2-sm px-4 py-2 text-sm font-semibold text-v2-muted hover:bg-v2-surface-hover'}
            onClick={() => setListState('active')}
          >
            活动组
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={listState === 'archived'}
            data-testid="group-state-archived"
            className={listState === 'archived'
              ? 'rounded-v2-sm bg-v2-primary px-4 py-2 text-sm font-semibold text-white'
              : 'rounded-v2-sm px-4 py-2 text-sm font-semibold text-v2-muted hover:bg-v2-surface-hover'}
            onClick={() => setListState('archived')}
          >
            已归档
          </button>
        </div>
      )}

      {isError ? (
        <div className="rounded-lg border border-v2-border bg-v2-surface">
          <ErrorState
            title="用户组加载失败"
            description="无法读取用户组列表，请稍后重试。"
            onRetry={() => refetch()}
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={groups}
          rowKey={(r) => r.id}
          loading={isLoading}
          empty={listState === 'active'
            ? { title: '暂无用户组', description: '点击右上角"新建组"创建第一个团队。' }
            : { title: '暂无已归档用户组', description: '归档后的用户组会显示在这里。' }}
        />
      )}

      <div className="text-sm text-v2-muted">
        共 <span className="font-semibold text-v2-fg tabular-nums">{total}</span> 个{listState === 'active' ? '活动组' : '已归档组'}
      </div>

      <GroupDialog
        open={dialogOpen}
        mode={dialogMode}
        group={editGroup}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => refetch()}
      />

      <MemberDialog
        groupId={memberGroup?.id ?? 0}
        groupName={memberGroup?.name ?? ''}
        open={!!memberGroup}
        onOpenChange={(o) => !o && setMemberGroup(null)}
      />

      {lifecycleDialog && (
        <GroupLifecycleDialog
          action={lifecycleDialog.action}
          target={lifecycleDialog.target}
          open
          onOpenChange={(open) => { if (!open) setLifecycleDialog(null) }}
          onSuccess={async () => {
            await invalidateGroupQueries()
            await refetch()
          }}
        />
      )}
    </PageShell>
  )
}
