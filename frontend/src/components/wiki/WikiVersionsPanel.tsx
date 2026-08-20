'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import { wikiApi } from '@/lib/wiki-api'
import type { WikiVersion } from '@/types/wiki'
import '@/design-system/figma-neutral/index.css'
import { Button, IconButton, NeutralAlertDialog, NeutralTooltip } from '@/design-system/figma-neutral/components'

export function WikiVersionsPanel({ pageId }: { pageId: number }) {
  const [open, setOpen] = useState(false)
  const [revertTarget, setRevertTarget] = useState<WikiVersion | null>(null)
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
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '回滚失败'
      toast.error(message)
    },
  })

  const versions = data ?? []

  return (
    <section className="cwgsyw-devices-panel">
      <header className="cwgsyw-devices-panel__head">
        <span>版本历史</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((value) => !value)}>
          {open ? '收起' : '展开'}
        </Button>
      </header>
      <div className="cwgsyw-devices-panel__body">
      {open ? (
        versions.length === 0 ? (
          <p className="cwgsyw-wiki-tree__empty">暂无历史版本</p>
        ) : (
          <div className="cwgsyw-wiki-space__list">
            {versions.map((version) => (
              <div key={version.version} className="cwgsyw-wiki-version">
                <div className="cwgsyw-wiki-version__main">
                  <span className="cwgsyw-wiki-version__title">v{version.version} — {version.title}</span>
                  {version.comment ? <p className="cwgsyw-wiki-space-card__desc">{version.comment}</p> : null}
                  <p className="cwgsyw-wiki-space-card__stamp">
                    {version.createdByName} · {new Date(version.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="cwgsyw-inline-controls cwgsyw-cmdb-admin__row-actions cwgsyw-wiki-version__actions">
                  <NeutralTooltip content="导出" className="cwgsyw-tooltip--pill" followCursor>
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--download" />}
                      aria-label={`导出 v${version.version}`}
                      onClick={() => {
                        wikiApi.exportPageVersion(pageId, version.version, `${version.title}-v${version.version}.md`).catch(() => toast.error('导出失败'))
                      }}
                    />
                  </NeutralTooltip>
                  <NeutralTooltip content="回滚" className="cwgsyw-tooltip--pill" followCursor>
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--undo" />}
                      aria-label={`回滚到 v${version.version}`}
                      onClick={() => setRevertTarget(version)}
                    />
                  </NeutralTooltip>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <p className="cwgsyw-devices-panel__hint">展开查看历史版本</p>
      )}
      {revertTarget ? (
        <NeutralAlertDialog
          open
          onOpenChange={(openDialog) => { if (!openDialog && !revertMutation.isPending) setRevertTarget(null) }}
          intent="destructive"
          title="确认回滚版本？"
          description={`将回滚到 v${revertTarget.version}。当前内容会被该版本覆盖。`}
          confirmLabel={revertMutation.isPending ? '正在回滚' : '确认回滚'}
          cancelLabel="取消"
          onConfirm={() => revertMutation.mutate(revertTarget.version, { onSuccess: () => setRevertTarget(null) })}
        />
      ) : null}
      </div>
    </section>
  )
}
