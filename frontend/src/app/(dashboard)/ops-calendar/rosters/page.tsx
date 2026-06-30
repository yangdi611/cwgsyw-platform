'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { PageHeader, DataTable, type ColumnDef } from '@/components/shared'
import { Button } from '@/components/v2/Button'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/v2/Dialog'
import { type RosterVO, ymd } from '@/lib/opsCalendar'
import { Plus, ArrowLeft } from 'lucide-react'

interface UserOpt { id: number; realName: string | null; username: string }

export default function RostersPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const qc = useQueryClient()

  useEffect(() => {
    if (!hasPermission('ops_calendar', 'manage')) router.replace('/ops-calendar')
  }, [hasPermission, router])

  const today = new Date()
  const [from, setFrom] = useState(ymd(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [to, setTo] = useState(ymd(new Date(today.getFullYear(), today.getMonth() + 1, 0)))
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RosterVO | null>(null)
  const [form, setForm] = useState({ dutyDate: ymd(today), shiftName: '全天', assigneeId: '', backupAssigneeId: '', phoneOverride: '', remark: '' })
  const [conflictMsg, setConflictMsg] = useState<string[]>([])

  const { data: rosters = [], isLoading } = useQuery({
    queryKey: ['ops-rosters', from, to],
    queryFn: () => api.get('/ops-calendar/rosters', { params: { from, to } }).then((r) => r.data.data as RosterVO[]),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['ops-users-min'],
    queryFn: () => api.get('/users', { params: { page: 1, size: 200 } }).then((r) => r.data.data.records as UserOpt[]),
  })

  const userName = (u: UserOpt) => u.realName || u.username

  function openCreate() {
    setEditing(null)
    setForm({ dutyDate: ymd(today), shiftName: '全天', assigneeId: '', backupAssigneeId: '', phoneOverride: '', remark: '' })
    setConflictMsg([])
    setOpen(true)
  }

  function openEdit(r: RosterVO) {
    setEditing(r)
    setForm({
      dutyDate: r.dutyDate, shiftName: r.shiftName,
      assigneeId: r.assigneeId ? String(r.assigneeId) : '',
      backupAssigneeId: r.backupAssigneeId ? String(r.backupAssigneeId) : '',
      phoneOverride: r.phoneOverride ?? '', remark: r.remark ?? '',
    })
    setConflictMsg([])
    setOpen(true)
  }

  function buildBody() {
    return {
      dutyDate: form.dutyDate,
      shiftName: form.shiftName,
      assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
      backupAssigneeId: form.backupAssigneeId ? Number(form.backupAssigneeId) : null,
      phoneOverride: form.phoneOverride || null,
      remark: form.remark || null,
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => editing
      ? api.put(`/ops-calendar/rosters/${editing.id}`, buildBody())
      : api.post('/ops-calendar/rosters', buildBody()),
    onSuccess: () => {
      toast.success(editing ? '排班已更新' : '排班已创建')
      qc.invalidateQueries({ queryKey: ['ops-rosters'] })
      setOpen(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '保存失败'),
  })

  async function checkConflicts() {
    try {
      const { data } = await api.post('/ops-calendar/rosters/check-conflicts', buildBody())
      const msgs = [...(data.data.conflicts ?? []), ...(data.data.warnings ?? [])].map((c: any) => c.message)
      setConflictMsg(msgs.length ? msgs : ['无冲突'])
    } catch { setConflictMsg(['检测失败']) }
  }

  const columns: ColumnDef<RosterVO>[] = useMemo(() => [
    { key: 'dutyDate', title: '日期', render: (r) => <span className="font-v2-mono text-sm">{r.dutyDate}</span> },
    { key: 'shiftName', title: '班次', render: (r) => r.shiftName },
    { key: 'assignee', title: '负责人', render: (r) => r.assigneeName ?? '-' },
    { key: 'phone', title: '联系电话', render: (r) => r.assigneePhone
        ? <span className="font-v2-mono text-sm">{r.assigneePhone}</span>
        : <span className="text-amber-600 text-xs">缺手机号</span> },
    { key: 'backup', title: '备份', render: (r) => r.backupAssigneeName ?? '-' },
    { key: 'remark', title: '备注', render: (r) => <span className="text-v2-muted text-sm">{r.remark ?? '-'}</span> },
    { key: 'ops', title: '操作', align: 'right' as const, render: (r) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(r) }}>编辑</Button>
      ) },
  ], [])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="运维日历"
        title="排班管理"
        subtitle="维护值班安排、备份负责人与联系方式，支撑节假日值守与巡检提醒。"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => router.push('/ops-calendar')}><ArrowLeft className="h-4 w-4" />返回</Button>
            <Button variant="primary" onClick={openCreate}><Plus className="h-4 w-4" />新建排班</Button>
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <Label className="text-sm text-v2-muted">从</Label>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Label className="text-sm text-v2-muted">到</Label>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
      </div>

      <DataTable
        columns={columns} data={rosters} rowKey={(r) => r.id} loading={isLoading}
        empty={{ title: '暂无排班', description: '点击右上角新建排班。' }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? '编辑排班' : '新建排班'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>日期</Label><Input type="date" value={form.dutyDate} onChange={(e) => setForm({ ...form, dutyDate: e.target.value })} /></div>
              <div><Label>班次</Label><Input value={form.shiftName} onChange={(e) => setForm({ ...form, shiftName: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>负责人</Label>
                <select className="w-full h-9 rounded-md border border-v2-border bg-v2-surface px-2 text-sm"
                  value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
                  <option value="">选择</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{userName(u)}</option>)}
                </select>
              </div>
              <div>
                <Label>备份负责人</Label>
                <select className="w-full h-9 rounded-md border border-v2-border bg-v2-surface px-2 text-sm"
                  value={form.backupAssigneeId} onChange={(e) => setForm({ ...form, backupAssigneeId: e.target.value })}>
                  <option value="">选择</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{userName(u)}</option>)}
                </select>
              </div>
            </div>
            <div><Label>联系电话覆盖（可选）</Label><Input value={form.phoneOverride} onChange={(e) => setForm({ ...form, phoneOverride: e.target.value })} placeholder="留空则用用户默认手机号" /></div>
            <div><Label>备注</Label><Input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></div>
            {conflictMsg.length > 0 && (
              <div className="text-xs rounded-md bg-amber-50 border border-amber-200 p-2 text-amber-800 space-y-1">
                {conflictMsg.map((m, i) => <div key={i}>• {m}</div>)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={checkConflicts}>冲突检测</Button>
            <Button variant="secondary" onClick={() => setOpen(false)}>取消</Button>
            <Button variant="primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.assigneeId}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
