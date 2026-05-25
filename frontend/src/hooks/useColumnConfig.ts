import { useState, useCallback, useEffect, useRef } from 'react'

export function useColumnConfig(modelId: string, defaultKeys: string[]) {
  const storageKey = `cmdb_col_config_${modelId}`
  const defaultKeysRef = useRef(defaultKeys)

  const [visible, setVisible] = useState<string[]>(() => {
    if (typeof window === 'undefined') return defaultKeys
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return JSON.parse(saved) as string[]
    } catch {}
    return defaultKeys
  })

  // Re-read from localStorage whenever storageKey changes (model switch)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(storageKey)
      setVisible(saved ? JSON.parse(saved) as string[] : defaultKeysRef.current)
    } catch {
      setVisible(defaultKeysRef.current)
    }
  }, [storageKey])

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
    setVisible(defaultKeysRef.current)
    try { localStorage.removeItem(storageKey) } catch {}
  }, [storageKey])

  return { visible, toggle, reset }
}
