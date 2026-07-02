import axios from 'axios'
import { getToken, clearToken } from './auth'
import { useAuthStore } from '@/store/authStore'
import { broadcastLogout } from './auth-broadcast'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 避免并发请求同时触发多次跳转登录页（SPEC 13.6）
let isRedirectingToLogin = false

const SESSION_ERROR_CODES = new Set([
  'SESSION_INVALID',
  'SESSION_TIMEOUT',
  'SESSION_REVOKED',
  'SESSION_STORE_UNAVAILABLE',
])

function redirectToLogin() {
  if (isRedirectingToLogin) return
  isRedirectingToLogin = true
  clearToken()
  useAuthStore.getState().clearAuth()
  window.location.href = '/login'
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    const errorCode = err.response?.data?.errorCode

    if (status === 401) {
      if (errorCode && SESSION_ERROR_CODES.has(errorCode)) {
        broadcastLogout(errorCode === 'SESSION_TIMEOUT' ? 'SESSION_TIMEOUT' : 'SESSION_REVOKED')
      }
      redirectToLogin()
    } else if (status === 503 && errorCode === 'SESSION_STORE_UNAVAILABLE') {
      redirectToLogin()
    } else if (status === 403) {
      if (errorCode === 'PASSWORD_CHANGE_REQUIRED' || errorCode === 'PROFILE_REQUIRED') {
        if (window.location.pathname !== '/account/setup') {
          window.location.href = '/account/setup'
        }
      } else {
        console.warn('[API 403] Forbidden:', err.config?.url)
      }
    }
    return Promise.reject(err)
  }
)

export default api
