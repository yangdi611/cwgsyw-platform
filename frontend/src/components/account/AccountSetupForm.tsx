'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/v2/Button'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { toast } from 'sonner'
import { submitAccountSetup, type AccountProfile } from '@/lib/account-api'
import { inspectPassword } from '@/lib/password-policy'
import { PasswordStrengthHints } from './PasswordStrengthHints'

interface AccountSetupFormData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
  email: string
  phone: string
  avatarUrl: string
}

interface AccountSetupFormProps {
  username: string
  mustChangePassword: boolean
  onSuccess: (profile: AccountProfile) => void
}

/**
 * 首次登录强制流程表单（SPEC 6.3）：一次性提交改密 + 补全资料。
 * mustChangePassword=false 时（只差 profile）当前/新密码字段留空提交。
 */
export function AccountSetupForm({ username, mustChangePassword, onSuccess }: AccountSetupFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<AccountSetupFormData>({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '', email: '', phone: '', avatarUrl: '' },
  })
  const newPassword = watch('newPassword')
  const confirmPassword = watch('confirmPassword')

  const onSubmit = async (data: AccountSetupFormData) => {
    if (mustChangePassword) {
      const violations = inspectPassword(username, data.newPassword)
      if (violations.length > 0) {
        toast.error('新密码不符合复杂度要求')
        return
      }
      if (data.newPassword !== data.confirmPassword) {
        toast.error('两次输入的密码不一致')
        return
      }
    }
    setSubmitting(true)
    try {
      const profile = await submitAccountSetup({
        currentPassword: mustChangePassword ? data.currentPassword : undefined,
        newPassword: mustChangePassword ? data.newPassword : undefined,
        confirmPassword: mustChangePassword ? data.confirmPassword : undefined,
        email: data.email,
        phone: data.phone,
        avatarUrl: data.avatarUrl || undefined,
      })
      toast.success('设置完成')
      onSuccess(profile)
    } catch (err: any) {
      const code = err.response?.data?.errorCode
      const message = err.response?.data?.message || '提交失败'
      if (code === 'PASSWORD_REUSED') {
        toast.error('新密码不能与初始密码或最近使用过的密码相同')
      } else {
        toast.error(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {mustChangePassword && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-v2-fg">第一步：修改初始密码</h3>
          <div className="space-y-2">
            <Label htmlFor="currentPassword">当前密码</Label>
            <Input
              id="currentPassword"
              type="password"
              {...register('currentPassword', { required: '请输入当前密码' })}
            />
            {errors.currentPassword && <p className="text-sm text-v2-danger">{errors.currentPassword.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">新密码</Label>
            <Input
              id="newPassword"
              type="password"
              {...register('newPassword', { required: '请输入新密码' })}
            />
            <PasswordStrengthHints username={username} password={newPassword} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认新密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              {...register('confirmPassword', { required: '请再次输入新密码' })}
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-sm text-v2-danger">两次输入的密码不一致</p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-v2-fg">
          {mustChangePassword ? '第二步：补全个人资料' : '补全个人资料'}
        </h3>
        <div className="space-y-2">
          <Label htmlFor="email">邮箱</Label>
          <Input id="email" type="email" {...register('email', { required: '请输入邮箱' })} />
          {errors.email && <p className="text-sm text-v2-danger">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">手机号</Label>
          <Input id="phone" {...register('phone', { required: '请输入手机号' })} />
          {errors.phone && <p className="text-sm text-v2-danger">{errors.phone.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="avatarUrl">头像 URL（可选）</Label>
          <Input id="avatarUrl" {...register('avatarUrl')} />
        </div>
      </div>

      <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
        {submitting ? '提交中…' : '完成设置'}
      </Button>
    </form>
  )
}
