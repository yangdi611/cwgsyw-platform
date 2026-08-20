'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { getApiErrorMessage } from '@/lib/api-error'
import { inspectPassword } from '@/lib/password-policy'
import { NeutralPasswordHints } from '@/components/account/NeutralPasswordHints'
import { TaskPanel } from '@/components/task-runtime/TaskEmpty'
import '@/components/task-runtime/tasks.css'
import {
  Button,
  Checkbox,
  Field,
  Input,
  NeutralDialog,
  Switch,
} from '@/design-system/figma-neutral/components'

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
    defaultValues: { username: '', realName: '', email: '', phone: '', password: '', status: 1, roleIds: [] },
  })

  const status = watch('status')
  const selectedRoles = watch('roleIds')
  const password = watch('password')
  const username = watch('username')

  const [resetPasswordOpen, setResetPasswordOpen] = useState(false)

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/rbac/roles').then((r) => (r.data.data?.records ?? []) as Role[]),
    enabled: open,
  })

  const { data: userDetail } = useQuery({
    queryKey: ['user-detail', user?.id],
    queryFn: () => api.get('/users/' + user!.id).then((r) => r.data.data),
    enabled: open && mode === 'edit' && !!user?.id,
  })

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && user) {
      reset({
        username: user.username,
        realName: user.realName || '',
        email: user.email || '',
        phone: user.phone || '',
        password: '',
        status: user.status,
        roleIds: userDetail?.roleIds ?? [],
      })
    } else {
      reset({ username: '', realName: '', email: '', phone: '', password: '', status: 1, roleIds: [] })
    }
  }, [open, mode, user, userDetail, reset])

  const onSubmit = async (data: UserFormData) => {
    try {
      if (mode === 'create') {
        await api.post('/users', {
          username: data.username,
          realName: data.realName,
          email: data.email,
          phone: data.phone,
          password: data.password,
          roleIds: data.roleIds,
        })
        toast.success('用户创建成功，用户首次登录需修改密码并补全资料')
      } else {
        await api.put(`/users/${user!.id}`, {
          realName: data.realName,
          email: data.email,
          phone: data.phone,
          status: data.status,
          roleIds: data.roleIds,
        })
        toast.success('用户更新成功')
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '操作失败'))
    }
  }

  return (
    <>
      <NeutralDialog
        className="cwgsyw-identity-dialog"
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose()
        }}
        title={mode === 'create' ? '新建用户' : '编辑用户'}
        showClose={false}
        footer={
          <div className="cwgsyw-form__actions">
            <Button type="button" size="sm" variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" form="user-dialog-form" size="sm" variant="primary" loading={isSubmitting}>
              {isSubmitting ? '保存中…' : '保存'}
            </Button>
          </div>
        }
      >
        <form id="user-dialog-form" className="cwgsyw-form cwgsyw-identity-form" noValidate onSubmit={handleSubmit(onSubmit)}>
          <Field
            htmlFor="username"
            label="用户名"
            required
            state={mode === 'edit' ? 'disabled' : errors.username ? 'error' : 'default'}
            errorText={errors.username?.message}
          >
            <Input size="sm"
              maxLength={64}
              placeholder="请输入用户名"
              {...register('username', {
                required: '用户名不能为空',
                maxLength: { value: 64, message: '用户名不能超过64个字符' },
              })}
            />
          </Field>
          <Field htmlFor="real_name" label="真实姓名">
            <Input size="sm" placeholder="请输入真实姓名" {...register('realName')} />
          </Field>
          <Field htmlFor="email" label="邮箱">
            <Input size="sm" type="email" maxLength={128} placeholder="请输入邮箱（未填则用户首次登录补全）" {...register('email')} />
          </Field>
          <Field htmlFor="phone" label="手机号">
            <Input size="sm" placeholder="请输入手机号（未填则用户首次登录补全）" {...register('phone')} />
          </Field>
          {mode === 'create' ? (
            <Field
              htmlFor="password"
              label="初始密码"
              required
              helperText="用户首次登录必须修改此密码。"
              state={errors.password ? 'error' : 'default'}
              errorText={errors.password?.message}
            >
              <Input size="sm"
                type="password"
                placeholder="至少 10 位，含大小写字母/数字/特殊字符"
                {...register('password', { required: '密码不能为空' })}
              />
            </Field>
          ) : null}
          {mode === 'create' ? <NeutralPasswordHints username={username} password={password} /> : null}
          {mode === 'edit' ? (
            <>
              <Switch
                label="启用状态"
                checked={status === 1}
                onChange={(event) => setValue('status', event.target.checked ? 1 : 0)}
              />
              <div className="cwgsyw-inline-controls">
                <Button type="button" variant="outline" size="sm" onClick={() => setResetPasswordOpen(true)}>
                  重置密码
                </Button>
              </div>
            </>
          ) : null}
          <TaskPanel
            title="角色分配"
            action={<span className="cwgsyw-tasks-cell-meta">已选 {selectedRoles.length} / {(rolesData || []).length}</span>}
          >
            <div className="cwgsyw-identity-check-list">
              {(rolesData || []).map((role) => (
                <Checkbox
                  key={role.id}
                  className="cwgsyw-tasks-choice"
                  label={role.name}
                  checked={selectedRoles.includes(role.id)}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setValue('roleIds', [...selectedRoles, role.id])
                    } else {
                      setValue('roleIds', selectedRoles.filter((id) => id !== role.id))
                    }
                  }}
                />
              ))}
              {(rolesData || []).length === 0 ? <p className="cwgsyw-stack-list__empty">暂无角色</p> : null}
            </div>
          </TaskPanel>
        </form>
      </NeutralDialog>

      {user ? (
        <ResetPasswordDialog
          open={resetPasswordOpen}
          username={user.username}
          userId={user.id}
          onClose={() => setResetPasswordOpen(false)}
        />
      ) : null}
    </>
  )
}

