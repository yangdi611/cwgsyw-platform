'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { PageHeader } from '@/components/shared'
import { DataTable, type ColumnDef } from '@/components/shared'
import { Button } from '@/components/v2/Button'
import { TaskTypeBadge } from '@/components/ops-calendar/TaskBadges'
import { RuleFormDialog } from '@/components/ops-calendar/RuleFormDialog'
import { type RuleVO, fmtTime, errMsg } from '@/lib/opsCalendar'
import { Plus, ArrowLeft } from 'lucide-react'

const TRIGGER_LABEL: Record<string, string> = {
  once: '一次性', daily: '每日', weekly: '每周', monthly: '每月',
  quarterly: '每季度', semiannual: '每半年', yearly: '每年', cron: 'Cron', holiday_relative: '节假日相对',
}

export default function OpsCalendarRulesPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RuleVO | null>(null)

  useEffect(() => {
    if (!hasPermission('ops_calendar', 'manage')) router.replace('/ops-calendar')
  }, [hasPermission, router])

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['ops-calendar-rules'],
    queryFn: () => api.get('/ops-calendar/rules').then((r) => r.data.data as RuleVO[]),
    enabled: hasPermission('ops_calendar', 'manage'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.post(`/ops-calendar/rules/${id}/${enabled ? 'enable' : 'disable'}`),
    onSuccess: () => {
      toast.success('已更新')
      queryClient.invalidateQueries({ queryKey: ['ops-calendar-rules'] })
    },
    onError: (e: unknown) => toast.error(errMsg(e, '操作失败')),
  })

  const columns: ColumnDef<RuleVO>[] = [
    { key: 'name', title: '规则名称', render: (r) => (
      <div>
        <div className="font-semibold text-v2-fg">{r.name}</div>
        {r.description && <div className="text-xs text-v2-muted truncate max-w-xs">{r.description}</div>}
      </div>
    ) },
    { key: 'taskType', title: '类型', render: (r) => <TaskTypeBadge taskType={r.taskType} /> },
    { key: 'triggerType', title: '周期', render: (r) => (
      <span className="text-sm text-v2-fg">{TRIGGER_LABEL[r.triggerType] ?? r.triggerType}</span>
    ) },
    { key: 'visibility', title: '可见性', render: (r) => (
      <span className="text-xs text-v2-muted">{r.visibility}{r.sensitive ? ' · 敏感' : ''}</span>
    ) },
    { key: 'nextGenerateAt', title: '下次生成', render: (r) => (
      <span className="text-xs text-v2-muted font-v2-mono">{r.nextGenerateAt ? fmtTime(r.nextGenerateAt) : '待初始化'}</span>
    ) },
    { key: 'enabled', title: '状态', render: (r) => (
      <span className={r.enabled ? 'text-green-600 text-sm' : 'text-v2-subtle text-sm'}>
        {r.enabled ? '启用' : '停用'}
      </span>
    ) },
    { key: 'actions', title: '操作', align: 'right' as const, render: (r) => (
      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setFormOpen(true) }}>编辑</Button>
        <Button variant="ghost" size="sm"
          onClick={() => toggleMutation.mutate({ id: r.id, enabled: !r.enabled })}>
          {r.enabled ? '停用' : '启用'}
        </Button>
      </div>
    ) },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="运维日历"
        title="周期规则"
        subtitle="配置自动生成任务的触发规则、负责人、提醒与升级策略。"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => router.push('/ops-calendar')}>
              <ArrowLeft className="h-4 w-4" />返回日历
            </Button>
            <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="h-4 w-4" />新建规则
            </Button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={rules}
        rowKey={(r) => r.id}
        loading={isLoading}
        empty={{ title: '暂无周期规则', description: '点击「新建规则」创建第一条自动任务规则。' }}
      />

      <RuleFormDialog
        open={formOpen}
        rule={editing}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null) }}
      />
    </div>
  )
}
