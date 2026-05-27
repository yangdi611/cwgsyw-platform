'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { buttonVariants } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  FolderOpen, Folder, Upload, FolderPlus, Search, Download, Eye, Trash2, File,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface FolderNode {
  id: number
  name: string
  parentId: number | null
  children?: FolderNode[]
}

interface SharedFile {
  id: number
  name: string
  fileType: string
  fileSize: number
  folderId: number | null
  uploaderName: string
  createdAt: string
}

interface FolderTreeResponse {
  data: FolderNode[]
}

interface FileListResponse {
  data: {
    records: SharedFile[]
    total: number
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function fileTypeLabel(type: string): string {
  const map: Record<string, string> = {
    pdf: 'PDF', docx: 'Word', xlsx: 'Excel', xls: 'Excel',
    doc: 'Word', pptx: 'PPT', ppt: 'PPT', txt: '文本',
    png: '图片', jpg: '图片', jpeg: '图片', gif: '图片',
    zip: '压缩包', rar: '压缩包',
  }
  return map[type.toLowerCase()] ?? type.toUpperCase()
}

// ─── Folder Tree Component ────────────────────────────────────────────────────

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
          if (hasChildren) setExpanded(v => !v)
        }}
        className={cn(
          'w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors text-left',
          selectedId === node.id
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted text-muted-foreground hover:text-foreground',
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {hasChildren ? (
          <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform', expanded && 'rotate-90')} />
        ) : (
          <span className="w-3" />
        )}
        {selectedId === node.id
          ? <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          : <Folder className="h-3.5 w-3.5 shrink-0" />
        }
        <span className="truncate">{node.name}</span>
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children!.map(child => (
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

// ─── Main Page ────────────────────────────────────────────────────────────────

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

  // Permission guard
  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('shared_file', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  // Folder tree
  const { data: folderData } = useQuery<FolderTreeResponse>({
    queryKey: ['file-folders'],
    queryFn: () => api.get('/files/folders/tree').then(r => r.data),
  })

  // File list
  const { data: fileData, isLoading: filesLoading } = useQuery<FileListResponse>({
    queryKey: ['files', selectedFolderId, search, page],
    queryFn: () =>
      api.get('/files', {
        params: {
          folder_id: selectedFolderId ?? undefined,
          keyword: search || undefined,
          page,
          size: pageSize,
        },
      }).then(r => r.data),
  })

  // Upload mutation
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/files/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] })
    },
  })

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: (name: string) =>
      api.post('/files/folders', {
        name,
        parent_id: selectedFolderId ?? null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-folders'] })
      setNewFolderOpen(false)
      setNewFolderName('')
    },
  })

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await uploadMutation.mutateAsync(file)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [uploadMutation])

  const handleDownload = useCallback(async (id: number, name: string) => {
    const res = await api.get(`/files/${id}/download-url`)
    const url: string = res.data?.data?.url ?? res.data?.url
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

  return (
    <div className="flex h-full min-h-0 flex-1">
      {/* Left: Folder Tree */}
      <aside className="w-[220px] shrink-0 border-r bg-background flex flex-col">
        <div className="p-3 border-b">
          <span className="text-sm font-medium text-muted-foreground">文件夹</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {/* All files root */}
          <button
            onClick={() => setSelectedFolderId(null)}
            className={cn(
              'w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors text-left',
              selectedFolderId === null
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="w-3" />
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            <span>全部文件</span>
          </button>
          {folders.map(node => (
            <FolderTreeNode
              key={node.id}
              node={node}
              selectedId={selectedFolderId}
              onSelect={setSelectedFolderId}
              depth={0}
            />
          ))}
        </div>
      </aside>

      {/* Right: File List */}
      <main className="flex-1 flex flex-col min-w-0 p-4 gap-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索文件名..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(true)}>
                <FolderPlus className="h-4 w-4 mr-1.5" />
                新建文件夹
              </Button>
            )}
            {canUpload && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  {uploading ? '上传中...' : '上传文件'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead className="w-24">类型</TableHead>
                <TableHead className="w-24">大小</TableHead>
                <TableHead className="w-32">上传者</TableHead>
                <TableHead className="w-40">上传时间</TableHead>
                <TableHead className="w-32 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filesLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : files.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    暂无文件
                  </TableCell>
                </TableRow>
              ) : (
                files.map(file => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[240px]">{file.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {fileTypeLabel(file.fileType)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatBytes(file.fileSize)}
                    </TableCell>
                    <TableCell className="text-sm">{file.uploaderName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(file.createdAt).toLocaleString('zh-CN', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/files/preview/${file.id}`}
                          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                          title="预览"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="下载"
                          onClick={() => handleDownload(file.id, file.name)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="删除"
                            onClick={() => {
                              if (confirm(`确认删除文件「${file.name}」？`)) {
                                deleteMutation.mutate(file.id)
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>共 {total} 个文件</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                上一页
              </Button>
              <span className="flex items-center px-2">
                第 {page} / {Math.ceil(total / pageSize)} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(total / pageSize)}
                onClick={() => setPage(p => p + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </main>

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
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newFolderName.trim()) {
                  createFolderMutation.mutate(newFolderName.trim())
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>取消</Button>
            <Button
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
