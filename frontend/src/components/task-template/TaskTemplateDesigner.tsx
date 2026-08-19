'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toast } from '@/design-system/figma-neutral/toast'
import { getApiErrorMessage, isAxiosError } from '@/lib/api-error'
import {
  getTaskTemplateVersion,
  listTaskFieldTypes,
  previewTaskTemplateVersion,
  publishTaskTemplateVersion,
  updateTaskTemplateVersion,
  validateTaskTemplateVersion,
  type PreviewRole,
  type FieldTypeMetadata,
  type TaskFieldDefinition,
  type TaskTemplateVersion,
  type TemplatePreview,
  type TemplateValidationIssue,
} from '@/lib/task-template-api'
import '@/design-system/figma-neutral/index.css'
import '@/components/task-runtime/tasks.css'
import { TaskPanel } from '@/components/task-runtime/TaskEmpty'
import {
  Alert,
  Button,
  ErrorState,
  Field,
  FormSettingsPage,
  Input,
  LoadingState,
  PageHeader,
  StatusBadge,
  Textarea,
} from '@/design-system/figma-neutral/components'
import { FieldLibrary } from './FieldLibrary'
import { FormCanvas } from './FormCanvas'
import { FieldPropertyPanel } from './FieldPropertyPanel'
import { TemplatePreviewDialog } from './TemplatePreviewDialog'
import { createTaskField, normalizeFieldOrder } from './designer-utils'

const VERSION_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  draft: { label: '草稿', tone: 'warning' },
  published: { label: '已发布', tone: 'success' },
  deprecated: { label: '已废弃', tone: 'neutral' },
  archived: { label: '已归档', tone: 'neutral' },
}

export function TaskTemplateDesigner({ templateId, versionId }: { templateId: number; versionId: number }) {
  const versionQuery = useQuery({
    queryKey: ['task-template-version', versionId],
    queryFn: () => getTaskTemplateVersion(versionId),
    enabled: Number.isFinite(versionId),
  })
  const fieldTypesQuery = useQuery({
    queryKey: ['task-field-types'],
    queryFn: listTaskFieldTypes,
  })
  if (versionQuery.isLoading || fieldTypesQuery.isLoading) return <LoadingState label="正在加载模板设计器…" />
  if (versionQuery.isError || fieldTypesQuery.isError) {
    return (
      <ErrorState
        title="模板设计器加载失败"
        retry={
          <Button type="button" size="sm" variant="secondary" onClick={() => { void versionQuery.refetch(); void fieldTypesQuery.refetch() }}>
            重试
          </Button>
        }
      />
    )
  }
  if (!versionQuery.data || !fieldTypesQuery.data) return <ErrorState title="模板设计器数据不完整" />

  return (
    <TaskTemplateDesignerWorkspace
      key={`${versionQuery.data.id}-${versionQuery.data.updatedAt}`}
      templateId={templateId}
      version={versionQuery.data}
      fieldTypes={fieldTypesQuery.data}
    />
  )
}

