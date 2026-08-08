'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/design-system'
import { ErrorState, LoadingState } from '@/components/shared'
import { AccountSetupForm } from '@/components/account/AccountSetupForm'
import { useAuthStore } from '@/store/authStore'
import { getAccountProfile, type AccountProfile } from '@/lib/account-api'

/**
 * 首次登录强制流程页面（SPEC 6.3）。requiredActions 非空时 dashboard layout 会重定向到此页；
 * 完成后刷新 authStore.requiredActions 并跳首页。
 */
export default function AccountSetupPage() {
  const router = useRouter()
  const setRequiredActions = useAuthStore((s) => s.setRequiredActions)
  const authUser = useAuthStore((s) => s.user)
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    getAccountProfile()
      .then(setProfile)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [])

  const handleSuccess = (updated: AccountProfile) => {
    setRequiredActions(updated.requiredActions)
    if (updated.requiredActions.length === 0) {
      router.push('/')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-v2-bg px-4">
        <LoadingState label="正在加载账号安全设置…" minHeight={160} />
      </div>
    )
  }

  if (loadError || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-v2-bg px-4">
        <ErrorState
          title="账号安全设置加载失败"
          description="无法读取当前账号状态，请重试。"
          onRetry={() => {
            setLoading(true)
            setLoadError(false)
            getAccountProfile()
              .then(setProfile)
              .catch(() => setLoadError(true))
              .finally(() => setLoading(false))
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-v2-bg px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>完善账号安全</CardTitle>
          <CardDescription>首次登录需要修改初始密码并补全个人资料才能继续使用系统。</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountSetupForm
            username={authUser?.username ?? profile.username}
            mustChangePassword={profile.mustChangePassword}
            onSuccess={handleSuccess}
          />
        </CardContent>
      </Card>
    </div>
  )
}
