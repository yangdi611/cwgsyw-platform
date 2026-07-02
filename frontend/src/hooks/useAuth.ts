'use client'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { setToken, clearToken } from '@/lib/auth'
import { useAuthStore, type RequiredAction } from '@/store/authStore'
import { broadcastLogout } from '@/lib/auth-broadcast'

export function useAuth() {
  const router = useRouter()
  const { setAuth, clearAuth, user } = useAuthStore()

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password })
    const {
      token,
      userId,
      username: responseUsername,
      realName,
      avatarUrl,
      groupScope,
      groupId,
      permissions,
      requiredActions,
    } = res.data.data

    setToken(token)
    setAuth(
      { userId, username: responseUsername, realName: realName ?? '', avatarUrl },
      groupScope ?? 'group',
      groupId ?? null,
      permissions ?? [],
      (requiredActions ?? []) as RequiredAction[]
    )

    await new Promise((r) => setTimeout(r, 50))
    if ((requiredActions ?? []).length > 0) router.push('/account/setup')
    else router.push('/')
  }

  const logout = async (reason: 'USER_LOGOUT' | 'SESSION_TIMEOUT' | 'SESSION_REVOKED' = 'USER_LOGOUT') => {
    try {
      await api.post('/auth/logout')
    } catch {
      // 登出即使接口失败也要清本地状态（SPEC 13.3）
    }
    clearToken()
    clearAuth()
    broadcastLogout(reason)
    router.push('/login')
  }

  return { login, logout, user }
}
