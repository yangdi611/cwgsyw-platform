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
    <FormSettingsPage
      embedded
      layout="default"
      className="cwgsyw-account-page"
      header={
        <PageHeader
          showBreadcrumb={false}
          showEyebrow={false}
          title="个人资料"
          subtitle="维护手机号、邮箱和头像，真实姓名由管理员统一维护。"
        />
      }
      form={
        <Card
          title="基本资料"
          description={
            profile
              ? `@${profile.username} · ${profile.realName}。真实姓名由管理员维护，如需修改请联系管理员。保存后将返回来源页面。`
              : '账号资料加载状态'
          }
        >
          {loading ? (
            <LoadingState label="正在加载个人资料…" />
          ) : loadError || !profile ? (
            <ErrorState
              title="个人资料加载失败"
              description="无法读取当前账号资料，请重试。"
              retry={
                <Button type="button" size="sm" variant="secondary" onClick={loadProfile}>
                  重试
                </Button>
              }
            />
          ) : (
            <ProfileForm profile={profile} onSuccess={handleSuccess} />
          )}
        </Card>
      }
    />
  )
}
