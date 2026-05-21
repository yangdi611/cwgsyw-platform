import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  user: { username: string; realName: string } | null
  permissions: Set<string>
  groupScope: string   // "group" | "tenant" | "platform"
  setAuth: (user: { username: string; realName: string }, groupScope: string, permissions: string[]) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      permissions: new Set(),
      groupScope: 'group',
      setAuth: (user, groupScope, permissions) =>
        set({ user, groupScope, permissions: new Set(permissions) }),
      clearAuth: () => set({ user: null, groupScope: 'group', permissions: new Set() }),
    }),
    {
      name: 'cwgsyw-auth',
      partialize: (state) => ({
        user: state.user,
        groupScope: state.groupScope,
        permissions: [...state.permissions],
      }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray((state as any).permissions)) {
          state.permissions = new Set((state as any).permissions)
        }
      },
    }
  )
)
