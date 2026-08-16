'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
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
  Breadcrumb,
  Button,
  Card,
  Chip,
  DataManagementPage,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  NeutralAlertDialog,
  NeutralDialog,
  PageHeader,
  SearchInput,
  Select,
  StatusBadge,
} from '@/design-system/figma-neutral/components'

interface SpatialLayoutIndexProps {
  canCreate: boolean
  canPublish: boolean
}

export function SpatialLayoutIndex({ canCreate, canPublish }: SpatialLayoutIndexProps) {
  const client = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [roomId, setRoomId] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [archiving, setArchiving] = useState<SpatialLayoutSummary | null>(null)
  const [restoring, setRestoring] = useState<SpatialLayoutSummary | null>(null)

  const { data: layouts = [], isLoading, isError, error } = useQuery({
    queryKey: spatialQueryKeys.layouts(includeArchived),
    queryFn: () => listSpatialLayouts(includeArchived),
  })
  const { data: rooms = [] } = useQuery({
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
      window.location.assign(`/cmdb/spatial/rooms/${layout.roomInstanceId}/edit`)
    },
  })
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

  return (
    <>
      <DataManagementPage className="cwgsyw-cmdb-page"
        header={
          <div className="cwgsyw-cmdb-instance-page">
          <PageHeader
            showEyebrow={false}
            title="空间布局"
            subtitle="机房与机柜位置"
            breadcrumb={
              <Breadcrumb
                items={[
                  { href: '/', label: '工作台' },
                  { href: '/cmdb', label: 'CMDB' },
                  { label: '空间布局' },
                ]}
              />
            }
            actions={canCreate && !includeArchived ? (
              <Button type="button" onClick={() => setShowCreate(true)}>新建布局</Button>
            ) : undefined}
          />
          </div>
        }
        toolbar={
          <div className="cwgsyw-inline-controls">
            <Chip label="活动" selected={!includeArchived} onClick={() => setIncludeArchived(false)} />
            <Chip label="已归档" selected={includeArchived} onClick={() => setIncludeArchived(true)} />
            <SearchInput size="sm" aria-label="搜索布局名称" placeholder="搜索布局名称" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          </div>
        }
        content={
          isLoading ? (
            <LoadingState label="正在加载空间布局" />
          ) : isError ? (
            <ErrorState title="空间布局加载失败" description={getApiErrorMessage(error, '空间布局加载失败')} showRetry={false} />
          ) : visible.length ? (
            <div className="cwgsyw-stack-list cwgsyw-cmdb-choice-list">
              {visible.map((layout) => (
                <Card
                  key={layout.layoutId}
                  title={layout.name}
                  description={`机房 #${layout.roomInstanceId}`}
                  headerAction={
                    <StatusBadge
                      label={layout.status === 'ARCHIVED' ? '已归档' : layout.publishedVersionId ? '已发布' : '草稿未发布'}
                      status={layout.status === 'ARCHIVED' ? 'neutral' : layout.publishedVersionId ? 'success' : 'warning'}
                    />
                  }
                  footer={canPublish ? (
                    layout.status === 'ACTIVE' ? (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setArchiving(layout)}>归档</Button>
                    ) : (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setRestoring(layout)}>恢复</Button>
                    )
                  ) : null}
                >
                  {layout.status === 'ACTIVE' ? (
                    <Link href={`/cmdb/spatial/rooms/${layout.roomInstanceId}`} className="cwgsyw-type-label-sm">打开布局</Link>
                  ) : null}
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title={includeArchived ? '暂无已归档布局' : '暂无空间布局'}
              description={includeArchived ? '归档后的空间布局会保留在这里。' : '点击右上角新建布局，为机房创建二维空间视图。'}
              action={canCreate && !includeArchived ? <Button type="button" variant="secondary" onClick={() => setShowCreate(true)}>创建首个布局</Button> : undefined}
            />
          )
        }
      />

      <NeutralDialog
        open={showCreate}
        onOpenChange={(open) => { if (!create.isPending) setShowCreate(open) }}
        title="新建机房布局"
        description="选择一个尚未配置布局的机房，系统会创建空草稿。"
        footer={
          <div className="cwgsyw-inline-controls">
            <Button type="button" variant="secondary" disabled={create.isPending} onClick={() => setShowCreate(false)}>取消</Button>
            <Button type="button" disabled={!roomId || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? '创建中…' : '创建并编辑'}
            </Button>
          </div>
        }
      >
        <Field label="机房">
          <Select size="sm" overlay
            value={roomId}
            placeholder={availableRooms.length ? '选择机房' : '暂无可配置机房'}
            disabled={!availableRooms.length}
            options={availableRooms.map((room) => ({ value: String(room.roomInstanceId), label: room.name }))}
            onChange={setRoomId}
          />
        </Field>
        {!availableRooms.length ? <p className="cwgsyw-type-label-sm">所有可见机房均已有活动布局；请先归档不再使用的布局，或在 CMDB 创建机房 CI。</p> : null}
        {create.error ? <Alert tone="danger" title="创建失败" description={getApiErrorMessage(create.error, '创建失败')} showDismiss={false} /> : null}
      </NeutralDialog>

      <NeutralAlertDialog
        open={Boolean(archiving)}
        onOpenChange={(open) => { if (!open && !archive.isPending) setArchiving(null) }}
        title="归档空间布局"
        description="归档后，该布局不再出现在活动机房列表中。已发布版本、历史记录和审计证据会保留，且不会删除任何 CI、关系或参考图。"
        intent="destructive"
        confirmLabel={archive.isPending ? '归档中...' : '确认归档'}
        onConfirm={() => archiving && archive.mutate(archiving.layoutId)}
      />
      <NeutralAlertDialog
        open={Boolean(restoring)}
        onOpenChange={(open) => { if (!open && !restore.isPending) setRestoring(null) }}
        title="恢复空间布局"
        description="恢复后，该布局会重新成为机房的活动布局。若该机房已被其他活动布局占用，系统会拒绝恢复并保留当前归档状态。"
        confirmLabel={restore.isPending ? '恢复中...' : '确认恢复'}
        onConfirm={() => restoring && restore.mutate(restoring.layoutId)}
      />
    </>
  )
}
