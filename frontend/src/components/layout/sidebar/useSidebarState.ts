'use client'

import { useState } from 'react'

const OPEN_GROUP_KEY = 'sidebar_open_group_v2'
const COLLAPSE_KEY = 'sidebar_collapsed_v2'

/**
 * 手风琴式展开状态：同一时刻只允许一个一级菜单展开。
 * - localStorage 无值 → 使用传入的 initialKey
 * - localStorage 为 '' → 用户已主动全部折叠
 * - localStorage 为某 storageKey → 展开该组
 */
export function useOpenGroup(initialKey: string | null): [string | null, (key: string) => void] {
  const [openKey, setOpenKey] = useState<string | null>(() => {
    if (typeof window === 'undefined') return initialKey
    const saved = localStorage.getItem(OPEN_GROUP_KEY)
    if (saved === null) return initialKey
    return saved || null
  })
  const toggle = (key: string) => {
    setOpenKey(prev => {
      const next = prev === key ? null : key
      try {
        localStorage.setItem(OPEN_GROUP_KEY, next ?? '')
      } catch {}
      return next
    })
  }
  return [openKey, toggle]
}

/** 折叠状态（localStorage 持久化）。收起后侧栏只显示 logo + 一级图标。 */
export function useCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  })
  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {}
      return next
    })
  }
  return [collapsed, toggle]
}
