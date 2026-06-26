'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { WikiTreeSidebar } from '@/components/wiki/WikiTreeSidebar'
import { PanelLeftClose, PanelLeftOpen, Network, FileDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { wikiApi } from '@/lib/wiki-api'
import { toast } from 'sonner'

export default function WikiSpaceLayout({ children }: { children: React.ReactNode }) {
  const { spaceId } = useParams<{ spaceId: string }>()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const sid = Number(spaceId)

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6">
      {/* Left: collapsible tree sidebar */}
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-v2-border bg-v2-surface transition-[width] duration-200',
          collapsed ? 'w-0 overflow-hidden' : 'w-[260px]',
        )}
      >
        <WikiTreeSidebar spaceId={sid} />
        <div className="flex items-center gap-1 border-t border-v2-border px-2 py-2">
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
        className="flex h-9 w-6 shrink-0 items-center justify-center self-start border-b border-r border-v2-border bg-v2-surface text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg"
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </button>

      {/* Right: scrollable main content */}
      <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}
