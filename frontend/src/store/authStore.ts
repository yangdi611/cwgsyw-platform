import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  user: { username: string; realName: string } | null
  permissions: Set<string>
  groupScope: string   // "group" | "tenant" | "platform"
  groupId: number | null
  setAuth: (user: { username: string; realName: string }, groupScope: string, groupId: number | null, permissions: string[]) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      permissions: new Set(),
      groupScope: 'group',
      groupId: null,
      setAuth: (user, groupScope, groupId, permissions) =>
        set({ user, groupScope, groupId, permissions: new Set(permissions) }),
      clearAuth: () => set({ user: null, groupScope: 'group', groupId: null, permissions: new Set() }),
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
        if (state && Array.isArray((state as any).permissions)) {
          state.permissions = new Set((state as any).permissions)
        }
      },
    }
  )
)
