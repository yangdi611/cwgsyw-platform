'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { usePermission } from '@/hooks/usePermission'
import { AssociationDefsSection } from './AssociationDefsSection'
import type { CiModelAdminItem } from '@/types/cmdb-model'
import { getApiErrorMessage } from '@/lib/api-error'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  Checkbox,
  Chip,
  EmptyState,
  Field,
  IconButton,
  Input,
  LoadingState,
  NeutralAlertDialog,
  Select,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'
import { CmdbAdminActionIcon } from './CmdbAdminActionIcon'

interface AssociationAttrVO {
  id: number
  associationKind: string
  fieldKey: string
  name: string
  fieldType: string
  isRequired: boolean
  enumOptions: string | null
  defaultValue: string | null
  sortOrder: number
}

const FIELD_TYPE_OPTIONS = [
  { value: 'singlechar', label: '单行文本' },
  { value: 'int', label: '整数' },
  { value: 'enum', label: '枚举' },
  { value: 'date', label: '日期' },
]

const FIELD_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  FIELD_TYPE_OPTIONS.map(o => [o.value, o.label])
)

const DEFAULT_KINDS_DEPRECATED: string[] = []

function AssociationsTab() {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const canWrite = hasPermission('cmdb_model', 'update')

  // ── Association Kinds / Defs (read-only from model data) ──
  const { data: models = [] } = useQuery<CiModelAdminItem[]>({
    queryKey: ['cmdb-models'],
    queryFn: async () => {
      try {
        const r = await api.get('/cmdb/models')
        return r.data.data.records
      } catch {
        return []
      }
    },
    enabled: typeof window !== 'undefined',
  })

  // ── Association Kinds (real data, drives the kind dropdown) ──
  const { data: kinds = [] } = useQuery<{ id: number; code: string; name: string; isBuiltIn: boolean }[]>({
    queryKey: ['cmdb-association-kinds'],
    queryFn: async () => {
      try { return (await api.get('/cmdb/association-kinds')).data.data } catch { return [] }
    },
    enabled: typeof window !== 'undefined',
  })

  // ── Association Attribute Management (AC-5) ──
  const [selectedKind, setSelectedKind] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingAttr, setEditingAttr] = useState<AssociationAttrVO | null>(null)
  const [form, setForm] = useState({
    fieldKey: '', name: '', fieldType: 'singlechar',
    isRequired: false, enumOptions: '', defaultValue: '', sortOrder: 0,
  })

  const activeKind = selectedKind

  const { data: attrs = [], isLoading: attrsLoading, refetch: refetchAttrs } = useQuery<AssociationAttrVO[]>({
    queryKey: ['cmdb-asst-attrs', activeKind],
    queryFn: () => api.get(`/cmdb/association-kinds/${activeKind}/attributes`).then(r => r.data.data),
    enabled: !!activeKind,
  })

  const createAttrMutation = useMutation({
    mutationFn: () => api.post(`/cmdb/association-kinds/${activeKind}/attributes`, {
      fieldKey: form.fieldKey,
      name: form.name,
      fieldType: form.fieldType,
      isRequired: form.isRequired,
      enumOptions: form.fieldType === 'enum' ? form.enumOptions : undefined,
      defaultValue: form.defaultValue || undefined,
      sortOrder: form.sortOrder,
    }),
    onSuccess: () => {
      toast.success('关联扩展属性已创建')
      queryClient.invalidateQueries({ queryKey: ['cmdb-asst-attrs', activeKind] })
      resetForm()
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '创建失败')),
  })

  const updateAttrMutation = useMutation({
    mutationFn: (attr: AssociationAttrVO) => api.put(`/cmdb/association-kinds/${activeKind}/attributes/${attr.id}`, {
      name: form.name,
      isRequired: form.isRequired,
      enumOptions: form.fieldType === 'enum' ? form.enumOptions : undefined,
      defaultValue: form.defaultValue || undefined,
      sortOrder: form.sortOrder,
    }),
    onSuccess: () => {
      toast.success('关联扩展属性已更新')
      queryClient.invalidateQueries({ queryKey: ['cmdb-asst-attrs', activeKind] })
      resetForm()
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '更新失败')),
  })

  const deleteAttrMutation = useMutation({
    mutationFn: (attr: AssociationAttrVO) => api.delete(`/cmdb/association-kinds/${activeKind}/attributes/${attr.id}`),
    onSuccess: () => {
      toast.success('关联扩展属性已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-asst-attrs', activeKind] })
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '删除失败')),
  })

  function resetForm() {
    setShowForm(false)
    setEditingAttr(null)
    setForm({ fieldKey: '', name: '', fieldType: 'singlechar', isRequired: false, enumOptions: '', defaultValue: '', sortOrder: 0 })
  }

  function startEdit(attr: AssociationAttrVO) {
    setEditingAttr(attr)
    setForm({
      fieldKey: attr.fieldKey,
      name: attr.name,
      fieldType: attr.fieldType,
      isRequired: attr.isRequired,
      enumOptions: attr.enumOptions ?? '',
      defaultValue: attr.defaultValue ?? '',
      sortOrder: attr.sortOrder,
    })
    setShowForm(true)
  }

  function handleSubmit() {
    if (editingAttr) {
      updateAttrMutation.mutate(editingAttr)
    } else {
      createAttrMutation.mutate()
    }
  }

  const formValid = form.fieldKey && form.name

  const [deleteAttr, setDeleteAttr] = useState<AssociationAttrVO | null>(null)

  return (
    <div className="cwgsyw-cmdb-admin__panel-section cwgsyw-cmdb-admin__associations">
      <section className="cwgsyw-cmdb-admin__subsection">
        <div className="cwgsyw-cmdb-admin__section-title">关联种类</div>
        {kinds.length === 0 ? (
          <EmptyState title="暂无关联种类" description="还没有可选择的关联类型。" />
        ) : (
          <div className="cwgsyw-inline-controls">
            {kinds.map((kind) => (
              <Chip key={kind.code} label={`${kind.name} (${kind.code})`} />
            ))}
          </div>
        )}
      </section>

      <AssociationDefsSection models={models} kinds={kinds} canWrite={canWrite} />

      <section className="cwgsyw-cmdb-admin__subsection">
        <div className="cwgsyw-inline-controls cwgsyw-cmdb-admin__toolbar">
          <div className="cwgsyw-cmdb-admin__section-title">关联扩展属性管理</div>
          {activeKind && !showForm && canWrite ? (
            <Button type="button" size="sm" onClick={() => { resetForm(); setShowForm(true) }}>新增属性</Button>
          ) : null}
        </div>
        <Field label="选择关联类型" htmlFor="assoc-kind">
          <Select size="sm" overlay
            id="assoc-kind"
            value={selectedKind}
            placeholder="请选择关联类型"
            options={kinds.map((kind) => ({ value: kind.code, label: `${kind.name} (${kind.code})` }))}
            onChange={setSelectedKind}
          />
        </Field>

        {showForm ? (
          <div className="cwgsyw-form">
            <div className="cwgsyw-filter-grid">
              <Field label="字段标识" htmlFor="attr-key" required helperText="英文/下划线">
                <Input size="sm" id="attr-key" value={form.fieldKey} disabled={!!editingAttr} onChange={(event) => setForm((current) => ({ ...current, fieldKey: event.target.value }))} />
              </Field>
              <Field label="显示名称" htmlFor="attr-name" required>
                <Input size="sm" id="attr-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="字段类型" htmlFor="attr-type">
                <Select size="sm" overlay
                  id="attr-type"
                  value={form.fieldType}
                  options={FIELD_TYPE_OPTIONS}
                  onChange={(value) => setForm((current) => ({ ...current, fieldType: value }))}
                />
              </Field>
              <Field label="默认值" htmlFor="attr-default">
                <Input size="sm" id="attr-default" value={form.defaultValue} onChange={(event) => setForm((current) => ({ ...current, defaultValue: event.target.value }))} />
              </Field>
              <Field label="排序" htmlFor="attr-sort">
                <Input size="sm" id="attr-sort" type="number" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: parseInt(event.target.value) || 0 }))} />
              </Field>
              <Checkbox
                id="is-required"
                label="必填"
                checked={form.isRequired}
                onChange={(event) => setForm((current) => ({ ...current, isRequired: event.currentTarget.checked }))}
              />
            </div>
            {form.fieldType === 'enum' ? (
              <Field label="枚举选项" htmlFor="attr-enum" helperText="逗号分隔">
                <Input size="sm" id="attr-enum" value={form.enumOptions} onChange={(event) => setForm((current) => ({ ...current, enumOptions: event.target.value }))} />
              </Field>
            ) : null}
            <div className="cwgsyw-inline-controls">
              <Button type="button" disabled={!formValid || createAttrMutation.isPending || updateAttrMutation.isPending} onClick={handleSubmit}>
                {editingAttr ? '更新' : '创建'}
              </Button>
              <Button type="button" variant="ghost" onClick={resetForm}>取消</Button>
            </div>
          </div>
        ) : null}

        {activeKind ? (
          attrsLoading ? (
            <LoadingState label="加载扩展属性" />
          ) : attrs.length === 0 ? (
            <EmptyState
              title={`关联类型「${activeKind}」暂无扩展属性定义`}
              action={canWrite ? <Button type="button" size="sm" onClick={() => { resetForm(); setShowForm(true) }}>新增属性</Button> : undefined}
            />
          ) : (
            <Table
              className={`cwgsyw-cmdb-table${canWrite ? ' cwgsyw-cmdb-admin__action-table' : ''}`}
              showSearch={false}
              columns={[
                { key: 'fieldKey', label: '标识' },
                { key: 'name', label: '名称' },
                { key: 'type', label: '类型' },
                { key: 'required', label: '必填' },
                { key: 'default', label: '默认值' },
                { key: 'sort', label: '排序' },
                ...(canWrite ? [{ key: 'actions', label: '', align: 'right' as const }] : []),
              ]}
              rows={attrs.map((attr) => ({
                id: String(attr.id),
                cells: {
                  fieldKey: attr.fieldKey,
                  name: attr.name,
                  type: <StatusBadge label={FIELD_TYPE_LABEL[attr.fieldType] ?? attr.fieldType} status="neutral" />,
                  required: attr.isRequired ? '是' : '否',
                  default: attr.defaultValue || '-',
                  sort: attr.sortOrder,
                  actions: canWrite ? (
                    <div className="cwgsyw-inline-controls cwgsyw-cmdb-admin__row-actions">
                      <IconButton type="button" size="sm" variant="ghost" icon={<CmdbAdminActionIcon name="edit" />} aria-label={`编辑扩展属性 ${attr.name}`} title="编辑" onClick={() => startEdit(attr)} />
                      <IconButton type="button" size="sm" variant="ghost" className="cwgsyw-cmdb-admin__delete-action" icon={<CmdbAdminActionIcon name="trash" />} aria-label={`删除扩展属性 ${attr.name}`} title="删除" onClick={() => setDeleteAttr(attr)} />
                    </div>
                  ) : null,
                },
              }))}
            />
          )
        ) : null}
      </section>

      <NeutralAlertDialog
        open={!!deleteAttr}
        onOpenChange={(open) => !open && setDeleteAttr(null)}
        title="确认删除扩展属性"
        description={`删除扩展属性「${deleteAttr?.name ?? ''}」?`}
        intent="destructive"
        confirmLabel="删除"
        onConfirm={() => {
          if (deleteAttr) deleteAttrMutation.mutate(deleteAttr)
          setDeleteAttr(null)
        }}
      />
    </div>
  )
}

export { AssociationsTab }
