'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { toast } from '@/design-system/figma-neutral/toast'
import { ProcessDefinition, ProcessDefinitionVersion } from '@/types/workflow'
import { extractPaginated } from '@/types/api'
import { getApiErrorMessage } from '@/lib/api-error'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  DataManagementPage,
  EmptyState,
  Field,
  IconButton,
  Input,
  LoadingState,
  NeutralAlertDialog,
  NeutralDialog,
  NeutralDrawer,
  NeutralTooltip,
  PageHeader,
  Pagination,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

interface ProcessDefWithMeta extends ProcessDefinition {
  deploymentTime?: string
  activeVersion?: number | null
}

function displayCategory(category?: string | null) {
  const value = category?.trim()
  if (!value || /:\/\//.test(value) || /^www\./i.test(value)) return '—'
  return value
}

export default function WorkflowAdminPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const canConfigure = hasPermission('workflow', 'configure')
  const [deleteTarget, setDeleteTarget] = useState<ProcessDefWithMeta | null>(null)
  const [versionDef, setVersionDef] = useState<ProcessDefWithMeta | null>(null)
  const [versions, setVersions] = useState<ProcessDefinitionVersion[]>([])
  const [page, setPage] = useState(1)
  const [deleteVersionTarget, setDeleteVersionTarget] = useState<{
    version: ProcessDefinitionVersion
    def: ProcessDefWithMeta
  } | null>(null)
  const [activating, setActivating] = useState<string | null>(null)
  const [suspending, setSuspending] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<ProcessDefWithMeta | null>(null)
  const [renameName, setRenameName] = useState('')
  const [renameKey, setRenameKey] = useState('')
  const [renaming, setRenaming] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['process-definitions', page],
    queryFn: () =>
      api.get('/workflow/definitions', { params: { page, size: 20 } }).then((r) =>
        extractPaginated<ProcessDefWithMeta>(r),
      ),
  })

  const definitions = data?.records ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 20))

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/workflow/definitions/${encodeURIComponent(deleteTarget.id)}`)
      toast.success(`流程 "${deleteTarget.name}" 已删除`)
      setDeleteTarget(null)
      refetch()
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '删除失败'))
      setDeleteTarget(null)
    }
  }

  const handleVersions = async (def: ProcessDefWithMeta) => {
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

  const handleActivate = async (v: ProcessDefinitionVersion, def: ProcessDefWithMeta) => {
    setActivating(v.id)
    try {
      await api.put(`/workflow/definitions/${encodeURIComponent(v.id)}/activate`)
      toast.success(`v${v.version} 已启用`)
      handleVersions(def)
      refetch()
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '启用失败'))
    } finally {
      setActivating(null)
    }
  }

  const handleSuspend = async (v: ProcessDefinitionVersion, def: ProcessDefWithMeta) => {
    setSuspending(v.id)
    try {
      await api.put(`/workflow/definitions/${encodeURIComponent(v.id)}/suspend`)
      toast.success(`v${v.version} 已禁用`)
      handleVersions(def)
      refetch()
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '禁用失败'))
    } finally {
      setSuspending(null)
    }
  }

  const openRename = (def: ProcessDefWithMeta) => {
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
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '更新失败'))
    } finally {
      setRenaming(false)
    }
  }

  const handleDeleteVersion = async () => {
    if (!deleteVersionTarget) return
    try {
      await api.post(`/workflow/definitions/delete-version`, {
        definitionId: deleteVersionTarget.version.id,
      })
      toast.success(`v${deleteVersionTarget.version.version} 已删除`)
      const t = deleteVersionTarget
      setDeleteVersionTarget(null)
      refetch()
      if (versionDef?.key === t.def.key) {
        handleVersions(t.def)
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '删除失败'))
      setDeleteVersionTarget(null)
    }
  }

  const getActiveVersionInfo = (def: ProcessDefWithMeta) => {
    if (def.activeVersion != null) {
      return { version: def.activeVersion, active: true }
    }
    return { version: def.version, active: false }
  }

  const columns = useMemo(
    () => [
      { key: 'name', label: '流程名称' },
      { key: 'key', label: 'Key' },
      { key: 'latest', label: '最新版本' },
      { key: 'category', label: '分类' },
      { key: 'active', label: '激活版本' },
      ...(canConfigure ? [{ key: 'actions', label: <span className="cwgsyw-sr-only">操作</span>, align: 'right' as const }] : []),
    ],
    [canConfigure],
  )

  const rows = definitions.map((def) => {
    const versionInfo = getActiveVersionInfo(def)
    return {
      id: def.id,
      selected: versionDef?.id === def.id,
      cells: {
        name: <span className="cwgsyw-workflow-admin__name" title={def.name}>{def.name}</span>,
        key: <span className="cwgsyw-workflow-admin__name" title={def.key}>{def.key}</span>,
        latest: `v${def.version}`,
        category: displayCategory(def.category),
        active: versionInfo.active ? (
          <StatusBadge size="sm" label={`v${versionInfo.version}`} status="success" />
        ) : (
          '—'
        ),
        actions: canConfigure ? (
          <div className="cwgsyw-inline-controls cwgsyw-cmdb-admin__row-actions" onClick={(event) => event.stopPropagation()}>
            <NeutralTooltip content="编辑" className="cwgsyw-tooltip--pill" followCursor>
              <IconButton
                type="button"
                size="sm"
                variant="ghost"
                icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--edit" />}
                aria-label={`编辑 ${def.name}`}
                onClick={() => openRename(def)}
              />
            </NeutralTooltip>
            <NeutralTooltip content="版本" className="cwgsyw-tooltip--pill" followCursor>
              <IconButton
                type="button"
                size="sm"
                variant="ghost"
                icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-workflow-admin__figma-action-icon--layers" />}
                aria-label={`${def.name} 的版本`}
                onClick={() => handleVersions(def)}
              />
            </NeutralTooltip>
            <NeutralTooltip content="删除" className="cwgsyw-tooltip--pill" followCursor>
              <IconButton
                type="button"
                size="sm"
                variant="ghost"
                className="cwgsyw-cmdb-admin__delete-action"
                icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--trash" />}
                aria-label={`删除 ${def.name}`}
                onClick={() => setDeleteTarget(def)}
              />
            </NeutralTooltip>
          </div>
        ) : null,
      },
    }
  })

  const tableState = isLoading ? 'loading' : definitions.length === 0 ? 'empty' : 'data'

  return (
    <>
      <DataManagementPage
        embedded
        className="cwgsyw-workflow cwgsyw-workflow-admin"
        header={
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="流程配置"
            subtitle="管理 BPMN 流程定义，创建和编辑审批流程，按版本启用或挂起。"
            actions={
              canConfigure ? (
                <Button className="cwgsyw-workflow__header-actions" type="button" size="sm" onClick={() => router.push('/workflow/design')}>
                  新建流程
                </Button>
              ) : undefined
            }
          />
        }
        content={
          isLoading ? (
            <LoadingState label="加载流程定义" />
          ) : definitions.length === 0 ? (
            <div className="cwgsyw-workflow-empty">
              {/* Official Figma git-branch glyph; image optimization adds no value here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/figma-icons/workflow-git-branch.svg" width={22} height={22} alt="" data-figma-node="6:26741" />
              <EmptyState
                showIcon={false}
                title="暂无流程定义"
                description="创建第一个 BPMN 流程定义来开始使用流程引擎"
                action={
                  canConfigure ? (
                    <Button type="button" size="sm" onClick={() => router.push('/workflow/design')}>
                      新建流程
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <Table
                className="cwgsyw-cmdb-table cwgsyw-workflow-admin__table"
                density="compact"
                columns={columns}
                rows={rows}
                showSearch={false}
                state={tableState}
              />
              <Pagination page={page} pageCount={pageCount} totalCount={total} onPageChange={setPage} />
            </>
          )
        }
      />

      <NeutralDrawer
        open={!!versionDef}
        onOpenChange={(open) => {
          if (!open) {
            setVersionDef(null)
            setVersions([])
          }
        }}
        title={versionDef ? `${versionDef.name} 的版本` : '版本历史'}
        description="启用、禁用、编辑或删除指定版本。删除版本会级联删除该版本下的运行实例。"
      >
        {versions.length === 0 ? (
          <EmptyState title="暂无版本数据" description="这个流程还没有可管理的版本。" />
        ) : (
          <Table
            className="cwgsyw-cmdb-table cwgsyw-workflow-admin__versions-table"
            density="compact"
            showSearch={false}
            columns={[
              { key: 'version', label: '版本' },
              { key: 'name', label: '名称' },
              { key: 'time', label: '部署时间' },
              { key: 'status', label: '启用状态' },
              ...(canConfigure ? [{ key: 'actions', label: <span className="cwgsyw-sr-only">操作</span>, align: 'right' as const }] : []),
            ]}
            rows={versions.map((v) => ({
              id: v.id,
              cells: {
                version: `v${v.version}`,
                name: v.name,
                time: v.deploymentTime ? new Date(v.deploymentTime).toLocaleString('zh-CN') : '-',
                status: !v.suspended ? <StatusBadge size="sm" label="已启用" status="success" /> : '--',
                actions: canConfigure && versionDef ? (
                  <div className="cwgsyw-inline-controls">
                    {v.suspended ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={activating === v.id}
                        onClick={() => handleActivate(v, versionDef)}
                      >
                        {activating === v.id ? '启用中…' : '启用'}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={suspending === v.id}
                        onClick={() => handleSuspend(v, versionDef)}
                      >
                        {suspending === v.id ? '禁用中…' : '禁用'}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/workflow/design/${versionDef.key}?version=${v.id}`)}
                    >
                      编辑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteVersionTarget({ version: v, def: versionDef })}
                    >
                      删除
                    </Button>
                  </div>
                ) : null,
              },
            }))}
          />
        )}
      </NeutralDrawer>

      <NeutralAlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        className="cwgsyw-cmdb-model-detail__delete-dialog"
        icon={<img src="/figma-icons/cmdb-model-alert.svg" alt="" width={56} height={56} />}
        title="确认删除"
        description={`确定要删除流程 ${deleteTarget?.name ?? ''} 及其所有版本吗？此操作不可撤销，将删除所有关联的运行时数据和历史记录。`}
        intent="destructive"
        confirmLabel="删除"
        onConfirm={handleDelete}
      />

      <NeutralAlertDialog
        open={!!deleteVersionTarget}
        onOpenChange={(open) => !open && setDeleteVersionTarget(null)}
        className="cwgsyw-cmdb-model-detail__delete-dialog"
        icon={<img src="/figma-icons/cmdb-model-alert.svg" alt="" width={56} height={56} />}
        title="确认删除版本"
        description={`确定要删除 ${deleteVersionTarget?.def.name ?? ''} 的 v${deleteVersionTarget?.version.version ?? ''} 吗？此操作将级联删除该版本下所有运行中和历史的流程实例，不可撤销。`}
        intent="destructive"
        confirmLabel="删除"
        onConfirm={handleDeleteVersion}
      />

      <NeutralDialog
        open={!!renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        title="编辑流程信息"
        showDescription={false}
        size="sm"
        footer={
          <div className="cwgsyw-inline-controls cwgsyw-workflow-dialog-actions">
            <Button type="button" variant="secondary" size="sm" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button type="button" size="sm" loading={renaming} disabled={renaming} onClick={handleRename}>
              {renaming ? '保存中…' : '保存'}
            </Button>
          </div>
        }
      >
        <div className="cwgsyw-workflow-dialog-form">
          <Field label="流程名称" htmlFor="rename-name" required>
            <Input
              id="rename-name"
              size="sm"
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
              placeholder="输入流程名称"
            />
          </Field>
          <Field label="流程 Key" htmlFor="rename-key" required>
            <Input
              id="rename-key"
              size="sm"
              value={renameKey}
              onChange={(event) => setRenameKey(event.target.value)}
              placeholder="输入流程 Key（英文标识）"
            />
          </Field>
        </div>
      </NeutralDialog>
    </>
  )
}
