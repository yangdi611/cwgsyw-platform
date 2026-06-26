import { create } from 'zustand'

/**
 * 面包屑动态段名注册。
 *
 * 详情页（如 CMDB 实例、变更文档、Wiki 页面）的 URL 段是 ID，
 * 面包屑无法从路由静态推断出可读名字。这些页面在数据加载完成后
 * 调用 setDynamicLabels(pathname, [...]) 把真实名字（如 ["运维知识库", "部署手册"]）
 * 按动态段出现顺序注册进来，解析器依序填充每个动态槽。
 *
 * 多数页面只有一个动态段（末段），传 [name] 即可；
 * Wiki 这类「空间/页面」两层动态路由传 [spaceName, pageTitle]。
 *
 * 约定：
 * - key 为当前 pathname，确保切页面时旧名字不串台
 * - 路由变化时由 Breadcrumb 组件自动清理过期 key
 */
interface BreadcrumbState {
  /** pathname → 该页面按顺序注册的动态段显示名数组 */
  labels: Record<string, string[]>
  /** 详情页加载完数据后注册动态段真实名字（按出现顺序） */
  setDynamicLabels: (pathname: string, labels: string[]) => void
  /** 切换路由时清掉非当前 path 的注册，避免内存堆积/串台 */
  prune: (currentPathname: string) => void
}

function sameArray(a: string[] | undefined, b: string[]): boolean {
  if (!a || a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

export const useBreadcrumbStore = create<BreadcrumbState>((set) => ({
  labels: {},
  setDynamicLabels: (pathname, labels) =>
    set((s) => {
      if (sameArray(s.labels[pathname], labels)) return s
      return { labels: { ...s.labels, [pathname]: labels } }
    }),
  prune: (currentPathname) =>
    set((s) => {
      const next: Record<string, string[]> = {}
      if (s.labels[currentPathname] !== undefined) {
        next[currentPathname] = s.labels[currentPathname]
      }
      return { labels: next }
    }),
}))

