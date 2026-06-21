'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Settings2 } from 'lucide-react'

export interface ColumnDef {
  key: string
  name: string
  required?: boolean  // required columns cannot be hidden
}

interface ColumnPickerProps {
  allColumns: ColumnDef[]
  visibleKeys: string[]
  onToggle: (key: string) => void
}

export function ColumnPicker({ allColumns, visibleKeys, onToggle }: ColumnPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <Button size="sm" variant="outline" onClick={() => setOpen(v => !v)}>
        <Settings2 className="h-3.5 w-3.5 mr-1" />列显示
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded-lg shadow-lg p-2 min-w-36">
            <p className="text-xs text-v2-muted px-2 py-1 mb-1">显示列</p>
            {allColumns.map(col => (
              <label
                key={col.key}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
                  col.required
                    ? 'cursor-default opacity-60'
                    : 'hover:bg-muted/50 cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={visibleKeys.includes(col.key)}
                  disabled={col.required}
                  onChange={() => !col.required && onToggle(col.key)}
                  className="rounded"
                />
                {col.name}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
