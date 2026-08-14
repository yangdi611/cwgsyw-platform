'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '@/design-system/figma-neutral/toast'
import { Button, Field, Input } from '@/design-system/figma-neutral/components'
import { getApiErrorCode, getApiErrorMessage } from '@/lib/api-error'
import { submitAccountSetup, type AccountProfile } from '@/lib/account-api'
import { inspectPassword } from '@/lib/password-policy'
import { NeutralPasswordHints } from './NeutralPasswordHints'

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
  const confirmMismatch = mustChangePassword && confirmPassword.length > 0 && confirmPassword !== newPassword

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
    } catch (err: unknown) {
      const code = getApiErrorCode(err)
      const message = getApiErrorMessage(err, '提交失败')
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
    <form className="cwgsyw-form" noValidate onSubmit={handleSubmit(onSubmit)}>
      {mustChangePassword ? (
        <>
          <h3 className="cwgsyw-type-title-sm">第一步：修改初始密码</h3>
          <Field
            htmlFor="currentPassword"
            label="当前密码"
            required
            state={errors.currentPassword ? 'error' : 'default'}
            errorText={errors.currentPassword?.message}
          >
            <Input
              type="password"
              autoComplete="current-password"
              {...register('currentPassword', { required: '请输入当前密码' })}
            />
          </Field>
          <Field
            htmlFor="newPassword"
            label="新密码"
            required
            state={errors.newPassword ? 'error' : 'default'}
            errorText={errors.newPassword?.message}
          >
            <Input
              type="password"
              autoComplete="new-password"
              {...register('newPassword', { required: '请输入新密码' })}
            />
          </Field>
          <NeutralPasswordHints username={username} password={newPassword} />
          <Field
            htmlFor="confirmPassword"
            label="确认新密码"
            required
            state={confirmMismatch || errors.confirmPassword ? 'error' : 'default'}
            errorText={confirmMismatch ? '两次输入的密码不一致' : errors.confirmPassword?.message}
          >
            <Input
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword', { required: '请再次输入新密码' })}
            />
          </Field>
        </>
      ) : null}

      <h3 className="cwgsyw-type-title-sm">{mustChangePassword ? '第二步：补全个人资料' : '补全个人资料'}</h3>
      <Field
        htmlFor="email"
        label="邮箱"
        required
        state={errors.email ? 'error' : 'default'}
        errorText={errors.email?.message}
      >
        <Input type="email" autoComplete="email" {...register('email', { required: '请输入邮箱' })} />
      </Field>
      <Field
        htmlFor="phone"
        label="手机号"
        required
        state={errors.phone ? 'error' : 'default'}
        errorText={errors.phone?.message}
      >
        <Input autoComplete="tel" {...register('phone', { required: '请输入手机号' })} />
      </Field>
      <Field htmlFor="avatarUrl" label="头像 URL">
        <Input placeholder="可选" {...register('avatarUrl')} />
      </Field>
      <div className="cwgsyw-form__actions">
        <Button type="submit" variant="primary" loading={submitting}>
          {submitting ? '提交中…' : '完成设置'}
        </Button>
      </div>
    </form>
  )
}
