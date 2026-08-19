'use client'

import { TableFieldEditor } from '@/components/change-doc/TableFieldEditor'
import { isTableFieldConfig, type FieldConfigVO, type TableRow } from '@/components/change-doc/tableFieldTypes'
import '@/design-system/figma-neutral/index.css'
import { Field, IconButton, Input, NeutralTooltip, Select, Textarea } from '@/design-system/figma-neutral/components'

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
          <div key={field.fieldKey} className={isTextarea ? 'cwgsyw-form cwgsyw-change-doc-field-list__textarea' : 'cwgsyw-form'}>
            {editable && isTextarea ? (
              <div className="cwgsyw-designer__actions cwgsyw-change-doc-field-list__ai-action">
                <NeutralTooltip content="AI 生成" className="cwgsyw-tooltip--pill" followCursor>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="AI 生成"
                    loading={aiLoadingField === field.fieldKey}
                    onClick={() => onAiGenerate(field.fieldKey)}
                    icon={
                      <img className="cwgsyw-change-doc-field-list__ai-icon" src="/figma-icons/change-doc-ai-sparkles.svg" alt="" aria-hidden="true" />
                    }
                  />
                </NeutralTooltip>
              </div>
            ) : null}
            {editable ? (
              field.fieldType === 'enum' ? (
                <Field label={field.label} required={field.required}>
                  <Select
                    size="sm"
                    overlay
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
                    size="sm"
                    value={value}
                    rows={4}
                    placeholder={field.placeholder ?? undefined}
                    onChange={onFieldChange(field.fieldKey)}
                  />
                </Field>
              ) : (
                <Field label={field.label} required={field.required}>
                  <Input
                    size="sm"
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
