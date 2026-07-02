'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/v2/Button'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { toast } from 'sonner'
import { getAccountProfile, updateAccountProfile, type AccountProfile } from '@/lib/account-api'

interface ProfileFormData {
  email: string
  phone: string
  avatarUrl: string
}

interface ProfileFormProps {
  onSuccess?: (profile: AccountProfile) => void
}

/**
 * 用户自助资料表单（SPEC 11.2 PUT /api/account/profile）。
 * realName 不可自助修改，由管理员维护（SPEC 8.4）。
 */
export function ProfileForm({ onSuccess }: ProfileFormProps) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [realName, setRealName] = useState('')
  const [username, setUsername] = useState('')
  const { register, handleSubmit, reset } = useForm<ProfileFormData>({
    defaultValues: { email: '', phone: '', avatarUrl: '' },
  })

  useEffect(() => {
    getAccountProfile()
      .then((profile) => {
        setRealName(profile.realName)
        setUsername(profile.username)
        reset({
          email: profile.email ?? '',
          phone: profile.phone ?? '',
          avatarUrl: profile.avatarUrl ?? '',
        })
      })
      .finally(() => setLoading(false))
  }, [reset])

  const onSubmit = async (data: ProfileFormData) => {
    setSubmitting(true)
    try {
      const profile = await updateAccountProfile(data)
      toast.success('资料已更新')
      onSuccess?.(profile)
    } catch (err: any) {
      toast.error(err.response?.data?.message || '更新失败')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>用户名</Label>
        <Input value={username} disabled />
      </div>
      <div className="space-y-2">
        <Label>真实姓名</Label>
        <Input value={realName} disabled />
        <p className="text-xs text-v2-muted">真实姓名由管理员维护，如需修改请联系管理员。</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">邮箱</Label>
        <Input id="email" type="email" {...register('email')} placeholder="请输入邮箱" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">手机号</Label>
        <Input id="phone" {...register('phone')} placeholder="请输入手机号" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="avatarUrl">头像 URL</Label>
        <Input id="avatarUrl" {...register('avatarUrl')} placeholder="可选，留空则使用默认头像" />
      </div>
      <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
        {submitting ? '保存中…' : '保存资料'}
      </Button>
    </form>
  )
}