function TaskTemplateDesignerWorkspace({
  templateId,
  version,
  fieldTypes,
}: {
  templateId: number
  version: TaskTemplateVersion
  fieldTypes: FieldTypeMetadata[]
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const versionId = version.id
  const [draft, setDraft] = useState(version)
  const [selectedKey, setSelectedKey] = useState<string | undefined>(version.fields[0]?.key)
  const [issues, setIssues] = useState<TemplateValidationIssue[]>([])
  const [busy, setBusy] = useState<'save' | 'validate' | 'publish' | 'preview'>()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewRole, setPreviewRole] = useState<PreviewRole>('executor')
  const [preview, setPreview] = useState<TemplatePreview>()
  const fieldTypeMap = useMemo(
    () => new Map(fieldTypes.map((fieldType) => [fieldType.type, fieldType])),
    [fieldTypes],
  )
  const selectedField = draft.fields.find((field) => field.key === selectedKey)
  const readOnly = draft.status !== 'draft'
  const status = VERSION_STATUS[draft.status] ?? { label: draft.status, tone: 'neutral' as const }

  const updateDraft = (updates: Partial<TaskTemplateVersion>) => setDraft((current) => current ? { ...current, ...updates } : current)
  const updateField = (nextField: TaskFieldDefinition) => {
    updateDraft({ fields: draft.fields.map((field) => field.key === selectedKey ? nextField : field) })
    if (nextField.key !== selectedKey) setSelectedKey(nextField.key)
  }
  const addField = (fieldType: FieldTypeMetadata) => {
    const field = createTaskField(fieldType, draft.fields)
    updateDraft({ fields: [...draft.fields, field] })
    setSelectedKey(field.key)
  }
  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= draft.fields.length) return
    const fields = [...draft.fields]
    ;[fields[index], fields[target]] = [fields[target], fields[index]]
    updateDraft({ fields: normalizeFieldOrder(fields) })
  }
  const removeField = (key: string) => {
    const fields = normalizeFieldOrder(draft.fields.filter((field) => field.key !== key))
    updateDraft({ fields })
    if (selectedKey === key) setSelectedKey(fields[0]?.key)
  }
  const save = async () => {
    if (readOnly) return draft
    const saved = await updateTaskTemplateVersion(versionId, {
      name: draft.name,
      description: draft.description,
      instructions: draft.instructions,
      layout: draft.layout ?? {},
      completionPolicy: draft.completionPolicy ?? {},
      defaultAssignment: draft.defaultAssignment ?? {},
      defaultReminder: draft.defaultReminder ?? {},
      defaultApprovalSchemeVersionId: draft.defaultApprovalSchemeVersionId,
      fields: normalizeFieldOrder(draft.fields),
    })
    setDraft(saved)
    queryClient.setQueryData(['task-template-version', versionId], saved)
    queryClient.invalidateQueries({ queryKey: ['task-template', templateId] })
    return saved
  }
  const handleSave = async () => {
    setBusy('save')
    try {
      await save()
      toast.success('模板草稿已保存')
    } catch (error) {
      toast.error(getApiErrorMessage(error, '保存失败'))
    } finally {
      setBusy(undefined)
    }
  }
  const handleValidate = async () => {
    setBusy('validate')
    try {
      await save()
      const result = await validateTaskTemplateVersion(versionId)
      setIssues(result.issues)
      toast[result.valid ? 'success' : 'warning'](result.valid ? '模板校验通过' : `发现 ${result.issues.length} 个问题`)
    } catch (error) {
      toast.error(getApiErrorMessage(error, '校验失败'))
    } finally {
      setBusy(undefined)
    }
  }
  const handlePublish = async () => {
    setBusy('publish')
    try {
      await save()
      const validation = await validateTaskTemplateVersion(versionId)
      setIssues(validation.issues)
      if (!validation.valid) {
        toast.warning(`发布前需处理 ${validation.issues.length} 个问题`)
        return
      }
      const published = await publishTaskTemplateVersion(versionId)
      setDraft(published)
      toast.success(`模板 v${published.version} 已发布并锁定`)
      queryClient.invalidateQueries({ queryKey: ['task-template', templateId] })
      router.refresh()
    } catch (error) {
      setIssues(extractValidationIssues(error))
      toast.error(getApiErrorMessage(error, '发布失败'))
    } finally {
      setBusy(undefined)
    }
  }
  const handlePreview = async (role: PreviewRole) => {
    setBusy('preview')
    setPreviewRole(role)
    setPreviewOpen(true)
    try {
      await save()
      setPreview(await previewTaskTemplateVersion(versionId, role, {}))
    } catch (error) {
      toast.error(getApiErrorMessage(error, '预览失败'))
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <FormSettingsPage
      embedded
      className="cwgsyw-tasks-page"
      header={
        <PageHeader
          showEyebrow={false}
          showBreadcrumb={false}
          showSubtitle={false}
          title={draft.name}
          status={<StatusBadge label={status.label} status={status.tone} />}
          actions={
            <div className="cwgsyw-designer__actions">
              <Button type="button" size="sm" variant="ghost" onClick={() => router.push(`/tasks/templates/${templateId}`)}>版本历史</Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => void handlePreview('executor')}>执行人预览</Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => void handlePreview('approver')}>审批人预览</Button>
              {!readOnly && <Button type="button" size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => void handleSave()}>{busy === 'save' ? '保存中' : '保存'}</Button>}
              {!readOnly && <Button type="button" size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => void handleValidate()}>{busy === 'validate' ? '校验中' : '校验'}</Button>}
              {!readOnly && <Button type="button" size="sm" variant="primary" disabled={Boolean(busy)} onClick={() => void handlePublish()}>{busy === 'publish' ? '发布中' : '发布并锁定'}</Button>}
            </div>
          }
        />
      }
      form={
        <div className="cwgsyw-form">
          {readOnly ? (
            <Alert tone="info" title="此版本已发布或废弃，只读展示不可变快照" showDescription={false} showDismiss={false} />
          ) : null}
          <TaskPanel title="版本信息">
            <div className="cwgsyw-tasks-form-grid cwgsyw-tasks-form-grid--wide">
              <Field label="版本名称">
                <Input size="sm" disabled={readOnly} value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} />
              </Field>
              <Field label="描述">
                <Input size="sm" disabled={readOnly} value={draft.description ?? ''} onChange={(event) => updateDraft({ description: event.target.value })} />
              </Field>
              <div className="cwgsyw-tasks-form-grid__full">
                <Field label="执行说明">
                  <Textarea disabled={readOnly} value={draft.instructions ?? ''} onChange={(event) => updateDraft({ instructions: event.target.value })} rows={3} />
                </Field>
              </div>
            </div>
          </TaskPanel>
          {issues.length > 0 ? (
            <Alert
              tone="warning"
              title={`发布前校验问题（${issues.length}）`}
              description={issues.map((issue) => `${issue.fieldKey || issue.path} · ${issue.message}`).join('；')}
              showDismiss={false}
            />
          ) : null}
          <div className="cwgsyw-designer">
            <FieldLibrary fieldTypes={fieldTypes} disabled={readOnly} onAdd={addField} />
            <FormCanvas fields={draft.fields} selectedKey={selectedKey} readOnly={readOnly} onSelect={setSelectedKey} onMove={moveField} onRemove={removeField} />
            <FieldPropertyPanel field={selectedField} fieldType={selectedField ? fieldTypeMap.get(selectedField.type) : undefined} readOnly={readOnly} onChange={updateField} />
          </div>
          <TemplatePreviewDialog open={previewOpen} role={previewRole} preview={preview} loading={busy === 'preview'} onOpenChange={setPreviewOpen} />
        </div>
      }
    />
  )
}

function extractValidationIssues(error: unknown): TemplateValidationIssue[] {
  if (!isAxiosError(error)) return []
  const data = error.response?.data
  if (typeof data !== 'object' || data === null || !('details' in data)) return []
  const details = (data as { details?: { issues?: unknown } }).details
  return Array.isArray(details?.issues) ? details.issues as TemplateValidationIssue[] : []
}
