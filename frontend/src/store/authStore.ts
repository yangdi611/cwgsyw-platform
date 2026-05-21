import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  user: { username: string; realName: string } | null
  permissions: Set<string>
  setAuth: (user: { username: string; realName: string }, permissions: string[]) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      permissions: new Set(),
      setAuth: (user, permissions) =>
        set({ user, permissions: new Set(permissions) }),
      clearAuth: () => set({ user: null, permissions: new Set() }),
    }),
    {
      name: 'cwgsyw-auth',
      partialize: (state) => ({
        user: state.user,
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
