'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import { listDirectoryGroups, listDirectoryUsers, type DirectoryGroup, type DirectoryUser } from '@/lib/task-plan-api'
import {
  createAnalyticsSubscription,
  deleteAnalyticsSubscription,
  listAnalyticsSubscriptions,
  testAnalyticsSubscription,
  type AnalyticsSubscriptionPayload,
} from '@/lib/task-analytics-api'
import '@/design-system/figma-neutral/index.css'
import '@/components/task-runtime/tasks.css'
import { TaskEmpty, TaskPanel, TASK_BAR_CHART_ICON, TASK_BAR_CHART_NODE } from '@/components/task-runtime/TaskEmpty'
import { Button, Field, Input, Select } from '@/design-system/figma-neutral/components'

interface Props { dashboardId: number; canManage: boolean }

export function DashboardSubscriptions({ dashboardId, canManage }: Props) {
  const queryClient = useQueryClient()
  const subscriptions = useQuery({ queryKey: ['task-analytics-subscriptions', dashboardId], queryFn: () => listAnalyticsSubscriptions(dashboardId), enabled: canManage })
  const users = useQuery({ queryKey: ['task-analytics-subscription-users'], queryFn: listDirectoryUsers, enabled: canManage })
  const groups = useQuery({ queryKey: ['task-analytics-subscription-groups'], queryFn: listDirectoryGroups, enabled: canManage })
  const [draft, setDraft] = useState<SubscriptionDraft>(initialDraft)
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['task-analytics-subscriptions', dashboardId] })
  const create = useMutation({ mutationFn: () => createAnalyticsSubscription(dashboardId, toPayload(draft)), onSuccess: async () => { toast.success('看板订阅已创建'); setDraft(initialDraft); await invalidate() }, onError: () => toast.error('订阅创建失败，请检查接收人和计划配置') })
  const remove = useMutation({ mutationFn: deleteAnalyticsSubscription, onSuccess: async () => { toast.success('订阅已删除'); await invalidate() }, onError: () => toast.error('订阅删除失败') })
  const sendTest = useMutation({ mutationFn: testAnalyticsSubscription, onSuccess: () => toast.success('已发起试发'), onError: () => toast.error('试发失败') })
  if (!canManage) return null
  const targets = draft.recipientType === 'user' ? users.data ?? [] : groups.data ?? []
  return (
    <TaskPanel title="定时订阅">
      <div className="cwgsyw-form cwgsyw-tasks-subscription-form">
        <div className="cwgsyw-tasks-form-grid cwgsyw-tasks-form-grid--wide">
          <Field label="订阅名称">
            <Input size="sm" value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} />
          </Field>
          <Field label="接收对象">
            <Select
              size="sm"
              overlay
              value={draft.recipientType}
              onChange={(value) => setDraft((current) => ({ ...current, recipientType: value as SubscriptionDraft['recipientType'], recipientId: undefined }))}
              options={[{ value: 'user', label: '用户' }, { value: 'group', label: '用户组' }]}
            />
          </Field>
          <Field label={draft.recipientType === 'user' ? '接收用户' : '接收用户组'}>
            <Select
              size="sm"
              overlay
              value={draft.recipientId ? String(draft.recipientId) : ''}
              onChange={(value) => setDraft((current) => ({ ...current, recipientId: value ? Number(value) : undefined }))}
              options={targets.map((target) => ({ value: String(target.id), label: targetName(target) }))}
              placeholder="选择对象"
            />
          </Field>
          <Field label="渠道">
            <Select
              size="sm"
              overlay
              value={draft.channel}
              onChange={(value) => setDraft((current) => ({ ...current, channel: value as SubscriptionDraft['channel'] }))}
              options={[{ value: 'notification', label: '站内通知' }, { value: 'email', label: '邮件' }]}
            />
          </Field>
          <Field label="周期">
            <Select
              size="sm"
              overlay
              value={draft.scheduleType}
              onChange={(value) => setDraft((current) => ({ ...current, scheduleType: value as SubscriptionDraft['scheduleType'] }))}
              options={[{ value: 'daily', label: '每天' }, { value: 'weekly', label: '每周' }, { value: 'monthly', label: '每月' }]}
            />
          </Field>
          <Field label="时间">
            <Input size="sm" type="time" value={draft.time} onChange={(event) => setDraft((value) => ({ ...value, time: event.target.value }))} />
          </Field>
          {draft.scheduleType === 'weekly' ? (
            <Field label="周几">
              <Select
                size="sm"
                overlay
                value={String(draft.dayOfWeek)}
                onChange={(value) => setDraft((current) => ({ ...current, dayOfWeek: Number(value) }))}
                options={[1, 2, 3, 4, 5, 6, 7].map((day) => ({ value: String(day), label: `周${['一', '二', '三', '四', '五', '六', '日'][day - 1]}` }))}
              />
            </Field>
          ) : null}
          {draft.scheduleType === 'monthly' ? (
            <Field label="日期">
              <Input size="sm" type="number" min={1} max={28} value={draft.dayOfMonth} onChange={(event) => setDraft((current) => ({ ...current, dayOfMonth: Number(event.target.value) }))} />
            </Field>
          ) : null}
          <div>
            <Button type="button" size="sm" onClick={() => create.mutate()} disabled={create.isPending || !draft.name.trim() || !draft.recipientId}>新增订阅</Button>
          </div>
        </div>
        {subscriptions.isLoading ? <p className="cwgsyw-type-body-sm">正在加载订阅...</p> : null}
        {subscriptions.isError ? <p className="cwgsyw-type-body-sm">订阅列表读取失败。</p> : null}
        {(subscriptions.data ?? []).map((subscription) => (
          <div key={subscription.id} className="cwgsyw-designer__inline">
            <div>
              <strong>{subscription.name}</strong>
              <p className="cwgsyw-type-label-xs">{recipientDescription(subscription.recipientType, subscription.recipientConfig.ids)} · {scheduleDescription(subscription.scheduleConfig)} · 下次 {dateTime(subscription.nextSendAt)}</p>
            </div>
            <span className="cwgsyw-type-label-xs">{subscription.channel === 'email' ? '邮件' : '通知'}</span>
            <Button type="button" size="sm" variant="ghost" disabled={sendTest.isPending} onClick={() => sendTest.mutate(subscription.id)}>试发</Button>
            <Button type="button" size="sm" variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(subscription.id)}>删除</Button>
          </div>
        ))}
        {!subscriptions.isLoading && subscriptions.data?.length === 0 ? (
          <TaskEmpty iconSrc={TASK_BAR_CHART_ICON} figmaNode={TASK_BAR_CHART_NODE} title="尚未配置定时发送" description="添加接收人和周期后即可订阅。" />
        ) : null}
      </div>
    </TaskPanel>
  )
}

