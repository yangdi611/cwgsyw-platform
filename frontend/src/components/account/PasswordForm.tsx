'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/v2/Button'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { toast } from 'sonner'
import { changeAccountPassword } from '@/lib/account-api'
import { inspectPassword } from '@/lib/password-policy'
import { PasswordStrengthHints } from './PasswordStrengthHints'

interface PasswordFormData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

interface PasswordFormProps {
  username?: string
  onSuccess?: () => void
}

/** 用户自助修改密码表单（SPEC 11.2 POST /api/account/password）。 */
export function PasswordForm({ username, onSuccess }: PasswordFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<PasswordFormData>({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const newPassword = watch('newPassword')
  const confirmPassword = watch('confirmPassword')
  const violations = inspectPassword(username, newPassword)
  const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword

  const onSubmit = async (data: PasswordFormData) => {
    if (violations.length > 0 || confirmMismatch) return
    setSubmitting(true)
    try {
      await changeAccountPassword(data)
      toast.success('密码修改成功')
      reset()
      onSuccess?.()
    } catch (err: any) {
      toast.error(err.response?.data?.message || '修改失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">当前密码</Label>
        <Input
          id="currentPassword"
          type="password"
          {...register('currentPassword', { required: '请输入当前密码' })}
        />
        {errors.currentPassword && (
          <p className="text-sm text-v2-danger">{errors.currentPassword.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">新密码</Label>
        <Input id="newPassword" type="password" {...register('newPassword', { required: true })} />
        <PasswordStrengthHints username={username} password={newPassword} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">确认新密码</Label>
        <Input id="confirmPassword" type="password" {...register('confirmPassword', { required: true })} />
        {confirmMismatch && <p className="text-sm text-v2-danger">两次输入的密码不一致</p>}
      </div>

      <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
        {submitting ? '提交中…' : '修改密码'}
      </Button>
    </form>
  )
}
