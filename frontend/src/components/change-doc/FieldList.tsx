'use client'

import { TableFieldEditor } from '@/components/change-doc/TableFieldEditor'
import { isTableFieldConfig, type FieldConfigVO, type TableRow } from '@/components/change-doc/tableFieldTypes'
import '@/design-system/figma-neutral/index.css'
import { Button, Field, Input, Select, Textarea } from '@/design-system/figma-neutral/components'

interface FieldListProps {
  fields: FieldConfigVO[]
  editable: boolean
  fieldsData: Record<string, unknown>
  aiLoadingField: string | null
  onFieldChange: (key: string) => React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  onTableFieldChange: (key: string) => (rows: TableRow[]) => void
  onAiGenerate: (fieldKey: string) => void
}

export function FieldList({
  fields,
  editable,
  fieldsData,
  aiLoadingField,
  onFieldChange,
  onTableFieldChange,
  onAiGenerate,
}: FieldListProps) {
  return (
    <div className="cwgsyw-form">
      {fields.map((field) => {
        if (field.fieldType === 'table' && isTableFieldConfig(field.config)) {
          const rows = Array.isArray(fieldsData[field.fieldKey]) ? (fieldsData[field.fieldKey] as TableRow[]) : []
          return (
            <Field key={field.fieldKey} label={field.label} required={field.required}>
              <TableFieldEditor
                config={field.config}
                rows={rows}
                onChange={onTableFieldChange(field.fieldKey)}
                disabled={!editable}
              />
            </Field>
          )
        }

        const rawValue = fieldsData[field.fieldKey]
        const value = rawValue === null || rawValue === undefined ? '' : String(rawValue)
        const isTextarea = field.fieldType === 'textarea'
        const enumOptions = Array.isArray((field.config as { options?: unknown } | undefined)?.options)
          ? (field.config as { options: { value: string; label: string }[] }).options
          : []

        return (
          <div key={field.fieldKey} className="cwgsyw-form">
            <div className="cwgsyw-designer__actions">
              {editable && isTextarea ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onAiGenerate(field.fieldKey)}
                  disabled={aiLoadingField === field.fieldKey}
                >
                  {aiLoadingField === field.fieldKey ? 'AI 生成中…' : 'AI 生成'}
                </Button>
              ) : null}
            </div>
            {editable ? (
              field.fieldType === 'enum' ? (
                <Field label={field.label} required={field.required}>
                  <Select
                    value={value}
                    placeholder="请选择"
                    options={[{ value: '', label: '请选择' }, ...enumOptions]}
                    onChange={(next) =>
                      onFieldChange(field.fieldKey)({ target: { value: next } } as React.ChangeEvent<HTMLSelectElement>)
                    }
                  />
                </Field>
              ) : isTextarea ? (
                <Field label={field.label} required={field.required}>
                  <Textarea
                    value={value}
                    rows={4}
                    placeholder={field.placeholder ?? undefined}
                    onChange={onFieldChange(field.fieldKey)}
                  />
                </Field>
              ) : (
                <Field label={field.label} required={field.required}>
                  <Input
                    type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : field.fieldType === 'datetime' ? 'datetime-local' : 'text'}
                    value={value}
                    placeholder={field.placeholder ?? undefined}
                    onChange={onFieldChange(field.fieldKey)}
                  />
                </Field>
              )
            ) : (
              <Field label={field.label} required={field.required}>
                <p>{value || '—'}</p>
              </Field>
            )}
          </div>
        )
      })}
    </div>
  )
}
