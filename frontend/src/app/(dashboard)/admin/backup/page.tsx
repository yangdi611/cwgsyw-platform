'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  StatusBadge,
} from '@/components/design-system'
import { ErrorState, PageHeader, DataTable, Pagination, type ColumnDef } from '@/components/shared'
import { usePermission } from '@/hooks/usePermission'
import { Database, Download, RotateCcw, Trash2, AlertTriangle, Loader2, Upload } from 'lucide-react'
import { getApiErrorMessage } from '@/lib/api-error'

interface BackupRecordVO {
  id: number
  fileName: string
  fileSizeBytes: number | null
  status: string
  backupType: string
  errorMessage: string | null
  createdByName: string | null
  createdAt: string
}

interface PageResult {
  records: BackupRecordVO[]
  total: number
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

const STATUS: Record<string, { variant: 'ok' | 'warn' | 'danger' | 'neutral'; label: string }> = {
  running: { variant: 'warn', label: '进行中' },
  success: { variant: 'ok', label: '成功' },
  failed: { variant: 'danger', label: '失败' },
}

/** Restore confirmation uses alert semantics; completion remains informational. */
function RestoreDialog({
  target,
  onConfirm,
  onCancel,
  loading,
  done,
  error,
}: {
  target: BackupRecordVO
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
  done: boolean
  error: string | null
}) {
  if (!done) {
    return (
      <AlertDialog open onOpenChange={(open) => { if (!open && !loading) onCancel() }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认恢复数据库？</AlertDialogTitle>
            <AlertDialogDescription>
              将使用备份 <span className="font-mono text-xs text-v2-fg">{target.fileName}</span> 覆盖当前所有数据。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-v2-danger" />
              <p className="font-medium text-v2-danger">此操作不可撤销。</p>
            </div>
            {error && <p className="break-all text-v2-danger">{error}</p>}
            {loading && (
              <p className="flex items-center gap-1.5 text-v2-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                正在恢复，请勿关闭页面…
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              确认恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !loading) onCancel() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>恢复完成</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-v2-muted">
          <p>
            数据库和 MinIO 已恢复到备份 <span className="font-mono text-xs text-v2-fg">{target.fileName}</span>。
          </p>
          <p className="font-medium text-yellow-600">
            建议执行：<span className="font-mono text-xs">docker compose restart backend</span> 以清除内存缓存。
          </p>
        </div>
        <DialogFooter>
          <Button variant="primary" onClick={onCancel}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const PAGE_SIZE = 20

export default function BackupPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [restoreTarget, setRestoreTarget] = useState<BackupRecordVO | null>(null)
  const [restoreDone, setRestoreDone] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('backup', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data, isLoading, isError, refetch } = useQuery<PageResult>({
    queryKey: ['backups', page],
    queryFn: () => api.get('/backups', { params: { page, size: PAGE_SIZE } }).then(r => r.data.data),
    enabled: isHydrated && hasPermission('backup', 'read'),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/backups'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: number) =>
      api.post(`/backups/${id}/restore`, null, { timeout: 600_000 }), // 10 min
    onSuccess: () => {
      setRestoreDone(true)
      setRestoreError(null)
      queryClient.invalidateQueries({ queryKey: ['backups'] })
    },
    onError: (err: unknown) => {
      const msg = getApiErrorMessage(err, '恢复失败，请检查后端日志')
      setRestoreError(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/backups/${id}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.post('/backups/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
  })

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.tar.gz')) {
      alert('仅支持 .tar.gz 格式的备份文件')
      e.target.value = ''
      return
    }
    uploadMutation.mutate(file)
    e.target.value = ''
  }

  const handleDownload = (record: BackupRecordVO) => {
    api.get(`/backups/${record.id}/download`, { responseType: 'blob' }).then(res => {
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = record.fileName
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const columns: ColumnDef<BackupRecordVO>[] = [
    {
      key: 'fileName',
      title: '文件名',
      render: r => <span className="font-mono text-xs text-v2-fg">{r.fileName}</span>,
    },
    {
      key: 'fileSizeBytes',
      title: '大小',
      render: r => <span className="text-xs text-v2-muted">{formatBytes(r.fileSizeBytes)}</span>,
    },
    {
      key: 'status',
      title: '状态',
      render: r => {
        const s = STATUS[r.status] ?? { variant: 'neutral' as const, label: r.status }
        return <StatusBadge status={s.variant}>{s.label}</StatusBadge>
      },
    },
    {
      key: 'createdAt',
      title: '创建时间',
      render: r => (
        <span className="text-xs text-v2-muted whitespace-nowrap">
          {new Date(r.createdAt).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      key: 'createdByName',
      title: '操作人',
      render: r => <span className="text-xs text-v2-muted">{r.createdByName ?? '—'}</span>,
    },
    {
      key: 'errorMessage',
      title: '错误信息',
      render: r =>
        r.errorMessage ? (
          <span className="max-w-xs truncate text-xs text-red-400" title={r.errorMessage}>
            {r.errorMessage}
          </span>
        ) : null,
    },
    {
      key: 'actions',
      title: '操作',
      render: r => (
        <div className="flex items-center gap-2">
          {r.status === 'success' && hasPermission('backup', 'read') && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="下载"
              onClick={() => handleDownload(r)}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
          {r.status === 'success' && hasPermission('backup', 'restore') && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="恢复"
              onClick={() => setRestoreTarget(r)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          {hasPermission('backup', 'delete') && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="删除"
              onClick={() => {
                if (confirm(`确认删除备份 ${r.fileName}？此操作将同时删除备份文件。`))
                  deleteMutation.mutate(r.id)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const records = data?.records ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="系统管理"
        title="备份与恢复"
        subtitle="备份 PostgreSQL 数据库和 MinIO 文件数据，可随时下载或恢复到指定备份点。超过 30 天的备份自动删除。"
        actions={
          hasPermission('backup', 'create') ? (
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".tar.gz,.gz"
                className="hidden"
                onChange={handleUpload}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                title="上传本地备份文件 (.tar.gz) 后即可恢复"
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                上传备份
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                立即备份
              </Button>
            </div>
          ) : undefined
        }
      />

      {isError ? (
        <div className="rounded-v2-md border border-v2-border bg-v2-surface">
          <ErrorState title="备份记录加载失败" description="无法读取备份列表，请重试。" onRetry={() => void refetch()} />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={records}
          rowKey={r => r.id}
          loading={isLoading || createMutation.isPending}
          empty={{ title: '暂无备份记录', description: '点击「立即备份」创建第一份备份。' }}
        />
      )}

      {data && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={data.total}
          onPageChange={setPage}
        />
      )}

      {restoreTarget && (
        <RestoreDialog
          target={restoreTarget}
          onConfirm={() => {
            setRestoreDone(false)
            setRestoreError(null)
            restoreMutation.mutate(restoreTarget.id)
          }}
          onCancel={() => {
            setRestoreTarget(null)
            setRestoreDone(false)
            setRestoreError(null)
          }}
          loading={restoreMutation.isPending}
          done={restoreDone}
          error={restoreError}
        />
      )}
    </div>
  )
}
