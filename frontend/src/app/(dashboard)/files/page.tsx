'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { downloadSharedFile } from '@/lib/shared-file-content'
import { usePermission } from '@/hooks/usePermission'
import { Input } from '@/components/v2/Input'
import { Button } from '@/components/v2/Button'
import { Card } from '@/components/v2/Card'
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
  Upload,
  FolderPlus,
  Search,
  Download,
  Eye,
  Trash2,
  Pencil,
  File,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FolderAclDialog } from './FolderAclDialog'
import { ResourceAccessDialog } from '@/components/authorization/ResourceAccessDialog'
import { useAuthorizationEnforced } from '@/hooks/useAuthorizationEnforced'
import { FolderTreeNode } from './components/FolderTreeNode'
import { AuditPanel } from './components/AuditPanel'
import type { FolderNode, SharedFile } from './components/types'
import { formatBytes, fileTypeLabel } from './components/utils'

export default function FilesPage() {
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const queryClient = useQueryClient()
  const authorizationEnforced = useAuthorizationEnforced('shared_file')

  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [ownerGroupId, setOwnerGroupId] = useState('')

  const [aclTarget, setAclTarget] = useState<FolderNode | null>(null)
  const [fileAclTarget, setFileAclTarget] = useState<SharedFile | null>(null)
  const [renaming, setRenaming] = useState<SharedFile | null>(null)
  const [renameValue, setRenameValue] = useState('')

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

  const { data: groups = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['authorization-groups'],
    queryFn: () => api.get('/groups').then((response) => response.data.data ?? []),
    enabled: hasPermission('group', 'read'),
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      if (selectedFolderId !== null) form.append('folder_id', String(selectedFolderId))
      if (selectedFolderId === null && ownerGroupId) form.append('owner_group_id', ownerGroupId)
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

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api.put(`/files/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] })
      setRenaming(null)
      setRenameValue('')
      toast.success('文件已重命名')
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
      api.post('/files/folders', {
        name,
        parentId: selectedFolderId ?? null,
        ownerGroupId: selectedFolderId === null && ownerGroupId ? Number(ownerGroupId) : undefined,
      }),
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
    try {
      await downloadSharedFile(id, name)
    } catch {
      toast.error('下载失败')
    }
  }, [])

  const folders = folderData?.data ?? []
  const files = fileData?.data?.records ?? []
  const total = fileData?.data?.total ?? 0

  const canUpload = hasPermission('shared_file', 'upload')
  const canDelete = hasPermission('shared_file', 'delete')
  const canUpdate = hasPermission('shared_file', 'update')
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
      key: 'fileType',
      title: '类型',
      render: (r) => <span className="text-sm text-v2-muted">{fileTypeLabel(r.fileType)}</span>,
    },
    {
      key: 'size',
      title: '大小',
      render: (r) => (
        <span className="tabular-nums text-sm text-v2-muted">{formatBytes(r.sizeBytes)}</span>
      ),
    },
    {
      key: 'createdByName',
      title: '上传者',
      render: (r) => <span className="text-sm text-v2-fg">{r.createdByName}</span>,
    },
    {
      key: 'createdAt',
      title: '上传时间',
      render: (r) => (
        <span className="whitespace-nowrap text-sm text-v2-muted">
          {new Date(r.createdAt).toLocaleString('zh-CN', {
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
            onClick={() => handleDownload(r.id, r.originalName)}
          >
            <Download className="h-4 w-4" />
          </Button>
          {authorizationEnforced && canManageAcl && r.canManageAcl && (
            <Button variant="ghost" size="sm" className="h-8 w-8 px-0" title="权限设置" onClick={() => setFileAclTarget(r)}>
              <Lock className="h-4 w-4" />
            </Button>
          )}
          {canUpdate && (
            <Button variant="ghost" size="sm" className="h-8 w-8 px-0" title="重命名" onClick={() => {
              setRenaming(r)
              setRenameValue(r.name)
            }}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canDelete && r.canDelete && (
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

      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>重命名文件</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenaming(null)}>取消</Button>
            <Button variant="primary" disabled={!renameValue.trim() || renameMutation.isPending} onClick={() => {
              if (renaming) renameMutation.mutate({ id: renaming.id, name: renameValue.trim() })
            }}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          <div className="space-y-3 py-2">
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
            {selectedFolderId === null && groups.length > 0 && (
              <label className="block space-y-1 text-sm text-v2-fg">
                <span>归属组</span>
                <select className="h-9 w-full rounded-v2-sm border border-v2-border bg-v2-surface px-2" value={ownerGroupId} onChange={(event) => setOwnerGroupId(event.target.value)}>
                  <option value="">使用主组</option>
                  {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              </label>
            )}
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
        authorizationEnforced
          ? <ResourceAccessDialog resourceType="shared_folder" resourceId={aclTarget.id}
              title={aclTarget.name} container open={!!aclTarget}
              onOpenChange={(value) => { if (!value) setAclTarget(null) }} />
          : <FolderAclDialog
              folderId={aclTarget.id}
              folderName={aclTarget.name}
              open={!!aclTarget}
              onOpenChange={(value) => { if (!value) setAclTarget(null) }}
            />
      )}
      {fileAclTarget && authorizationEnforced && (
        <ResourceAccessDialog resourceType="shared_file" resourceId={fileAclTarget.id}
          title={fileAclTarget.name} container={false} open
          onOpenChange={(value) => { if (!value) setFileAclTarget(null) }} />
      )}
    </div>
  )
}
