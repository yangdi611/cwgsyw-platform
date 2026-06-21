'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/v2/Button'
import { Card } from '@/components/v2/Card'
import { PageHeader, DataTable, Pagination, EmptyState, type ColumnDef } from '@/components/shared'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FolderNode {
  id: number
  name: string
  parent_id: number | null
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
}: {
  node: FolderNode
  selectedId: number | null
  onSelect: (id: number | null) => void
  depth: number
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div>
      <button
        onClick={() => {
          onSelect(node.id)
          if (hasChildren) setExpanded((v) => !v)
        }}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors',
          selectedId === node.id
            ? 'bg-v2-primary-soft font-semibold text-v2-primary'
            : 'text-v2-fg hover:bg-v2-surface-hover',
        )}
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
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
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
    </div>
  )
}