interface SubscriptionDraft { name: string; recipientType: 'user' | 'group'; recipientId?: number; scheduleType: 'daily' | 'weekly' | 'monthly'; time: string; dayOfWeek: number; dayOfMonth: number; channel: 'notification' | 'email' }
const initialDraft: SubscriptionDraft = { name: '', recipientType: 'user', scheduleType: 'weekly', time: '09:00', dayOfWeek: 1, dayOfMonth: 1, channel: 'notification' }
function toPayload(value: SubscriptionDraft): AnalyticsSubscriptionPayload { const scheduleConfig: AnalyticsSubscriptionPayload['scheduleConfig'] = { type: value.scheduleType, time: value.time }; if (value.scheduleType === 'weekly') scheduleConfig.dayOfWeek = value.dayOfWeek; if (value.scheduleType === 'monthly') scheduleConfig.dayOfMonth = value.dayOfMonth; return { name: value.name.trim(), recipientType: value.recipientType, recipientConfig: { ids: value.recipientId ? [value.recipientId] : [] }, scheduleConfig, channel: value.channel } }
function targetName(target: DirectoryUser | DirectoryGroup) { return 'username' in target ? `${target.realName || target.username} (#${target.id})` : target.name }
function recipientDescription(type: string, ids: number[]) { return `${type === 'group' ? '用户组' : '用户'} #${ids.join(', #')}` }
function scheduleDescription(config: { type: 'daily' | 'weekly' | 'monthly'; time?: string; dayOfWeek?: number; dayOfMonth?: number }) { const time = config.time || '09:00'; return config.type === 'weekly' ? `每周 ${config.dayOfWeek} ${time}` : config.type === 'monthly' ? `每月 ${config.dayOfMonth} 日 ${time}` : `每天 ${time}` }
function dateTime(value?: string) { return value ? new Date(value).toLocaleString('zh-CN') : '-' }
