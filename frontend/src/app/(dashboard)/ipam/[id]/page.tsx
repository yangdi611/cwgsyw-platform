'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { getApiErrorMessage, isAxiosError } from '@/lib/api-error'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { useBreadcrumbLabel } from '@/hooks/useBreadcrumbLabel'
import { usePermission } from '@/hooks/usePermission'
import { toast } from '@/design-system/figma-neutral/toast'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  DetailDrawerPage,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  LoadingState,
  NeutralAlertDialog,
  NeutralDialog,
  NeutralTooltip,
  PageHeader,
  Progress,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

interface IpAllocationVO {
  id: number
  poolId: number
  ipAddress: string
  status: string
  ciInstanceId: number | null
  ciInstanceName: string | null
  description: string | null
  allocatedBy: number | null
  allocatedByName: string | null
  allocatedAt: string | null
  releasedAt: string | null
}

interface IpPoolDetailVO {
  id: number
  name: string
  description: string
  cidr: string
  gateway: string
  dns: string
  status: string
  totalCount: number
  allocatedCount: number
  utilizationPercent: number
  createdAt: string
  updatedAt: string
  allocations: IpAllocationVO[]
}

function poolStatusMeta(status: string): { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string } {
  if (status === 'active') return { tone: 'success', label: '活跃' }
  if (status === 'full') return { tone: 'danger', label: '已满' }
  if (status === 'disabled') return { tone: 'neutral', label: '已禁用' }
  return { tone: 'neutral', label: status || '未知' }
}

function allocStatusMeta(status: string): { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string } {
  if (status === 'allocated') return { tone: 'success', label: '已分配' }
  if (status === 'released') return { tone: 'neutral', label: '已释放' }
  return { tone: 'neutral', label: status || '未知' }
}

function utilizationTone(percent: number): 'success' | 'warning' | 'danger' {
  if (percent >= 90) return 'danger'
  if (percent >= 70) return 'warning'
  return 'success'
}

