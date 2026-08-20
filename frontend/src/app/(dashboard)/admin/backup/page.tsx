'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/api-error'
import { toast } from '@/design-system/figma-neutral/toast'
import { usePermission } from '@/hooks/usePermission'
import '@/design-system/figma-neutral/index.css'
import {
  Alert,
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingState,
  NeutralAlertDialog,
  NeutralDialog,
  OverlayDestructivePage,
  PageHeader,
  Pagination,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

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
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

const STATUS: Record<string, { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
  running: { tone: 'warning', label: '进行中' },
  success: { tone: 'success', label: '成功' },
  failed: { tone: 'danger', label: '失败' },
}

const PAGE_SIZE = 20

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
      <NeutralAlertDialog
        open
        onOpenChange={(open) => { if (!open && !loading) onCancel() }}
        intent="destructive"
        title="确认恢复数据库？"
        description={`将使用备份 ${target.fileName} 覆盖当前所有数据。此操作不可撤销。`}
        confirmLabel={loading ? '正在恢复' : '确认恢复'}
        cancelLabel="取消"
        onConfirm={onConfirm}
      />
    )
  }

  return (
    <NeutralDialog
      open
      onOpenChange={(open) => { if (!open && !loading) onCancel() }}
      title="恢复完成"
      description={`数据库和 MinIO 已恢复到备份 ${target.fileName}。建议执行 docker compose restart backend 以清除内存缓存。`}
      footer={<Button type="button" onClick={onCancel}>关闭</Button>}
    >
      {error ? <Alert tone="danger" title="恢复提示" description={error} showDismiss={false} /> : null}
    </NeutralDialog>
  )
}

export default function BackupPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [restoreTarget, setRestoreTarget] = useState<BackupRecordVO | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BackupRecordVO | null>(null)
  const [restoreDone, setRestoreDone] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('backup', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data, isLoading, isError, refetch } = useQuery<PageResult>({
    queryKey: ['backups', page],
    queryFn: () => api.get('/backups', { params: { page, size: PAGE_SIZE } }).then((response) => response.data.data),
    enabled: isHydrated && hasPermission('backup', 'read'),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/backups'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
  })
  const restoreMutation = useMutation({
    mutationFn: (id: number) => api.post(`/backups/${id}/restore`, null, { timeout: 600_000 }),
    onSuccess: () => {
      setRestoreDone(true)
      setRestoreError(null)
      queryClient.invalidateQueries({ queryKey: ['backups'] })
    },
    onError: (error: unknown) => {
      setRestoreError(getApiErrorMessage(error, '恢复失败，请检查后端日志'))
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

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.tar.gz')) {
      toast.error('仅支持 .tar.gz 格式的备份文件')
      event.target.value = ''
      return
    }
    uploadMutation.mutate(file)
    event.target.value = ''
  }

  const handleDownload = (record: BackupRecordVO) => {
    api.get(`/backups/${record.id}/download`, { responseType: 'blob' }).then((response) => {
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = record.fileName
      link.click()
      URL.revokeObjectURL(url)
    })
  }

  const records = data?.records ?? []
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))

  return (
    <>
      <OverlayDestructivePage
        embedded
        header={
          <PageHeader
            eyebrow="系统管理"
            title="备份与恢复"
            subtitle="备份 PostgreSQL 数据库和 MinIO 文件数据，可随时下载或恢复到指定备份点。超过 30 天的备份自动删除。"
            breadcrumb={<Breadcrumb items={[{ href: '/', label: '工作台' }, { label: '备份与恢复' }]} />}
            actions={
              hasPermission('backup', 'create') ? (
                <div className="cwgsyw-designer__actions">
                  <input ref={fileInputRef} type="file" accept=".tar.gz,.gz" hidden onChange={handleUpload} />
                  <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
                    {uploadMutation.isPending ? '上传中' : '上传备份'}
                  </Button>
                  <Button type="button" size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                    {createMutation.isPending ? '备份中' : '立即备份'}
                  </Button>
                </div>
              ) : undefined
            }
          />
        }
        overlay={
          isError ? (
            <ErrorState
              title="备份记录加载失败"
              description="无法读取备份列表，请重试。"
              retry={<Button type="button" variant="secondary" onClick={() => void refetch()}>重试</Button>}
            />
          ) : isLoading || createMutation.isPending ? (
            <LoadingState label="正在加载备份记录…" />
          ) : records.length === 0 ? (
            <EmptyState title="暂无备份记录" description="点击「立即备份」创建第一份备份。" />
          ) : (
            <div className="cwgsyw-form">
              <Table
                showSearch={false}
                columns={[
                  { key: 'fileName', label: '文件名' },
                  { key: 'fileSizeBytes', label: '大小' },
                  { key: 'status', label: '状态' },
                  { key: 'createdAt', label: '创建时间' },
                  { key: 'createdByName', label: '操作人' },
                  { key: 'errorMessage', label: '错误信息' },
                  { key: 'actions', label: '操作' },
                ]}
                rows={records.map((record) => {
                  const status = STATUS[record.status] ?? { tone: 'neutral' as const, label: record.status }
                  return {
                    id: String(record.id),
                    cells: {
                      fileName: record.fileName,
                      fileSizeBytes: formatBytes(record.fileSizeBytes),
                      status: <StatusBadge label={status.label} status={status.tone} />,
                      createdAt: new Date(record.createdAt).toLocaleString('zh-CN'),
                      createdByName: record.createdByName ?? '—',
                      errorMessage: record.errorMessage ?? '',
                      actions: (
                        <div className="cwgsyw-designer__actions">
                          {record.status === 'success' && hasPermission('backup', 'read') ? (
                            <IconButton type="button" variant="ghost" size="sm" icon="inbox" aria-label="下载" onClick={() => handleDownload(record)} />
                          ) : null}
                          {record.status === 'success' && hasPermission('backup', 'restore') ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setRestoreTarget(record)}>恢复</Button>
                          ) : null}
                          {hasPermission('backup', 'delete') ? (
                            <IconButton
                              type="button"
                              variant="ghost"
                              size="sm"
                              icon="trash"
                              aria-label="删除"
                              onClick={() => setDeleteTarget(record)}
                            />
                          ) : null}
                        </div>
                      ),
                    },
                  }
                })}
              />
              {data ? <Pagination page={page} pageCount={pageCount} totalCount={data.total} onPageChange={setPage} /> : null}
            </div>
          )
        }
        confirmation={
          <>
            {restoreTarget ? (
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
            ) : null}
            {deleteTarget ? (
              <NeutralAlertDialog
                open
                onOpenChange={(open) => { if (!open && !deleteMutation.isPending) setDeleteTarget(null) }}
                intent="destructive"
                title="确认删除备份？"
                description={`将删除备份 ${deleteTarget.fileName} 及其备份文件。此操作不可撤销。`}
                confirmLabel={deleteMutation.isPending ? '正在删除' : '确认删除'}
                cancelLabel="取消"
                onConfirm={() => deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
              />
            ) : null}
          </>
        }
      />
    </>
  )
}
