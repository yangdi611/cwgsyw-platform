'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  DataManagementPage,
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  PageHeader,
  Table,
} from '@/design-system/figma-neutral/components'
import GroupDialog from '@/components/group/GroupDialog'
import MemberDialog from '@/components/group/MemberDialog'
import GroupLifecycleDialog, {
  type GroupLifecycleAction,
  type GroupLifecycleTarget,
} from '@/components/group/GroupLifecycleDialog'

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

  const columns = useMemo(
    () => [
      { key: 'name', label: '组名称' },
      { key: 'description', label: '描述' },
      { key: 'leaderRealName', label: '组长' },
      { key: 'memberCount', label: '组员' },
      ...(canUpdate || canArchive || canPurge ? [{ key: 'actions', label: '操作', align: 'right' as const }] : []),
    ],
    [canArchive, canPurge, canUpdate],
  )

  const rows = groups.map((group) => ({
    id: String(group.id),
    disabled: group.isBuiltin,
    cells: {
      name: group.name,
      description: group.description || '-',
      leaderRealName: group.leaderRealName || '-',
      memberCount: (
        <span>
          <strong>{group.memberCount ?? 0}</strong> 人
          {group.memberPreview && group.memberPreview.length > 0 ? (
            <span>
              {' '}
              {group.memberPreview.join(', ')}
              {(group.memberCount ?? 0) > 3 ? ', …' : ''}
            </span>
          ) : null}
        </span>
      ),
      actions: (
        <div className="cwgsyw-inline-controls">
          {listState === 'active' && canUpdate ? (
            <Button type="button" variant="ghost" size="sm" disabled={group.isBuiltin} onClick={() => setMemberGroup(group)}>
              成员
            </Button>
          ) : null}
          {listState === 'active' && canUpdate ? (
            <Button type="button" variant="ghost" size="sm" disabled={group.isBuiltin} onClick={() => handleEdit(group)}>
              编辑
            </Button>
          ) : null}
          {listState === 'active' && canArchive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={group.isBuiltin}
              aria-label={`归档用户组 ${group.name}`}
              data-testid={`group-archive-${group.id}`}
              onClick={() => openLifecycleDialog('archive', group)}
            >
              归档
            </Button>
          ) : null}
          {listState === 'archived' && canUpdate ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`恢复用户组 ${group.name}`}
              data-testid={`group-restore-${group.id}`}
              onClick={() => openLifecycleDialog('restore', group)}
            >
              恢复
            </Button>
          ) : null}
          {listState === 'archived' && canPurge ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leadingIcon="trash"
              aria-label={`永久清除用户组 ${group.name}`}
              data-testid={`group-purge-${group.id}`}
              onClick={() => openLifecycleDialog('purge', group)}
            >
              清除
            </Button>
          ) : null}
        </div>
      ),
    },
  }))

  const tableState = isLoading ? 'loading' : groups.length === 0 ? 'empty' : 'data'

  return (
    <>
      <DataManagementPage
        embedded
        layout="default"
        header={
          <PageHeader
            eyebrow="身份与权限"
            title="用户组管理"
            subtitle="按业务团队组织用户，配置组长与成员，支撑日报审批与数据可见性范围。"
            breadcrumb={<Breadcrumb items={[{ href: '/', label: '工作台' }, { label: '用户组管理' }]} />}
            actions={
              canCreate ? (
                <Button type="button" variant="primary" onClick={handleNew}>
                  新建组
                </Button>
              ) : null
            }
          />
        }
        filter={
          canViewArchived ? (
            <FilterBar
              filterItems={
                <div className="cwgsyw-tabs cwgsyw-tabs--segmented cwgsyw-tabs--md" role="tablist" aria-label="用户组状态">
                  <Button
                    type="button"
                    variant="ghost"
                    role="tab"
                    aria-selected={listState === 'active'}
                    data-testid="group-state-active"
                    className="cwgsyw-tab"
                    onClick={() => setListState('active')}
                  >
                    活动组
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    role="tab"
                    aria-selected={listState === 'archived'}
                    data-testid="group-state-archived"
                    className="cwgsyw-tab"
                    onClick={() => setListState('archived')}
                  >
                    已归档
                  </Button>
                </div>
              }
            />
          ) : null
        }
        content={
          isError ? (
            <ErrorState
              title="用户组加载失败"
              description="无法读取用户组列表，请稍后重试。"
              retry={
                <Button type="button" variant="secondary" onClick={() => refetch()}>
                  重试
                </Button>
              }
            />
          ) : (
            <>
              <Table
                columns={columns}
                rows={rows}
                showSearch={false}
                state={tableState}
                loading={<LoadingState label="正在加载用户组…" />}
                empty={
                  <EmptyState
                    title={listState === 'active' ? '暂无用户组' : '暂无已归档用户组'}
                    description={listState === 'active' ? '点击右上角“新建组”创建第一个团队。' : '归档后的用户组会显示在这里。'}
                  />
                }
              />
              <p className="cwgsyw-type-body-sm">
                共 <strong>{total}</strong> 个{listState === 'active' ? '活动组' : '已归档组'}
              </p>
            </>
          )
        }
      />

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
        onOpenChange={(open) => {
          if (!open) setMemberGroup(null)
        }}
      />

      {lifecycleDialog ? (
        <GroupLifecycleDialog
          action={lifecycleDialog.action}
          target={lifecycleDialog.target}
          open
          onOpenChange={(open) => {
            if (!open) setLifecycleDialog(null)
          }}
          onSuccess={async () => {
            await invalidateGroupQueries()
            await refetch()
          }}
        />
      ) : null}
    </>
  )
}
