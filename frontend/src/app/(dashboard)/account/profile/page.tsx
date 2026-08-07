'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ErrorState, LoadingState, PageHeader } from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/design-system'
import { ProfileForm } from '@/components/account/ProfileForm'
import { getAccountProfile, type AccountProfile } from '@/lib/account-api'

export default function AccountProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true
    getAccountProfile()
      .then((nextProfile) => {
        if (!active) return
        setProfile(nextProfile)
      })
      .catch(() => {
        if (!active) return
        setProfile(null)
        setLoadError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const loadProfile = () => {
    setLoading(true)
    setLoadError(false)
    getAccountProfile()
      .then(setProfile)
      .catch(() => {
        setProfile(null)
        setLoadError(true)
      })
      .finally(() => setLoading(false))
  }

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
          <CardDescription>{profile ? `@${profile.username} · ${profile.realName}` : '账号资料加载状态'}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState label="正在加载个人资料…" minHeight={180} />
          ) : loadError || !profile ? (
            <ErrorState
              title="个人资料加载失败"
              description="无法读取当前账号资料，请重试。"
              onRetry={loadProfile}
            />
          ) : (
            <ProfileForm profile={profile} onSuccess={handleSuccess} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
