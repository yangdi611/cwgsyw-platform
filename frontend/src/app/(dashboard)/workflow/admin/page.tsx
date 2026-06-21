'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/v2/Button'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { PageHeader, Pagination } from '@/components/shared'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/v2/Dialog'
import { toast } from 'sonner'
import Link from 'next/link'
import { ChevronDown, CheckCircle, Pencil, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProcessDef {
  id: string
  name: string
  key: string
  version: number
  description: string
  category: string
  suspended: boolean
  deployment_time: string
  activeVersion?: number | null
}

export default function WorkflowAdminPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const canConfigure = hasPermission('workflow', 'configure')
  const [deleteTarget, setDeleteTarget] = useState<ProcessDef | null>(null)
  const [versionDef, setVersionDef] = useState<ProcessDef | null>(null)
  const [versions, setVersions] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [deleteVersionTarget, setDeleteVersionTarget] = useState<{
    version: any
    def: ProcessDef
  } | null>(null)
  const [activating, setActivating] = useState<string | null>(null)
  const [suspending, setSuspending] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<ProcessDef | null>(null)
  const [renameName, setRenameName] = useState('')
  const [renameKey, setRenameKey] = useState('')
  const [renaming, setRenaming] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['process-definitions', page],
    queryFn: () =>
      api.get('/workflow/definitions', { params: { page, size: 20 } }).then((r) => ({
        records: (r.data.data?.records ?? []) as ProcessDef[],
        total: r.data.data?.total ?? 0,
      })),
  })

  const definitions = data?.records ?? []
  const total = data?.total ?? 0

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/workflow/definitions/${encodeURIComponent(deleteTarget.id)}`)
      toast.success(`流程 "${deleteTarget.name}" 已删除`)
      setDeleteTarget(null)
      refetch()
    } catch (err: any) {
      toast.error(err.response?.data?.message || '删除失败')
      setDeleteTarget(null)
    }
  }

  const handleVersions = async (def: ProcessDef) => {
    if (versionDef?.id === def.id) {
      setVersionDef(null)
      setVersions([])
      return
    }
    setVersionDef(def)
    try {
      const r = await api.get(`/workflow/definitions/key/${def.key}/versions`)
      setVersions(r.data.data ?? [])
    } catch {
      toast.error('获取版本历史失败')
    }
  }

  const handleActivate = async (v: any, def: ProcessDef) => {
    setActivating(v.id)
    try {
      await api.put(`/workflow/definitions/${encodeURIComponent(v.id)}/activate`)
      toast.success(`v${v.version} 已启用`)
      handleVersions(def)
      refetch()
    } catch (err: any) {
      toast.error(err.response?.data?.message || '启用失败')
    } finally {
      setActivating(null)
    }
  }

  const handleSuspend = async (v: any, def: ProcessDef) => {
    setSuspending(v.id)
    try {
      await api.put(`/workflow/definitions/${encodeURIComponent(v.id)}/suspend`)
      toast.success(`v${v.version} 已禁用`)
      handleVersions(def)
      refetch()
    } catch (err: any) {
      toast.error(err.response?.data?.message || '禁用失败')
    } finally {
      setSuspending(null)
    }
  }

  const openRename = (def: ProcessDef) => {
    setRenameTarget(def)
    setRenameName(def.name)
    setRenameKey(def.key)
  }

  const handleRename = async () => {
    if (!renameTarget) return
    if (!renameName.trim()) {
      toast.error('请输入流程名称')
      return
    }
    if (!renameKey.trim()) {
      toast.error('请输入流程 Key')
      return
    }
    setRenaming(true)
    try {
      await api.put(`/workflow/definitions/${encodeURIComponent(renameTarget.id)}/rename`, {
        name: renameName.trim(),
        key: renameKey.trim(),
      })
      toast.success('流程信息已更新')
      const t = renameTarget
      setRenameTarget(null)
      refetch()
      if (versionDef?.id === t.id) {
        handleVersions(t)
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || '更新失败')
    } finally {
      setRenaming(false)
    }
  }

  const getActiveVersionInfo = (def: ProcessDef) => {
    if (def.activeVersion != null) {
      return { version: def.activeVersion, active: true }
    }
    return { version: def.version, active: false }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="流程中心"
        title="流程管理"
        subtitle="管理 BPMN 流程定义，创建和编辑审批流程，按版本启用或挂起。"
        actions={
          canConfigure ? (
            <Button variant="primary" onClick={() => router.push('/workflow/design')}>
              <Plus className="h-4 w-4" />
              新建流程
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <p className="text-v2-muted">加载中…</p>
      ) : definitions.length === 0 ? (
        <div className="rounded-v2-lg border border-v2-border bg-v2-surface px-6 py-16 text-center">
          <p className="mb-2 text-lg font-semibold text-v2-fg">暂无流程定义</p>
          <p className="mb-4 text-sm text-v2-muted">创建第一个 BPMN 流程定义来开始使用流程引擎</p>
          {canConfigure && (
            <Button variant="primary" onClick={() => router.push('/workflow/design')}>
              <Plus className="h-4 w-4" />
              新建流程
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-v2-border bg-v2-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-v2-border bg-v2-surface-soft">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-v2-muted">流程名称</th>
                    <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-v2-muted">Key</th>
                    <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-v2-muted">最新版本</th>
                    <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-v2-muted">分类</th>
                    <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-v2-muted">激活版本</th>
                    {canConfigure && (
                      <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-v2-muted">操作</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-v2-border">
                  {definitions.map((def) => {
                    const isExpanded = versionDef?.id === def.id
                    const versionInfo = getActiveVersionInfo(def)
                    return (
                      <Fragment key={def.id}>
                        <tr className={cn('hover:bg-v2-surface-hover', isExpanded && 'bg-v2-surface-soft/50')}>
                          <td className="px-3 py-3 font-semibold text-v2-fg">{def.name}</td>
                          <td className="px-3 py-3 font-v2-mono text-xs text-v2-muted">{def.key}</td>
                          <td className="px-3 py-3 text-v2-fg tabular-nums">v{def.version}</td>
                          <td className="px-3 py-3 text-v2-fg">{def.category || '-'}</td>
                          <td className="px-3 py-3">
                            {versionInfo.active ? (
                              <StatusBadge status="ok">
                                <span className="flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  v{versionInfo.version}
                                </span>
                              </StatusBadge>
                            ) : (
                              <span className="text-v2-subtle">--</span>
                            )}
                          </td>
                          {canConfigure && (
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openRename(def)}>
                                  <Pencil className="h-3 w-3" />
                                  编辑
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleVersions(def)}>
                                  版本
                                  <ChevronDown
                                    className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-180')}
                                  />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-v2-danger"
                                  onClick={() => setDeleteTarget(def)}
                                >
                                  删除
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-v2-border">
                            <td colSpan={canConfigure ? 6 : 5} className="bg-v2-surface-soft/50 p-0">
                              <div className="px-6 py-4">
                                <div className="overflow-hidden rounded-md border border-v2-border bg-v2-surface">
                                  <table className="w-full text-sm">
                                    <thead className="border-b border-v2-border bg-v2-surface-soft">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-v2-muted">版本</th>
                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-v2-muted">名称</th>
                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-v2-muted">部署时间</th>
                                        <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-v2-muted">启用状态</th>
                                        {canConfigure && (
                                          <th className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-v2-muted">操作</th>
                                        )}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-v2-border">
                                      {versions.length === 0 ? (
                                        <tr>
                                          <td
                                            colSpan={canConfigure ? 5 : 4}
                                            className="p-3 text-center text-sm text-v2-muted"
                                          >
                                            暂无版本数据
                                          </td>
                                        </tr>
                                      ) : (
                                        versions.map((v: any) => (
                                          <tr key={v.id}>
                                            <td className="px-3 py-2.5 font-v2-mono text-v2-fg tabular-nums">v{v.version}</td>
                                            <td className="px-3 py-2.5 text-v2-fg">{v.name}</td>
                                            <td className="px-3 py-2.5 text-v2-muted">
                                              {v.deployment_time
                                                ? new Date(v.deployment_time).toLocaleString('zh-CN')
                                                : '-'}
                                            </td>
                                            <td className="px-3 py-2.5">
                                              {!v.suspended ? (
                                                <StatusBadge status="ok">
                                                  <span className="flex items-center gap-1">
                                                    <CheckCircle className="h-3 w-3" />
                                                    已启用
                                                  </span>
                                                </StatusBadge>
                                              ) : (
                                                <span className="text-v2-subtle">--</span>
                                              )}
                                            </td>
                                            {canConfigure && (
                                              <td className="px-3 py-2.5">
                                                <div className="flex items-center justify-end gap-1">
                                                  {v.suspended ? (
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className="text-v2-success"
                                                      disabled={activating === v.id}
                                                      onClick={() => handleActivate(v, def)}
                                                    >
                                                      {activating === v.id ? '启用中…' : '启用'}
                                                    </Button>
                                                  ) : (
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      className="text-v2-warning"
                                                      disabled={suspending === v.id}
                                                      onClick={() => handleSuspend(v, def)}
                                                    >
                                                      {suspending === v.id ? '禁用中…' : '禁用'}
                                                    </Button>
                                                  )}
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                      router.push(
                                                        `/workflow/design/${def.key}?version=${v.id}`,
                                                      )
                                                    }
                                                  >
                                                    编辑
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-v2-danger"
                                                    onClick={() =>
                                                      setDeleteVersionTarget({ version: v, def })
                                                    }
                                                  >
                                                    删除
                                                  </Button>
                                                </div>
                                              </td>
                                            )}
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination page={page} pageSize={20} total={total} onPageChange={setPage} />
        </>
      )}

      {/* Delete process dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-v2-muted">
            确定要删除流程 <strong className="text-v2-fg">{deleteTarget?.name}</strong> 及其所有版本吗？
            此操作不可撤销，将删除所有关联的运行时数据和历史记录。
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete version dialog */}
      <Dialog
        open={!!deleteVersionTarget}
        onOpenChange={(o) => !o && setDeleteVersionTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除版本</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-v2-muted">
            确定要删除 <strong className="text-v2-fg">{deleteVersionTarget?.def.name}</strong> 的
            <strong className="text-v2-fg"> v{deleteVersionTarget?.version.version}</strong> 吗？
          </p>
          <p className="text-xs text-v2-danger">
            此操作将级联删除该版本下所有运行中和历史的流程实例，不可撤销。
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteVersionTarget(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!deleteVersionTarget) return
                try {
                  await api.post(`/workflow/definitions/delete-version`, {
                    definition_id: deleteVersionTarget.version.id,
                  })
                  toast.success(`v${deleteVersionTarget.version.version} 已删除`)
                  const t = deleteVersionTarget
                  setDeleteVersionTarget(null)
                  refetch()
                  if (versionDef?.key === t.def.key) {
                    handleVersions(t.def)
                  }
                } catch (err: any) {
                  toast.error(err.response?.data?.message || '删除失败')
                  setDeleteVersionTarget(null)
                }
              }}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>编辑流程信息</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rename-name">流程名称</Label>
              <Input
                id="rename-name"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                placeholder="输入流程名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rename-key">流程 Key</Label>
              <Input
                id="rename-key"
                value={renameKey}
                onChange={(e) => setRenameKey(e.target.value)}
                placeholder="输入流程 Key（英文标识）"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button variant="primary" disabled={renaming} onClick={handleRename}>
              {renaming ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
