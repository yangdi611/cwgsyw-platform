'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, FileCheck2, LockKeyhole, Save } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ErrorState, LoadingState, WorkspaceShell, WorkspaceToolbar } from '@/components/shared'
import { Button, Card, Input, Label, StatusBadge, Textarea } from '@/components/design-system'
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
import { FieldLibrary } from './FieldLibrary'
import { FormCanvas } from './FormCanvas'
import { FieldPropertyPanel } from './FieldPropertyPanel'
import { TemplatePreviewDialog } from './TemplatePreviewDialog'
import { createTaskField, normalizeFieldOrder } from './designer-utils'

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
  if (versionQuery.isLoading || fieldTypesQuery.isLoading) return <LoadingState />
  if (versionQuery.isError || fieldTypesQuery.isError) return <ErrorState title="模板设计器加载失败" onRetry={() => { versionQuery.refetch(); fieldTypesQuery.refetch() }} />
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
    <WorkspaceShell
      height="viewport"
      className="-m-4 md:-m-6"
      toolbar={(
        <WorkspaceToolbar
          title={draft.name}
          subtitle={readOnly ? `任务模板 · v${draft.version} · 此版本已发布或废弃，只读展示不可变快照。` : `任务模板 · v${draft.version} · 配置字段、校验、条件、公式、可见性和统计语义。`}
          actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/tasks/templates/${templateId}`}><Button variant="ghost"><ArrowLeft className="h-4 w-4" />版本历史</Button></Link>
            <Button variant="secondary" onClick={() => handlePreview('executor')}><Eye className="h-4 w-4" />执行人预览</Button>
            <Button variant="secondary" onClick={() => handlePreview('approver')}><Eye className="h-4 w-4" />审批人预览</Button>
            {!readOnly && <Button variant="secondary" disabled={Boolean(busy)} onClick={handleSave}><Save className="h-4 w-4" />保存</Button>}
            {!readOnly && <Button variant="secondary" disabled={Boolean(busy)} onClick={handleValidate}><FileCheck2 className="h-4 w-4" />校验</Button>}
            {!readOnly && <Button variant="primary" disabled={Boolean(busy)} onClick={handlePublish}><LockKeyhole className="h-4 w-4" />发布并锁定</Button>}
          </div>
          }
        />
      )}
    >
      <div className="min-h-0 overflow-y-auto p-4 md:p-6">
      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1"><Label>版本名称</Label><Input disabled={readOnly} value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} /></div>
          <div className="space-y-1"><Label>状态</Label><div className="h-9 pt-1"><StatusBadge status={draft.status === 'published' ? 'ok' : draft.status === 'draft' ? 'warn' : 'neutral'}>{draft.status}</StatusBadge></div></div>
          <div className="space-y-1 md:col-span-2"><Label>描述</Label><Input disabled={readOnly} value={draft.description ?? ''} onChange={(event) => updateDraft({ description: event.target.value })} /></div>
          <div className="space-y-1 md:col-span-2"><Label>执行说明</Label><Textarea disabled={readOnly} value={draft.instructions ?? ''} onChange={(event) => updateDraft({ instructions: event.target.value })} rows={3} /></div>
        </div>
      </Card>

      {issues.length > 0 && (
        <Card className="border border-v2-warning-border bg-v2-warning-soft p-4">
          <h2 className="font-semibold text-v2-warning">发布前校验问题（{issues.length}）</h2>
          <div className="mt-2 space-y-1">{issues.map((issue, index) => <p key={`${issue.code}-${issue.fieldKey}-${index}`} className="text-sm text-v2-warning"><span className="font-v2-mono text-xs">{issue.fieldKey || issue.path}</span> · {issue.message}</p>)}</div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="grid min-w-[1100px] grid-cols-[260px_minmax(520px,1fr)_330px]">
          <FieldLibrary fieldTypes={fieldTypes} disabled={readOnly} onAdd={addField} />
          <FormCanvas fields={draft.fields} selectedKey={selectedKey} readOnly={readOnly} onSelect={setSelectedKey} onMove={moveField} onRemove={removeField} />
          <FieldPropertyPanel field={selectedField} fieldType={selectedField ? fieldTypeMap.get(selectedField.type) : undefined} readOnly={readOnly} onChange={updateField} />
        </div>
      </Card>

      <TemplatePreviewDialog open={previewOpen} role={previewRole} preview={preview} loading={busy === 'preview'} onOpenChange={setPreviewOpen} />
      </div>
    </WorkspaceShell>
  )
}

function extractValidationIssues(error: unknown): TemplateValidationIssue[] {
  if (!isAxiosError(error)) return []
  const data = error.response?.data
  if (typeof data !== 'object' || data === null || !('details' in data)) return []
  const details = (data as { details?: { issues?: unknown } }).details
  return Array.isArray(details?.issues) ? details.issues as TemplateValidationIssue[] : []
}
