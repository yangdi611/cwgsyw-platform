import { create } from 'zustand'

/**
 * ⌘K 命令面板开关状态。
 * 让 Header 的搜索占位按钮、全局快捷键监听、面板自身共享同一开关。
 */
interface CommandPaletteState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useCommandPalette = create<CommandPaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}))
