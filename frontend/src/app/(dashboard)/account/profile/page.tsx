'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/v2/Card'
import { ProfileForm } from '@/components/account/ProfileForm'
import { getAccountProfile, type AccountProfile } from '@/lib/account-api'

export default function AccountProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAccountProfile()
      .then(setProfile)
      .finally(() => setLoading(false))
  }, [])

  // 保存成功后返回进入本页前的来源页面，而不是停留在个人资料页。
  const handleSuccess = () => {
    router.back()
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="账号安全" title="个人资料" subtitle="维护手机号、邮箱和头像，真实姓名由管理员统一维护。" />

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>基本资料</CardTitle>
          <CardDescription>{profile ? `@${profile.username} · ${profile.realName}` : ' '}</CardDescription>
        </CardHeader>
        <CardContent>
          {!loading && profile && <ProfileForm onSuccess={handleSuccess} />}
        </CardContent>
      </Card>
    </div>
  )
}
