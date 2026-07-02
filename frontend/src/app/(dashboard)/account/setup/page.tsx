'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/v2/Card'
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

  useEffect(() => {
    getAccountProfile()
      .then(setProfile)
      .finally(() => setLoading(false))
  }, [])

  const handleSuccess = (updated: AccountProfile) => {
    setRequiredActions(updated.requiredActions)
    if (updated.requiredActions.length === 0) {
      router.push('/')
    }
  }

  if (loading) return null

  return (
    <div className="flex min-h-screen items-center justify-center bg-v2-bg px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>完善账号安全</CardTitle>
          <CardDescription>首次登录需要修改初始密码并补全个人资料才能继续使用系统。</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountSetupForm
            username={authUser?.username ?? profile?.username ?? ''}
            mustChangePassword={profile?.mustChangePassword ?? true}
            onSuccess={handleSuccess}
          />
        </CardContent>
      </Card>
    </div>
  )
}
