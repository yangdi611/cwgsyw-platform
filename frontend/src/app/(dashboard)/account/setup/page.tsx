'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import '@/design-system/figma-neutral/index.css'
import '@/components/account/account.css'
import {
  Button,
  Card,
  ErrorState,
  FormSettingsPage,
  LoadingState,
  PageHeader,
} from '@/design-system/figma-neutral/components'
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

  const loadProfile = () => {
    setLoading(true)
    setLoadError(false)
    getAccountProfile()
      .then(setProfile)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }

  return (
    <FormSettingsPage
      embedded
      layout="default"
      className="cwgsyw-account-page"
      header={
        <PageHeader
          showBreadcrumb={false}
          showEyebrow={false}
          title="完善账号安全"
          subtitle="首次登录需要修改初始密码并补全个人资料才能继续使用系统。"
        />
      }
      form={
        <Card
          title="首次设置"
          description={profile ? `@${profile.username} · ${profile.realName}。完成后将进入工作台。` : '账号安全设置加载状态'}
        >
          {loading ? (
            <LoadingState label="正在加载账号安全设置…" />
          ) : loadError || !profile ? (
            <ErrorState
              title="账号安全设置加载失败"
              description="无法读取当前账号状态，请重试。"
              retry={
                <Button type="button" size="sm" variant="secondary" onClick={loadProfile}>
                  重试
                </Button>
              }
            />
          ) : (
            <AccountSetupForm
              username={authUser?.username ?? profile.username}
              mustChangePassword={profile.mustChangePassword}
              onSuccess={handleSuccess}
            />
          )}
        </Card>
      }
    />
  )
}
