'use client'

import { Button } from '@/components/v2/Button'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Textarea } from '@/components/v2/Textarea'
import { Sparkles } from 'lucide-react'
import { TableFieldEditor } from '@/components/change-doc/TableFieldEditor'
import { isTableFieldConfig, type TableRow, type FieldConfigVO } from '@/components/change-doc/tableFieldTypes'

interface FieldListProps {
  fields: FieldConfigVO[]
  editable: boolean
  fieldsData: Record<string, unknown>
  aiLoadingField: string | null
  onFieldChange: (key: string) => React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>
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
    <>
      {fields.map((field) => {
        if (field.fieldType === 'table' && isTableFieldConfig(field.config)) {
          const rows = Array.isArray(fieldsData[field.fieldKey])
            ? (fieldsData[field.fieldKey] as TableRow[])
            : []
          return (
            <div key={field.fieldKey} className="space-y-1.5">
              <Label>
                {field.label}
                {field.required && <span className="ml-1 text-v2-danger">*</span>}
              </Label>
              <TableFieldEditor
                config={field.config}
                rows={rows}
                onChange={onTableFieldChange(field.fieldKey)}
                disabled={!editable}
              />
            </div>
          )
        }

        const value =
          typeof fieldsData[field.fieldKey] === 'string'
            ? (fieldsData[field.fieldKey] as string)
            : ''
        const isTextarea = field.fieldType === 'textarea'

        return (
          <div key={field.fieldKey} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>
                {field.label}
                {field.required && <span className="ml-1 text-v2-danger">*</span>}
              </Label>
              {editable && isTextarea && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onAiGenerate(field.fieldKey)}
                  disabled={aiLoadingField === field.fieldKey}
                >
                  <Sparkles className="h-3 w-3" />
                  {aiLoadingField === field.fieldKey ? 'AI 生成中…' : 'AI 生成'}
                </Button>
              )}
            </div>
            {editable ? (
              isTextarea ? (
                <Textarea
                  value={value}
                  onChange={onFieldChange(field.fieldKey)}
                  placeholder={field.placeholder ?? undefined}
                  rows={4}
                />
              ) : field.fieldType === 'date' ? (
                <Input type="date" value={value} onChange={onFieldChange(field.fieldKey)} />
              ) : field.fieldType === 'datetime' ? (
                <Input
                  type="datetime-local"
                  value={value}
                  onChange={onFieldChange(field.fieldKey)}
                />
              ) : (
                <Input
                  value={value}
                  onChange={onFieldChange(field.fieldKey)}
                  placeholder={field.placeholder ?? undefined}
                />
              )
            ) : (
              <p className="whitespace-pre-wrap text-sm text-v2-fg">{value || '—'}</p>
            )}
          </div>
        )
      })}
    </>
  )
}
