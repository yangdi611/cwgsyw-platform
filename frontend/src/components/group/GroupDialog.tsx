'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

interface GroupFormData {
  name: string
  description: string
  leader_id: number | null
  member_ids: number[]
}

interface UserOption {
  id: number
  username: string
  real_name: string
  group_id: number | null
  group_name?: string
}

interface GroupDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  group?: { id: number; name: string; description?: string; leader_id?: number | null } | null
  onClose: () => void
  onSuccess: () => void
}

export default function GroupDialog({ open, mode, group, onClose, onSuccess }: GroupDialogProps) {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<GroupFormData>({
    defaultValues: { name: '', description: '', leader_id: null, member_ids: [] }
  })

  const { data: usersData } = useQuery({
    queryKey: ['all-users-for-group'],
    queryFn: () => api.get('/users', { params: { page: 1, size: 200 } }).then(r => {
      const records = r.data.data?.records ?? []
      return records as UserOption[]
    }),
    enabled: open,
  })

  const { data: groupsData } = useQuery({
    queryKey: ['all-groups-for-dialog'],
    queryFn: () => api.get('/groups').then(r => r.data.data as any[]),
    enabled: open,
  })

  const sortedUsers = useMemo(() => {
    if (!usersData) return []
    const groupMap = new Map((groupsData || []).map((g: any) => [g.id, g.name]))
    return [...usersData].sort((a, b) => {
      const aHasGroup = a.group_id != null ? 1 : 0
      const bHasGroup = b.group_id != null ? 1 : 0
      if (aHasGroup !== bHasGroup) return aHasGroup - bHasGroup
      return (a.real_name || a.username).localeCompare(b.real_name || b.username, 'zh-CN')
    }).map(u => ({ ...u, group_name: u.group_id ? groupMap.get(u.group_id) : undefined }))
  }, [usersData, groupsData])

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && group) {
        reset({ name: group.name, description: group.description || '', leader_id: (group as any).leader_id ?? null, member_ids: [] })
      } else {
        reset({ name: '', description: '', leader_id: null, member_ids: [] })
      }
    }
  }, [open, mode, group, reset])

  const selectedMemberIds = watch('member_ids')

  const onSubmit = async (data: GroupFormData) => {
    try {
      if (mode === 'create') {
        await api.post('/groups', {
          name: data.name,
          description: data.description,
          leader_id: data.leader_id || undefined,
          member_ids: data.member_ids.length > 0 ? data.member_ids : undefined,
        })
        toast.success('组创建成功')
      } else {
        await api.put(`/groups/${group!.id}`, {
          name: data.name,
          description: data.description,
          leader_id: data.leader_id,
        })
        toast.success('组更新成功')
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message || '操作失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新建组' : '编辑组'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">组名称</Label>
            <Input
              id="name"
              {...register('name', { required: '组名称不能为空' })}
              placeholder="请输入组名称"
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <textarea id="description" {...register('description')}
              className="w-full rounded-md border border-v2-border bg-background px-3 py-2 text-sm"
              rows={2} placeholder="请输入组描述" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="leader_id">组长</Label>
            <select id="leader_id" {...register('leader_id', { setValueAs: (v) => v === '' ? null : Number(v) })}
              className="w-full rounded-md border border-v2-border bg-background px-3 py-2 text-sm">
              <option value="">-- 不指定组长 --</option>
              {sortedUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.real_name || u.username}{u.group_name ? ' (' + u.group_name + ')' : ''}
                </option>
              ))}
            </select>
          </div>

          {mode === 'create' && (
            <div className="space-y-2">
              <Label>组员</Label>
              <div className="max-h-40 overflow-y-auto space-y-1 border rounded p-2">
                {sortedUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={selectedMemberIds.includes(u.id)}
                      onCheckedChange={(c) => { if (c) { setValue('member_ids', [...selectedMemberIds, u.id]) } else { setValue('member_ids', selectedMemberIds.filter(id => id !== u.id)) } }} />
                    {u.real_name || u.username}
                    {u.group_name && <span className="text-v2-muted">（{u.group_name}）</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
