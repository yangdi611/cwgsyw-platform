'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { type RosterVO, ymd, errMsg } from '@/lib/opsCalendar'
import { listDirectoryGroups, type DirectoryGroup } from '@/lib/task-plan-api'
import '@/design-system/figma-neutral/index.css'
import {
  Alert,
  Breadcrumb,
  Button,
  DataManagementPage,
  EmptyState,
  Field,
  FilterBar,
  Input,
  NeutralAlertDialog,
  NeutralDialog,
  PageHeader,
  Select,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'

interface UserOpt {
  id: number
  realName: string | null
  username: string
}

export default function RostersPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!hasPermission('calendar_settings', 'read')) router.replace('/ops-calendar')
  }, [hasPermission, router])

  const today = new Date()
  const [from, setFrom] = useState(ymd(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [to, setTo] = useState(ymd(new Date(today.getFullYear(), today.getMonth() + 1, 0)))
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RosterVO | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RosterVO | null>(null)
  const [form, setForm] = useState({
    dutyDate: ymd(today),
    startAt: '',
    endAt: '',
    shiftName: '全天',
    assigneeId: '',
    backupAssigneeId: '',
    groupId: '',
    phoneOverride: '',
    remark: '',
  })
  const [conflictMsg, setConflictMsg] = useState<string[]>([])

  const { data: rosters = [], isLoading } = useQuery({
    queryKey: ['calendar-settings-rosters', from, to],
    queryFn: () => api.get('/calendar-settings/rosters', { params: { from, to } }).then((response) => response.data.data as RosterVO[]),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['ops-users-min'],
    queryFn: () => api.get('/users', { params: { page: 1, size: 200 } }).then((response) => response.data.data.records as UserOpt[]),
  })
  const { data: groups = [] } = useQuery<DirectoryGroup[]>({
    queryKey: ['calendar-settings-groups'],
    queryFn: listDirectoryGroups,
  })
  const canManage = hasPermission('calendar_settings', 'manage')
  const userName = (user: UserOpt) => user.realName || user.username

  function openCreate() {
    setEditing(null)
    setForm({
      dutyDate: ymd(today),
      startAt: '',
      endAt: '',
      shiftName: '全天',
      assigneeId: '',
      backupAssigneeId: '',
      groupId: '',
      phoneOverride: '',
      remark: '',
    })
    setConflictMsg([])
    setOpen(true)
  }

  function openEdit(roster: RosterVO) {
    setEditing(roster)
    setForm({
      dutyDate: roster.dutyDate,
      startAt: roster.startAt?.slice(0, 16) ?? '',
      endAt: roster.endAt?.slice(0, 16) ?? '',
      shiftName: roster.shiftName,
      assigneeId: roster.assigneeId ? String(roster.assigneeId) : '',
      backupAssigneeId: roster.backupAssigneeId ? String(roster.backupAssigneeId) : '',
      groupId: roster.groupId ? String(roster.groupId) : '',
      phoneOverride: roster.phoneOverride ?? '',
      remark: roster.remark ?? '',
    })
    setConflictMsg([])
    setOpen(true)
  }

  function buildBody() {
    return {
      dutyDate: form.dutyDate,
      startAt: form.startAt || null,
      endAt: form.endAt || null,
      shiftName: form.shiftName,
      assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
      backupAssigneeId: form.backupAssigneeId ? Number(form.backupAssigneeId) : null,
      groupId: form.groupId ? Number(form.groupId) : null,
      phoneOverride: form.phoneOverride || null,
      remark: form.remark || null,
    }
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      editing ? api.put(`/calendar-settings/rosters/${editing.id}`, buildBody()) : api.post('/calendar-settings/rosters', buildBody()),
    onSuccess: () => {
      toast.success(editing ? '排班已更新' : '排班已创建')
      queryClient.invalidateQueries({ queryKey: ['calendar-settings-rosters'] })
      setOpen(false)
    },
    onError: (error) => toast.error(errMsg(error, '保存失败')),
  })

  async function checkConflicts() {
    try {
      const { data } = await api.post('/calendar-settings/rosters/check-conflicts', buildBody())
      const messages = [...(data.data.conflicts ?? []), ...(data.data.warnings ?? [])].map((item: { message: string }) => item.message)
      setConflictMsg(messages.length ? messages : ['无冲突'])
    } catch {
      setConflictMsg(['检测失败'])
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/calendar-settings/rosters/${id}`),
    onSuccess: () => {
      toast.success('排班已删除')
      queryClient.invalidateQueries({ queryKey: ['calendar-settings-rosters'] })
      setDeleteTarget(null)
    },
    onError: (error: unknown) => toast.error(errMsg(error, '删除失败')),
  })

  const userOptions = [{ value: '', label: '选择' }, ...users.map((user) => ({ value: String(user.id), label: userName(user) }))]
  const groupOptions = [{ value: '', label: '选择' }, ...groups.map((group) => ({ value: String(group.id), label: group.name }))]

  return (
    <>
      <DataManagementPage
        embedded
        header={
          <PageHeader
            eyebrow="运维日历"
            title="排班管理"
            subtitle="维护值班安排、备份负责人与联系方式，支撑节假日值守与巡检提醒。"
            breadcrumb={
              <Breadcrumb
                items={[
                  { href: '/', label: '工作台' },
                  { href: '/ops-calendar', label: '运维日历' },
                  { label: '排班管理' },
                ]}
              />
            }
            actions={
              <div className="cwgsyw-inline-controls">
                <Button type="button" variant="secondary" onClick={() => router.push('/ops-calendar')}>
                  返回
                </Button>
                {canManage ? (
                  <Button type="button" variant="primary" onClick={openCreate}>
                    新建排班
                  </Button>
                ) : null}
              </div>
            }
          />
        }
        filter={
          <FilterBar
            filterItems={
              <div className="cwgsyw-inline-controls">
                <Field htmlFor="roster-from" label="从">
                  <Input id="roster-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
                </Field>
                <Field htmlFor="roster-to" label="到">
                  <Input id="roster-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
                </Field>
              </div>
            }
          />
        }
        content={
          <Table
            showSearch={false}
            columns={[
              { key: 'dutyDate', label: '日期' },
              { key: 'shiftName', label: '班次' },
              { key: 'assignee', label: '负责人' },
              { key: 'phone', label: '联系电话' },
              { key: 'backup', label: '备份' },
              { key: 'group', label: '所属组' },
              { key: 'remark', label: '备注' },
              { key: 'updatedAt', label: '最近更新' },
              { key: 'ops', label: '操作', align: 'right' },
            ]}
            rows={rosters.map((roster) => ({
              id: String(roster.id),
              cells: {
                dutyDate: roster.dutyDate,
                shiftName: `${roster.shiftName} ${roster.startAt?.slice(11, 16) ?? '00:00'} - ${roster.endAt?.slice(11, 16) ?? '24:00'}`,
                assignee: roster.assigneeName ?? '-',
                phone: roster.assigneePhone ? roster.assigneePhone : <StatusBadge label="缺手机号" status="warning" />,
                backup: roster.backupAssigneeName ?? '-',
                group: roster.groupName ? `${roster.groupName}${roster.groupArchived ? '（已归档）' : ''}` : '-',
                remark: roster.remark ?? '-',
                updatedAt: `${roster.updatedBy ? `用户 #${roster.updatedBy}` : '-'} ${roster.updatedAt?.slice(0, 16).replace('T', ' ') ?? ''}`,
                ops: canManage ? (
                  <div className="cwgsyw-inline-controls">
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(roster)}>
                      编辑
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteTarget(roster)}>
                      删除
                    </Button>
                  </div>
                ) : null,
              },
            }))}
            state={isLoading ? 'loading' : rosters.length === 0 ? 'empty' : 'data'}
            empty={<EmptyState title="暂无排班" description="点击右上角新建排班。" showAction={false} />}
          />
        }
      />

      <NeutralDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? '编辑排班' : '新建排班'}
        showClose={false}
        footer={
          <div className="cwgsyw-form__actions">
            <Button type="button" variant="ghost" onClick={() => void checkConflicts()}>
              冲突检测
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={saveMutation.isPending}
              disabled={!form.assigneeId || !form.groupId || Boolean(form.startAt) !== Boolean(form.endAt)}
              onClick={() => saveMutation.mutate()}
            >
              保存
            </Button>
          </div>
        }
      >
        <div className="cwgsyw-form">
          <Field htmlFor="roster-date" label="日期" required>
            <Input id="roster-date" type="date" value={form.dutyDate} onChange={(event) => setForm({ ...form, dutyDate: event.target.value })} />
          </Field>
          <Field htmlFor="roster-shift" label="班次">
            <Input id="roster-shift" value={form.shiftName} onChange={(event) => setForm({ ...form, shiftName: event.target.value })} />
          </Field>
          <Field htmlFor="roster-start" label="开始时间">
            <Input id="roster-start" type="datetime-local" value={form.startAt} onChange={(event) => setForm({ ...form, startAt: event.target.value })} />
          </Field>
          <Field htmlFor="roster-end" label="结束时间">
            <Input id="roster-end" type="datetime-local" value={form.endAt} onChange={(event) => setForm({ ...form, endAt: event.target.value })} />
          </Field>
          <Field htmlFor="roster-assignee" label="负责人" required>
            <Select id="roster-assignee" value={form.assigneeId} options={userOptions} onChange={(value) => setForm({ ...form, assigneeId: value })} />
          </Field>
          <Field htmlFor="roster-backup" label="备份负责人">
            <Select id="roster-backup" value={form.backupAssigneeId} options={userOptions} onChange={(value) => setForm({ ...form, backupAssigneeId: value })} />
          </Field>
          <Field htmlFor="roster-group" label="所属组" required>
            <Select id="roster-group" value={form.groupId} options={groupOptions} onChange={(value) => setForm({ ...form, groupId: value })} />
          </Field>
          <Field htmlFor="roster-phone" label="联系电话覆盖（可选）" helperText="留空则用用户默认手机号">
            <Input id="roster-phone" value={form.phoneOverride} onChange={(event) => setForm({ ...form, phoneOverride: event.target.value })} />
          </Field>
          <Field htmlFor="roster-remark" label="备注">
            <Input id="roster-remark" value={form.remark} onChange={(event) => setForm({ ...form, remark: event.target.value })} />
          </Field>
          {conflictMsg.length > 0 ? (
            <Alert
              tone="warning"
              title="冲突检测"
              description={conflictMsg.join('；')}
              showDismiss={false}
            />
          ) : null}
        </div>
      </NeutralDialog>

      <NeutralAlertDialog
        open={!!deleteTarget}
        title="确认删除排班"
        description={deleteTarget ? `确认删除 ${deleteTarget.dutyDate} 的排班？` : '确认删除该排班？'}
        intent="destructive"
        confirmLabel="删除"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onOpenChange={(next) => {
          if (!next) setDeleteTarget(null)
        }}
      />
    </>
  )
}
