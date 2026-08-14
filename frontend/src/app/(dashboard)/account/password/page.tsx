'use client'

import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
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
      header={
        <PageHeader
          eyebrow="账号安全"
          title="修改密码"
          subtitle="定期更换密码有助于保护账号安全。修改后无需重新登录。"
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/account/profile', label: '个人资料' },
                { label: '修改密码' },
              ]}
            />
          }
        />
      }
      form={
        <Card title="密码" description="当前密码用于确认身份。新密码需同时满足长度、大小写、数字和特殊字符规则。">
          <PasswordForm />
        </Card>
      }
      supporting={
        <Card title="保存说明" description="密码修改成功后会清空表单，当前登录会话保持有效，无需重新登录。" />
      }
    />
  )
}
