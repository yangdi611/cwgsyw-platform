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
import { Switch } from '@/components/v2/Switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/v2/Dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { type HolidayVO, errMsg } from '@/lib/opsCalendar'
import { Plus, ArrowLeft } from 'lucide-react'

const TYPE_LABEL: Record<string, string> = { legal: '法定节假日', company: '公司假期', campaign: '重大保障期' }

export default function HolidaysPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const qc = useQueryClient()

  useEffect(() => {
    if (!hasPermission('ops_calendar', 'manage')) router.replace('/ops-calendar')
  }, [hasPermission, router])

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<HolidayVO | null>(null)
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', holidayType: 'legal', workdayOverrides: '', enabled: true, remark: '' })

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ['ops-holidays'],
    queryFn: () => api.get('/ops-calendar/holidays').then((r) => r.data.data as HolidayVO[]),
  })

  function openCreate() {
    setEditing(null)
    setForm({ name: '', startDate: '', endDate: '', holidayType: 'legal', workdayOverrides: '', enabled: true, remark: '' })
    setOpen(true)
  }

  function openEdit(h: HolidayVO) {
    setEditing(h)
    setForm({
      name: h.name, startDate: h.startDate, endDate: h.endDate, holidayType: h.holidayType,
      workdayOverrides: h.workdayOverrides ?? '', enabled: h.enabled, remark: h.remark ?? '',
    })
    setOpen(true)
  }

  function buildBody() {
    let overrides = form.workdayOverrides.trim()
    // 接受逗号分隔日期或 JSON 数组，统一成 JSON 数组字符串
    if (overrides && !overrides.startsWith('[')) {
      overrides = JSON.stringify(overrides.split(/[,，\s]+/).filter(Boolean))
    }
    return {
      name: form.name, startDate: form.startDate, endDate: form.endDate,
      holidayType: form.holidayType, workdayOverrides: overrides || '[]',
      enabled: form.enabled, remark: form.remark || null,
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => editing
      ? api.put(`/ops-calendar/holidays/${editing.id}`, buildBody())
      : api.post('/ops-calendar/holidays', buildBody()),
    onSuccess: () => {
      toast.success(editing ? '节假日已更新' : '节假日已创建')
      qc.invalidateQueries({ queryKey: ['ops-holidays'] })
      setOpen(false)
    },
    onError: (e: unknown) => toast.error(errMsg(e, '保存失败')),
  })

  const columns: ColumnDef<HolidayVO>[] = useMemo(() => [
    { key: 'name', title: '名称', render: (h) => <span className="font-semibold text-v2-fg">{h.name}</span> },
    { key: 'range', title: '日期范围', render: (h) => <span className="font-v2-mono text-sm">{h.startDate} ~ {h.endDate}</span> },
    { key: 'type', title: '类型', render: (h) => TYPE_LABEL[h.holidayType] ?? h.holidayType },
    { key: 'overrides', title: '调休补班', render: (h) => <span className="text-v2-muted text-sm">{h.workdayOverrides && h.workdayOverrides !== '[]' ? h.workdayOverrides : '-'}</span> },
    { key: 'enabled', title: '状态', render: (h) => <StatusBadge status={h.enabled ? 'ok' : 'neutral'}>{h.enabled ? '启用' : '停用'}</StatusBadge> },
    { key: 'ops', title: '操作', align: 'right' as const, render: (h) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(h) }}>编辑</Button>
      ) },
  ], [])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="运维日历"
        title="节假日历"
        subtitle="维护节假日、调休补班日，支撑工作日判断与节前/节后相对日期任务（Phase 4）。"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => router.push('/ops-calendar')}><ArrowLeft className="h-4 w-4" />返回</Button>
            <Button variant="primary" onClick={openCreate}><Plus className="h-4 w-4" />新建节假日</Button>
          </div>
        }
      />

      <DataTable
        columns={columns} data={holidays} rowKey={(h) => h.id} loading={isLoading}
        empty={{ title: '暂无节假日', description: '点击右上角新建节假日。' }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? '编辑节假日' : '新建节假日'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>名称</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 国庆节" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>开始日期</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><Label>结束日期</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>
            <div>
              <Label>类型</Label>
              <Select value={form.holidayType} onValueChange={(v) => setForm({ ...form, holidayType: v ?? 'legal' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="legal">法定节假日</SelectItem>
                  <SelectItem value="company">公司假期</SelectItem>
                  <SelectItem value="campaign">重大保障期</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>调休补班日（逗号分隔，如 2026-10-11,2026-10-12）</Label>
              <Input value={form.workdayOverrides} onChange={(e) => setForm({ ...form, workdayOverrides: e.target.value })} placeholder="可留空" />
            </div>
            <div><Label>备注</Label><Input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              <Label>启用</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>取消</Button>
            <Button variant="primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name || !form.startDate || !form.endDate}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
