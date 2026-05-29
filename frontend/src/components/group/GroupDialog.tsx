'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import api from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface GroupFormData {
  name: string
}

interface GroupDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  group?: { id: number; name: string } | null
  onClose: () => void
  onSuccess: () => void
}

export default function GroupDialog({ open, mode, group, onClose, onSuccess }: GroupDialogProps) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<GroupFormData>({
    defaultValues: { name: '' }
  })

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && group) {
        reset({ name: group.name })
      } else {
        reset({ name: '' })
      }
    }
  }, [open, mode, group, reset])

  const onSubmit = async (data: GroupFormData) => {
    try {
      if (mode === 'create') {
        await api.post('/groups', { name: data.name })
        toast.success('组创建成功')
      } else {
        await api.put(`/groups/${group!.id}`, { name: data.name })
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
      <DialogContent className="sm:max-w-sm">
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
