import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type RequiredAction = 'CHANGE_PASSWORD' | 'COMPLETE_PROFILE'

export interface AuthUser {
  userId: number
  username: string
  realName: string
  avatarUrl?: string | null
}

interface AuthState {
  user: AuthUser | null
  permissions: Set<string>
  groupScope: string   // "group" | "tenant" | "platform"
  groupId: number | null
  requiredActions: RequiredAction[]
  isHydrated: boolean
  setAuth: (
    user: AuthUser,
    groupScope: string,
    groupId: number | null,
    permissions: string[],
    requiredActions: RequiredAction[]
  ) => void
  setRequiredActions: (requiredActions: RequiredAction[]) => void
  clearAuth: () => void
  setHydrated: () => void
}

interface PersistedAuthState {
  permissions?: unknown
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      permissions: new Set(),
      groupScope: 'group',
      groupId: null,
      requiredActions: [],
      isHydrated: false,
      setAuth: (user, groupScope, groupId, permissions, requiredActions) =>
        set({ user, groupScope, groupId, permissions: new Set(permissions), requiredActions }),
      setRequiredActions: (requiredActions) => set({ requiredActions }),
      clearAuth: () =>
        set({ user: null, groupScope: 'group', groupId: null, permissions: new Set(), requiredActions: [] }),
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'cwgsyw-auth',
      partialize: (state) => ({
        user: state.user,
        groupScope: state.groupScope,
        groupId: state.groupId,
        permissions: [...state.permissions],
        requiredActions: state.requiredActions,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const storedPermissions = (state as unknown as PersistedAuthState).permissions
          if (Array.isArray(storedPermissions)) {
            state.permissions = new Set(
              storedPermissions.filter((permission): permission is string => typeof permission === 'string')
            )
          }
          state.setHydrated()
        }
      },
    }
  )
)
