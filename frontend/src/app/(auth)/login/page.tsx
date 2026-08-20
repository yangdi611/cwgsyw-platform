'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useAuth } from '@/hooks/useAuth'
import '@/design-system/figma-neutral/index.css'
import '@/components/account/account.css'
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
      className="cwgsyw-account-page cwgsyw-account-page--login"
      header={
        <div className="cwgsyw-account-login-brand">
          <Image
            className="cwgsyw-account-login-brand__logo"
            src="/sidebar-logo.png"
            alt=""
            width={72}
            height={72}
            unoptimized
          />
          <PageHeader
            showBreadcrumb={false}
            showEyebrow={false}
            showSubtitle={false}
            title="IT 基础设施运维管理平台"
          />
        </div>
      }
      form={
        <>
        <Card title="登录" description="登录成功后进入工作台。">
          <form className="cwgsyw-form cwgsyw-account-form" noValidate onSubmit={handleSubmit}>
            <Field htmlFor="username" label="用户名" required>
              <Input
                id="username"
                size="sm"
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
                size="sm"
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
                    className="cwgsyw-account-password-toggle"
                    icon={
                      <Image
                        className="cwgsyw-account-password-toggle__icon"
                        src={showPassword ? '/figma-icons/account-login-eye-off.svg' : '/figma-icons/account-login-eye.svg'}
                        alt=""
                        width={16}
                        height={16}
                        unoptimized
                      />
                    }
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    title={showPassword ? '隐藏密码' : '显示密码'}
                    onClick={() => setShowPassword((current) => !current)}
                  />
                }
              />
            </Field>
            <div className="cwgsyw-form__actions">
              <Button type="submit" size="sm" variant="primary" loading={loading}>
                {loading ? '登录中…' : '登录'}
              </Button>
            </div>
          </form>
        </Card>
        <p className="cwgsyw-account-login-hint">联系管理员获取账号；首次登录可能需要完成账号安全设置。</p>
        </>
      }
    />
  )
}
