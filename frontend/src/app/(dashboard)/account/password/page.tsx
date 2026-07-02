'use client'

import { PageHeader } from '@/components/shared'
import { Card, CardContent } from '@/components/v2/Card'
import { PasswordForm } from '@/components/account/PasswordForm'

export default function AccountPasswordPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="个人中心"
        title="修改密码"
        subtitle="定期更换密码有助于保护账号安全。修改后无需重新登录。"
      />
      <Card className="max-w-lg">
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
