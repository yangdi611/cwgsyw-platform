'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/v2/Button'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Checkbox } from '@/components/v2/Checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/v2/Select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/v2/Dialog'
import type { CiAttributeGroupVO } from './types'
import { FIELD_TYPES, TABLE_SCHEMA_TEMPLATE, optionToJson } from './types'

interface AddAttributeDialogProps {
  open: boolean
  groups: CiAttributeGroupVO[]
  isPending: boolean
  onClose: () => void
  onCreate: (data: {
    fieldKey: string
    displayName: string
    fieldType: string
    required: boolean
    searchable: boolean
    unique: boolean
    inList: boolean
    inForm: boolean
    groupId: number | null
    options: string | null
    validation: string | null
  }) => void
}

export function AddAttributeDialog({
  open,
  groups,
  isPending,
  onClose,
  onCreate,
}: AddAttributeDialogProps) {
  const [fieldKey, setFieldKey] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [fieldType, setFieldType] = useState('text')
  const [required, setRequired] = useState(false)
  const [searchable, setSearchable] = useState(false)
  const [unique, setUnique] = useState(false)
  const [inList, setInList] = useState(true)
  const [inForm, setInForm] = useState(true)
  const [groupId, setGroupId] = useState<number | null>(null)
  const [optionsStr, setOptionsStr] = useState('')
  const [validationStr, setValidationStr] = useState('')

  useEffect(() => {
    if (!open) {
      setFieldKey('')
      setDisplayName('')
      setFieldType('text')
      setRequired(false)
      setSearchable(false)
      setUnique(false)
      setInList(true)
      setInForm(true)
      setGroupId(null)
      setOptionsStr('')
      setValidationStr('')
    }
  }, [open])

  const handleCreate = () => {
    const options =
      fieldType === 'select' || fieldType === 'multi_select'
        ? optionToJson(optionsStr)
        : fieldType === 'table'
          ? TABLE_SCHEMA_TEMPLATE
          : null

    const validation = validationStr.trim() || null

    onCreate({
      fieldKey: fieldKey.trim(),
      displayName: displayName.trim(),
      fieldType,
      required,
      searchable,
      unique,
      inList,
      inForm,
      groupId,
      options,
      validation,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>新建属性</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                字段标识 <span className="text-v2-danger">*</span>
              </Label>
              <Input
                placeholder="例如：cpu_cores"
                value={fieldKey}
                onChange={(e) => setFieldKey(e.target.value)}
              />
              <p className="text-xs text-v2-muted">后端字段名（snake_case），创建后不可修改</p>
            </div>
            <div className="space-y-1.5">
              <Label>
                显示名称 <span className="text-v2-danger">*</span>
              </Label>
              <Input
                placeholder="例如：CPU 核数"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>类型</Label>
              <Select value={fieldType} onValueChange={(v) => v && setFieldType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>所属分组</Label>
              <Select
                value={groupId === null ? '__null__' : String(groupId)}
                onValueChange={(v) => {
                  if (v === '__null__') {
                    setGroupId(null)
                  } else {
                    setGroupId(Number(v))
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="无" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__null__">无</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(fieldType === 'select' || fieldType === 'multi_select') && (
            <div className="space-y-1.5">
              <Label>选项（逗号分隔）</Label>
              <Input
                placeholder="选项1,选项2,选项3"
                value={optionsStr}
                onChange={(e) => setOptionsStr(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>校验规则（可选）</Label>
            <Input
              placeholder="例如：^[0-9]+$"
              value={validationStr}
              onChange={(e) => setValidationStr(e.target.value)}
            />
            <p className="text-xs text-v2-muted">正则表达式（前端校验用）</p>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox checked={required} onCheckedChange={(v) => setRequired(!!v)} />
              <span>必填</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={searchable} onCheckedChange={(v) => setSearchable(!!v)} />
              <span>可搜索</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={unique} onCheckedChange={(v) => setUnique(!!v)} />
              <span>唯一</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={inList} onCheckedChange={(v) => setInList(!!v)} />
              <span>列表显示</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={inForm} onCheckedChange={(v) => setInForm(!!v)} />
              <span>表单显示</span>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            disabled={!fieldKey.trim() || !displayName.trim() || isPending}
            onClick={handleCreate}
          >
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
