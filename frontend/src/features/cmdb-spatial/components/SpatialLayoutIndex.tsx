'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  archiveSpatialLayout,
  createSpatialLayout,
  listSpatialLayouts,
  listSpatialRooms,
  restoreActiveSpatialLayout,
  spatialQueryKeys,
} from '../api/spatial-api'
import type { SpatialLayoutSummary } from '../model/types'
import {
  Alert,
  Button,
  Card,
  DataManagementPage,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  LoadingState,
  NeutralAlertDialog,
  NeutralDialog,
  NeutralTooltip,
  PageHeader,
  SearchInput,
  Select,
  StatusBadge,
  Tabs,
} from '@/design-system/figma-neutral/components'

interface SpatialLayoutIndexProps {
  canCreate: boolean
  canPublish: boolean
}

export function SpatialLayoutIndex({ canCreate, canPublish }: SpatialLayoutIndexProps) {
  const client = useQueryClient()
  const router = useRouter()
  const [keyword, setKeyword] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [roomId, setRoomId] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [archiving, setArchiving] = useState<SpatialLayoutSummary | null>(null)
  const [restoring, setRestoring] = useState<SpatialLayoutSummary | null>(null)

  const { data: layouts = [], isLoading, isError, error, refetch: refetchLayouts } = useQuery({
    queryKey: spatialQueryKeys.layouts(includeArchived),
    queryFn: () => listSpatialLayouts(includeArchived),
  })
  const {
    data: rooms = [],
    isLoading: isRoomsLoading,
    isError: isRoomsError,
    error: roomsError,
    refetch: refetchRooms,
  } = useQuery({
    queryKey: spatialQueryKeys.rooms('', false),
    queryFn: () => listSpatialRooms('', false),
    enabled: canCreate,
  })

  const invalidateLayoutAvailability = () => {
    client.invalidateQueries({ queryKey: ['cmdb', 'spatial', 'layouts'] })
    client.invalidateQueries({ queryKey: ['cmdb', 'spatial', 'rooms'] })
  }

  const create = useMutation({
    mutationFn: () => createSpatialLayout(
      Number(roomId),
      `${rooms.find((room) => room.roomInstanceId === Number(roomId))?.name || '机房'}逻辑布局`,
    ),
    onSuccess: (layout) => {
      invalidateLayoutAvailability()
      router.push(`/cmdb/spatial/rooms/${layout.roomInstanceId}/edit`)
    },
  })
  const handleCreateDialogOpenChange = (open: boolean) => {
    if (create.isPending) return
    setShowCreate(open)
    if (!open) {
      setRoomId('')
      create.reset()
    }
  }
  const archive = useMutation({
    mutationFn: (layoutId: number) => archiveSpatialLayout(layoutId),
    onSuccess: () => {
      setArchiving(null)
      invalidateLayoutAvailability()
    },
  })
  const restore = useMutation({
    mutationFn: (layoutId: number) => restoreActiveSpatialLayout(layoutId),
    onSuccess: () => {
      setRestoring(null)
      invalidateLayoutAvailability()
    },
  })

  const visible = useMemo(
    () => layouts.filter(
      (layout) => layout.status === (includeArchived ? 'ARCHIVED' : 'ACTIVE')
        && layout.name.includes(keyword),
    ),
    [includeArchived, keyword, layouts],
  )
  const availableRooms = rooms.filter((room) => !room.configured)
  const modeLabel = includeArchived ? '已归档' : '活动'

  return (
    <>
      <DataManagementPage className="cwgsyw-cmdb-page cwgsyw-cmdb-spatial-index"
        header={
          <div className="cwgsyw-cmdb-instance-page">
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="空间布局"
            subtitle={`${modeLabel}布局 ${visible.length} 个 · 机房与机柜位置`}
            actions={canCreate && !includeArchived ? (
              <Button className="cwgsyw-cmdb-spatial-index__create-trigger" type="button" size="sm" onClick={() => setShowCreate(true)}>新建布局</Button>
            ) : undefined}
          />
          </div>
        }
        toolbar={
          <div className="cwgsyw-cmdb-spatial-index__toolbar">
            <SearchInput
              size="sm"
              aria-label="搜索布局名称"
              placeholder="搜索布局名称"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onClear={() => setKeyword('')}
            />
            <div className="cwgsyw-cmdb-spatial-index__mode" aria-label="布局状态">
              <Tabs
                style="cmdb"
                size="sm"
                value={includeArchived ? 'archived' : 'active'}
                onChange={(id) => setIncludeArchived(id === 'archived')}
                items={[
                  { id: 'active', label: '活动', panel: null },
                  { id: 'archived', label: '已归档', panel: null },
                ]}
              />
            </div>
          </div>
        }
        content={
          isLoading ? (
            <div className="cwgsyw-cmdb-spatial-index__state">
              <LoadingState label="正在加载空间布局" />
            </div>
          ) : isError ? (
            <div className="cwgsyw-cmdb-spatial-index__state">
              <ErrorState
                title="空间布局加载失败"
                description={getApiErrorMessage(error, '空间布局加载失败')}
                retry={<Button type="button" size="sm" variant="secondary" onClick={() => void refetchLayouts()}>重试</Button>}
              />
            </div>
          ) : visible.length ? (
            <div className="cwgsyw-cmdb-spatial-index__grid">
              {visible.map((layout) => (
                <Card
                  key={layout.layoutId}
                  title={layout.name}
                  description={`机房 #${layout.roomInstanceId}`}
                  padding="sm"
                  headerAction={
                    <StatusBadge
                      label={layout.status === 'ARCHIVED' ? '已归档' : layout.publishedVersionId ? '已发布' : '草稿未发布'}
                      status={layout.status === 'ARCHIVED' ? 'neutral' : layout.publishedVersionId ? 'success' : 'warning'}
                      size="sm"
                    />
                  }
                  footer={layout.status === 'ACTIVE' || canPublish ? (
                    <div className="cwgsyw-cmdb-spatial-index__actions">
                      {layout.status === 'ACTIVE' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => router.push(`/cmdb/spatial/rooms/${layout.roomInstanceId}`)}
                        >
                          打开布局
                        </Button>
                      ) : <span />}
                      {canPublish ? (
                        layout.status === 'ACTIVE' ? (
                          <NeutralTooltip content="归档" className="cwgsyw-tooltip--pill" followCursor>
                            <IconButton
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="cwgsyw-cmdb-spatial-index__archive-action"
                              icon={<span className="cwgsyw-cmdb-spatial-index__archive-icon" aria-hidden="true" />}
                              aria-label={`归档${layout.name}`}
                              onClick={() => setArchiving(layout)}
                            />
                          </NeutralTooltip>
                        ) : (
                          <Button type="button" size="sm" variant="ghost" onClick={() => setRestoring(layout)}>恢复</Button>
                        )
                      ) : null}
                    </div>
                  ) : null}
                >
                  {layout.updatedAt ? (
                    <time className="cwgsyw-cmdb-spatial-index__updated" dateTime={layout.updatedAt}>
                      更新于 {layout.updatedAt.replace('T', ' ').slice(0, 16)}
                    </time>
                  ) : null}
                </Card>
              ))}
            </div>
          ) : (
            <div className="cwgsyw-cmdb-spatial-index__state">
              <EmptyState
                title={keyword ? '没有匹配的空间布局' : includeArchived ? '暂无已归档布局' : '暂无空间布局'}
                description={keyword ? '请调整搜索关键词后重试。' : includeArchived ? '归档后的空间布局会保留在这里。' : '点击右上角新建布局，为机房创建二维空间视图。'}
                action={canCreate && !includeArchived && !keyword ? <Button type="button" size="sm" variant="secondary" onClick={() => setShowCreate(true)}>创建首个布局</Button> : undefined}
              />
            </div>
          )
        }
      />

      <NeutralDialog
        open={showCreate}
        onOpenChange={handleCreateDialogOpenChange}
        title="新建机房布局"
        description="选择一个尚未配置布局的机房，系统会创建空草稿。"
        size="sm"
        footer={
          <div className="cwgsyw-inline-controls cwgsyw-cmdb-spatial-index__create-dialog-actions">
            <Button type="button" size="sm" variant="secondary" disabled={create.isPending} onClick={() => handleCreateDialogOpenChange(false)}>取消</Button>
            <Button type="button" size="sm" disabled={!roomId || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? '创建中…' : '创建并编辑'}
            </Button>
          </div>
        }
      >
        <div className="cwgsyw-cmdb-spatial-index__create-dialog-form">
          <Field label="机房">
            <Select size="sm" overlay
              value={roomId}
              placeholder={isRoomsLoading ? '正在加载机房' : availableRooms.length ? '选择机房' : '暂无可配置机房'}
              loading={isRoomsLoading}
              disabled={isRoomsError || !availableRooms.length}
              options={availableRooms.map((room) => ({ value: String(room.roomInstanceId), label: room.name }))}
              onChange={setRoomId}
            />
          </Field>
          {isRoomsError ? (
            <Alert
              tone="danger"
              title="机房列表加载失败"
              description={getApiErrorMessage(roomsError, '请稍后重试')}
              action={<Button type="button" size="sm" variant="secondary" onClick={() => void refetchRooms()}>重试</Button>}
              showDismiss={false}
            />
          ) : !isRoomsLoading && !availableRooms.length ? (
            <p className="cwgsyw-type-label-sm">所有可见机房均已有活动布局；请先归档不再使用的布局，或在 CMDB 创建机房 CI。</p>
          ) : null}
          {create.error ? <Alert tone="danger" title="创建失败" description={getApiErrorMessage(create.error, '创建失败')} showDismiss={false} /> : null}
        </div>
      </NeutralDialog>

      <NeutralAlertDialog
        open={Boolean(archiving)}
        onOpenChange={(open) => { if (!open && !archive.isPending) setArchiving(null) }}
        title="归档空间布局"
        description={archive.error
          ? `归档失败：${getApiErrorMessage(archive.error, '请稍后重试')}`
          : '归档后，该布局不再出现在活动机房列表中。已发布版本、历史记录和审计证据会保留，且不会删除任何 CI、关系或参考图。'}
        intent="destructive"
        confirmLabel={archive.isPending ? '归档中...' : '确认归档'}
        onConfirm={() => archiving && archive.mutate(archiving.layoutId)}
      />
      <NeutralAlertDialog
        open={Boolean(restoring)}
        onOpenChange={(open) => { if (!open && !restore.isPending) setRestoring(null) }}
        title="恢复空间布局"
        description={restore.error
          ? `恢复失败：${getApiErrorMessage(restore.error, '请稍后重试')}`
          : '恢复后，该布局会重新成为机房的活动布局。若该机房已被其他活动布局占用，系统会拒绝恢复并保留当前归档状态。'}
        confirmLabel={restore.isPending ? '恢复中...' : '确认恢复'}
        onConfirm={() => restoring && restore.mutate(restoring.layoutId)}
      />
    </>
  )
}
