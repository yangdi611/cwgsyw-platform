/**
 * 当前登录用户自助 profile / 改密 / 首次 setup API 客户端（SPEC 11.2）。
 * 新接口协议全部 camelCase，不做 snake_case 兼容（SPEC 2.3）。
 */
import api from './api'

export type RequiredAction = 'CHANGE_PASSWORD' | 'COMPLETE_PROFILE'

export interface AccountProfile {
  id: number
  username: string
  realName: string
  email: string | null
  phone: string | null
  avatarUrl: string | null
  mustChangePassword: boolean
  profileCompleted: boolean
  passwordChangedAt: string | null
  lastLoginAt: string | null
  requiredActions: RequiredAction[]
}

export interface UpdateAccountProfileRequest {
  email?: string
  phone?: string
  avatarUrl?: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface AccountSetupRequest {
  currentPassword?: string
  newPassword?: string
  confirmPassword?: string
  email: string
  phone: string
  avatarUrl?: string
}

export function getAccountProfile(): Promise<AccountProfile> {
  return api.get('/account/profile').then((r) => r.data.data)
}

export function updateAccountProfile(req: UpdateAccountProfileRequest): Promise<AccountProfile> {
  return api.put('/account/profile', req).then((r) => r.data.data)
}

export function changeAccountPassword(req: ChangePasswordRequest): Promise<AccountProfile> {
  return api.post('/account/password', req).then((r) => r.data.data)
}

export function submitAccountSetup(req: AccountSetupRequest): Promise<AccountProfile> {
  return api.post('/account/setup', req).then((r) => r.data.data)
}
