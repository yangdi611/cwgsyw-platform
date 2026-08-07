'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { WikiTreeSidebar } from '@/components/wiki/WikiTreeSidebar'
import { PanelLeftClose, PanelLeftOpen, Network, FileDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { wikiApi } from '@/lib/wiki-api'
import { toast } from 'sonner'

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
    <div className="relative -m-4 flex h-[calc(100dvh-3.5rem)] min-h-0 md:-m-6">
      {/* Left: collapsible tree sidebar */}
      <aside
        className={cn(
          'absolute inset-y-0 left-0 z-20 flex shrink-0 flex-col overflow-hidden border-r border-v2-border bg-v2-surface transition-[width] duration-200 md:static md:z-auto',
          collapsed ? 'w-0 overflow-hidden' : 'w-[260px]',
        )}
      >
        <div className="min-h-0 flex-1">
          <WikiTreeSidebar spaceId={sid} />
        </div>
        <div className="flex shrink-0 items-center gap-1 border-t border-v2-border px-2 py-2">
          <button
            onClick={() => router.push(`/wiki/${sid}/graph`)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-v2-muted transition-colors hover:bg-v2-surface-hover hover:text-v2-fg"
          >
            <Network className="h-3.5 w-3.5" />
            知识图谱
          </button>
          <button
            onClick={() => { wikiApi.exportSpace(sid).catch(() => toast.error('导出失败')) }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-v2-muted transition-colors hover:bg-v2-surface-hover hover:text-v2-fg"
          >
            <FileDown className="h-3.5 w-3.5" />
            导出空间
          </button>
        </div>
      </aside>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        title={collapsed ? '展开目录' : '收起目录'}
        className={cn(
          'relative z-30 flex h-9 w-6 shrink-0 items-center justify-center self-start border-b border-r border-v2-border bg-v2-surface text-v2-muted transition-transform duration-200 hover:bg-v2-surface-hover hover:text-v2-fg md:translate-x-0',
          collapsed ? 'translate-x-0' : 'translate-x-[236px]',
        )}
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>

      {/* Right: route content owns scrolling when it needs it; workspaces stay fixed-height. */}
      <main
        className={cn(
          'min-h-0 min-w-0 flex-1 p-4 md:p-6',
          isSpaceHome ? 'overflow-y-auto' : 'overflow-hidden',
        )}
      >
        {children}
      </main>
    </div>
  )
}
