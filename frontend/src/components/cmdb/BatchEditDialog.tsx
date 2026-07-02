'use client'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/v2/Button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { X } from 'lucide-react'

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

/**
 * 批量编辑弹窗（spec §9.1）。对选中实例覆盖一个公共标量字段。
 * 仅暴露标量类型字段（排除 table 等），调 POST /cmdb/instances/batch-update。
 */
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

  // 仅标量公共字段：排除 table 类型（变长结构化，不支持批量覆盖）
  const SCALAR = new Set(['singlechar', 'longchar', 'int', 'float', 'bool', 'enum', 'date', 'objuser'])
  const editable = attributes.filter(
    (a) => a.isEditable !== false && SCALAR.has(a.fieldType),
  )
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
      if (res.failed === 0) {
        toast.success(`已更新 ${res.succeeded} 条`)
      } else {
        toast.warning(`成功 ${res.succeeded} 条，失败 ${res.failed} 条：${res.failures[0]?.error ?? ''}`)
      }
      queryClient.invalidateQueries({ queryKey: ['cmdb-instances', modelCode] })
      reset()
      onDone()
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '批量更新失败')
    },
  })

  function reset() {
    setFieldKey('')
    setValue('')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[480px] rounded-xl border border-v2-border bg-v2-surface p-5 shadow-v2-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-v2-fg">批量编辑（{selectedIds.length} 条）</h3>
          <button onClick={onClose} className="text-v2-muted hover:text-v2-fg">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-v2-fg">选择字段</label>
            <Select value={fieldKey} onValueChange={(v) => { setFieldKey(v ?? ''); setValue('') }}>
              <SelectTrigger>
                <SelectValue placeholder="选择要修改的公共字段">
                  {(v: string) => editable.find((a) => a.fieldKey === v)?.name ?? '选择要修改的公共字段'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {editable.map((a) => (
                  <SelectItem key={a.fieldKey} value={a.fieldKey}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {fieldKey && (
            <div>
              <label className="mb-1 block text-sm font-medium text-v2-fg">新值</label>
              {current?.fieldType === 'enum' && Array.isArray(current.option) ? (
                <Select value={value} onValueChange={(v) => setValue(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择">
                      {(v: string) => current.option?.find((o) => o.id === v)?.name ?? '请选择'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {current.option!.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : current?.fieldType === 'bool' ? (
                <Select value={value} onValueChange={(v) => setValue(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择">
                      {(v: string) => (v === 'true' ? '是' : v === 'false' ? '否' : '请选择')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">是</SelectItem>
                    <SelectItem value="false">否</SelectItem>
                  </SelectContent>
                </Select>
              ) : current?.fieldType === 'date' ? (
                <Input type="date" value={value} onChange={(e) => setValue(e.target.value)} />
              ) : current?.fieldType === 'int' || current?.fieldType === 'float' ? (
                <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
              ) : (
                <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="输入新值" />
              )}
              <p className="mt-1.5 text-xs text-v2-muted">将覆盖所选 {selectedIds.length} 个实例的该字段。</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            disabled={!fieldKey || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? '提交中…' : '应用'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** 按字段类型把字符串值转成后端期望的 JSON 类型。 */
function coerce(fieldType: string | undefined, v: string): unknown {
  if (fieldType === 'int') return v === '' ? null : Number.parseInt(v, 10)
  if (fieldType === 'float') return v === '' ? null : Number.parseFloat(v)
  if (fieldType === 'bool') return v === 'true'
  return v
}
