'use client'

import { useState } from 'react'
import type { AttributeGroupAdminItem, CreateAttributePayload } from './types'
import { FIELD_TYPES, TABLE_SCHEMA_TEMPLATE, parseEnumOptions } from './types'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  Checkbox,
  Field,
  Input,
  NeutralDialog,
  Select,
} from '@/design-system/figma-neutral/components'

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
  const optionsMissing = isEnum && parseEnumOptions(optionsText).length === 0

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
      option: isEnum ? enumOptions : fieldType === 'table' ? TABLE_SCHEMA_TEMPLATE : null,
      enumOptions: enumOptions ? JSON.stringify(enumOptions) : null,
      sortOrder: Number(sortOrder) || 0,
    })
  }

  return (
    <NeutralDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="新建属性"
      showDescription={false}
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>取消</Button>
          <Button
            type="button"
            size="sm"
            disabled={!fieldKey.trim() || !name.trim() || !effectiveGroupId || optionsMissing || isPending}
            onClick={handleCreate}
          >
            创建
          </Button>
        </>
      }
    >
      <div className="cwgsyw-form cwgsyw-cmdb-model-detail__dialog-form">
        <div className="cwgsyw-filter-grid">
          <Field label="字段标识" htmlFor="attr-key" required helperText="最多 64 个字符；使用小写字母、数字和下划线，创建后不可修改">
            <Input size="sm" id="attr-key" maxLength={64} placeholder="例如：cpu_cores" value={fieldKey} onChange={(event) => setFieldKey(event.target.value)} />
          </Field>
          <Field label="显示名称" htmlFor="attr-name" required>
            <Input size="sm" id="attr-name" placeholder="例如：CPU 核数" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="类型" htmlFor="attr-type">
            <Select size="sm" overlay
              id="attr-type"
              value={fieldType}
              options={Object.entries(FIELD_TYPES).map(([value, label]) => ({ value, label }))}
              onChange={setFieldType}
            />
          </Field>
          <Field label="所属分组" htmlFor="attr-group" required>
            <Select size="sm" overlay
              id="attr-group"
              value={effectiveGroupId}
              placeholder="请选择分组"
              options={groups.map((group) => ({ value: group.groupId, label: group.name }))}
              onChange={setGroupId}
            />
          </Field>
        </div>
        {isEnum ? (
          <Field label="选项" htmlFor="attr-options" required helperText="使用逗号分隔；选项值与显示名称保持一致">
            <Input size="sm" id="attr-options" placeholder="生产,测试,开发" value={optionsText} onChange={(event) => setOptionsText(event.target.value)} />
          </Field>
        ) : null}
        <div className="cwgsyw-filter-grid">
          <Field label="默认值" htmlFor="attr-default">
            <Input size="sm" id="attr-default" placeholder="可选" value={defaultValue} onChange={(event) => setDefaultValue(event.target.value)} />
          </Field>
          <Field label="排序" htmlFor="attr-sort">
            <Input size="sm" id="attr-sort" type="number" min={0} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
          </Field>
        </div>
        <div className="cwgsyw-cmdb-model-detail__dialog-flags">
          <Checkbox label="必填" checked={isRequired} onChange={(event) => setIsRequired(event.currentTarget.checked)} />
          <Checkbox label="实例可编辑" checked={isEditable} onChange={(event) => setIsEditable(event.currentTarget.checked)} />
          <Checkbox label="唯一" checked={isUnique} onChange={(event) => setIsUnique(event.currentTarget.checked)} />
          <Checkbox label="列表显示" checked={isListShow} onChange={(event) => setIsListShow(event.currentTarget.checked)} />
          <Checkbox label="详情表单显示" checked={isDrawerShow} onChange={(event) => setIsDrawerShow(event.currentTarget.checked)} />
        </div>
      </div>
    </NeutralDialog>
  )
}
