'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  DataManagementPage,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  Input,
  LoadingState,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

interface AuditLogVO {
  id: number
  module: string
  action: string
  targetId: number
  targetType: string
  operatorId: number
  operatorName: string
  operatorIp: string
  beforeJson: string | null
  afterJson: string | null
  remark: string
  createdAt: string
}

interface PageResult {
  records: AuditLogVO[]
  total: number
}

const MODULE_LABELS: Record<string, string> = {
  device: '设备密码库',
  change_doc: '变更文档',
  sys_config: '系统配置',
  user: '用户管理',
  group: '组管理',
  backup: '备份与恢复',
  shared_file: '共享文档',
}

const ACTION_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  create: 'success',
  update: 'warning',
  delete: 'danger',
  approve: 'success',
  reject: 'danger',
  view_password: 'neutral',
  submit: 'success',
  ai_generate: 'neutral',
}

const PAGE_SIZE = 20

function snapshotSummary(snapshot: string | null): string {
  if (!snapshot) return '—'
  try {
    return JSON.stringify(JSON.parse(snapshot))
  } catch {
    return '快照格式无效'
  }
}

export default function AuditLogPage() {
  return (
    <Suspense fallback={<LoadingState label="正在加载审计日志…" />}>
      <AuditLogPageInner />
    </Suspense>
  )
}

function AuditLogPageInner() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('audit', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const [module, setModule] = useState(searchParams.get('module') ?? '')
  const [action, setAction] = useState('')
  const [operatorId, setOperatorId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, isError, refetch } = useQuery<PageResult>({
    queryKey: ['audit-logs', module, action, operatorId, keyword, startDate, endDate, page],
    queryFn: () => {
      const params: Record<string, string | number> = { page, size: PAGE_SIZE }
      if (module) params.module = module
      if (action) params.action = action
      if (operatorId) params.operatorId = Number(operatorId)
      if (keyword) params.keyword = keyword
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      return api.get('/audit-logs', { params }).then((response) => response.data.data)
    },
    enabled: isHydrated && hasPermission('audit', 'read'),
  })

  const records = data?.records ?? []
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))

  return (
    <DataManagementPage
      className="cwgsyw-audit"
      embedded
      header={
        <PageHeader
          eyebrow="系统管理"
          title="审计日志"
          subtitle="记录所有写操作的模块、动作、操作人与目标对象，支持按模块与时间范围筛选。"
          breadcrumb={<Breadcrumb items={[{ href: '/', label: '工作台' }, { label: '审计日志' }]} />}
        />
      }
      filter={
        <FilterBar
          filterItems={
            <>
              <Field htmlFor="audit-module" label="模块">
                <Select
                  value={module || '__all__'}
                  placeholder="全部模块"
                  options={[
                    { value: '__all__', label: '全部模块' },
                    ...Object.entries(MODULE_LABELS).map(([value, label]) => ({ value, label })),
                  ]}
                  onChange={(value) => {
                    setModule(value === '__all__' ? '' : value)
                    setPage(1)
                  }}
                />
              </Field>
              <Field htmlFor="audit-action" label="操作">
                <Input
                  value={action}
                  placeholder="如 create"
                  onChange={(event) => {
                    setAction(event.target.value)
                    setPage(1)
                  }}
                />
              </Field>
              <Field htmlFor="audit-operator" label="操作人 ID">
                <Input
                  type="number"
                  min="1"
                  value={operatorId}
                  placeholder="用户 ID"
                  onChange={(event) => {
                    setOperatorId(event.target.value)
                    setPage(1)
                  }}
                />
              </Field>
              <Field htmlFor="audit-keyword" label="关键词">
                <Input
                  value={keyword}
                  placeholder="备注或目标"
                  onChange={(event) => {
                    setKeyword(event.target.value)
                    setPage(1)
                  }}
                />
              </Field>
              <Field htmlFor="audit-start" label="开始日期">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value)
                    setPage(1)
                  }}
                />
              </Field>
              <Field htmlFor="audit-end" label="结束日期">
                <Input
                  type="date"
                  value={endDate}
                  onChange={(event) => {
                    setEndDate(event.target.value)
                    setPage(1)
                  }}
                />
              </Field>
            </>
          }
          reset={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setModule('')
                setAction('')
                setOperatorId('')
                setKeyword('')
                setStartDate('')
                setEndDate('')
                setPage(1)
              }}
            >
              重置
            </Button>
          }
        />
      }
      content={
        isError ? (
          <ErrorState
            title="审计日志加载失败"
            description="无法读取审计日志，请稍后重试。"
            retry={<Button type="button" variant="secondary" onClick={() => void refetch()}>重试</Button>}
          />
        ) : isLoading ? (
          <LoadingState label="正在加载审计日志…" />
        ) : records.length === 0 ? (
          <EmptyState title="暂无审计日志" description="当前筛选条件下没有操作记录。" />
        ) : (
          <div className="cwgsyw-form cwgsyw-audit__content">
            <Table
              className="cwgsyw-audit__table cwgsyw-cmdb-table"
              showSearch={false}
              columns={[
                { key: 'createdAt', label: '时间' },
                { key: 'module', label: '模块' },
                { key: 'action', label: '操作' },
                { key: 'operatorName', label: '操作人' },
                { key: 'target', label: '目标' },
                { key: 'remark', label: '备注' },
                { key: 'snapshot', label: '变更快照' },
                { key: 'operatorIp', label: 'IP' },
              ]}
              rows={records.map((record) => ({
                id: String(record.id),
                cells: {
                  createdAt: new Date(record.createdAt).toLocaleString('zh-CN'),
                  module: MODULE_LABELS[record.module] ?? record.module,
                  action: <StatusBadge label={record.action} status={ACTION_TONE[record.action] ?? 'neutral'} />,
                  operatorName: record.operatorName,
                  target: `${record.targetType}${record.targetId ? ` #${record.targetId}` : ''}`,
                  remark: record.remark,
                  snapshot: `前：${snapshotSummary(record.beforeJson)}；后：${snapshotSummary(record.afterJson)}`,
                  operatorIp: record.operatorIp,
                },
              }))}
            />
            {data ? <Pagination page={page} pageCount={pageCount} totalCount={data.total} onPageChange={setPage} /> : null}
          </div>
        )
      }
    />
  )
}
