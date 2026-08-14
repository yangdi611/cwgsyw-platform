'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { toast } from '@/design-system/figma-neutral/toast'
import { wikiApi } from '@/lib/wiki-api'
import { WikiTreeSidebar } from '@/components/wiki/WikiTreeSidebar'
import '@/design-system/figma-neutral/index.css'
import { Button, IconButton } from '@/design-system/figma-neutral/components'

export default function WikiSpaceLayout({ children }: { children: React.ReactNode }) {
  const { spaceId } = useParams<{ spaceId: string }>()
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const sid = Number(spaceId)
  const isSpaceHome = pathname === `/wiki/${spaceId}`

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)')
    const syncSidebar = () => setCollapsed(mobile.matches)
    syncSidebar()
    mobile.addEventListener('change', syncSidebar)
    return () => mobile.removeEventListener('change', syncSidebar)
  }, [])

  return (
    <div className="cwgsyw-wiki-space" data-collapsed={collapsed ? 'true' : 'false'} data-home={isSpaceHome ? 'true' : 'false'}>
      {!collapsed ? (
        <aside className="cwgsyw-card cwgsyw-card--sm">
          <WikiTreeSidebar spaceId={sid} />
          <div className="cwgsyw-designer__actions">
            <Button type="button" variant="ghost" size="sm" onClick={() => router.push(`/wiki/${sid}/graph`)}>
              知识图谱
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                wikiApi.exportSpace(sid).catch(() => toast.error('导出失败'))
              }}
            >
              导出空间
            </Button>
          </div>
        </aside>
      ) : null}
      <IconButton
        type="button"
        variant="ghost"
        size="sm"
        icon={collapsed ? 'chevron-next' : 'chevron-previous'}
        aria-label={collapsed ? '展开目录' : '收起目录'}
        onClick={() => setCollapsed((value) => !value)}
      />
      <main>{children}</main>
    </div>
  )
}
