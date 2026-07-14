import type { NavEntry, NavGroup } from './types'

export function isGroup(item: NavEntry): item is NavGroup {
  return 'children' in item
}

/** 某个一级菜单（权限过滤后）是否存在子项命中当前路由。 */
export function groupActiveChild(
  group: NavGroup,
  pathname: string,
  hasPermission: (r: string, a: string) => boolean,
  groupScope?: string,
): boolean {
  const visibleChildren = group.children.filter(
    c => (!c.requiredScope || c.requiredScope === groupScope)
      && (!c.resource || !c.action || hasPermission(c.resource, c.action)),
  )
  if (visibleChildren.length === 0) return false
  return visibleChildren.some(
    c => pathname === c.href || pathname.startsWith(c.href + '/') || pathname.startsWith(c.href + '?'),
  )
}
