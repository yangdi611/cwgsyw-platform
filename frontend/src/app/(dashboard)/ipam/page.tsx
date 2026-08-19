'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { getApiErrorMessage } from '@/lib/api-error'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  DataManagementPage,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  IconButton,
  Input,
  LoadingState,
  NeutralAlertDialog,
  NeutralDialog,
  NeutralTooltip,
  PageHeader,
  Pagination,
  Progress,
  SearchInput,
  Select,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

interface IpPoolVO {
  id: number
  groupId: number
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
}

interface Group {
  id: number
  name: string
}

function poolStatusMeta(status: string): { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string } {
  if (status === 'active') return { tone: 'success', label: '活跃' }
  if (status === 'full') return { tone: 'danger', label: '已满' }
  if (status === 'disabled') return { tone: 'neutral', label: '已禁用' }
  return { tone: 'neutral', label: status || '未知' }
}

export default function IpamPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const userGroupId = useAuthStore((state) => state.groupId)
  const userGroupScope = useAuthStore((state) => state.groupScope)
  const queryClient = useQueryClient()

  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const size = 20

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    cidr: '',
    gateway: '',
    dns: '',
    description: '',
    groupId: '',
  })
  const [deleteTarget, setDeleteTarget] = useState<IpPoolVO | null>(null)
  const needsGroupSelect = userGroupScope !== 'group'
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then((response) => response.data.data?.records ?? response.data.data ?? []),
    enabled: createOpen && needsGroupSelect,
  })

  useEffect(() => {
    if (!hasPermission('ip_pool', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ip-pools', keyword, status, page],
    queryFn: () =>
      api
        .get('/ip-pools', {
          params: { keyword: keyword || undefined, status: status || undefined, page, size },
        })
        .then((response) => response.data.data),
    enabled: hasPermission('ip_pool', 'read'),
  })

  const pools = (data?.records ?? []) as IpPoolVO[]
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / size) || 1)

  const createMutation = useMutation({
    mutationFn: (body: typeof createForm) => api.post('/ip-pools', { ...body, groupId: Number(body.groupId) }).then((response) => response.data),
    onSuccess: () => {
      toast.success('地址池已创建')
      queryClient.invalidateQueries({ queryKey: ['ip-pools'] })
      setCreateOpen(false)
      setCreateForm({ name: '', cidr: '', gateway: '', dns: '', description: '', groupId: '' })
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '创建失败')),
  })

  const deleteMutation = useMutation({
    mutationFn: (poolId: number) => api.delete(`/ip-pools/${poolId}`),
    onSuccess: () => {
      toast.success('地址池已删除')
      queryClient.invalidateQueries({ queryKey: ['ip-pools'] })
      setDeleteTarget(null)
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, '删除失败')),
  })

  const handleCreate = () => {
    if (!createForm.name.trim()) {
      toast.error('请填写地址池名称')
      return
    }
    if (!createForm.cidr.trim()) {
      toast.error('请填写 CIDR')
      return
    }
    if (!userGroupId && !createForm.groupId) {
      toast.error('请选择地址池归属组')
      return
    }
    createMutation.mutate({ ...createForm, groupId: String(userGroupId ?? createForm.groupId) })
  }

  const columns = useMemo(
    () => [
      { key: 'name', label: '名称' },
      { key: 'cidr', label: 'CIDR' },
      { key: 'gateway', label: '网关' },
      { key: 'utilization', label: '使用率' },
      { key: 'status', label: '状态' },
      { key: 'actions', label: <span className="cwgsyw-sr-only">操作</span>, align: 'right' as const },
    ],
    [],
  )

  const rows = pools.map((pool) => {
    const meta = poolStatusMeta(pool.status)
    const utilizationTone = pool.utilizationPercent >= 90 ? 'danger' : pool.utilizationPercent >= 70 ? 'warning' : 'success'
    return {
      id: String(pool.id),
      cells: {
        name: (
          <span className="cwgsyw-ipam__name-cell">
            <span className="cwgsyw-ipam__name">{pool.name}</span>
            {pool.description ? <span className="cwgsyw-ipam__desc">{pool.description}</span> : null}
          </span>
        ),
        cidr: pool.cidr,
        gateway: pool.gateway || '-',
        utilization: (
          <div>
            <Progress
              value={pool.utilizationPercent}
              label={`${pool.allocatedCount}/${pool.totalCount}`}
              showLabel
              showPercentage
              size="sm"
              tone={utilizationTone}
            />
          </div>
        ),
        status: <StatusBadge label={meta.label} status={meta.tone} />,
        actions: (
          <div className="cwgsyw-inline-controls cwgsyw-cmdb-admin__row-actions" onClick={(event) => event.stopPropagation()}>
            <NeutralTooltip content="详情" className="cwgsyw-tooltip--pill" followCursor>
              <IconButton
                type="button"
                size="sm"
                variant="ghost"
                icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--eye" />}
                aria-label={`查看 ${pool.name}`}
                onClick={() => router.push(`/ipam/${pool.id}`)}
              />
            </NeutralTooltip>
            <PermissionGuard resource="ip_pool" action="delete">
              <NeutralTooltip content="删除" className="cwgsyw-tooltip--pill" followCursor>
                <IconButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="cwgsyw-cmdb-admin__delete-action"
                  icon={<span aria-hidden="true" className="cwgsyw-icon cwgsyw-icon--sm cwgsyw-cmdb-admin__figma-action-icon cwgsyw-cmdb-admin__figma-action-icon--trash" />}
                  aria-label={`删除 ${pool.name}`}
                  onClick={() => setDeleteTarget(pool)}
                />
              </NeutralTooltip>
            </PermissionGuard>
          </div>
        ),
      },
    }
  })

  const tableState = isLoading ? 'loading' : pools.length === 0 ? 'empty' : 'data'

  return (
    <>
      <DataManagementPage
        embedded
        className="cwgsyw-ipam"
        layout="default"
        header={
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="IP 地址池"
            subtitle="管理网络地址段、网关与 DNS，监控地址分配率与冲突状态。"
            actions={
              <PermissionGuard resource="ip_pool" action="create">
                <Button
                  className="cwgsyw-ipam__create"
                  type="button"
                  size="sm"
                  onClick={() => {
                    setCreateOpen(true)
                    setCreateForm({ name: '', cidr: '', gateway: '', dns: '', description: '', groupId: '' })
                  }}
                >
                  新建地址池
                </Button>
              </PermissionGuard>
            }
          />
        }
        filter={
          <FilterBar
            search={
              <SearchInput
                size="sm"
                value={keyword}
                placeholder="搜索名称、CIDR、描述…"
                aria-label="搜索地址池名称、CIDR 或描述"
                onChange={(event) => {
                  setKeyword(event.target.value)
                  setPage(1)
                }}
                onClear={() => {
                  setKeyword('')
                  setPage(1)
                }}
              />
            }
            filterItems={
              <Select
                overlay
                size="sm"
                aria-label="地址池状态"
                value={status || '__all__'}
                placeholder="全部状态"
                options={[
                  { value: '__all__', label: '全部状态' },
                  { value: 'active', label: '活跃' },
                  { value: 'disabled', label: '已禁用' },
                  { value: 'full', label: '已满' },
                ]}
                onChange={(value) => {
                  setStatus(value === '__all__' ? '' : value)
                  setPage(1)
                }}
              />
            }
          />
        }
        content={
          isError ? (
            <ErrorState
              title="地址池加载失败"
              description="无法读取 IP 地址池，请稍后重试。"
              retry={
                <Button type="button" variant="secondary" size="sm" onClick={() => refetch()}>
                  重试
                </Button>
              }
            />
          ) : (
            <>
              <Table
                className="cwgsyw-cmdb-table cwgsyw-ipam__table"
                columns={columns}
                rows={rows}
                density="compact"
                showSearch={false}
                state={tableState}
                onRowClick={(id) => router.push(`/ipam/${id}`)}
                loading={<LoadingState label="正在加载地址池…" />}
                empty={
                  <div className="cwgsyw-neutral-empty">
                    {/* Official 22px Figma network glyph; image optimization adds no value here. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/figma-icons/ipam-network.svg" width={22} height={22} alt="" data-figma-node="6:28340" />
                    <EmptyState showIcon={false} title="暂无地址池" description="点击右上角“新建地址池”添加第一个网段。" />
                  </div>
                }
              />
              <Pagination page={page} pageCount={pageCount} totalCount={total} onPageChange={setPage} />
            </>
          )
        }
      />

      <NeutralDialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) setCreateOpen(false)
        }}
        title="新建地址池"
        size="sm"
        showClose={false}
        footer={
          <div className="cwgsyw-form__actions">
            <Button type="button" variant="secondary" size="sm" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={createMutation.isPending}
              disabled={!createForm.name.trim() || !createForm.cidr.trim() || (needsGroupSelect && !createForm.groupId)}
              onClick={handleCreate}
            >
              {createMutation.isPending ? '创建中…' : '创建'}
            </Button>
          </div>
        }
      >
        <div className="cwgsyw-form">
          <Field htmlFor="pool-name" label="名称" required>
            <Input
              id="pool-name"
              size="sm"
              value={createForm.name}
              placeholder="例：生产网段 A"
              onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field htmlFor="pool-cidr" label="CIDR" required>
            <Input
              id="pool-cidr"
              size="sm"
              value={createForm.cidr}
              placeholder="例：192.168.1.0/24"
              onChange={(event) => setCreateForm((current) => ({ ...current, cidr: event.target.value }))}
            />
          </Field>
          {needsGroupSelect ? (
            <Field label="归属组" required>
              <Select
                size="sm"
                overlay
                value={createForm.groupId}
                placeholder="请选择归属组"
                options={groups.map((group) => ({ value: String(group.id), label: group.name }))}
                onChange={(value) => setCreateForm((current) => ({ ...current, groupId: value }))}
              />
            </Field>
          ) : null}
          <Field htmlFor="pool-gateway" label="网关">
            <Input
              id="pool-gateway"
              size="sm"
              value={createForm.gateway}
              placeholder="192.168.1.1"
              onChange={(event) => setCreateForm((current) => ({ ...current, gateway: event.target.value }))}
            />
          </Field>
          <Field htmlFor="pool-dns" label="DNS">
            <Input
              id="pool-dns"
              size="sm"
              value={createForm.dns}
              placeholder="8.8.8.8"
              onChange={(event) => setCreateForm((current) => ({ ...current, dns: event.target.value }))}
            />
          </Field>
          <Field htmlFor="pool-description" label="描述">
            <Input
              id="pool-description"
              size="sm"
              value={createForm.description}
              onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
            />
          </Field>
        </div>
      </NeutralDialog>

      <NeutralAlertDialog
        open={!!deleteTarget}
        title="确认删除"
        description={`确定要删除地址池「${deleteTarget?.name ?? ''}」（${deleteTarget?.cidr ?? ''}）吗？地址池中已分配的 IP 需要先释放。`}
        intent="destructive"
        confirmLabel={deleteMutation.isPending ? '删除中…' : '确认删除'}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      />
    </>
  )
}
