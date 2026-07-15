'use client'

import { useState } from 'react'
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
import type { AttributeGroupAdminItem, CreateAttributePayload } from './types'
import { FIELD_TYPES, TABLE_SCHEMA_TEMPLATE, parseEnumOptions } from './types'

interface AddAttributeDialogProps {
  open: boolean
  groups: AttributeGroupAdminItem[]
  isPending: boolean
  onClose: () => void
  onCreate: (data: CreateAttributePayload) => void
}

export function AddAttributeDialog({
  open,
  groups,
  isPending,
  onClose,
  onCreate,
}: AddAttributeDialogProps) {
  const [fieldKey, setFieldKey] = useState('')
  const [name, setName] = useState('')
  const [fieldType, setFieldType] = useState('singlechar')
  const [isRequired, setIsRequired] = useState(false)
  const [isEditable, setIsEditable] = useState(true)
  const [isUnique, setIsUnique] = useState(false)
  const [isListShow, setIsListShow] = useState(true)
  const [isDrawerShow, setIsDrawerShow] = useState(true)
  const [groupId, setGroupId] = useState('')
  const [defaultValue, setDefaultValue] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [optionsText, setOptionsText] = useState('')
  const effectiveGroupId = groupId || groups[0]?.groupId || ''
  const isEnum = fieldType === 'enum' || fieldType === 'enummulti'

  const handleCreate = () => {
    const enumOptions = isEnum ? parseEnumOptions(optionsText) : null
    onCreate({
      fieldKey: fieldKey.trim(),
      name: name.trim(),
      groupId: effectiveGroupId,
      fieldType,
      isRequired,
      isEditable,
      isUnique,
      isListShow,
      isDrawerShow,
      defaultValue: defaultValue.trim() || null,
      option: isEnum
        ? enumOptions
        : fieldType === 'table'
          ? TABLE_SCHEMA_TEMPLATE
          : null,
      // Backend create validation still requires this deprecated mirror for enum fields.
      enumOptions: enumOptions ? JSON.stringify(enumOptions) : null,
      sortOrder: Number(sortOrder) || 0,
    })
  }

  const optionsMissing = isEnum && parseEnumOptions(optionsText).length === 0

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
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
                maxLength={64}
                onChange={(event) => setFieldKey(event.target.value)}
              />
              <p className="text-xs text-v2-muted">最多 64 个字符；使用小写字母、数字和下划线，创建后不可修改</p>
            </div>
            <div className="space-y-1.5">
              <Label>
                显示名称 <span className="text-v2-danger">*</span>
              </Label>
              <Input
                placeholder="例如：CPU 核数"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>类型</Label>
              <Select value={fieldType} onValueChange={(value) => value && setFieldType(value)}>
                <SelectTrigger>
                  <SelectValue>
                    {(value: string) => FIELD_TYPES[value] ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_TYPES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                所属分组 <span className="text-v2-danger">*</span>
              </Label>
              <Select value={effectiveGroupId} onValueChange={(value) => setGroupId(value ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择分组">
                    {(value: string) => groups.find((group) => group.groupId === value)?.name ?? '请选择分组'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.groupId}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isEnum && (
            <div className="space-y-1.5">
              <Label>
                选项 <span className="text-v2-danger">*</span>
              </Label>
              <Input
                placeholder="生产,测试,开发"
                value={optionsText}
                onChange={(event) => setOptionsText(event.target.value)}
              />
              <p className="text-xs text-v2-muted">使用逗号分隔；选项值与显示名称保持一致</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>默认值</Label>
              <Input
                placeholder="可选"
                value={defaultValue}
                onChange={(event) => setDefaultValue(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>排序</Label>
              <Input
                type="number"
                min="0"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox checked={isRequired} onCheckedChange={(value) => setIsRequired(!!value)} />
              <span>必填</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={isEditable} onCheckedChange={(value) => setIsEditable(!!value)} />
              <span>实例可编辑</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={isUnique} onCheckedChange={(value) => setIsUnique(!!value)} />
              <span>唯一</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={isListShow} onCheckedChange={(value) => setIsListShow(!!value)} />
              <span>列表显示</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={isDrawerShow} onCheckedChange={(value) => setIsDrawerShow(!!value)} />
              <span>详情表单显示</span>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            disabled={
              !fieldKey.trim() ||
              !name.trim() ||
              !effectiveGroupId ||
              optionsMissing ||
              isPending
            }
            onClick={handleCreate}
          >
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
