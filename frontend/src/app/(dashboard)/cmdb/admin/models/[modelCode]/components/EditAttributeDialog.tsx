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
import type { CiAttributeVO, CiAttributeGroupVO } from './types'
import { FIELD_TYPES, TABLE_SCHEMA_TEMPLATE, optionToJson } from './types'

interface EditAttributeDialogProps {
  attr: CiAttributeVO | null
  groups: CiAttributeGroupVO[]
  isPending: boolean
  onClose: () => void
  onUpdate: (data: {
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

export function EditAttributeDialog({
  attr,
  groups,
  isPending,
  onClose,
  onUpdate,
}: EditAttributeDialogProps) {
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
    if (attr) {
      // Use setTimeout to defer setState calls
      const timer = setTimeout(() => {
        setDisplayName(attr.displayName)
        setFieldType(attr.fieldType)
        setRequired(attr.required)
        setSearchable(attr.searchable)
        setUnique(attr.unique)
        setInList(attr.inList)
        setInForm(attr.inForm)
        setGroupId(attr.groupId)
        setValidationStr(attr.validation ?? '')

        if (attr.fieldType === 'select' || attr.fieldType === 'multi_select') {
          try {
            const arr = JSON.parse(attr.options ?? '[]') as string[]
            setOptionsStr(arr.join(','))
          } catch {
            setOptionsStr('')
          }
        } else {
          setOptionsStr('')
        }
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [attr])

  if (!attr) return null

  const handleUpdate = () => {
    const options =
      fieldType === 'select' || fieldType === 'multi_select'
        ? optionToJson(optionsStr)
        : fieldType === 'table'
          ? TABLE_SCHEMA_TEMPLATE
          : null

    const validation = validationStr.trim() || null

    onUpdate({
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
    <Dialog open={!!attr} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑属性</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>字段标识</Label>
            <Input value={attr.fieldKey} disabled />
            <p className="text-xs text-v2-muted">字段标识创建后不可修改</p>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>类型</Label>
              <Select value={fieldType} onValueChange={(v) => v && setFieldType(v)} disabled={attr.builtIn}>
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

          {attr.builtIn && (
            <p className="rounded-v2-md border border-v2-primary-border bg-v2-primary-soft px-3 py-2 text-xs text-v2-primary">
              这是内置属性。字段标识 (<code className="font-v2-mono">{attr.fieldKey}</code>) 和类型不可修改
              —— 它们被后端代码常量级引用（如告警同步按 inner_ip 匹配主机），修改会让相关功能静默失效。
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            disabled={!displayName.trim() || isPending}
            onClick={handleUpdate}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
