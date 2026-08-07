'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Building2, FilePlus2, Map, RotateCcw, Search } from 'lucide-react'
import { EmptyState, PageHeader, PageShell } from '@/components/shared'
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
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
} from '@/components/design-system'
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
    <PageShell width="full" density="comfortable">
      <PageHeader
        eyebrow="CMDB"
        title="空间布局"
        subtitle="机房、机柜与 CI 的二维位置视图。"
        actions={canCreate && !includeArchived ? (
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <FilePlus2 className="h-4 w-4" />
            新建布局
          </Button>
        ) : undefined}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" aria-label="布局状态筛选">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={includeArchived
              ? 'border-v2-border bg-v2-surface text-v2-muted hover:bg-v2-surface-hover'
              : 'border-v2-primary bg-v2-primary-soft text-v2-primary shadow-none hover:bg-v2-primary-soft'}
            onClick={() => setIncludeArchived(false)}
          >
            活动
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={includeArchived
              ? 'border-v2-primary bg-v2-primary-soft text-v2-primary shadow-none hover:bg-v2-primary-soft'
              : 'border-v2-border bg-v2-surface text-v2-muted hover:bg-v2-surface-hover'}
            onClick={() => setIncludeArchived(true)}
          >
            已归档
          </Button>
        </div>
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-v2-muted" />
          <Input
            className="pl-9"
            aria-label="搜索布局名称"
            placeholder="搜索布局名称"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <Card className="py-24 text-center text-sm text-v2-muted">正在加载空间布局...</Card>
      ) : isError ? (
        <Card className="py-24 text-center text-sm text-v2-danger">
          {getApiErrorMessage(error, '空间布局加载失败')}
        </Card>
      ) : visible.length ? (
        <div className="space-y-3">
          {visible.map((layout) => (
            <Card key={layout.layoutId} data-layout-id={layout.layoutId} className="flex p-4" hover>
              {layout.status === 'ACTIVE' ? (
                <Link href={`/cmdb/spatial/rooms/${layout.roomInstanceId}`} className="min-w-0 flex-1">
                  <LayoutSummary layout={layout} />
                </Link>
              ) : (
                <div className="min-w-0 flex-1">
                  <LayoutSummary layout={layout} />
                </div>
              )}
              {canPublish && (
                <div className="ml-3 shrink-0">
                  {layout.status === 'ACTIVE' ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      title={`归档 ${layout.name}`}
                      aria-label={`归档 ${layout.name}`}
                      onClick={() => setArchiving(layout)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      title={`恢复 ${layout.name}`}
                      aria-label={`恢复 ${layout.name}`}
                      onClick={() => setRestoring(layout)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Building2 className="h-5 w-5 text-v2-muted" />}
            title={includeArchived ? '暂无已归档布局' : '暂无空间布局'}
            description={includeArchived
              ? '归档后的空间布局会保留在这里。'
              : '点击右上角新建布局，为机房创建二维空间视图。'}
            action={canCreate && !includeArchived ? (
              <Button variant="secondary" onClick={() => setShowCreate(true)}>
                创建首个布局
              </Button>
            ) : undefined}
          />
        </Card>
      )}

      <Dialog open={showCreate} onOpenChange={(open) => !create.isPending && setShowCreate(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建机房布局</DialogTitle>
            <DialogDescription>选择一个尚未配置布局的机房，系统会创建空草稿。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>机房</Label>
            <Select value={roomId || null} onValueChange={(value) => setRoomId(value ?? '')}>
              <SelectTrigger className="w-full" disabled={!availableRooms.length}>
                <SelectValue placeholder={availableRooms.length ? '选择机房' : '暂无可配置机房'}>
                  {(value: string) => availableRooms.find(
                    (room) => String(room.roomInstanceId) === value,
                  )?.name ?? '选择机房'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableRooms.map((room) => (
                  <SelectItem key={room.roomInstanceId} value={String(room.roomInstanceId)}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!availableRooms.length && (
              <p className="text-sm text-v2-muted">
                所有可见机房均已有活动布局；请先归档不再使用的布局，或在 CMDB 创建机房 CI。
              </p>
            )}
            {create.error && (
              <p className="text-sm text-v2-danger">{getApiErrorMessage(create.error, '创建失败')}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" disabled={create.isPending} onClick={() => setShowCreate(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              disabled={!roomId || create.isPending}
              loading={create.isPending}
              onClick={() => create.mutate()}
            >
              创建并编辑
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(archiving)}
        onOpenChange={(open) => !open && !archive.isPending && setArchiving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>归档空间布局</AlertDialogTitle>
            <AlertDialogDescription>
              归档后，该布局不再出现在活动机房列表中。已发布版本、历史记录和审计证据会保留，且不会删除任何 CI、关系或参考图。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {archive.error && (
            <p className="text-sm text-v2-danger">{getApiErrorMessage(archive.error, '归档失败')}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archive.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!archiving || archive.isPending}
              onClick={() => archiving && archive.mutate(archiving.layoutId)}
            >
              {archive.isPending ? '归档中...' : '确认归档'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(restoring)}
        onOpenChange={(open) => !open && !restore.isPending && setRestoring(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>恢复空间布局</AlertDialogTitle>
            <AlertDialogDescription>
              恢复后，该布局会重新成为机房的活动布局。若该机房已被其他活动布局占用，系统会拒绝恢复并保留当前归档状态。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {restore.error && (
            <p className="text-sm text-v2-danger">{getApiErrorMessage(restore.error, '恢复失败')}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restore.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={!restoring || restore.isPending}
              onClick={() => restoring && restore.mutate(restoring.layoutId)}
            >
              {restore.isPending ? '恢复中...' : '确认恢复'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  )
}

function LayoutSummary({ layout }: { layout: SpatialLayoutSummary }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-v2-md bg-v2-primary-soft p-2 text-v2-primary">
        <Map className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold text-v2-fg">{layout.name}</span>
          <StatusBadge status={layout.status === 'ARCHIVED' ? 'neutral' : layout.publishedVersionId ? 'ok' : 'warn'}>
            {layout.status === 'ARCHIVED' ? '已归档' : layout.publishedVersionId ? '已发布' : '草稿未发布'}
          </StatusBadge>
        </div>
        <p className="mt-1 text-sm text-v2-muted">机房 #{layout.roomInstanceId}</p>
      </div>
    </div>
  )
}
