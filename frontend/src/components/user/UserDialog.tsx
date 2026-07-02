'use client'

import { useEffect, useState } from 'react'
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
import { inspectPassword, describeViolation } from '@/lib/password-policy'

interface Role {
  id: number
  code: string
  name: string
}

interface UserFormData {
  username: string
  realName: string
  email: string
  phone: string
  password: string
  status: number
  roleIds: number[]
}

interface ResetPasswordFormData {
  newPassword: string
  confirmPassword: string
}

interface UserDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  user?: { id: number; username: string; realName: string; email: string; phone?: string; status: number } | null
  onClose: () => void
  onSuccess: () => void
}

export default function UserDialog({ open, mode, user, onClose, onSuccess }: UserDialogProps) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<UserFormData>({
    defaultValues: { username: '', realName: '', email: '', phone: '', password: '', status: 1, roleIds: [] }
  })

  const status = watch('status')
  const selectedRoles = watch('roleIds')
  const password = watch('password')

  const [resetPasswordOpen, setResetPasswordOpen] = useState(false)

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
          phone: user.phone || '',
          password: '',
          status: user.status,
          roleIds: userDetail?.roleIds ?? []
        })
      } else {
        reset({ username: '', realName: '', email: '', phone: '', password: '', status: 1, roleIds: [] })
      }
    }
  }, [open, mode, user, userDetail, reset])

  // 创建用户时的密码复杂度即时提示（最终准入以后端 PasswordPolicyService 为准，见 SPEC 9.5）
  const passwordViolations = mode === 'create' ? inspectPassword(watch('username'), password) : []

  const onSubmit = async (data: UserFormData) => {
    try {
      if (mode === 'create') {
        await api.post('/users', {
          username: data.username,
          realName: data.realName,
          email: data.email,
          phone: data.phone,
          password: data.password,
          roleIds: data.roleIds
        })
        toast.success('用户创建成功，用户首次登录需修改密码并补全资料')
      } else {
        await api.put(`/users/${user!.id}`, {
          realName: data.realName,
          email: data.email,
          phone: data.phone,
          status: data.status,
          roleIds: data.roleIds
        })
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
    <>
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
              <Input id="email" type="email" {...register('email')} placeholder="请输入邮箱（未填则用户首次登录补全）" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">手机号</Label>
              <Input id="phone" {...register('phone')} placeholder="请输入手机号（未填则用户首次登录补全）" />
            </div>

            {mode === 'create' && (
              <div className="space-y-2">
                <Label htmlFor="password">初始密码</Label>
                <Input
                  id="password"
                  type="password"
                  {...register('password', { required: '密码不能为空' })}
                  placeholder="至少 10 位，含大小写字母/数字/特殊字符"
                />
                {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
                {password && passwordViolations.length > 0 && (
                  <ul className="space-y-0.5 text-xs text-red-500">
                    {passwordViolations.map((v) => <li key={v}>· {describeViolation(v)}</li>)}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">用户首次登录必须修改此密码。</p>
              </div>
            )}

            {mode === 'edit' && (
              <>
                <div className="flex items-center justify-between">
                  <Label htmlFor="status">启用状态</Label>
                  <Switch
                    id="status"
                    checked={status === 1}
                    onCheckedChange={(c) => setValue('status', c ? 1 : 0)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>密码</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setResetPasswordOpen(true)}>
                    重置密码
                  </Button>
                </div>
              </>
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

      {user && (
        <ResetPasswordDialog
          open={resetPasswordOpen}
          username={user.username}
          userId={user.id}
          onClose={() => setResetPasswordOpen(false)}
        />
      )}
    </>
  )
}

function ResetPasswordDialog({
  open,
  username,
  userId,
  onClose,
}: { open: boolean; username: string; userId: number; onClose: () => void }) {
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<ResetPasswordFormData>({
    defaultValues: { newPassword: '', confirmPassword: '' }
  })
  const newPassword = watch('newPassword')
  const violations = inspectPassword(username, newPassword)

  useEffect(() => {
    if (open) reset({ newPassword: '', confirmPassword: '' })
  }, [open, reset])

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }
    try {
      await api.post(`/users/${userId}/reset-password`, data)
      toast.success('密码已重置，用户下次登录需修改密码')
      onClose()
    } catch (err: any) {
      const msg = err.response?.data?.message || '重置密码失败'
      toast.error(msg)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>重置密码：@{username}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">新密码</Label>
            <Input
              id="newPassword"
              type="password"
              {...register('newPassword', { required: '新密码不能为空' })}
            />
            {errors.newPassword && <p className="text-sm text-red-500">{errors.newPassword.message}</p>}
            {newPassword && violations.length > 0 && (
              <ul className="space-y-0.5 text-xs text-red-500">
                {violations.map((v) => <li key={v}>· {describeViolation(v)}</li>)}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认新密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              {...register('confirmPassword', { required: '请再次输入新密码' })}
            />
            {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
          </div>
          <p className="text-xs text-muted-foreground">重置后该用户所有登录会话会立即失效，下次登录需修改密码。</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '提交中...' : '确认重置'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