function ResetPasswordDialog({
  open,
  username,
  userId,
  onClose,
}: {
  open: boolean
  username: string
  userId: number
  onClose: () => void
}) {
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<ResetPasswordFormData>({
    defaultValues: { newPassword: '', confirmPassword: '' },
  })
  const newPassword = watch('newPassword')
  const confirmPassword = watch('confirmPassword')
  const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword

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
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '重置密码失败'))
    }
  }

  return (
    <NeutralDialog
        className="cwgsyw-identity-dialog"
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={`重置密码：@${username}`}
      description="重置后该用户所有登录会话会立即失效，下次登录需修改密码。"
      showClose={false}
      footer={
        <div className="cwgsyw-form__actions">
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="reset-password-form" size="sm" variant="primary" loading={isSubmitting}>
            {isSubmitting ? '提交中…' : '确认重置'}
          </Button>
        </div>
      }
    >
      <form id="reset-password-form" className="cwgsyw-form cwgsyw-identity-form" noValidate onSubmit={handleSubmit(onSubmit)}>
        <Field
          htmlFor="newPassword"
          label="新密码"
          required
          state={errors.newPassword ? 'error' : 'default'}
          errorText={errors.newPassword?.message}
        >
          <Input size="sm" type="password" {...register('newPassword', { required: '新密码不能为空' })} />
        </Field>
        <NeutralPasswordHints username={username} password={newPassword} />
        <Field
          htmlFor="confirmPassword"
          label="确认新密码"
          required
          state={confirmMismatch || errors.confirmPassword ? 'error' : 'default'}
          errorText={confirmMismatch ? '两次输入的密码不一致' : errors.confirmPassword?.message}
        >
          <Input size="sm" type="password" {...register('confirmPassword', { required: '请再次输入新密码' })} />
        </Field>
      </form>
    </NeutralDialog>
  )
}
