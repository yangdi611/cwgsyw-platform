'use client'

import { useState } from 'react'
import type { AttributeAdminItem, UpdateAttributePayload } from './types'
import { FIELD_TYPES, formatEnumOptions, parseEnumOptions } from './types'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  Checkbox,
  Field,
  Input,
  NeutralDialog,
} from '@/design-system/figma-neutral/components'

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
  const optionsMissing = isEnum && parseEnumOptions(optionsText).length === 0

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

  return (
    <NeutralDialog
      open
      onOpenChange={(next) => !next && onClose()}
      title="编辑属性"
      showDescription={false}
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>取消</Button>
          <Button type="button" size="sm" disabled={!name.trim() || optionsMissing || isPending} onClick={handleUpdate}>
            保存
          </Button>
        </>
      }
    >
      <div className="cwgsyw-form cwgsyw-cmdb-model-detail__dialog-form">
        <div className="cwgsyw-filter-grid">
          <Field label="字段标识" htmlFor="edit-key">
            <Input size="sm" id="edit-key" value={attr.fieldKey} disabled />
          </Field>
          <Field label="类型" htmlFor="edit-type">
            <Input size="sm" id="edit-type" value={FIELD_TYPES[attr.fieldType] ?? attr.fieldType} disabled />
          </Field>
          <Field label="显示名称" htmlFor="edit-name" required>
            <Input size="sm" id="edit-name" placeholder="例如：CPU 核数" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="所属分组" htmlFor="edit-group">
            <Input size="sm" id="edit-group" value={attr.groupName ?? attr.groupId} disabled />
          </Field>
        </div>
        {isEnum ? (
          <Field label="选项" htmlFor="edit-options" required>
            <Input size="sm" id="edit-options" placeholder="生产,测试,开发" value={optionsText} onChange={(event) => setOptionsText(event.target.value)} />
          </Field>
        ) : null}
        <div className="cwgsyw-filter-grid">
          <Field label="默认值" htmlFor="edit-default">
            <Input size="sm" id="edit-default" placeholder="可选" value={defaultValue} onChange={(event) => setDefaultValue(event.target.value)} />
          </Field>
          <Field label="排序" htmlFor="edit-sort">
            <Input size="sm" id="edit-sort" type="number" min={0} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
          </Field>
        </div>
        <div className="cwgsyw-cmdb-model-detail__dialog-flags">
          <Checkbox label="必填" checked={isRequired} onChange={(event) => setIsRequired(event.currentTarget.checked)} />
          <Checkbox label="实例可编辑" checked={isEditable} onChange={(event) => setIsEditable(event.currentTarget.checked)} />
          <Checkbox label="列表显示" checked={isListShow} onChange={(event) => setIsListShow(event.currentTarget.checked)} />
          <Checkbox label="详情表单显示" checked={isDrawerShow} onChange={(event) => setIsDrawerShow(event.currentTarget.checked)} />
        </div>
        <p className="cwgsyw-type-label-xs">字段标识、类型、分组和唯一性创建后不可修改。</p>
      </div>
    </NeutralDialog>
  )
}
