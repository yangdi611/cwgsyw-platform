'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { type HolidayVO, errMsg } from '@/lib/opsCalendar'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  DataManagementPage,
  DateInput,
  EmptyState,
  Field,
  Input,
  NeutralAlertDialog,
  NeutralDialog,
  PageHeader,
  Select,
  StatusBadge,
  Switch,
  Table,
} from '@/design-system/figma-neutral/components'

const TYPE_LABEL: Record<string, string> = { legal: '法定节假日', company: '公司假期', campaign: '重大保障期' }

export default function HolidaysPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!hasPermission('calendar_settings', 'read')) router.replace('/ops-calendar')
  }, [hasPermission, router])

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<HolidayVO | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HolidayVO | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    holidayType: 'legal',
    workdayOverrides: '',
    enabled: true,
    remark: '',
  })

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ['calendar-settings-holidays'],
    queryFn: () => api.get('/calendar-settings/holidays').then((response) => response.data.data as HolidayVO[]),
  })
  const canManage = hasPermission('calendar_settings', 'manage')

  function openCreate() {
    setEditing(null)
    setForm({ name: '', startDate: '', endDate: '', holidayType: 'legal', workdayOverrides: '', enabled: true, remark: '' })
    setOpen(true)
  }

  function openEdit(holiday: HolidayVO) {
    setEditing(holiday)
    setForm({
      name: holiday.name,
      startDate: holiday.startDate,
      endDate: holiday.endDate,
      holidayType: holiday.holidayType,
      workdayOverrides: holiday.workdayOverrides ?? '',
      enabled: holiday.enabled,
      remark: holiday.remark ?? '',
    })
    setOpen(true)
  }

  function buildBody() {
    let overrides = form.workdayOverrides.trim()
    if (overrides && !overrides.startsWith('[')) {
      overrides = JSON.stringify(overrides.split(/[,，\s]+/).filter(Boolean))
    }
    return {
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      holidayType: form.holidayType,
      workdayOverrides: overrides || '[]',
      enabled: form.enabled,
      remark: form.remark || null,
    }
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? api.put(`/calendar-settings/holidays/${editing.id}`, buildBody())
        : api.post('/calendar-settings/holidays', buildBody()),
    onSuccess: () => {
      toast.success(editing ? '节假日已更新' : '节假日已创建')
      queryClient.invalidateQueries({ queryKey: ['calendar-settings-holidays'] })
      setOpen(false)
    },
    onError: (error: unknown) => toast.error(errMsg(error, '保存失败')),
  })

  const importMutation = useMutation({
    mutationFn: (year: number) => api.post(`/calendar-settings/holidays/import-cn?year=${year}`).then((response) => response.data),
    onSuccess: (result) => {
      toast.success(`已导入 ${result?.data ?? 0} 条 ${new Date().getFullYear()} 年法定节假日`)
      queryClient.invalidateQueries({ queryKey: ['calendar-settings-holidays'] })
      setImportOpen(false)
    },
    onError: (error: unknown) => toast.error(errMsg(error, '导入失败')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/calendar-settings/holidays/${id}`),
    onSuccess: () => {
      toast.success('节假日已删除')
      queryClient.invalidateQueries({ queryKey: ['calendar-settings-holidays'] })
      setDeleteTarget(null)
    },
    onError: (error: unknown) => toast.error(errMsg(error, '删除失败')),
  })

  return (
    <>
      <DataManagementPage
        className="cwgsyw-ops"
        embedded
        header={
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="节假日历"
            subtitle="维护节假日、调休补班日，支撑工作日判断。"
            actions={
              <div className="cwgsyw-ops__actions">
                <Button type="button" size="sm" variant="secondary" onClick={() => router.push('/ops-calendar')}>
                  返回日历
                </Button>
                {canManage ? (
                  <Button type="button" size="sm" variant="secondary" loading={importMutation.isPending} onClick={() => setImportOpen(true)}>
                    导入法定节假日
                  </Button>
                ) : null}
                {canManage ? (
                  <Button type="button" size="sm" variant="primary" onClick={openCreate}>
                    新建节假日
                  </Button>
                ) : null}
              </div>
            }
          />
        }
        content={
          <Table
            className="cwgsyw-cmdb-table cwgsyw-ops__table"
            density="compact"
            showSearch={false}
            columns={[
              { key: 'name', label: '名称' },
              { key: 'range', label: '日期范围' },
              { key: 'type', label: '类型' },
              { key: 'overrides', label: '调休补班' },
              { key: 'enabled', label: '状态' },
              { key: 'remark', label: '备注' },
              { key: 'updatedAt', label: '最近更新' },
              { key: 'ops', label: '操作', align: 'right' },
            ]}
            rows={holidays.map((holiday) => ({
              id: String(holiday.id),
              cells: {
                name: holiday.name,
                range: `${holiday.startDate} ~ ${holiday.endDate}`,
                type: TYPE_LABEL[holiday.holidayType] ?? holiday.holidayType,
                overrides: holiday.workdayOverrides && holiday.workdayOverrides !== '[]' ? holiday.workdayOverrides : '-',
                enabled: <StatusBadge size="sm" label={holiday.enabled ? '启用' : '停用'} status={holiday.enabled ? 'success' : 'neutral'} />,
                remark: holiday.remark ?? '-',
                updatedAt: `${holiday.updatedBy ? `用户 #${holiday.updatedBy}` : '-'} ${holiday.updatedAt?.slice(0, 16).replace('T', ' ') ?? ''}`,
                ops: canManage ? (
                  <div className="cwgsyw-ops__row-actions">
                    <button type="button" className="cwgsyw-ops__icon-btn" aria-label={`编辑 ${holiday.name}`} onClick={() => openEdit(holiday)}>
                      <span className="cwgsyw-ops__icon cwgsyw-ops__icon--edit" aria-hidden="true" />
                    </button>
                    <button type="button" className="cwgsyw-ops__icon-btn is-danger" aria-label={`删除 ${holiday.name}`} onClick={() => setDeleteTarget(holiday)}>
                      <span className="cwgsyw-ops__icon cwgsyw-ops__icon--trash" aria-hidden="true" />
                    </button>
                  </div>
                ) : null,
              },
            }))}
            state={isLoading ? 'loading' : holidays.length === 0 ? 'empty' : 'data'}
            empty={
              <div className="cwgsyw-ops__empty">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/figma-icons/home-calendar.svg" width={22} height={22} alt="" data-figma-node="6:24162" />
                <EmptyState showIcon={false} title="暂无节假日" description="点击右上角新建节假日。" showAction={false} />
              </div>
            }
          />
        }
      />

      <NeutralDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? '编辑节假日' : '新建节假日'}
        size="sm"
        showClose
        footer={
          <div className="cwgsyw-ops-dialog__footer">
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={saveMutation.isPending}
              disabled={!form.name || !form.startDate || !form.endDate}
              onClick={() => saveMutation.mutate()}
            >
              保存
            </Button>
          </div>
        }
      >
        <div className="cwgsyw-ops-dialog">
          <Field htmlFor="holiday-name" label="名称" required>
            <Input size="sm" id="holiday-name" value={form.name} placeholder="如 国庆节" onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field htmlFor="holiday-start" label="开始日期" required>
            <DateInput size="sm" id="holiday-start" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
          </Field>
          <Field htmlFor="holiday-end" label="结束日期" required>
            <DateInput size="sm" id="holiday-end" type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
          </Field>
          <Field htmlFor="holiday-type" label="类型">
            <Select
              overlay
              size="sm"
              id="holiday-type"
              value={form.holidayType}
              options={[
                { value: 'legal', label: '法定节假日' },
                { value: 'company', label: '公司假期' },
                { value: 'campaign', label: '重大保障期' },
              ]}
              onChange={(value) => setForm({ ...form, holidayType: value })}
            />
          </Field>
          <Field htmlFor="holiday-overrides" label="调休补班日" helperText="逗号分隔，如 2026-10-11,2026-10-12">
            <Input
              size="sm"
              id="holiday-overrides"
              value={form.workdayOverrides}
              placeholder="可留空"
              onChange={(event) => setForm({ ...form, workdayOverrides: event.target.value })}
            />
          </Field>
          <Field htmlFor="holiday-remark" label="备注">
            <Input size="sm" id="holiday-remark" value={form.remark} onChange={(event) => setForm({ ...form, remark: event.target.value })} />
          </Field>
          <Switch
            label="启用"
            checked={form.enabled}
            onChange={(event) => setForm({ ...form, enabled: event.currentTarget.checked })}
          />
        </div>
      </NeutralDialog>

      <NeutralAlertDialog
        open={importOpen}
        title="导入法定节假日"
        description="导入 2026 年中国法定节假日（估算值，可后续按公告调整）？"
        confirmLabel="导入"
        onConfirm={() => importMutation.mutate(2026)}
        onOpenChange={(next) => {
          if (!next) setImportOpen(false)
        }}
      />

      <NeutralAlertDialog
        open={!!deleteTarget}
        title="确认删除节假日"
        description={deleteTarget ? `确认删除「${deleteTarget.name}」？` : '确认删除该节假日？'}
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
