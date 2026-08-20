'use client'

import type { FieldTypeMetadata } from '@/lib/task-template-api'
import { Button } from '@/design-system/figma-neutral/components'

export function FieldLibrary({
  fieldTypes,
  disabled,
  onAdd,
}: {
  fieldTypes: FieldTypeMetadata[]
  disabled: boolean
  onAdd: (type: FieldTypeMetadata) => void
}) {
  const categories = fieldTypes.reduce<Record<string, FieldTypeMetadata[]>>((result, fieldType) => {
    result[fieldType.category] = [...(result[fieldType.category] ?? []), fieldType]
    return result
  }, {})
  return (
    <aside className="cwgsyw-designer__pane cwgsyw-designer__library">
      <div>
        <h2 className="cwgsyw-type-title-sm">字段组件库</h2>
        <p className="cwgsyw-type-label-xs">点击加入表单画布</p>
      </div>
      <div className="cwgsyw-form">
        {Object.entries(categories).map(([category, types]) => (
          <section key={category} className="cwgsyw-form">
            <h3 className="cwgsyw-type-label-xs">{category}</h3>
            <div className="cwgsyw-designer__type-grid">
              {types.map((type) => (
                <Button
                  key={type.type}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onAdd(type)}
                  className="cwgsyw-designer__type"
                  trailingIcon={<span aria-hidden="true">+</span>}
                >
                  {type.label}
                </Button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  )
}
