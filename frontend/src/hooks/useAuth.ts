'use client'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { setToken, clearToken } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const router = useRouter()
  const { setAuth, clearAuth, user } = useAuthStore()

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password })
    const { token, username: u, realName, groupScope, groupId, permissions } = res.data.data
    setToken(token)
    setAuth({ username: u, realName: realName ?? '' }, groupScope ?? 'group', groupId ?? null, permissions)
    await new Promise((r) => setTimeout(r, 50))
    router.push('/')
  }

  const logout = () => {
    clearToken()
    clearAuth()
    router.push('/login')
  }

  return { login, logout, user }
}
