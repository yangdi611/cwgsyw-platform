'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/v2/Button'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { Card } from '@/components/v2/Card'
import {
  PageHeader,
  FilterBar,
  FilterChip,
  DataTable,
  Pagination,
  type ColumnDef,
} from '@/components/shared'
import { toast } from 'sonner'

const BpmnViewer = dynamic(() => import('@/components/workflow/BpmnViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[300px] items-center justify-center rounded-v2-md border border-v2-border bg-v2-surface-soft text-v2-muted">
      加载流程图…
    </div>
  ),
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

function instanceStatus(inst: InstanceVO): { variant: 'ok' | 'warn' | 'neutral'; label: string } {
  if (inst.suspended) return { variant: 'warn', label: '已挂起' }
  if (inst.ended) return { variant: 'ok', label: '已完成' }
  return { variant: 'neutral', label: '运行中' }
}

export default function InstancesPage() {
  const { hasPermission } = usePermission()
  const canConfigure = hasPermission('workflow', 'configure')
  const [tab, setTab] = useState<'running' | 'finished'>('running')
  const [page, setPage] = useState(1)
  const [selectedInstance, setSelectedInstance] = useState<InstanceVO | null>(null)
  const [activities, setActivities] = useState<ActivityVO[]>([])
  const [viewerXml, setViewerXml] = useState('')

  const queryKey = tab === 'running' ? 'instances-running' : 'instances-finished'
  const endpoint = tab === 'running' ? '/workflow/instances/running' : '/workflow/instances/finished'

  const { data, isLoading, refetch } = useQuery({
    queryKey: [queryKey, page],
    queryFn: () =>
      api.get(endpoint, { params: { page, size: 20 } }).then((r) => ({
        records: (r.data.data?.records ?? []) as InstanceVO[],
        total: r.data.data?.total ?? 0,
      })),
  })

  const instances = data?.records ?? []
  const total = data?.total ?? 0

  const handleView = async (inst: InstanceVO) => {
    setSelectedInstance(inst)
    try {
      const [detailRes, activityRes] = await Promise.all([
        api.get('/workflow/definitions').then((r) => {
          const defs = r.data.data?.records ?? []
          const match = defs.find((d: any) => d.key === inst.processDefinitionKey)
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

  const handleTerminate = async (id: string) => {
    if (!confirm('确定要终止此流程实例吗？')) return
    try {
      await api.delete(`/workflow/instances/${id}`)
      toast.success('已终止')
      refetch()
    } catch {
      toast.error('操作失败')
    }
  }

  const completedIds = activities.filter((a) => a.endTime).map((a) => a.activityId)
  const currentIds = activities.filter((a) => !a.endTime).map((a) => a.activityId)

  const formatDate = (s: string) => new Date(s).toLocaleString('zh-CN')

  const columns: ColumnDef<InstanceVO>[] = [
    {
      key: 'name',
      title: '流程名称',
      render: (r) => <span className="font-medium text-v2-fg">{r.processDefinitionName}</span>,
    },
    {
      key: 'business_key',
      title: '业务标识',
      render: (r) => (
        <span className="font-v2-mono text-xs text-v2-muted">{r.businessKey || '-'}</span>
      ),
    },
    {
      key: 'start_time',
      title: '开始时间',
      render: (r) => (
        <span className="whitespace-nowrap text-sm text-v2-muted">{formatDate(r.startTime)}</span>
      ),
    },
    ...(tab === 'finished'
      ? [
          {
            key: 'end_time' as const,
            title: '结束时间',
            render: (r: InstanceVO) => (
              <span className="whitespace-nowrap text-sm text-v2-muted">
                {r.endTime ? formatDate(r.endTime) : '-'}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'status',
      title: '状态',
      render: (r) => {
        const m = instanceStatus(r)
        return <StatusBadge status={m.variant}>{m.label}</StatusBadge>
      },
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleView(r)}>
            查看
          </Button>
          {canConfigure && !r.ended && (
            <>
              {r.suspended ? (
                <Button variant="ghost" size="sm" onClick={() => handleActivate(r.id)}>
                  激活
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => handleSuspend(r.id)}>
                  挂起
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-v2-danger"
                onClick={() => handleTerminate(r.id)}
              >
                终止
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="流程中心"
        title="流程实例"
        subtitle="查看和管理运行中的流程实例与已完成的历史记录，支持挂起、激活与终止。"
      />

      <FilterBar>
        <FilterChip
          active={tab === 'running'}
          onClick={() => {
            setTab('running')
            setPage(1)
          }}
        >
          运行中
        </FilterChip>
        <FilterChip
          active={tab === 'finished'}
          onClick={() => {
            setTab('finished')
            setPage(1)
          }}
        >
          已完成
        </FilterChip>
      </FilterBar>

      <DataTable
        columns={columns}
        data={instances}
        rowKey={(r) => r.id}
        loading={isLoading}
        empty={{
          title: tab === 'running' ? '暂无运行中的流程实例' : '暂无已完成的流程实例',
          description: '切换标签查看其他状态的流程实例。',
        }}
      />

      <Pagination page={page} pageSize={20} total={total} onPageChange={setPage} />

      {/* Detail Panel */}
      {selectedInstance && (
        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-bold text-v2-fg">{selectedInstance.processDefinitionName}</h2>
              <p className="text-sm text-v2-muted">
                Business Key: {selectedInstance.businessKey || '-'} · ID:{' '}
                <span className="font-v2-mono">{selectedInstance.id}</span>
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedInstance(null)
                setViewerXml('')
                setActivities([])
              }}
            >
              关闭
            </Button>
          </div>

          {viewerXml ? (
            <div className="mb-4">
              <p className="mb-2 text-sm font-semibold text-v2-fg">流程进度</p>
              <BpmnViewer xml={viewerXml} completedActivities={completedIds} currentActivities={currentIds} />
              <div className="mt-2 flex items-center gap-4 text-xs text-v2-muted">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-v2-success" /> 已完成
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-v2-primary" /> 当前
                </span>
              </div>
            </div>
          ) : (
            <p className="mb-4 text-sm text-v2-muted">暂无流程图数据</p>
          )}

          {activities.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-v2-fg">活动历史</p>
              <div className="space-y-1">
                {activities.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 border-b border-v2-border py-1.5 text-sm last:border-0"
                  >
                    <StatusBadge status={a.endTime ? 'ok' : 'neutral'}>
                      {a.endTime ? '已完成' : '进行中'}
                    </StatusBadge>
                    <span className="text-v2-fg">{a.activityName}</span>
                    {a.assignee && (
                      <span className="ml-auto text-xs text-v2-muted">负责人: {a.assignee}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
