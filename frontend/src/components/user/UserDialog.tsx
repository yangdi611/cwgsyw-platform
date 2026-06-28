'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

interface Role {
  id: number
  code: string
  name: string
}

interface UserFormData {
  username: string
  realName: string
  email: string
  password: string
  status: number
  roleIds: number[]
}

interface UserDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  user?: { id: number; username: string; realName: string; email: string; status: number } | null
  onClose: () => void
  onSuccess: () => void
}

export default function UserDialog({ open, mode, user, onClose, onSuccess }: UserDialogProps) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<UserFormData>({
    defaultValues: { username: '', realName: '', email: '', password: '', status: 1, roleIds: [] }
  })

  const status = watch('status')
  const selectedRoles = watch('roleIds')

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/rbac/roles').then(r => (r.data.data?.records ?? []) as Role[]),
    enabled: open
  })

  const { data: userDetail } = useQuery({
    queryKey: ['user-detail', user?.id],
    queryFn: () => api.get('/users/' + user!.id).then(r => r.data.data),
    enabled: open && mode === 'edit' && !!user?.id
  })

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && user) {
        reset({
          username: user.username,
          realName: user.realName || '',
          email: user.email || '',
          password: '',
          status: user.status,
          roleIds: userDetail?.roleIds ?? []
        })
      } else {
        reset({ username: '', realName: '', email: '', password: '', status: 1, roleIds: [] })
      }
    }
  }, [open, mode, user, userDetail, reset])

  const onSubmit = async (data: UserFormData) => {
    try {
      if (mode === 'create') {
        await api.post('/users', {
          username: data.username,
          realName: data.realName,
          email: data.email,
          password: data.password,
          roleIds: data.roleIds
        })
        toast.success('用户创建成功')
      } else {
        const body: Record<string, any> = {
          realName: data.realName,
          email: data.email,
          status: data.status,
          roleIds: data.roleIds
        }
        if (data.password) body.password = data.password
        await api.put(`/users/${user!.id}`, body)
        toast.success('用户更新成功')
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      const msg = err.response?.data?.message || '操作失败'
      toast.error(msg)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新建用户' : '编辑用户'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              {...register('username', { required: '用户名不能为空' })}
              disabled={mode === 'edit'}
              placeholder="请输入用户名"
            />
            {errors.username && <p className="text-sm text-red-500">{errors.username.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="real_name">真实姓名</Label>
            <Input id="real_name" {...register('realName')} placeholder="请输入真实姓名" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" type="email" {...register('email')} placeholder="请输入邮箱" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              密码{mode === 'edit' ? '（留空则不修改）' : ''}
            </Label>
            <Input
              id="password"
              type="password"
              {...register('password', {
                required: mode === 'create' ? '密码不能为空' : false,
                minLength: { value: 6, message: '密码至少6位' }
              })}
              placeholder={mode === 'edit' ? '留空不修改' : '请输入密码'}
            />
            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
          </div>

          {mode === 'edit' && (
            <div className="flex items-center justify-between">
              <Label htmlFor="status">启用状态</Label>
              <Switch
                id="status"
                checked={status === 1}
                onCheckedChange={(c) => setValue('status', c ? 1 : 0)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>角色分配</Label>
            <div className="max-h-32 overflow-y-auto space-y-1 border rounded p-2">
              {(rolesData || []).map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedRoles.includes(role.id)}
                    onCheckedChange={(c) => {
                      if (c) {
                        setValue('roleIds', [...selectedRoles, role.id])
                      } else {
                        setValue('roleIds', selectedRoles.filter(id => id !== role.id))
                      }
                    }}
                  />
                  {role.name}
                </label>
              ))}
            </div>
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
