'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { toast } from '@/design-system/figma-neutral/toast'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  Card,
  Tabs,
  DataManagementPage,
  EmptyState,
  ErrorState,
  LoadingState,
  NeutralAlertDialog,
  NeutralDrawer,
  PageHeader,
  Pagination,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

const BpmnViewer = dynamic(() => import('@/components/workflow/BpmnViewer'), {
  ssr: false,
  loading: () => <LoadingState label="加载流程图" />,
})

interface InstanceVO {
  id: string
  processDefinitionName: string
  processDefinitionKey: string
  businessKey: string
  startTime: string
  endTime: string | null
  ended: boolean
  suspended: boolean
}

interface ActivityVO {
  activityId: string
  activityName: string
  activityType: string
  startTime: string
  endTime: string | null
  assignee: string
}

function instanceStatus(inst: InstanceVO): { tone: 'success' | 'warning' | 'neutral'; label: string } {
  if (inst.suspended) return { tone: 'warning', label: '已挂起' }
  if (inst.ended) return { tone: 'success', label: '已完成' }
  return { tone: 'neutral', label: '运行中' }
}

function instanceName(inst: InstanceVO) {
  return inst.processDefinitionName || inst.processDefinitionKey || '未命名流程'
}

export default function InstancesPage() {
  const { hasPermission } = usePermission()
  const canConfigure = hasPermission('workflow', 'configure')
  const [tab, setTab] = useState<'running' | 'finished'>('running')
  const [page, setPage] = useState(1)
  const [selectedInstance, setSelectedInstance] = useState<InstanceVO | null>(null)
  const [activities, setActivities] = useState<ActivityVO[]>([])
  const [viewerXml, setViewerXml] = useState('')
  const [terminateId, setTerminateId] = useState<string | null>(null)

  const queryKey = tab === 'running' ? 'instances-running' : 'instances-finished'
  const endpoint = tab === 'running' ? '/workflow/instances/running' : '/workflow/instances/finished'

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [queryKey, page],
    queryFn: () =>
      api.get(endpoint, { params: { page, size: 20 } }).then((r) => ({
        records: (r.data.data?.records ?? []) as InstanceVO[],
        total: r.data.data?.total ?? 0,
      })),
  })

  const instances = data?.records ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 20))

  const handleView = async (inst: InstanceVO) => {
    setSelectedInstance(inst)
    try {
      const [detailRes, activityRes] = await Promise.all([
        api.get('/workflow/definitions').then((r) => {
          const defs = r.data.data?.records ?? []
          const match = defs.find((d: { key: string; name?: string }) => d.key === inst.processDefinitionKey)
          if (match) return api.get(`/workflow/definitions/${match.id}`)
          return null
        }),
        api.get(`/workflow/instances/${inst.id}/activities`),
      ])
      if (detailRes) setViewerXml(detailRes.data.data?.xml ?? '')
      setActivities((activityRes.data.data ?? []) as ActivityVO[])
    } catch {
      toast.error('获取流程详情失败')
    }
  }

  const handleSuspend = async (id: string) => {
    try {
      await api.put(`/workflow/instances/${id}/suspend`)
      toast.success('已挂起')
      refetch()
    } catch {
      toast.error('操作失败')
    }
  }

  const handleActivate = async (id: string) => {
    try {
      await api.put(`/workflow/instances/${id}/activate`)
      toast.success('已激活')
      refetch()
    } catch {
      toast.error('操作失败')
    }
  }

  const handleTerminate = async () => {
    if (!terminateId) return
    try {
      await api.delete(`/workflow/instances/${terminateId}`)
      toast.success('已终止')
      setTerminateId(null)
      refetch()
    } catch {
      toast.error('操作失败')
      setTerminateId(null)
    }
  }

  const completedIds = activities.filter((a) => a.endTime).map((a) => a.activityId)
  const currentIds = activities.filter((a) => !a.endTime).map((a) => a.activityId)
  const formatDate = (s: string) => new Date(s).toLocaleString('zh-CN')

  const columns = [
    { key: 'name', label: '流程名称' },
    { key: 'business_key', label: '业务标识' },
    { key: 'start_time', label: '开始时间' },
    ...(tab === 'finished' ? [{ key: 'end_time', label: '结束时间' }] : []),
    { key: 'status', label: '状态' },
    { key: 'actions', label: '操作' },
  ]

  const rows = instances.map((r) => {
    const status = instanceStatus(r)
    const businessKey = r.businessKey || '-'
    return {
      id: r.id,
      selected: selectedInstance?.id === r.id,
      cells: {
        name: instanceName(r),
        business_key: (
          <span className="cwgsyw-workflow-instances__business-key" title={businessKey}>
            {businessKey}
          </span>
        ),
        start_time: formatDate(r.startTime),
        end_time: r.endTime ? formatDate(r.endTime) : '-',
        status: <StatusBadge size="sm" label={status.label} status={status.tone} />,
        actions: (
          <div className="cwgsyw-workflow-instances__actions" onClick={(event) => event.stopPropagation()}>
            <Button type="button" variant="ghost" size="sm" onClick={() => handleView(r)}>
              查看
            </Button>
            {canConfigure && !r.ended ? (
              <>
                {r.suspended ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleActivate(r.id)}>
                    激活
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleSuspend(r.id)}>
                    挂起
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => setTerminateId(r.id)}>
                  终止
                </Button>
              </>
            ) : null}
          </div>
        ),
      },
    }
  })

  const tableState = isLoading ? 'loading' : instances.length === 0 ? 'empty' : 'data'

  return (
    <>
      <DataManagementPage
        embedded
        className="cwgsyw-workflow cwgsyw-workflow-instances"
        header={
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="流程实例"
            subtitle="查看和管理运行中的流程实例与已完成的历史记录，支持挂起、激活与终止。"
          />
        }
        toolbar={
          <div className="cwgsyw-workflow-instances__toolbar" aria-label="实例状态">
            <Tabs
              style="cmdb"
              size="sm"
              value={tab}
              onChange={(id) => {
                setTab(id as 'running' | 'finished')
                setPage(1)
              }}
              items={[
                { id: 'running', label: '运行中', panel: null },
                { id: 'finished', label: '已完成', panel: null },
              ]}
            />
          </div>
        }
        content={
          isError ? (
            <ErrorState
              title="流程实例加载失败"
              description="无法读取流程实例，请稍后重试。"
              retry={
                <Button type="button" variant="secondary" size="sm" onClick={() => refetch()}>
                  重试
                </Button>
              }
            />
          ) : (
            <>
              <Table
                className={`cwgsyw-cmdb-table cwgsyw-workflow-instances__table cwgsyw-workflow-instances__table--${tab}`}
                columns={columns}
                rows={rows}
                density="compact"
                showSearch={false}
                state={tableState}
                empty={
                  <div className="cwgsyw-workflow-empty">
                    {/* Official 20px Figma git-branch glyph; image optimization adds no value here. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/figma-icons/workflow-git-branch.svg"
                      width={22}
                      height={22}
                      alt=""
                      data-figma-node="6:26741"
                    />
                    <EmptyState
                      showIcon={false}
                      title={tab === 'running' ? '暂无运行中的流程实例' : '暂无已完成的流程实例'}
                      description="切换标签查看其他状态的流程实例。"
                    />
                  </div>
                }
              />
              <Pagination page={page} pageCount={pageCount} totalCount={total} onPageChange={setPage} />
            </>
          )
        }
      />

      <NeutralDrawer
        open={!!selectedInstance}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedInstance(null)
            setViewerXml('')
            setActivities([])
          }
        }}
        title={selectedInstance ? instanceName(selectedInstance) : '流程详情'}
        description={`Business Key: ${selectedInstance?.businessKey || '-'} · ID: ${selectedInstance?.id ?? ''}`}
      >
        {viewerXml ? (
          <div className="cwgsyw-form">
            <div className="cwgsyw-type-label-sm">流程进度</div>
            <BpmnViewer xml={viewerXml} completedActivities={completedIds} currentActivities={currentIds} />
            <div className="cwgsyw-inline-controls">
              <StatusBadge size="sm" label="已完成" status="success" />
              <StatusBadge size="sm" label="当前" status="info" />
            </div>
          </div>
        ) : (
          <EmptyState title="暂无流程图数据" description="未能读取该实例对应的流程定义 XML。" />
        )}
        {activities.length > 0 ? (
          <div className="cwgsyw-form">
            <div className="cwgsyw-type-label-sm">活动历史</div>
            {activities.map((a, i) => (
              <Card key={`${a.activityId}-${i}`} showHeader={false} padding="sm">
                <StatusBadge size="sm" label={a.endTime ? '已完成' : '进行中'} status={a.endTime ? 'success' : 'neutral'} />
                <div className="cwgsyw-type-body-sm">{a.activityName}</div>
                {a.assignee ? <div className="cwgsyw-type-label-xs">负责人: {a.assignee}</div> : null}
              </Card>
            ))}
          </div>
        ) : null}
      </NeutralDrawer>

      <NeutralAlertDialog
        open={!!terminateId}
        onOpenChange={(open) => !open && setTerminateId(null)}
        className="cwgsyw-cmdb-model-detail__delete-dialog"
        icon={<img src="/figma-icons/cmdb-model-alert.svg" alt="" width={56} height={56} />}
        title="确认终止"
        description="确定要终止此流程实例吗？"
        intent="destructive"
        confirmLabel="终止"
        onConfirm={handleTerminate}
      />
    </>
  )
}
