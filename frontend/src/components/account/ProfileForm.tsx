'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button, Input, Label } from '@/components/design-system'
import { toast } from 'sonner'
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
      const profile = await updateAccountProfile(data)
      reset({
        email: profile.email ?? '',
        phone: profile.phone ?? '',
        avatarUrl: profile.avatarUrl ?? '',
      })
      toast.success('资料已更新')
      onSuccess?.(profile)
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '更新失败'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>用户名</Label>
        <Input value={profile.username} disabled />
      </div>
      <div className="space-y-2">
        <Label>真实姓名</Label>
        <Input value={profile.realName} disabled />
        <p className="text-xs text-v2-muted">真实姓名由管理员维护，如需修改请联系管理员。</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">邮箱</Label>
        <Input id="email" type="email" {...register('email')} maxLength={128} placeholder="请输入邮箱" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">手机号</Label>
        <Input id="phone" {...register('phone')} maxLength={32} placeholder="请输入手机号" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="avatarUrl">头像 URL</Label>
        <Input id="avatarUrl" {...register('avatarUrl')} maxLength={512} placeholder="可选，留空则使用默认头像" />
      </div>
      <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
        {submitting ? '保存中…' : '保存资料'}
      </Button>
    </form>
  )
}
