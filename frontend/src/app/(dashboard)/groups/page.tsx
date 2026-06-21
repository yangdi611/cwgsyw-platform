'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/v2/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/v2/Dialog'
import { toast } from 'sonner'
import GroupDialog from '@/components/group/GroupDialog'
import MemberDialog from '@/components/group/MemberDialog'
import { PageHeader, DataTable, type ColumnDef } from '@/components/shared'
import { Plus, Trash2, Pencil, Users } from 'lucide-react'

interface Group {
  id: number
  name: string
  description: string
  leader_id: number | null
  leader_real_name: string | null
  member_count: number
  member_preview: string[]
}

export default function GroupsPage() {
  const { hasPermission } = usePermission()
  const canCreate = hasPermission('group', 'create')
  const canUpdate = hasPermission('group', 'update')
  const canDelete = hasPermission('group', 'delete')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editGroup, setEditGroup] = useState<Group | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null)
  const [memberGroup, setMemberGroup] = useState<Group | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then((r) => r.data.data as Group[]),
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

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/groups/${deleteTarget.id}`)
      toast.success('组已删除')
      setDeleteTarget(null)
      refetch()
    } catch {
      toast.error('删除失败')
      setDeleteTarget(null)
    }
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
      key: 'leader_real_name',
      title: '组长',
      render: (r) => <span className="text-v2-fg">{r.leader_real_name || '-'}</span>,
    },
    {
      key: 'member_count',
      title: '组员',
      render: (r) => (
        <div className="text-v2-muted">
          <span className="font-semibold text-v2-fg tabular-nums">{r.member_count ?? 0}</span> 人
          {r.member_preview && r.member_preview.length > 0 && (
            <span className="ml-2 text-xs">
              {r.member_preview.join(', ')}
              {(r.member_count ?? 0) > 3 ? ', …' : ''}
            </span>
          )}
        </div>
      ),
    },
    ...(canUpdate || canDelete
      ? [
          {
            key: 'actions',
            title: '操作',
            align: 'right' as const,
            render: (r: Group) => (
              <div className="flex items-center justify-end gap-1">
                {canUpdate && (
                  <Button variant="ghost" size="sm" onClick={() => setMemberGroup(r)}>
                    <Users className="h-3.5 w-3.5" />
                    成员
                  </Button>
                )}
                {canUpdate && (
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                    编辑
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-v2-danger"
                    onClick={() => setDeleteTarget(r)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="身份与权限"
        title="用户组管理"
        subtitle="按业务团队组织用户，配置组长与成员，支撑日报审批与数据可见性范围。"
        actions={
          canCreate ? (
            <Button variant="primary" onClick={handleNew}>
              <Plus className="h-4 w-4" />
              新建组
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={groups}
        rowKey={(r) => r.id}
        loading={isLoading}
        empty={{ title: '暂无用户组', description: '点击右上角"新建组"创建第一个团队。' }}
      />

      <div className="text-sm text-v2-muted">
        共 <span className="font-semibold text-v2-fg tabular-nums">{total}</span> 个组
      </div>

      <GroupDialog
        open={dialogOpen}
        mode={dialogMode}
        group={editGroup}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => refetch()}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除组 <strong>{deleteTarget?.name}</strong> 吗？该组下的成员关联将一并清除。
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MemberDialog
        groupId={memberGroup?.id ?? 0}
        groupName={memberGroup?.name ?? ''}
        open={!!memberGroup}
        onOpenChange={(o) => !o && setMemberGroup(null)}
      />
    </div>
  )
}
