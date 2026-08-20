'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { Button, Field, Input, NeutralDialog, Select } from '@/design-system/figma-neutral/components'

interface AttrDef {
  fieldKey: string
  name: string
  fieldType: string
  isEditable?: boolean
  option?: { id: string; name: string }[] | null
}

interface BatchUpdateResult {
  total: number
  succeeded: number
  failed: number
  failures: { id: number; error: string }[]
}

export function BatchEditDialog({
  open,
  onClose,
  modelCode,
  attributes,
  selectedIds,
  onDone,
}: {
  open: boolean
  onClose: () => void
  modelCode: string
  attributes: AttrDef[]
  selectedIds: number[]
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [fieldKey, setFieldKey] = useState('')
  const [value, setValue] = useState('')
  const SCALAR = new Set(['singlechar', 'longchar', 'int', 'float', 'bool', 'enum', 'date', 'objuser'])
  const editable = attributes.filter((a) => a.isEditable !== false && SCALAR.has(a.fieldType))
  const current = editable.find((a) => a.fieldKey === fieldKey)

  const mutation = useMutation({
    mutationFn: () =>
      api
        .post('/cmdb/instances/batch-update', {
          ids: selectedIds,
          fields: { [fieldKey]: coerce(current?.fieldType, value) },
        })
        .then((r) => r.data.data as BatchUpdateResult),
    onSuccess: (res) => {
      if (res.failed === 0) toast.success(`已更新 ${res.succeeded} 条`)
      else toast.warning(`成功 ${res.succeeded} 条，失败 ${res.failed} 条：${res.failures[0]?.error ?? ''}`)
      queryClient.invalidateQueries({ queryKey: ['cmdb-instances', modelCode] })
      setFieldKey('')
      setValue('')
      onDone()
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '批量更新失败')
    },
  })

  return (
    <NeutralDialog
      open={open}
      onOpenChange={(next) => { if (!next) onClose() }}
      title={`批量编辑（${selectedIds.length} 条）`}
      footer={
        <div className="cwgsyw-inline-controls">
          <Button type="button" variant="secondary" onClick={onClose}>取消</Button>
          <Button
            type="button"
            disabled={!fieldKey || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? '提交中…' : '应用'}
          </Button>
        </div>
      }
    >
      <Field label="选择字段">
        <Select size="sm" overlay
          value={fieldKey}
          placeholder="选择要修改的公共字段"
          options={editable.map((a) => ({ value: a.fieldKey, label: a.name }))}
          onChange={(next) => { setFieldKey(next); setValue('') }}
        />
      </Field>
      {fieldKey ? (
        <Field label="新值" helperText={`将覆盖所选 ${selectedIds.length} 个实例的该字段。`}>
          {current?.fieldType === 'enum' && Array.isArray(current.option) ? (
            <Select size="sm" overlay
              value={value}
              placeholder="请选择"
              options={current.option.map((o) => ({ value: o.id, label: o.name }))}
              onChange={setValue}
            />
          ) : current?.fieldType === 'bool' ? (
            <Select size="sm" overlay
              value={value}
              placeholder="请选择"
              options={[{ value: 'true', label: '是' }, { value: 'false', label: '否' }]}
              onChange={setValue}
            />
          ) : current?.fieldType === 'date' ? (
            <Input size="sm" type="date" value={value} onChange={(e) => setValue(e.target.value)} />
          ) : current?.fieldType === 'int' || current?.fieldType === 'float' ? (
            <Input size="sm" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          ) : (
            <Input size="sm" value={value} onChange={(e) => setValue(e.target.value)} placeholder="输入新值" />
          )}
        </Field>
      ) : null}
    </NeutralDialog>
  )
}

function coerce(fieldType: string | undefined, v: string): unknown {
  if (fieldType === 'int') return v === '' ? null : Number.parseInt(v, 10)
  if (fieldType === 'float') return v === '' ? null : Number.parseFloat(v)
  if (fieldType === 'bool') return v === 'true'
  return v
}
