'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Input } from '@/components/v2/Input'
import { Button } from '@/components/v2/Button'
import { Card } from '@/components/v2/Card'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { PageHeader, DataTable, Pagination, EmptyState, type ColumnDef } from '@/components/shared'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/v2/Dialog'
import {
  FolderOpen,
  Folder,
  Upload,
  FolderPlus,
  Search,
  Download,
  Eye,
  Trash2,
  File,
  ChevronRight,
  Lock,
  ScrollText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FolderAclDialog } from './FolderAclDialog'

interface FolderNode {
  id: number
  name: string
  parent_id: number | null
  acl_custom?: boolean
  children?: FolderNode[]
}

interface SharedFile {
  id: number
  name: string
  original_name: string
  file_type: string
  size_bytes: number
  folder_id: number | null
  created_by_name: string
  created_at: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function fileTypeLabel(type: string): string {
  const map: Record<string, string> = {
    pdf: 'PDF',
    docx: 'Word',
    xlsx: 'Excel',
    xls: 'Excel',
    doc: 'Word',
    pptx: 'PPT',
    ppt: 'PPT',
    txt: '文本',
    png: '图片',
    jpg: '图片',
    jpeg: '图片',
    gif: '图片',
    zip: '压缩包',
    rar: '压缩包',
  }
  if (!type) return '未知'
  return map[type.toLowerCase()] ?? type.toUpperCase()
}

function FolderTreeNode({
  node,
  selectedId,
  onSelect,
  depth,
  canManage,
  canManageAcl,
  onDelete,
  onEditAcl,
}: {
  node: FolderNode
  selectedId: number | null
  onSelect: (id: number | null) => void
  depth: number
  canManage: boolean
  canManageAcl: boolean
  onDelete: (node: FolderNode) => void
  onEditAcl: (node: FolderNode) => void
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div>
      <div
        className={cn(
          'group flex w-full items-center gap-1.5 rounded-md pr-1 text-sm transition-colors',
          selectedId === node.id
            ? 'bg-v2-primary-soft font-semibold text-v2-primary'
            : 'text-v2-fg hover:bg-v2-surface-hover',
        )}
      >
        <button
          onClick={() => {
            onSelect(node.id)
            if (hasChildren) setExpanded((v) => !v)
          }}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-left"
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          {hasChildren ? (
            <ChevronRight
              className={cn('h-3 w-3 shrink-0 transition-transform', expanded && 'rotate-90')}
            />
          ) : (
            <span className="w-3" />
          )}
          {selectedId === node.id ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
          {node.acl_custom && (
            <Lock className="h-3 w-3 shrink-0 text-v2-warn" aria-label="自定义权限" />
          )}
        </button>
        {canManageAcl && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEditAcl(node)
            }}
            title="权限设置"
            className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-v2-muted hover:bg-v2-surface hover:text-v2-fg group-hover:flex"
          >
            <Lock className="h-3.5 w-3.5" />
          </button>
        )}
        {canManage && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(node)
            }}
            title="删除文件夹"
            className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-v2-muted hover:bg-v2-surface hover:text-v2-danger group-hover:flex"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
              canManage={canManage}
              canManageAcl={canManageAcl}
              onDelete={onDelete}
              onEditAcl={onEditAcl}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FilesPage() {
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const queryClient = useQueryClient()

  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const [aclTarget, setAclTarget] = useState<FolderNode | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('shared_file', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: folderData } = useQuery<{ data: FolderNode[] }>({
    queryKey: ['file-folders'],
    queryFn: () => api.get('/files/folders').then((r) => r.data),
  })

  const { data: fileData, isLoading: filesLoading } = useQuery<{
    data: { records: SharedFile[]; total: number }
  }>({
    queryKey: ['files', selectedFolderId, search, page],
    queryFn: () =>
      api
        .get('/files', {
          params: {
            folderId: selectedFolderId ?? undefined,
            keyword: search || undefined,
            page,
            size: pageSize,
          },
        })
        .then((r) => r.data),
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      if (selectedFolderId !== null) form.append('folder_id', String(selectedFolderId))
      return api.post('/files/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/files/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] })
    },
  })

  const deleteFolderMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/files/folders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-folders'] })
      if (selectedFolderId === deleteFolderMutation.variables) setSelectedFolderId(null)
      toast.success('文件夹已删除')
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        '删除失败'
      toast.error(msg)
    },
  })

  const createFolderMutation = useMutation({
    mutationFn: (name: string) =>
      api.post('/files/folders', { name, parent_id: selectedFolderId ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-folders'] })
      setNewFolderOpen(false)
      setNewFolderName('')
    },
  })

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setUploading(true)
      try {
        await uploadMutation.mutateAsync(file)
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [uploadMutation],
  )

  const handleDownload = useCallback(async (id: number, name: string) => {
    const res = await api.get(`/files/${id}/download-url`)
    const url: string = res.data?.data
    if (url) {
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.target = '_blank'
      a.click()
    }
  }, [])

  const folders = folderData?.data ?? []
  const files = fileData?.data?.records ?? []
  const total = fileData?.data?.total ?? 0

  const canUpload = hasPermission('shared_file', 'upload')
  const canDelete = hasPermission('shared_file', 'delete')
  const canManage = hasPermission('shared_file', 'manage')
  const canManageAcl = hasPermission('shared_file', 'manage_acl')

  const handleDeleteFolder = useCallback(
    (node: FolderNode) => {
      if (confirm(`确认删除文件夹「${node.name}」？（仅当文件夹为空时可删除）`)) {
        deleteFolderMutation.mutate(node.id)
      }
    },
    [deleteFolderMutation],
  )

  const columns: ColumnDef<SharedFile>[] = [
    {
      key: 'name',
      title: '名称',
      render: (r) => (
        <div className="flex items-center gap-2">
          <File className="h-4 w-4 shrink-0 text-v2-muted" />
          <span className="max-w-[240px] truncate text-v2-fg">{r.name}</span>
        </div>
      ),
    },
    {
      key: 'file_type',
      title: '类型',
      render: (r) => <span className="text-sm text-v2-muted">{fileTypeLabel(r.file_type)}</span>,
    },
    {
      key: 'size',
      title: '大小',
      render: (r) => (
        <span className="tabular-nums text-sm text-v2-muted">{formatBytes(r.size_bytes)}</span>
      ),
    },
    {
      key: 'created_by_name',
      title: '上传者',
      render: (r) => <span className="text-sm text-v2-fg">{r.created_by_name}</span>,
    },
    {
      key: 'created_at',
      title: '上传时间',
      render: (r) => (
        <span className="whitespace-nowrap text-sm text-v2-muted">
          {new Date(r.created_at).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/files/preview/${r.id}`}
            title="预览"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg"
          >
            <Eye className="h-4 w-4" />
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 px-0"
            title="下载"
            onClick={() => handleDownload(r.id, r.name)}
          >
            <Download className="h-4 w-4" />
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 px-0 text-v2-danger"
              title="删除"
              onClick={() => {
                if (confirm(`确认删除文件「${r.name}」？`)) deleteMutation.mutate(r.id)
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="资源管理"
        title="共享文档"
        subtitle="集中管理运维文档与归档文件，支持文件夹分类、上传下载与在线预览。"
        actions={
          <>
            {canManage && (
              <Button variant="secondary" onClick={() => setNewFolderOpen(true)}>
                <FolderPlus className="h-4 w-4" />
                新建文件夹
              </Button>
            )}
            {canUpload && (
              <Button variant="primary" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                {uploading ? '上传中…' : '上传文件'}
              </Button>
            )}
          </>
        }
      />

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

      <div className="flex gap-4">
        {/* Left: Folder Tree */}
        <Card className="w-60 shrink-0 p-3">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-v2-muted">文件夹</h3>
          <div className="space-y-0.5">
            <button
              onClick={() => setSelectedFolderId(null)}
              className={cn(
                'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors',
                selectedFolderId === null
                  ? 'bg-v2-primary-soft font-semibold text-v2-primary'
                  : 'text-v2-fg hover:bg-v2-surface-hover',
              )}
            >
              <span className="w-3" />
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
              <span>全部文件</span>
            </button>
            {folders.map((node) => (
              <FolderTreeNode
                key={node.id}
                node={node}
                selectedId={selectedFolderId}
                onSelect={setSelectedFolderId}
                depth={0}
                canManage={canManage}
                canManageAcl={canManageAcl}
                onDelete={handleDeleteFolder}
                onEditAcl={setAclTarget}
              />
            ))}
          </div>
        </Card>

        {/* Right: File List */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-v2-muted" />
            <Input
              className="pl-8"
              placeholder="搜索文件名…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>

          {filesLoading ? null : files.length === 0 ? (
            <Card>
              <EmptyState
                icon={<File className="h-5 w-5 text-v2-muted" />}
                title="暂无文件"
                description="当前文件夹为空，点击右上角上传文件或新建文件夹。"
              />
            </Card>
          ) : (
            <DataTable columns={columns} data={files} rowKey={(r) => r.id} />
          )}

          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

          {/* Audit log panel */}
          <AuditPanel />
        </div>
      </div>

      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="文件夹名称"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFolderName.trim()) {
                  createFolderMutation.mutate(newFolderName.trim())
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setNewFolderOpen(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
              onClick={() => createFolderMutation.mutate(newFolderName.trim())}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder ACL Dialog */}
      {aclTarget && (
        <FolderAclDialog
          folderId={aclTarget.id}
          folderName={aclTarget.name}
          open={!!aclTarget}
          onOpenChange={(v) => {
            if (!v) setAclTarget(null)
          }}
        />
      )}
    </div>
  )
}

interface SharedFileAuditLog {
  id: number
  action: string
  targetType: string
  targetId: number
  operatorName: string
  remark: string
  createdAt: string
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  upload: '上传',
  delete: '删除文件',
  create_folder: '新建文件夹',
  delete_folder: '删除文件夹',
  acl_update: '修改权限',
}
const AUDIT_ACTION_VARIANT: Record<string, 'ok' | 'warn' | 'danger' | 'neutral'> = {
  upload: 'ok',
  create_folder: 'ok',
  delete: 'danger',
  delete_folder: 'danger',
  acl_update: 'warn',
}

function AuditPanel() {
  const [open, setOpen] = useState(false)

  const { data } = useQuery<{ data: { records: SharedFileAuditLog[] } }>({
    queryKey: ['shared-file-audit'],
    queryFn: () =>
      api.get('/audit-logs', { params: { module: 'shared_file', page: 1, size: 10 } }).then((r) => r.data),
    enabled: open,
  })

  const records = data?.data?.records ?? []

  return (
    <Card className="p-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-v2-fg">
          <ScrollText className="h-4 w-4 text-v2-muted" />
          操作日志
        </span>
        <span className="flex items-center gap-3">
          <Link
            href="/admin/audit?module=shared_file"
            className="text-xs text-v2-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            查看全部 →
          </Link>
          <ChevronRight className={cn('h-4 w-4 text-v2-muted transition-transform', open && 'rotate-90')} />
        </span>
      </button>
      {open && (
        <div className="border-t border-v2-border px-4 py-2">
          {records.length === 0 ? (
            <p className="py-4 text-center text-xs text-v2-muted">暂无操作记录</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-v2-muted">
                  <th className="py-1.5 text-left font-medium">时间</th>
                  <th className="py-1.5 text-left font-medium">操作</th>
                  <th className="py-1.5 text-left font-medium">对象</th>
                  <th className="py-1.5 text-left font-medium">操作人</th>
                  <th className="py-1.5 text-left font-medium">备注</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t border-v2-border/50">
                    <td className="whitespace-nowrap py-1.5 text-v2-muted">
                      {new Date(r.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="py-1.5">
                      <StatusBadge status={AUDIT_ACTION_VARIANT[r.action] ?? 'neutral'}>
                        {AUDIT_ACTION_LABELS[r.action] ?? r.action}
                      </StatusBadge>
                    </td>
                    <td className="py-1.5 text-v2-muted">
                      {r.targetType}
                      {r.targetId ? ` #${r.targetId}` : ''}
                    </td>
                    <td className="py-1.5 text-v2-fg">{r.operatorName}</td>
                    <td className="max-w-[200px] truncate py-1.5 text-v2-muted">{r.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Card>
  )
}
