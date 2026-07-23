'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BellRing, Mail, Play, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/v2/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/v2/Card'
import { listDirectoryGroups, listDirectoryUsers, type DirectoryGroup, type DirectoryUser } from '@/lib/task-plan-api'
import {
  createAnalyticsSubscription,
  deleteAnalyticsSubscription,
  listAnalyticsSubscriptions,
  testAnalyticsSubscription,
  type AnalyticsSubscriptionPayload,
} from '@/lib/task-analytics-api'

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
  return <Card><CardHeader><CardTitle>定时订阅</CardTitle><CardDescription>每位接收人按自身数据权限接收可见范围内的看板内容。</CardDescription></CardHeader><CardContent className="space-y-4">
    <div className="grid gap-3 lg:grid-cols-6">
      <label className="space-y-1 text-sm lg:col-span-2"><span>订阅名称</span><input className="h-9 w-full border border-v2-border bg-v2-surface px-3" value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} /></label>
      <label className="space-y-1 text-sm"><span>接收对象</span><select className="h-9 w-full border border-v2-border bg-v2-surface px-2" value={draft.recipientType} onChange={(event) => setDraft((value) => ({ ...value, recipientType: event.target.value as SubscriptionDraft['recipientType'], recipientId: undefined }))}><option value="user">用户</option><option value="group">用户组</option></select></label>
      <label className="space-y-1 text-sm lg:col-span-2"><span>{draft.recipientType === 'user' ? '接收用户' : '接收用户组'}</span><select className="h-9 w-full border border-v2-border bg-v2-surface px-2" value={draft.recipientId ?? ''} onChange={(event) => setDraft((value) => ({ ...value, recipientId: event.target.value ? Number(event.target.value) : undefined }))}><option value="">选择对象</option>{targets.map((target) => <option key={target.id} value={target.id}>{targetName(target)}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span>渠道</span><select className="h-9 w-full border border-v2-border bg-v2-surface px-2" value={draft.channel} onChange={(event) => setDraft((value) => ({ ...value, channel: event.target.value as SubscriptionDraft['channel'] }))}><option value="notification">站内通知</option><option value="email">邮件</option></select></label>
      <label className="space-y-1 text-sm"><span>周期</span><select className="h-9 w-full border border-v2-border bg-v2-surface px-2" value={draft.scheduleType} onChange={(event) => setDraft((value) => ({ ...value, scheduleType: event.target.value as SubscriptionDraft['scheduleType'] }))}><option value="daily">每天</option><option value="weekly">每周</option><option value="monthly">每月</option></select></label>
      <label className="space-y-1 text-sm"><span>时间</span><input className="h-9 w-full border border-v2-border bg-v2-surface px-3" type="time" value={draft.time} onChange={(event) => setDraft((value) => ({ ...value, time: event.target.value }))} /></label>
      {draft.scheduleType === 'weekly' && <label className="space-y-1 text-sm"><span>周几</span><select className="h-9 w-full border border-v2-border bg-v2-surface px-2" value={draft.dayOfWeek} onChange={(event) => setDraft((value) => ({ ...value, dayOfWeek: Number(event.target.value) }))}>{[1, 2, 3, 4, 5, 6, 7].map((day) => <option key={day} value={day}>周{['一', '二', '三', '四', '五', '六', '日'][day - 1]}</option>)}</select></label>}
      {draft.scheduleType === 'monthly' && <label className="space-y-1 text-sm"><span>日期</span><input className="h-9 w-full border border-v2-border bg-v2-surface px-3" type="number" min={1} max={28} value={draft.dayOfMonth} onChange={(event) => setDraft((value) => ({ ...value, dayOfMonth: Number(event.target.value) }))} /></label>}
      <div className="flex items-end"><Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending || !draft.name.trim() || !draft.recipientId}><Plus className="h-4 w-4" />新增订阅</Button></div>
    </div>
    {subscriptions.isLoading && <p className="text-sm text-v2-muted">正在加载订阅...</p>}{subscriptions.isError && <p className="text-sm text-v2-danger">订阅列表读取失败。</p>}
    <div className="divide-y divide-v2-border border-y border-v2-border">{(subscriptions.data ?? []).map((subscription) => <div key={subscription.id} className="flex flex-wrap items-center gap-3 py-3 text-sm"><div className="min-w-40 flex-1"><p className="font-medium">{subscription.name}</p><p className="text-xs text-v2-muted">{recipientDescription(subscription.recipientType, subscription.recipientConfig.ids)} · {scheduleDescription(subscription.scheduleConfig)} · 下次 {dateTime(subscription.nextSendAt)}</p></div><span className="inline-flex items-center gap-1 text-xs text-v2-muted">{subscription.channel === 'email' ? <Mail className="h-3.5 w-3.5" /> : <BellRing className="h-3.5 w-3.5" />}{subscription.channel === 'email' ? '邮件' : '通知'}</span><Button size="sm" variant="ghost" title="试发" disabled={sendTest.isPending} onClick={() => sendTest.mutate(subscription.id)}><Play className="h-4 w-4" /></Button><Button size="sm" variant="ghost" title="删除订阅" disabled={remove.isPending} onClick={() => remove.mutate(subscription.id)}><Trash2 className="h-4 w-4 text-v2-danger" /></Button></div>)}</div>
    {!subscriptions.isLoading && subscriptions.data?.length === 0 && <p className="text-sm text-v2-muted">尚未配置定时发送。</p>}
  </CardContent></Card>
}

interface SubscriptionDraft { name: string; recipientType: 'user' | 'group'; recipientId?: number; scheduleType: 'daily' | 'weekly' | 'monthly'; time: string; dayOfWeek: number; dayOfMonth: number; channel: 'notification' | 'email' }
const initialDraft: SubscriptionDraft = { name: '', recipientType: 'user', scheduleType: 'weekly', time: '09:00', dayOfWeek: 1, dayOfMonth: 1, channel: 'notification' }
function toPayload(value: SubscriptionDraft): AnalyticsSubscriptionPayload { const scheduleConfig: AnalyticsSubscriptionPayload['scheduleConfig'] = { type: value.scheduleType, time: value.time }; if (value.scheduleType === 'weekly') scheduleConfig.dayOfWeek = value.dayOfWeek; if (value.scheduleType === 'monthly') scheduleConfig.dayOfMonth = value.dayOfMonth; return { name: value.name.trim(), recipientType: value.recipientType, recipientConfig: { ids: value.recipientId ? [value.recipientId] : [] }, scheduleConfig, channel: value.channel } }
function targetName(target: DirectoryUser | DirectoryGroup) { return 'username' in target ? `${target.realName || target.username} (#${target.id})` : target.name }
function recipientDescription(type: string, ids: number[]) { return `${type === 'group' ? '用户组' : '用户'} #${ids.join(', #')}` }
function scheduleDescription(config: { type: 'daily' | 'weekly' | 'monthly'; time?: string; dayOfWeek?: number; dayOfMonth?: number }) { const time = config.time || '09:00'; return config.type === 'weekly' ? `每周 ${config.dayOfWeek} ${time}` : config.type === 'monthly' ? `每月 ${config.dayOfMonth} 日 ${time}` : `每天 ${time}` }
function dateTime(value?: string) { return value ? new Date(value).toLocaleString('zh-CN') : '-' }
