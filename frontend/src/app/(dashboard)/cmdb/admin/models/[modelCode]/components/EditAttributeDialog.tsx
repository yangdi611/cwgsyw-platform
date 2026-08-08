'use client'

import { useState } from 'react'
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@/components/design-system'
import type { AttributeAdminItem, UpdateAttributePayload } from './types'
import { FIELD_TYPES, formatEnumOptions, parseEnumOptions } from './types'

interface EditAttributeDialogProps {
  attr: AttributeAdminItem
  isPending: boolean
  onClose: () => void
  onUpdate: (data: UpdateAttributePayload) => void
}

export function EditAttributeDialog({
  attr,
  isPending,
  onClose,
  onUpdate,
}: EditAttributeDialogProps) {
  const [name, setName] = useState(attr.name)
  const [isRequired, setIsRequired] = useState(attr.isRequired)
  const [isEditable, setIsEditable] = useState(attr.isEditable)
  const [isListShow, setIsListShow] = useState(attr.isListShow)
  const [isDrawerShow, setIsDrawerShow] = useState(attr.isDrawerShow)
  const [defaultValue, setDefaultValue] = useState(attr.defaultValue ?? '')
  const [sortOrder, setSortOrder] = useState(String(attr.sortOrder))
  const [optionsText, setOptionsText] = useState(() => formatEnumOptions(attr.option))
  const isEnum = attr.fieldType === 'enum' || attr.fieldType === 'enummulti'

  const handleUpdate = () => {
    onUpdate({
      name: name.trim(),
      isRequired,
      isEditable,
      isListShow,
      isDrawerShow,
      defaultValue: defaultValue.trim() || null,
      option: isEnum ? parseEnumOptions(optionsText) : undefined,
      sortOrder: Number(sortOrder) || 0,
    })
  }

  const optionsMissing = isEnum && parseEnumOptions(optionsText).length === 0

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑属性</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>字段标识</Label>
              <Input value={attr.fieldKey} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>类型</Label>
              <Input value={FIELD_TYPES[attr.fieldType] ?? attr.fieldType} disabled />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-1.5">
              <Label>所属分组</Label>
              <Input value={attr.groupName ?? attr.groupId} disabled />
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
              <Checkbox checked={isListShow} onCheckedChange={(value) => setIsListShow(!!value)} />
              <span>列表显示</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={isDrawerShow} onCheckedChange={(value) => setIsDrawerShow(!!value)} />
              <span>详情表单显示</span>
            </label>
          </div>

          <p className="rounded-v2-md border border-v2-border bg-v2-surface-soft px-3 py-2 text-xs text-v2-muted">
            字段标识、类型、分组和唯一性创建后不可修改。
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            disabled={!name.trim() || optionsMissing || isPending}
            onClick={handleUpdate}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
