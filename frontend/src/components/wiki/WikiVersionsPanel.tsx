'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { wikiApi } from '@/lib/wiki-api'
import { Button } from '@/components/v2/Button'
import { ChevronDown, ChevronRight, RotateCcw, FileDown } from 'lucide-react'
import type { WikiVersion } from '@/types/wiki'

export function WikiVersionsPanel({ pageId }: { pageId: number }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data } = useQuery<WikiVersion[]>({
    queryKey: ['wiki-versions', pageId],
    queryFn: () => wikiApi.getVersions(pageId),
    enabled: open,
  })

  const revertMutation = useMutation({
    mutationFn: (version: number) => wikiApi.revertPage(pageId, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki-page', pageId] })
      toast.success('已回滚到该版本')
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '回滚失败'
      toast.error(msg)
    },
  })

  const versions = data ?? []

  return (
    <div className="rounded-v2-md border border-v2-border bg-v2-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-v2-fg"
      >
        <span>版本历史</span>
        {open ? <ChevronDown className="h-4 w-4 text-v2-muted" /> : <ChevronRight className="h-4 w-4 text-v2-muted" />}
      </button>

      {open && (
        <div className="border-t border-v2-border px-4 py-3">
          {versions.length === 0 ? (
            <p className="text-xs text-v2-muted">暂无历史版本</p>
          ) : (
            <ul className="space-y-2">
              {versions.map((v) => (
                <li key={v.version} className="text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-v2-fg">
                        v{v.version} — {v.title}
                      </p>
                      {v.comment && (
                        <p className="truncate text-v2-muted">{v.comment}</p>
                      )}
                      <p className="text-v2-subtle">
                        {v.createdByName} ·{' '}
                        {new Date(v.createdAt).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        title="导出此版本"
                        onClick={() => { wikiApi.exportPage(pageId).catch(() => toast.error('导出失败')) }}
                        className="flex h-6 w-6 items-center justify-center rounded text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="回滚到此版本"
                        onClick={() => {
                          if (confirm(`确认回滚到 v${v.version}？`)) revertMutation.mutate(v.version)
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded text-v2-muted hover:bg-v2-surface-hover hover:text-v2-danger"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
