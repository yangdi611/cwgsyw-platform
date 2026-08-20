'use client'

import { useState } from 'react'
import { Button, Checkbox, NeutralPopover } from '@/design-system/figma-neutral/components'

export interface ColumnDef {
  key: string
  name: string
  required?: boolean
}

interface ColumnPickerProps {
  allColumns: ColumnDef[]
  visibleKeys: string[]
  onToggle: (key: string) => void
}

export function ColumnPicker({ allColumns, visibleKeys, onToggle }: ColumnPickerProps) {
  const [open, setOpen] = useState(false)
  return (
    <NeutralPopover
      title="显示列"
      trigger={<Button type="button" size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>列显示</Button>}
    >
      <div className="cwgsyw-stack-list">
        {allColumns.map((col) => (
          <Checkbox
            key={col.key}
            label={col.name}
            checked={visibleKeys.includes(col.key)}
            disabled={col.required}
            onChange={() => { if (!col.required) onToggle(col.key) }}
          />
        ))}
      </div>
    </NeutralPopover>
  )
}
