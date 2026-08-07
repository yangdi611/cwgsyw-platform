'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label } from '@/components/design-system'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/api-error'

interface GroupFormData {
  name: string
  description: string
  leaderId: number | null
  memberIds: number[]
}

interface UserOption {
  id: number
  username: string
  realName: string
  groupId: number | null
  groupName?: string
}

interface GroupDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  group?: { id: number; name: string; description?: string; leaderId?: number | null } | null
  onClose: () => void
  onSuccess: () => void
}

export default function GroupDialog({ open, mode, group, onClose, onSuccess }: GroupDialogProps) {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<GroupFormData>({
    defaultValues: { name: '', description: '', leaderId: null, memberIds: [] }
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
    queryFn: () => api.get('/groups').then(r => r.data.data as { id: number; name: string }[]),
    enabled: open,
  })

  const sortedUsers = useMemo(() => {
    if (!usersData) return []
    const groupMap = new Map((groupsData || []).map((g) => [g.id, g.name]))
    return [...usersData].sort((a, b) => {
      const aHasGroup = a.groupId != null ? 1 : 0
      const bHasGroup = b.groupId != null ? 1 : 0
      if (aHasGroup !== bHasGroup) return aHasGroup - bHasGroup
      return (a.realName || a.username).localeCompare(b.realName || b.username, 'zh-CN')
    }).map(u => ({ ...u, groupName: u.groupId ? groupMap.get(u.groupId) : undefined }))
  }, [usersData, groupsData])

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && group) {
        reset({ name: group.name, description: group.description || '', leaderId: (group as { leaderId?: number | null }).leaderId ?? null, memberIds: [] })
      } else {
        reset({ name: '', description: '', leaderId: null, memberIds: [] })
      }
    }
  }, [open, mode, group, reset])

  const selectedMemberIds = watch('memberIds')

  const onSubmit = async (data: GroupFormData) => {
    try {
      if (mode === 'create') {
        await api.post('/groups', {
          name: data.name,
          description: data.description,
          leaderId: data.leaderId || undefined,
          memberIds: data.memberIds.length > 0 ? data.memberIds : undefined,
        })
        toast.success('组创建成功')
      } else {
        await api.put(`/groups/${group!.id}`, {
          name: data.name,
          description: data.description,
          leaderId: data.leaderId,
        })
        toast.success('组更新成功')
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '操作失败'))
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
              {...register('name', { required: '组名称不能为空', maxLength: { value: 64, message: '组名称不能超过64个字符' } })}
              maxLength={64}
              placeholder="请输入组名称"
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">描述</Label>
            <textarea id="description" {...register('description', { maxLength: { value: 255, message: '组描述不能超过255个字符' } })}
              className="w-full rounded-md border border-v2-border bg-background px-3 py-2 text-sm"
              rows={2} maxLength={255} placeholder="请输入组描述" />
            {errors.description && <p className="text-sm text-red-500">{errors.description.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="leaderId">组长</Label>
            <select id="leaderId" {...register('leaderId', { setValueAs: (v) => v === '' ? null : Number(v) })}
              className="w-full rounded-md border border-v2-border bg-background px-3 py-2 text-sm">
              <option value="">-- 不指定组长 --</option>
              {sortedUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.realName || u.username}{u.groupName ? ' (' + u.groupName + ')' : ''}
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
                      onCheckedChange={(c) => { if (c) { setValue('memberIds', [...selectedMemberIds, u.id]) } else { setValue('memberIds', selectedMemberIds.filter(id => id !== u.id)) } }} />
                    {u.realName || u.username}
                    {u.groupName && <span className="text-v2-muted">（{u.groupName}）</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="default" type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button size="default" variant="default" type="submit" disabled={isSubmitting}>
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
