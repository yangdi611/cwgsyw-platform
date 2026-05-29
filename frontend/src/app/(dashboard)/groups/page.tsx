'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import GroupDialog from '@/components/group/GroupDialog'

interface Group {
  id: number
  name: string
  description: string
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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then((r) => {
      const items = r.data.data as Group[]
      return { records: items, total: items.length }
    }),
  })

  const groups = data?.records ?? []
  const total = data?.total ?? 0

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
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">组管理</h1>
        {canCreate && (
          <Button onClick={handleNew}>+ 新建组</Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground">暂无组</p>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 text-sm font-medium">组名称</th>
                  <th className="text-left p-3 text-sm font-medium">描述</th>
                  {(canUpdate || canDelete) && (
                    <th className="text-right p-3 text-sm font-medium">操作</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id} className="border-b last:border-0">
                    <td className="p-3 text-sm font-medium">{group.name}</td>
                    <td className="p-3 text-sm text-muted-foreground">{group.description || '-'}</td>
                    {(canUpdate || canDelete) && (
                      <td className="p-3 text-right">
                        {canUpdate && (
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(group)}>
                            编辑
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setDeleteTarget(group)}>
                            删除
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            共 {total} 个组
          </div>
        </>
      )}

      <GroupDialog
        open={dialogOpen}
        mode={dialogMode}
        group={editGroup}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => refetch()}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除组 <strong>{deleteTarget?.name}</strong> 吗？该组下的成员关联将一并清除。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
