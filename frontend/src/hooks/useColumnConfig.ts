import { useState, useCallback } from 'react'

export function useColumnConfig(modelId: string, defaultKeys: string[]) {
  const storageKey = `cmdb_col_config_${modelId}`

  const [visible, setVisible] = useState<string[]>(() => {
    if (typeof window === 'undefined') return defaultKeys
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return JSON.parse(saved) as string[]
    } catch {}
    return defaultKeys
  })

  const toggle = useCallback((key: string) => {
    setVisible(prev => {
      const next = prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
      return next
    })
  }, [storageKey])

  const reset = useCallback(() => {
    setVisible(defaultKeys)
    try { localStorage.removeItem(storageKey) } catch {}
  }, [storageKey, defaultKeys])

  return { visible, toggle, reset }
}
