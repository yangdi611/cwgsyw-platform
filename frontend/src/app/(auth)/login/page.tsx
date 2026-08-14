'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  Card,
  Field,
  FormSettingsPage,
  IconButton,
  Input,
  PageHeader,
} from '@/design-system/figma-neutral/components'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
    } catch {
      setError('用户名或密码错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <FormSettingsPage
      centered
      layout="default"
      header={
        <PageHeader
          showBreadcrumb={false}
          eyebrow="账号安全"
          title="登录"
          subtitle="使用平台账号登录。首次登录可能需要修改初始密码并补全资料。"
        />
      }
      form={
        <Card title="CWGSYW 运维平台" description="匿名访问此页。登录成功后进入工作台。">
          <form className="cwgsyw-form" noValidate onSubmit={handleSubmit}>
            <Field htmlFor="username" label="用户名" required>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                required
                onChange={(event) => setUsername(event.target.value)}
              />
            </Field>
            <Field
              htmlFor="password"
              label="密码"
              required
              state={error ? 'error' : 'default'}
              errorText={error || undefined}
            >
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                required
                onChange={(event) => setPassword(event.target.value)}
                trailingIcon={
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon="eye"
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    onClick={() => setShowPassword((current) => !current)}
                  />
                }
              />
            </Field>
            <div className="cwgsyw-form__actions">
              <Button type="submit" variant="primary" loading={loading}>
                {loading ? '登录中…' : '登录'}
              </Button>
            </div>
          </form>
        </Card>
      }
    />
  )
}
