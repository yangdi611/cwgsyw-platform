import type { ReactNode } from 'react'

/**
 * CMDB 模块布局。
 *
 * 历史上这里有一个左侧「模型导航」树：拉取 /cmdb/models 按分组展示，
 * 点击跳转到 /cmdb/instances/by-model/[model] 浏览该模型的实例。
 *
 * 在引入 8 模块全局 Sidebar（CMDB → 实例管理 / 模型管理 / 变更记录 …）后，
 * 这棵内部模型树与全局导航重复，且强制套在所有 /cmdb/* 页面（变更历史、
 * 告警、统计、2D 视图等与「按模型浏览实例」无关的页面）会挤占 224px 宽度。
 * 故移除。
 *
 * 现在 /cmdb/* 页面直接使用上层 dashboard 布局（Sidebar + Header + 全宽内容）。
 * 按模型浏览实例走：
 *   - 全局 Sidebar「CMDB → 实例管理」，或
 *   - /cmdb/instances 页内的模型筛选下拉
 *
 * 保留此文件作为占位，便于未来若需要 CMDB 级别的公共元素（如子导航条）
 * 再在此扩展。
 */
export default function CmdbLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
