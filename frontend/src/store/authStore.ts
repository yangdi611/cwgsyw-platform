import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  user: { username: string; realName: string } | null
  permissions: Set<string>
  groupScope: string   // "group" | "tenant" | "platform"
  groupId: number | null
  isHydrated: boolean
  setAuth: (user: { username: string; realName: string }, groupScope: string, groupId: number | null, permissions: string[]) => void
  clearAuth: () => void
  setHydrated: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      permissions: new Set(),
      groupScope: 'group',
      groupId: null,
      isHydrated: false,
      setAuth: (user, groupScope, groupId, permissions) =>
        set({ user, groupScope, groupId, permissions: new Set(permissions) }),
      clearAuth: () => set({ user: null, groupScope: 'group', groupId: null, permissions: new Set() }),
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'cwgsyw-auth',
      partialize: (state) => ({
        user: state.user,
        groupScope: state.groupScope,
        groupId: state.groupId,
        permissions: [...state.permissions],
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (Array.isArray((state as any).permissions)) {
            state.permissions = new Set((state as any).permissions)
          }
          state.setHydrated()
        }
      },
    }
  )
)
