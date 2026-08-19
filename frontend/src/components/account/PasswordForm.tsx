'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '@/design-system/figma-neutral/toast'
import { Button, Field, Input } from '@/design-system/figma-neutral/components'
import { getApiErrorMessage } from '@/lib/api-error'
import { changeAccountPassword } from '@/lib/account-api'
import { inspectPassword } from '@/lib/password-policy'
import { NeutralPasswordHints } from './NeutralPasswordHints'

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
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PasswordFormData>({
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
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '修改失败'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="cwgsyw-form cwgsyw-account-form" noValidate onSubmit={handleSubmit(onSubmit)}>
      <Field
        htmlFor="currentPassword"
        label="当前密码"
        required
        state={errors.currentPassword ? 'error' : 'default'}
        errorText={errors.currentPassword?.message}
      >
        <Input
          size="sm"
          type="password"
          autoComplete="current-password"
          {...register('currentPassword', { required: '请输入当前密码' })}
        />
      </Field>
      <Field htmlFor="newPassword" label="新密码" required>
        <Input size="sm" type="password" autoComplete="new-password" {...register('newPassword', { required: true })} />
      </Field>
      <NeutralPasswordHints username={username} password={newPassword} />
      <Field
        htmlFor="confirmPassword"
        label="确认新密码"
        required
        state={confirmMismatch ? 'error' : 'default'}
        errorText={confirmMismatch ? '两次输入的密码不一致' : undefined}
      >
        <Input size="sm" type="password" autoComplete="new-password" {...register('confirmPassword', { required: true })} />
      </Field>
      <div className="cwgsyw-form__actions">
        <Button type="submit" size="sm" variant="primary" loading={submitting}>
          {submitting ? '提交中…' : '修改密码'}
        </Button>
      </div>
    </form>
  )
}
