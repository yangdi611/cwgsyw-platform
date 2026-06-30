'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '@/lib/api'
import { DetailDrawer } from '@/components/shared'
import { Button } from '@/components/v2/Button'
import { Textarea } from '@/components/v2/Textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { toast } from 'sonner'
import { TaskTypeBadge, TaskStatusBadge } from './TaskBadges'
import { type TaskDetailVO, fmtTime, taskTypeLabel } from '@/lib/opsCalendar'

interface Props {
  taskId: number | null
  onClose: () => void
}

const RESULT_OPTIONS = [
  { value: 'normal', label: '正常' },
  { value: 'abnormal', label: '异常' },
  { value: 'partial', label: '部分完成' },
  { value: 'not_required', label: '无需执行' },
]
const RISK_OPTIONS = [
  { value: 'none', label: '无' }, { value: 'low', label: '低' },
  { value: 'medium', label: '中' }, { value: 'high', label: '高' }, { value: 'critical', label: '严重' },
]

export function TaskDetailDrawer({ taskId, onClose }: Props) {
  const open = taskId != null
  const qc = useQueryClient()
  const [completing, setCompleting] = useState(false)
  const [resultStatus, setResultStatus] = useState('normal')
  const [resultSummary, setResultSummary] = useState('')
  const [riskLevel, setRiskLevel] = useState('none')
  const [checks, setChecks] = useState<Record<number, { checked: boolean; value: string }>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['ops-calendar-task', taskId],
    queryFn: () => api.get(`/ops-calendar/tasks/${taskId}`).then((r) => r.data.data as TaskDetailVO),
    enabled: open && !!taskId,
  })

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['ops-calendar-tasks'] })
    qc.invalidateQueries({ queryKey: ['ops-calendar-day'] })
    qc.invalidateQueries({ queryKey: ['ops-calendar-dashboard'] })
    qc.invalidateQueries({ queryKey: ['ops-calendar-task', taskId] })
  }

  const act = useMutation({
    mutationFn: ({ action, body }: { action: string; body?: unknown }) =>
      api.post(`/ops-calendar/tasks/${taskId}/${action}`, body ?? {}),
    onSuccess: (_res, vars) => {
      toast.success('操作成功')
      invalidateAll()
      if (vars.action === 'complete') { setCompleting(false); onClose() }
      if (vars.action === 'cancel' || vars.action === 'close-exception') onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '操作失败'),
  })

  function submitComplete() {
    const checklistValues = (data?.checklist ?? []).map((i) => ({
      itemId: i.id,
      checked: checks[i.id]?.checked ?? i.checked,
      value: checks[i.id]?.value ?? i.value ?? '',
    }))
    act.mutate({ action: 'complete', body: { resultStatus, resultSummary, riskLevel, checklistValues } })
  }

  const t = data?.task

  return (
    <DetailDrawer
      open={open}
      onClose={() => { setCompleting(false); onClose() }}
      title={t?.title ?? '任务详情'}
      footer={
        data && !completing ? (
          <div className="flex flex-wrap gap-2">
            {data.canConfirm && <Button variant="primary" onClick={() => act.mutate({ action: 'confirm' })}>确认收到</Button>}
            {data.canStart && <Button variant="secondary" onClick={() => act.mutate({ action: 'start' })}>开始执行</Button>}
            {data.canComplete && <Button variant="primary" onClick={() => setCompleting(true)}>提交完成</Button>}
            {data.canCloseException && (
              <Button variant="secondary" onClick={() => {
                const reason = window.prompt('异常原因')
                if (reason) act.mutate({ action: 'close-exception', body: { reason, riskLevel: 'medium' } })
              }}>异常关闭</Button>
            )}
            {data.canCancel && (
              <Button variant="ghost" onClick={() => {
                const reason = window.prompt('取消原因') ?? ''
                act.mutate({ action: 'cancel', body: { reason } })
              }}>取消</Button>
            )}
            <Button variant="ghost" onClick={() => act.mutate({ action: 'remind' })}>重发提醒</Button>
          </div>
        ) : null
      }
    >
      {isLoading && <p className="py-8 text-center text-sm text-v2-muted">加载中…</p>}

      {data && t && !completing && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <TaskTypeBadge taskType={t.taskType} />
            <TaskStatusBadge status={t.status} />
            {t.sensitive && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">敏感</span>}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Field label="类型" value={taskTypeLabel(t.taskType)} />
            <Field label="优先级" value={t.priority} />
            <Field label="负责人" value={t.assigneeName ?? '-'} />
            <Field label="联系电话" value={t.assigneePhone ?? '-'} />
            <Field label="计划开始" value={fmtTime(t.plannedStartAt)} />
            <Field label="截止时间" value={fmtTime(t.dueAt)} />
            <Field label="所属组" value={t.groupName ?? '-'} />
            <Field label="来源" value={t.sourceType} />
          </dl>

          {data.content && (
            <Section title="任务说明"><p className="text-sm text-v2-fg whitespace-pre-wrap">{data.content}</p></Section>
          )}

          {data.checklist.length > 0 && (
            <Section title="执行清单">
              <ul className="space-y-1">
                {data.checklist.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 text-sm">
                    <span className={i.checked ? 'text-green-600' : 'text-v2-muted'}>{i.checked ? '✓' : '○'}</span>
                    <span className="text-v2-fg">{i.title}</span>
                    {i.required && <span className="text-xs text-red-500">*</span>}
                    {i.value && <span className="text-xs text-v2-muted ml-auto">{i.value}</span>}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {data.resultSummary && (
            <Section title="执行结果">
              <p className="text-sm text-v2-fg whitespace-pre-wrap">{data.resultSummary}</p>
              {t.resultStatus && <p className="text-xs text-v2-muted mt-1">结论：{t.resultStatus} · 风险：{t.riskLevel ?? '-'}</p>}
            </Section>
          )}

          {data.closeReason && (
            <Section title="关闭原因"><p className="text-sm text-v2-fg">{data.closeReason}</p></Section>
          )}

          {data.links.length > 0 && (
            <Section title="关联对象">
              <ul className="space-y-1 text-sm">
                {data.links.map((l) => (
                  <li key={l.id} className="text-v2-muted">{l.linkType} #{l.linkId}{l.linkTitle ? ` · ${l.linkTitle}` : ''}</li>
                ))}
              </ul>
            </Section>
          )}

          {data.participants.length > 0 && (
            <Section title="参与人">
              <div className="flex flex-wrap gap-1.5">
                {data.participants.map((p) => (
                  <span key={`${p.userId}-${p.role}`} className="text-xs px-2 py-0.5 rounded border border-v2-border text-v2-fg">
                    {p.userName ?? p.userId}<span className="text-v2-muted ml-1">{roleLabel(p.role)}</span>
                  </span>
                ))}
              </div>
            </Section>
          )}

          {data.logs.length > 0 && (
            <Section title="动态记录">
              <ul className="space-y-1.5">
                {data.logs.map((lg) => (
                  <li key={lg.id} className="text-xs text-v2-muted flex gap-2">
                    <span className="text-v2-subtle">{fmtTime(lg.createdAt)}</span>
                    <span className="text-v2-fg">{lg.operatorName ?? '系统'}</span>
                    <span>{logActionLabel(lg.action)}</span>
                    {lg.content && <span className="truncate">· {lg.content}</span>}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      {data && completing && (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-v2-fg">提交执行结果</h4>
          <div className="space-y-1">
            <label className="text-xs text-v2-muted">执行结论 *</label>
            <Select value={resultStatus} onValueChange={(v) => setResultStatus(v ?? 'normal')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RESULT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-v2-muted">风险等级</label>
            <Select value={riskLevel} onValueChange={(v) => setRiskLevel(v ?? 'none')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RISK_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-v2-muted">结果说明{['abnormal', 'partial'].includes(resultStatus) && ' *'}</label>
            <Textarea value={resultSummary} onChange={(e) => setResultSummary(e.target.value)} rows={4} placeholder="填写执行情况…" />
          </div>
          {data.checklist.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs text-v2-muted">检查项</label>
              {data.checklist.map((i) => (
                <label key={i.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checks[i.id]?.checked ?? i.checked}
                    onChange={(e) => setChecks((p) => ({ ...p, [i.id]: { checked: e.target.checked, value: p[i.id]?.value ?? i.value ?? '' } }))}
                  />
                  <span className="text-v2-fg">{i.title}</span>
                  {i.required && <span className="text-xs text-red-500">*</span>}
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="primary" onClick={submitComplete} disabled={act.isPending}>提交</Button>
            <Button variant="ghost" onClick={() => setCompleting(false)}>返回</Button>
          </div>
        </div>
      )}
    </DetailDrawer>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-v2-muted">{label}</dt>
      <dd className="text-v2-fg">{value}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border-t border-v2-border pt-4">
      <h4 className="text-xs font-semibold text-v2-muted uppercase tracking-wide">{title}</h4>
      {children}
    </div>
  )
}

function roleLabel(r: string): string {
  return { assignee: '负责人', collaborator: '协同', recipient: '接收', escalation: '升级' }[r] ?? r
}
function logActionLabel(a: string): string {
  return {
    create: '创建', notify: '提醒', confirm: '确认', start: '开始', complete: '完成',
    overdue: '逾期', escalate: '升级', cancel: '取消', close_exception: '异常关闭', update: '编辑',
  }[a] ?? a
}
