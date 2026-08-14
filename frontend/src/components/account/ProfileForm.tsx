'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from '@/design-system/figma-neutral/toast'
import { Button, Field, Input } from '@/design-system/figma-neutral/components'
import { getApiErrorMessage } from '@/lib/api-error'
import { updateAccountProfile, type AccountProfile } from '@/lib/account-api'

interface ProfileFormData {
  email: string
  phone: string
  avatarUrl: string
}

interface ProfileFormProps {
  profile: AccountProfile
  onSuccess?: (profile: AccountProfile) => void
}

/**
 * 用户自助资料表单（SPEC 11.2 PUT /api/account/profile）。
 * realName 不可自助修改，由管理员维护（SPEC 8.4）。
 */
export function ProfileForm({ profile, onSuccess }: ProfileFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, reset } = useForm<ProfileFormData>({
    defaultValues: {
      email: profile.email ?? '',
      phone: profile.phone ?? '',
      avatarUrl: profile.avatarUrl ?? '',
    },
  })

  const onSubmit = async (data: ProfileFormData) => {
    setSubmitting(true)
    try {
      const nextProfile = await updateAccountProfile(data)
      reset({
        email: nextProfile.email ?? '',
        phone: nextProfile.phone ?? '',
        avatarUrl: nextProfile.avatarUrl ?? '',
      })
      toast.success('资料已更新')
      onSuccess?.(nextProfile)
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '更新失败'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="cwgsyw-form" noValidate onSubmit={handleSubmit(onSubmit)}>
      <Field htmlFor="profile-username" label="用户名" state="disabled">
        <Input autoComplete="username" readOnly value={profile.username} />
      </Field>
      <Field
        htmlFor="profile-realName"
        label="真实姓名"
        state="disabled"
        helperText="真实姓名由管理员维护，如需修改请联系管理员。"
      >
        <Input autoComplete="name" readOnly value={profile.realName} />
      </Field>
      <Field htmlFor="email" label="邮箱">
        <Input type="email" autoComplete="email" maxLength={128} placeholder="请输入邮箱" {...register('email')} />
      </Field>
      <Field htmlFor="phone" label="手机号">
        <Input autoComplete="tel" maxLength={32} placeholder="请输入手机号" {...register('phone')} />
      </Field>
      <Field htmlFor="avatarUrl" label="头像 URL">
        <Input maxLength={512} placeholder="可选，留空则使用默认头像" {...register('avatarUrl')} />
      </Field>
      <div className="cwgsyw-form__actions">
        <Button type="submit" variant="primary" loading={submitting}>
          {submitting ? '保存中…' : '保存资料'}
        </Button>
      </div>
    </form>
  )
}
