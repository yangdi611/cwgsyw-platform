export type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  resource: string | null
  action: string | null
  badge?: number
  /** 精确匹配 pathname（不走 startsWith 前缀）。
   *  用于根路径项如 /cmdb 概览，避免 /cmdb/* 子页都把它点亮。 */
  exact?: boolean
}

export type NavGroup = {
  label: string
  icon: React.ElementType
  children: NavItem[]
  storageKey: string
  defaultOpen?: boolean
  resource: string | null
  action: string | null
}

export type NavEntry = NavItem | NavGroup