export default function IpamDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission, isHydrated } = usePermission()

  const [allocateOpen, setAllocateOpen] = useState(false)
  const [allocateForm, setAllocateForm] = useState({
    ipAddress: '',
    ciInstanceId: null as number | null,
    description: '',
  })
  const [releaseTarget, setReleaseTarget] = useState<IpAllocationVO | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '', gateway: '', dns: '' })

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('ip_pool', 'read')) router.replace('/')
  }, [hasPermission, isHydrated, router])

  const canRead = isHydrated && hasPermission('ip_pool', 'read')
  const { data: pool, isLoading, isError, error, refetch } = useQuery<IpPoolDetailVO, unknown>({
    queryKey: ['ip-pool', id],
    queryFn: () => api.get(`/ip-pools/${id}`).then((response) => response.data.data as IpPoolDetailVO),
    enabled: canRead,
    retry: (failureCount, err: unknown) => {
      if (isAxiosError(err) && [403, 404].includes(err.response?.status ?? 0)) return false
      return failureCount < 2
    },
  })

  useBreadcrumbLabel(pool?.name)

  const allocateMutation = useMutation({
    mutationFn: (body: typeof allocateForm) => api.post(`/ip-pools/${id}/allocate`, body),
    onSuccess: () => {
      toast.success('IP 已分配')
      queryClient.invalidateQueries({ queryKey: ['ip-pool', id] })
      queryClient.invalidateQueries({ queryKey: ['ip-pools'] })
      setAllocateOpen(false)
      setAllocateForm({ ipAddress: '', ciInstanceId: null, description: '' })
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, '分配失败')),
  })

  const releaseMutation = useMutation({
    mutationFn: (ipAddress: string) => api.post(`/ip-pools/${id}/release`, { ipAddress }),
    onSuccess: () => {
      toast.success('IP 已释放')
      queryClient.invalidateQueries({ queryKey: ['ip-pool', id] })
      queryClient.invalidateQueries({ queryKey: ['ip-pools'] })
      setReleaseTarget(null)
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, '释放失败')),
  })

  const updateMutation = useMutation({
    mutationFn: () => api.put(`/ip-pools/${id}`, editForm),
    onSuccess: () => {
      toast.success('地址池信息已更新')
      queryClient.invalidateQueries({ queryKey: ['ip-pool', id] })
      queryClient.invalidateQueries({ queryKey: ['ip-pools'] })
      setEditing(false)
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err, '更新失败')),
  })

  const startEdit = () => {
    if (!pool) return
    setEditForm({
      name: pool.name,
      description: pool.description || '',
      gateway: pool.gateway || '',
      dns: pool.dns || '',
    })
    setEditing(true)
  }

  const columns = useMemo(
    () => [
      { key: 'ipAddress', label: 'IP 地址' },
      { key: 'status', label: '状态' },
      { key: 'ciInstance', label: '关联 CI 实例' },
      { key: 'allocatedByName', label: '分配人' },
      { key: 'allocatedAt', label: '分配时间' },
      { key: 'description', label: '描述' },
      { key: 'actions', label: <span className="cwgsyw-sr-only">操作</span>, align: 'right' as const },
    ],
    [],
  )

  if (isLoading) return <LoadingState label="正在加载地址池…" />
  if (isError) {
    const status = isAxiosError(error) ? error.response?.status : undefined
    const message =
      status === 404
        ? '地址池不存在'
        : status === 403
          ? '你没有访问该地址池的权限'
          : `加载地址池失败：${getApiErrorMessage(error, '请稍后重试')}`
    return (
      <ErrorState
        title="地址池加载失败"
        description={message}
        retry={status !== 403 ? <Button type="button" variant="secondary" onClick={() => void refetch()}>重试</Button> : null}
      />
    )
  }
  if (!pool) return <ErrorState title="地址池不存在" description="无法找到该地址池。" showRetry={false} />

  const meta = poolStatusMeta(pool.status)
  const pct = pool.utilizationPercent
  const allocations = pool.allocations ?? []
  const rows = allocations.map((allocation) => {
    const allocationMeta = allocStatusMeta(allocation.status)
    return {
      id: String(allocation.id),
      cells: {
        ipAddress: <span className="cwgsyw-type-body-sm">{allocation.ipAddress}</span>,
        status: <StatusBadge label={allocationMeta.label} status={allocationMeta.tone} />,
        ciInstance: allocation.ciInstanceId ? (
          <Link href={`/cmdb/instances/by-model/host/${allocation.ciInstanceId}`}>
            {allocation.ciInstanceName ?? `实例 #${allocation.ciInstanceId}`}
          </Link>
        ) : (
          '-'
        ),
        allocatedByName: allocation.allocatedByName || '-',
        allocatedAt: allocation.allocatedAt ? new Date(allocation.allocatedAt).toLocaleString('zh-CN') : '-',
        description: allocation.description || '-',
        actions:
          allocation.status === 'allocated' ? (
            <PermissionGuard resource="ip_pool" action="update">
              <div className="cwgsyw-inline-controls cwgsyw-cmdb-admin__row-actions">
                <NeutralTooltip content="释放" className="cwgsyw-tooltip--pill" followCursor>
                  <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="cwgsyw-cmdb-admin__delete-action"
                    icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--trash" />}
                    aria-label={`释放 ${allocation.ipAddress}`}
                    onClick={() => setReleaseTarget(allocation)}
                  />
                </NeutralTooltip>
              </div>
            </PermissionGuard>
          ) : (
            '-'
          ),
      },
    }
  })

  return (
    <>
      <DetailDrawerPage
        embedded
        className="cwgsyw-ipam cwgsyw-ipam-detail"
        header={
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title={pool.name}
            subtitle={`${pool.cidr}${pool.description ? ` · ${pool.description}` : ''}`}
            status={<StatusBadge size="sm" label={meta.label} status={meta.tone} />}
            actions={
              <div className="cwgsyw-inline-controls">
                <PermissionGuard resource="ip_pool" action="update">
                  <NeutralTooltip content="编辑" className="cwgsyw-tooltip--pill" followCursor>
                    <IconButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--edit" />}
                      aria-label={`编辑 ${pool.name}`}
                      onClick={startEdit}
                    />
                  </NeutralTooltip>
                </PermissionGuard>
                <PermissionGuard resource="ip_pool" action="update">
                  <Button type="button" size="sm" onClick={() => setAllocateOpen(true)}>
                    分配 IP
                  </Button>
                </PermissionGuard>
              </div>
            }
          />
        }
        content={
          <div className="cwgsyw-form">
            {editing ? (
              <section className="cwgsyw-devices-panel">
                <header className="cwgsyw-devices-panel__head">编辑地址池信息</header>
                <div className="cwgsyw-devices-panel__body cwgsyw-form">
                  <p className="cwgsyw-devices-panel__hint">CIDR 与容量由地址池定义决定，这里只改名称、网关、DNS 和描述。</p>
                  <Field htmlFor="pool-name" label="名称" required>
                    <Input
                      id="pool-name"
                      size="sm"
                      value={editForm.name}
                      onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                    />
                  </Field>
                  <Field htmlFor="pool-gateway" label="网关">
                    <Input
                      id="pool-gateway"
                      size="sm"
                      value={editForm.gateway}
                      onChange={(event) => setEditForm((current) => ({ ...current, gateway: event.target.value }))}
                    />
                  </Field>
                  <Field htmlFor="pool-dns" label="DNS">
                    <Input
                      id="pool-dns"
                      size="sm"
                      value={editForm.dns}
                      onChange={(event) => setEditForm((current) => ({ ...current, dns: event.target.value }))}
                    />
                  </Field>
                  <Field htmlFor="pool-description" label="描述">
                    <Input
                      id="pool-description"
                      size="sm"
                      value={editForm.description}
                      onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
                    />
                  </Field>
                  <div className="cwgsyw-inline-controls">
                    <Button type="button" variant="primary" size="sm" loading={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                      保存
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                      取消
                    </Button>
                  </div>
                </div>
              </section>
            ) : null}

            {!editing ? (
              <section className="cwgsyw-devices-panel">
                <header className="cwgsyw-devices-panel__head">地址池摘要</header>
                <div className="cwgsyw-devices-panel__body">
                  <dl className="cwgsyw-devices-defs">
                    <div>
                      <dt>CIDR</dt>
                      <dd>{pool.cidr}</dd>
                    </div>
                    <div>
                      <dt>网关</dt>
                      <dd>{pool.gateway || '-'}</dd>
                    </div>
                    <div>
                      <dt>DNS</dt>
                      <dd>{pool.dns || '-'}</dd>
                    </div>
                    {pool.description ? (
                      <div>
                        <dt>描述</dt>
                        <dd>{pool.description}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <div className="cwgsyw-ipam-detail__usage">
                    <span className="cwgsyw-ipam-detail__usage-label">使用率</span>
                    <Progress
                      value={pct}
                      label={`${pool.allocatedCount} / ${pool.totalCount}`}
                      showLabel
                      showPercentage
                      size="sm"
                      tone={utilizationTone(pct)}
                    />
                  </div>
                </div>
              </section>
            ) : null}

            <section className="cwgsyw-devices-panel">
              <header className="cwgsyw-devices-panel__head">IP 分配记录</header>
              <div className="cwgsyw-devices-panel__body">
              <Table
                className="cwgsyw-cmdb-table cwgsyw-ipam__table"
                columns={columns}
                rows={rows}
                density="compact"
                showSearch={false}
                state={allocations.length === 0 ? 'empty' : 'data'}
                empty={
                  <div className="cwgsyw-neutral-empty">
                    {/* Official 22px Figma network glyph; image optimization adds no value here. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/figma-icons/ipam-network.svg" width={22} height={22} alt="" data-figma-node="6:28340" />
                    <EmptyState showIcon={false} title="暂无分配记录" description="点击右上角「分配 IP」分配第一个地址。" />
                  </div>
                }
              />
              </div>
            </section>
          </div>
        }
      />

      <NeutralDialog
        open={allocateOpen}
        onOpenChange={(open) => {
          if (!open) setAllocateOpen(false)
        }}
        title="分配 IP"
        size="sm"
        description="填写指定地址，或留空后由系统分配下一个可用 IP。"
        showClose={false}
        footer={
          <div className="cwgsyw-form__actions">
            <Button type="button" variant="secondary" size="sm" onClick={() => setAllocateOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={allocateMutation.isPending}
              onClick={() => allocateMutation.mutate(allocateForm)}
            >
              {allocateMutation.isPending ? '分配中…' : '确认分配'}
            </Button>
          </div>
        }
      >
        <div className="cwgsyw-form">
          <Field htmlFor="allocate-ip" label="IP 地址" helperText="留空则自动分配下一个可用 IP">
            <Input
              id="allocate-ip"
              size="sm"
              value={allocateForm.ipAddress}
              placeholder="留空则自动分配"
              onChange={(event) => setAllocateForm((current) => ({ ...current, ipAddress: event.target.value }))}
            />
          </Field>
          <Field htmlFor="allocate-description" label="描述">
            <Input
              id="allocate-description"
              size="sm"
              value={allocateForm.description}
              placeholder="备注用途"
              onChange={(event) => setAllocateForm((current) => ({ ...current, description: event.target.value }))}
            />
          </Field>
        </div>
      </NeutralDialog>

      <NeutralAlertDialog
        open={!!releaseTarget}
        title="确认释放 IP"
        description={
          releaseTarget
            ? `确定要释放 IP ${releaseTarget.ipAddress} 吗？${releaseTarget.ciInstanceName ? `（关联实例：${releaseTarget.ciInstanceName}）` : ''}`
            : '确定要释放该 IP 吗？'
        }
        intent="destructive"
        confirmLabel={releaseMutation.isPending ? '释放中…' : '确认释放'}
        onConfirm={() => releaseTarget && releaseMutation.mutate(releaseTarget.ipAddress)}
        onOpenChange={(open) => {
          if (!open) setReleaseTarget(null)
        }}
      />
    </>
  )
}
