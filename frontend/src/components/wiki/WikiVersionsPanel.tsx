'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import { wikiApi } from '@/lib/wiki-api'
import type { WikiVersion } from '@/types/wiki'
import '@/design-system/figma-neutral/index.css'
import { Button, Card, NeutralAlertDialog } from '@/design-system/figma-neutral/components'

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
    <Card
      title="版本历史"
      headerAction={
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((value) => !value)}>
          {open ? '收起' : '展开'}
        </Button>
      }
    >
      {open ? (
        versions.length === 0 ? (
          <p>暂无历史版本</p>
        ) : (
          <div className="cwgsyw-form">
            {versions.map((version) => (
              <div key={version.version} className="cwgsyw-form">
                <strong>
                  v{version.version} — {version.title}
                </strong>
                {version.comment ? <p>{version.comment}</p> : null}
                <p>
                  {version.createdByName} · {new Date(version.createdAt).toLocaleString('zh-CN')}
                </p>
                <div className="cwgsyw-designer__actions">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      wikiApi.exportPageVersion(pageId, version.version, `${version.title}-v${version.version}.md`).catch(() => toast.error('导出失败'))
                    }}
                  >
                    导出
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRevertTarget(version)}
                  >
                    回滚
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <p>展开查看历史版本</p>
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
    </Card>
  )
}
