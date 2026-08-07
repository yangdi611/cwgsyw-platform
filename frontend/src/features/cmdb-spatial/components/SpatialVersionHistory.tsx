'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, History, RotateCcw } from 'lucide-react'
import { Button } from '@/components/design-system'
import { getApiErrorMessage } from '@/lib/api-error'
import { listSpatialLayouts, listSpatialVersions, spatialQueryKeys } from '../api/spatial-api'
import api from '@/lib/api'

export function SpatialVersionHistory({ roomId, canPublish }: { roomId: number; canPublish: boolean }) {
  const client = useQueryClient(); const [restoring, setRestoring] = useState<string | null>(null)
  const { data: layouts = [] } = useQuery({ queryKey: spatialQueryKeys.layouts(true), queryFn: () => listSpatialLayouts(true) })
  const layout = layouts.find((item) => item.roomInstanceId === roomId)
  const { data: versions = [], isLoading, isError, error } = useQuery({ queryKey: spatialQueryKeys.versions(layout?.layoutId ?? 0), queryFn: () => listSpatialVersions(layout!.layoutId), enabled: Boolean(layout) })
  const restore = useMutation({ mutationFn: (versionId: string) => api.post(`/cmdb/spatial/layouts/${layout!.layoutId}/versions/${versionId}/restore`), onSuccess: () => { setRestoring(null); client.invalidateQueries({ queryKey: spatialQueryKeys.draft(layout!.layoutId) }) } })
  if (!layout) return <div className="py-20 text-center text-sm text-v2-muted">正在加载布局...</div>
  if (isLoading) return <div className="py-20 text-center text-sm text-v2-muted">正在加载版本历史...</div>
  if (isError) return <div className="py-20 text-center text-sm text-v2-danger">{getApiErrorMessage(error, '版本历史加载失败')}</div>
  return <div className="mx-auto max-w-5xl space-y-5"><div className="flex items-center gap-3 border-b border-v2-border pb-4"><Link href={`/cmdb/spatial/rooms/${roomId}`} className="inline-flex h-8 w-8 items-center justify-center rounded-v2-sm text-v2-muted hover:bg-v2-surface-hover" title="返回查看器"><ArrowLeft className="h-4 w-4" /></Link><div><h1 className="text-xl font-semibold text-v2-fg">布局版本历史</h1><p className="mt-1 text-sm text-v2-muted">{layout.name}</p></div></div>{versions.length ? <div className="overflow-x-auto border border-v2-border"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-v2-surface-soft text-xs text-v2-muted"><tr><th className="px-4 py-3 font-medium">版本</th><th className="px-4 py-3 font-medium">发布时间</th><th className="px-4 py-3 font-medium">说明</th><th className="px-4 py-3 font-medium">对象数</th><th className="px-4 py-3 font-medium">校验和</th><th className="px-4 py-3" /></tr></thead><tbody>{versions.map((version) => <tr key={version.versionId} className="border-t border-v2-border"><td className="px-4 py-3 font-medium">V{version.versionNo}</td><td className="px-4 py-3 text-v2-muted">{version.publishedAt ? new Date(version.publishedAt).toLocaleString('zh-CN') : '-'}</td><td className="max-w-64 truncate px-4 py-3">{version.changeSummary || '-'}</td><td className="px-4 py-3">{version.elementCount}</td><td className="px-4 py-3 font-mono text-xs text-v2-muted">{version.checksum.slice(0, 12)}</td><td className="px-4 py-3 text-right">{canPublish && <Button size="ui-sm" variant="outline" onClick={() => setRestoring(version.versionId)}><RotateCcw className="mr-1.5 h-4 w-4" />恢复为草稿</Button>}</td></tr>)}</tbody></table></div> : <div className="border border-dashed border-v2-border py-20 text-center text-sm text-v2-muted"><History className="mx-auto h-8 w-8" /><p className="mt-3">尚无已发布版本</p></div>}{restoring !== null && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-v2-md border border-v2-border bg-v2-surface p-5 shadow-v2-lg"><h2 className="text-base font-semibold">恢复历史版本</h2><p className="mt-2 text-sm text-v2-muted">将复制该版本为新草稿，不会立即改变当前已发布版本。</p>{restore.error && <p className="mt-2 text-sm text-v2-danger">{getApiErrorMessage(restore.error, '恢复失败，当前可能存在未确认草稿')}</p>}<div className="mt-5 flex justify-end gap-2"><Button size="default" variant="outline" onClick={() => setRestoring(null)}>取消</Button><Button size="default" variant="default" disabled={restore.isPending} onClick={() => restore.mutate(restoring)}>{restore.isPending ? '恢复中...' : '确认恢复'}</Button></div></div></div>}</div>
}
