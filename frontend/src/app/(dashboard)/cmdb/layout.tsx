'use client'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { Server, Database, Network, Box, Cloud, Loader2 } from 'lucide-react'

interface CiModelVO {
  model_id: string
  name: string
  icon: string
  group_code: string
  description: string
  is_built_in: boolean
  is_paused: boolean
}

const MODEL_ICONS: Record<string, React.ElementType> = {
  server: Server,
  database: Database,
  network: Network,
  box: Box,
  cloud: Cloud,
}

export default function CmdbLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const params = useParams<{ modelId?: string }>()
  const { hasPermission } = usePermission()

  // The fullscreen topology page renders full-bleed (-m-6 / 100vh) and must not be
  // narrowed by a sidebar. Skip the model tree there, and when the user lacks read access.
  const showSidebar =
    hasPermission('cmdb_instance', 'read') && !pathname.startsWith('/cmdb/topology')

  const { data: models = [], isLoading } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-layout-models'],
    queryFn: () => api.get('/cmdb/meta/models').then(r => r.data.data),
    enabled: showSidebar,
  })

  if (!showSidebar) return <>{children}</>

  // Group models by group_code (fallback "未分类" when empty).
  const grouped = models.reduce((acc, m) => {
    const key = m.group_code || '未分类'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {} as Record<string, CiModelVO[]>)

  const activeModelId = params.modelId

  return (
    <div className="flex gap-6">
      <aside className="w-56 shrink-0 self-start sticky top-0">
        <div className="py-1 max-h-screen overflow-y-auto">
          <h3 className="px-2 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            模型导航
          </h3>
          {isLoading ? (
            <div className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />加载中...
            </div>
          ) : (
            <nav className="space-y-4">
              {Object.entries(grouped).map(([group, groupModels]) => (
                <div key={group}>
                  <p className="px-2 mb-1 text-xs font-medium text-muted-foreground">{group}</p>
                  <div className="space-y-0.5">
                    {groupModels.map(m => {
                      const Icon = MODEL_ICONS[m.icon] ?? Box
                      const active = !!activeModelId && activeModelId === m.model_id
                      return (
                        <Link
                          key={m.model_id}
                          href={`/cmdb/instances/by-model/${m.model_id}`}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                            active
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted text-muted-foreground hover:text-foreground',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{m.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
              {models.length === 0 && (
                <p className="px-2 py-4 text-sm text-muted-foreground">暂无模型</p>
              )}
            </nav>
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
