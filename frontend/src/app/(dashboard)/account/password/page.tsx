'use client'

import '@/design-system/figma-neutral/index.css'
import '@/components/account/account.css'
import {
  Card,
  FormSettingsPage,
  PageHeader,
} from '@/design-system/figma-neutral/components'
import { PasswordForm } from '@/components/account/PasswordForm'

export default function AccountPasswordPage() {
  return (
    <FormSettingsPage
      embedded
      layout="default"
      className="cwgsyw-account-page cwgsyw-account-page--password"
      header={
        <PageHeader
          showBreadcrumb={false}
          showEyebrow={false}
          title="修改密码"
          subtitle="定期更换密码有助于保护账号安全。修改后无需重新登录。"
        />
      }
      form={
        <Card title="密码" description="当前密码用于确认身份；新密码需满足复杂度规则。修改成功后会清空表单。">
          <PasswordForm />
        </Card>
      }
    />
  )
}
