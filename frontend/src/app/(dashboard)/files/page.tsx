'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import axios from 'axios'
import api from '@/lib/api'
import { downloadSharedFile } from '@/lib/shared-file-content'
import { usePermission } from '@/hooks/usePermission'
import { ResourceAccessDialog } from '@/components/authorization/ResourceAccessDialog'
import { FolderTreeNode } from './components/FolderTreeNode'
import { AuditPanel } from './components/AuditPanel'
import type { FolderNode, SharedFile } from './components/types'
import { formatBytes, fileTypeLabel } from './components/utils'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  DataManagementPage,
  EmptyState,
  Field,
  FilterBar,
  Input,
  NeutralAlertDialog,
  NeutralDialog,
  PageHeader,
  Pagination,
  Progress,
  SearchInput,
  Select,
  Table,
} from '@/design-system/figma-neutral/components'

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
  const [ownerGroupId, setOwnerGroupId] = useState('')
  const [editingFolder, setEditingFolder] = useState<FolderNode | null>(null)
  const [folderName, setFolderName] = useState('')
  const [folderParentId, setFolderParentId] = useState('')

  const [aclTarget, setAclTarget] = useState<FolderNode | null>(null)
  const [fileAclTarget, setFileAclTarget] = useState<SharedFile | null>(null)
  const [renaming, setRenaming] = useState<SharedFile | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [moving, setMoving] = useState<SharedFile | null>(null)
  const [moveFolderId, setMoveFolderId] = useState('')
  const [deleteFile, setDeleteFile] = useState<SharedFile | null>(null)
  const [deleteFolder, setDeleteFolder] = useState<FolderNode | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadAbortRef = useRef<AbortController | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('shared_file', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: folderData } = useQuery<{ data: FolderNode[] }>({
    queryKey: ['file-folders'],
    queryFn: () => api.get('/files/folders').then((response) => response.data),
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
        .then((response) => response.data),
  })

  const { data: groups = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['authorization-groups'],
    queryFn: () => api.get('/groups').then((response) => response.data.data ?? []),
    enabled: hasPermission('group', 'read'),
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      const controller = new AbortController()
      uploadAbortRef.current = controller
      form.append('file', file)
      if (selectedFolderId !== null) form.append('folder_id', String(selectedFolderId))
      if (selectedFolderId === null && ownerGroupId) form.append('owner_group_id', ownerGroupId)
      return api.post('/files/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: controller.signal,
        onUploadProgress: (event) => {
          if (event.total) setUploadProgress(Math.round((event.loaded / event.total) * 100))
        },
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
      setDeleteFile(null)
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

  const moveMutation = useMutation({
    mutationFn: ({ id, parentId }: { id: number; parentId: string }) =>
      api.put(`/files/${id}`, { parentId: parentId === '' ? null : Number(parentId) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] })
      setMoving(null)
      setMoveFolderId('')
      toast.success('文件已移动')
    },
  })

  const deleteFolderMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/files/folders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-folders'] })
      if (selectedFolderId === deleteFolderMutation.variables) setSelectedFolderId(null)
      setDeleteFolder(null)
      toast.success('文件夹已删除')
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '删除失败'
      toast.error(message)
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

  const closeNewFolderDialog = () => {
    setNewFolderOpen(false)
    setNewFolderName('')
    setOwnerGroupId('')
  }

  const updateFolderMutation = useMutation({
    mutationFn: ({ id, name, parentId }: { id: number; name: string; parentId?: string }) =>
      api.patch(`/files/folders/${id}`, {
        name,
        ...(parentId === undefined ? {} : { parentId: parentId === '' ? null : Number(parentId) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-folders'] })
      setEditingFolder(null)
      toast.success('文件夹已更新')
    },
    onError: (error: unknown) => {
      toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '更新失败')
    },
  })

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      setUploading(true)
      try {
        await uploadMutation.mutateAsync(file)
        toast.success('文件上传成功')
      } catch (error) {
        if (axios.isCancel(error)) toast.message('已取消上传')
        else toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '上传失败')
      } finally {
        setUploading(false)
        setUploadProgress(null)
        uploadAbortRef.current = null
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
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const flatFolders = (nodes: FolderNode[]): FolderNode[] => nodes.flatMap((node) => [node, ...flatFolders(node.children ?? [])])

  const canUpload = hasPermission('shared_file', 'upload')
  const canDelete = hasPermission('shared_file', 'delete')
  const canUpdate = hasPermission('shared_file', 'update')
  const canManage = hasPermission('shared_file', 'manage')
  const canManageAcl = hasPermission('shared_file', 'manage_acl')

  const selectFolder = (id: number | null) => {
    setSelectedFolderId(id)
    setPage(1)
  }

  const folderOptions = [
    { value: '', label: '根目录' },
    ...flatFolders(folders).map((folder) => ({ value: String(folder.id), label: folder.name })),
  ]

  return (
    <>
      <DataManagementPage
        embedded
        header={
          <PageHeader
            eyebrow="资源管理"
            title="共享文档"
            subtitle="集中管理运维文档与归档文件，支持文件夹分类、上传下载与在线预览。"
            breadcrumb={<Breadcrumb items={[{ href: '/', label: '工作台' }, { label: '共享文档' }]} />}
            actions={
              <div className="cwgsyw-inline-controls">
                {canManage ? (
                  <Button type="button" variant="secondary" onClick={() => setNewFolderOpen(true)}>
                    新建文件夹
                  </Button>
                ) : null}
                {canUpload ? (
                  <>
                    <Button type="button" variant="primary" loading={uploading} onClick={() => fileInputRef.current?.click()}>
                      {uploading ? `上传中${uploadProgress == null ? '…' : ` ${uploadProgress}%`}` : '上传文件'}
                    </Button>
                    {uploading ? (
                      <Button type="button" variant="secondary" onClick={() => uploadAbortRef.current?.abort()}>
                        取消上传
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
            }
          />
        }
        filter={
          <FilterBar
            search={
              <SearchInput
                placeholder="搜索文件名…"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
              />
            }
          />
        }
        content={
          <div className="cwgsyw-form">
            <input ref={fileInputRef} type="file" className="cwgsyw-sr-only" onChange={handleFileChange} />
            {uploading && uploadProgress != null ? (
              <Progress value={uploadProgress} label="上传进度" showLabel showPercentage size="sm" tone="neutral" />
            ) : null}
            <div className="cwgsyw-split cwgsyw-split--nav">
              <aside className="cwgsyw-split__pane">
                <div className="cwgsyw-split__pane-head">
                  <div className="cwgsyw-type-label-xs">文件夹</div>
                </div>
                <div className="cwgsyw-split__pane-body">
                  <div className="cwgsyw-tree">
                    <Button
                      type="button"
                      variant="ghost"
                      className="cwgsyw-tree-item"
                      data-selected={selectedFolderId === null}
                      onClick={() => selectFolder(null)}
                    >
                      全部文件
                    </Button>
                    {folders.map((node) => (
                      <FolderTreeNode
                        key={node.id}
                        node={node}
                        selectedId={selectedFolderId}
                        onSelect={selectFolder}
                        depth={0}
                        canManage={canManage}
                        canManageAcl={canManageAcl}
                        onDelete={setDeleteFolder}
                        onEdit={(node) => {
                          setEditingFolder(node)
                          setFolderName(node.name)
                          setFolderParentId(node.parentId === null ? '' : String(node.parentId))
                        }}
                        onEditAcl={setAclTarget}
                      />
                    ))}
                  </div>
                </div>
              </aside>
              <section className="cwgsyw-split__pane">
                <div className="cwgsyw-split__pane-head">
                  <div className="cwgsyw-type-label-xs">文件列表</div>
                </div>
                <div className="cwgsyw-split__pane-body">
                  <Table
                    showSearch={false}
                    columns={[
                      { key: 'name', label: '名称' },
                      { key: 'fileType', label: '类型' },
                      { key: 'size', label: '大小' },
                      { key: 'createdByName', label: '上传者' },
                      { key: 'createdAt', label: '上传时间' },
                      { key: 'actions', label: '操作', align: 'right' },
                    ]}
                    rows={files.map((file) => ({
                      id: String(file.id),
                      cells: {
                        name: file.name,
                        fileType: fileTypeLabel(file.fileType),
                        size: formatBytes(file.sizeBytes),
                        createdByName: file.createdByName,
                        createdAt: new Date(file.createdAt).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                        actions: (
                          <div className="cwgsyw-inline-controls">
                            <Link href={`/files/preview/${file.id}`}>预览</Link>
                            <Button type="button" size="sm" variant="ghost" onClick={() => handleDownload(file.id, file.originalName)}>
                              下载
                            </Button>
                            {canManageAcl && file.canManageAcl ? (
                              <Button type="button" size="sm" variant="ghost" onClick={() => setFileAclTarget(file)}>
                                权限
                              </Button>
                            ) : null}
                            {canUpdate ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setRenaming(file)
                                  setRenameValue(file.name)
                                }}
                              >
                                重命名
                              </Button>
                            ) : null}
                            {canManage ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setMoving(file)
                                  setMoveFolderId(file.folderId === null ? '' : String(file.folderId))
                                }}
                              >
                                移动
                              </Button>
                            ) : null}
                            {canDelete && file.canDelete ? (
                              <Button type="button" size="sm" variant="ghost" onClick={() => setDeleteFile(file)}>
                                删除
                              </Button>
                            ) : null}
                          </div>
                        ),
                      },
                    }))}
                    state={filesLoading ? 'loading' : files.length === 0 ? 'empty' : 'data'}
                    empty={<EmptyState title="暂无文件" description="当前文件夹为空，点击右上角上传文件或新建文件夹。" showAction={false} />}
                  />
                  <Pagination page={page} pageCount={pageCount} totalCount={total} onPageChange={setPage} />
                </div>
              </section>
            </div>
            <AuditPanel />
          </div>
        }
      />

      <NeutralDialog
        open={!!renaming}
        onOpenChange={(open) => {
          if (!open) setRenaming(null)
        }}
        title="重命名文件"
        showClose={false}
        footer={
          <div className="cwgsyw-form__actions">
            <Button type="button" variant="secondary" onClick={() => setRenaming(null)}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={renameMutation.isPending}
              disabled={!renameValue.trim()}
              onClick={() => {
                if (renaming) renameMutation.mutate({ id: renaming.id, name: renameValue.trim() })
              }}
            >
              保存
            </Button>
          </div>
        }
      >
        <Field htmlFor="file-rename" label="文件名" required>
          <Input id="file-rename" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
        </Field>
      </NeutralDialog>

      <NeutralDialog
        open={!!moving}
        onOpenChange={(open) => {
          if (!open) setMoving(null)
        }}
        title="移动文件"
        showClose={false}
        footer={
          <div className="cwgsyw-form__actions">
            <Button type="button" variant="secondary" onClick={() => setMoving(null)}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={moveMutation.isPending}
              onClick={() => {
                if (moving) moveMutation.mutate({ id: moving.id, parentId: moveFolderId })
              }}
            >
              保存
            </Button>
          </div>
        }
      >
        <Field htmlFor="file-move" label="移动到">
          <Select id="file-move" value={moveFolderId} options={folderOptions} onChange={setMoveFolderId} />
        </Field>
      </NeutralDialog>

      <NeutralDialog
        open={newFolderOpen}
        onOpenChange={(open) => {
          if (open) setNewFolderOpen(true)
          else closeNewFolderDialog()
        }}
        title="新建文件夹"
        showClose={false}
        footer={
          <div className="cwgsyw-form__actions">
            <Button type="button" variant="secondary" onClick={closeNewFolderDialog}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={createFolderMutation.isPending}
              disabled={!newFolderName.trim()}
              onClick={() => createFolderMutation.mutate(newFolderName.trim())}
            >
              创建
            </Button>
          </div>
        }
      >
        <div className="cwgsyw-form">
          <Field htmlFor="folder-name" label="文件夹名称" required>
            <Input
              id="folder-name"
              value={newFolderName}
              placeholder="文件夹名称"
              onChange={(event) => setNewFolderName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && newFolderName.trim()) {
                  createFolderMutation.mutate(newFolderName.trim())
                }
              }}
            />
          </Field>
          {selectedFolderId === null && groups.length > 0 ? (
            <Field htmlFor="folder-owner-group" label="归属组">
              <Select
                id="folder-owner-group"
                value={ownerGroupId}
                options={[{ value: '', label: '使用主组' }, ...groups.map((group) => ({ value: String(group.id), label: group.name }))]}
                onChange={setOwnerGroupId}
              />
            </Field>
          ) : null}
        </div>
      </NeutralDialog>

      <NeutralDialog
        open={!!editingFolder}
        onOpenChange={(open) => {
          if (!open) setEditingFolder(null)
        }}
        title="编辑文件夹"
        showClose={false}
        footer={
          <div className="cwgsyw-form__actions">
            <Button type="button" variant="secondary" onClick={() => setEditingFolder(null)}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={updateFolderMutation.isPending}
              disabled={!folderName.trim()}
              onClick={() => {
                if (!editingFolder) return
                updateFolderMutation.mutate({
                  id: editingFolder.id,
                  name: folderName.trim(),
                  parentId:
                    folderParentId === (editingFolder.parentId === null ? '' : String(editingFolder.parentId))
                      ? undefined
                      : folderParentId,
                })
              }}
            >
              保存
            </Button>
          </div>
        }
      >
        <div className="cwgsyw-form">
          <Field htmlFor="folder-edit-name" label="名称" required>
            <Input id="folder-edit-name" value={folderName} onChange={(event) => setFolderName(event.target.value)} />
          </Field>
          <Field htmlFor="folder-edit-parent" label="移动到">
            <Select
              id="folder-edit-parent"
              value={folderParentId}
              options={folderOptions.filter((option) => option.value !== String(editingFolder?.id ?? ''))}
              onChange={setFolderParentId}
            />
          </Field>
        </div>
      </NeutralDialog>

      <NeutralAlertDialog
        open={!!deleteFile}
        title="确认删除文件"
        description={deleteFile ? `确认删除文件「${deleteFile.name}」？` : '确认删除该文件？'}
        intent="destructive"
        confirmLabel="删除"
        onConfirm={() => deleteFile && deleteMutation.mutate(deleteFile.id)}
        onOpenChange={(open) => {
          if (!open) setDeleteFile(null)
        }}
      />

      <NeutralAlertDialog
        open={!!deleteFolder}
        title="确认删除文件夹"
        description={deleteFolder ? `确认删除文件夹「${deleteFolder.name}」？（仅当文件夹为空时可删除）` : '确认删除该文件夹？'}
        intent="destructive"
        confirmLabel="删除"
        onConfirm={() => deleteFolder && deleteFolderMutation.mutate(deleteFolder.id)}
        onOpenChange={(open) => {
          if (!open) setDeleteFolder(null)
        }}
      />

      {aclTarget ? (
        <ResourceAccessDialog
          resourceType="shared_folder"
          resourceId={aclTarget.id}
          title={aclTarget.name}
          container
          open={!!aclTarget}
          onOpenChange={(value) => {
            if (!value) setAclTarget(null)
          }}
        />
      ) : null}
      {fileAclTarget ? (
        <ResourceAccessDialog
          resourceType="shared_file"
          resourceId={fileAclTarget.id}
          title={fileAclTarget.name}
          container={false}
          open
          onOpenChange={(value) => {
            if (!value) setFileAclTarget(null)
          }}
        />
      ) : null}
    </>
  )
}
