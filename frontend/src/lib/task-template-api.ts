import api from '@/lib/api'

export type TaskTemplateStatus = 'draft' | 'published' | 'deprecated' | 'archived'
export type TaskTemplateVersionStatus = 'draft' | 'published' | 'deprecated'
export type PreviewRole = 'executor' | 'approver' | 'copied' | 'analytics' | 'export'

export interface TaskFieldDefinition {
  id?: number
  parentFieldKey?: string
  key: string
  label: string
  type: string
  sortOrder: number
  required: boolean
  defaultValue?: unknown
  validation: Record<string, unknown>
  display: Record<string, unknown>
  visibility: Record<string, unknown>
  condition: Record<string, unknown>
  formula: Record<string, unknown>
  analytics: Record<string, unknown>
  sensitive: boolean
}

export interface FieldTypeMetadata {
  type: string
  label: string
  category: string
  supportsAnalytics: boolean
  supportsDimension: boolean
  supportsSensitive: boolean
  supportsExport: boolean
  aggregations: string[]
}

export interface TaskTemplateSummary {
  id: number
  code: string
  name: string
  category?: string
  description?: string
  status: TaskTemplateStatus
  latestVersionId?: number
  builtin: boolean
  scopeType: 'tenant' | 'group' | 'private'
  ownerGroupId?: number
  createdAt: string
  updatedAt: string
}

export interface TaskTemplateVersionSummary {
  id: number
  templateId: number
  version: number
  status: TaskTemplateVersionStatus
  name: string
  publishedAt?: string
  updatedAt: string
}

export interface TaskTemplateDetail extends TaskTemplateSummary {
  versions: TaskTemplateVersionSummary[]
}

export interface TaskTemplateVersion {
  id: number
  templateId: number
  version: number
  status: TaskTemplateVersionStatus
  name: string
  description?: string
  instructions?: string
  layout: Record<string, unknown>
  completionPolicy: Record<string, unknown>
  defaultAssignment: Record<string, unknown>
  defaultReminder: Record<string, unknown>
  defaultApprovalSchemeVersionId?: number
  publishedBy?: number
  publishedAt?: string
  updatedAt: string
  fields: TaskFieldDefinition[]
}

export interface TemplateValidationIssue {
  code: string
  fieldKey?: string
  path: string
  message: string
}

export interface TemplateValidationResult {
  valid: boolean
  issues: TemplateValidationIssue[]
}

export interface TemplatePreview {
  schema: TaskTemplateVersion
  role: PreviewRole
  formData: Record<string, unknown>
  computedValues: Record<string, unknown>
  visibleFields: Record<string, boolean>
  requiredFields: Record<string, boolean>
  valueIssues: TemplateValidationIssue[]
}

export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
}

export interface CreateTaskTemplatePayload {
  code: string
  name: string
  category?: string
  description?: string
  scopeType?: 'tenant' | 'group' | 'private'
  ownerGroupId?: number
  instructions?: string
  layout?: Record<string, unknown>
  fields?: TaskFieldDefinition[]
}

export interface UpdateTaskTemplateVersionPayload {
  name: string
  description?: string
  instructions?: string
  layout: Record<string, unknown>
  completionPolicy: Record<string, unknown>
  defaultAssignment: Record<string, unknown>
  defaultReminder: Record<string, unknown>
  defaultApprovalSchemeVersionId?: number
  fields: TaskFieldDefinition[]
}

export async function listTaskTemplates(params: {
  keyword?: string
  status?: string
  category?: string
  page?: number
  size?: number
}) {
  return api.get('/task-templates', { params }).then((response) => response.data.data as PageResult<TaskTemplateSummary>)
}

export async function createTaskTemplate(payload: CreateTaskTemplatePayload) {
  return api.post('/task-templates', payload).then((response) => response.data.data as TaskTemplateDetail)
}

export async function getTaskTemplate(templateId: number) {
  return api.get(`/task-templates/${templateId}`).then((response) => response.data.data as TaskTemplateDetail)
}

export async function deleteTaskTemplate(templateId: number) {
  return api.delete(`/task-templates/${templateId}`)
}

export async function createTaskTemplateDraft(templateId: number) {
  return api.post(`/task-templates/${templateId}/versions`).then((response) => response.data.data as TaskTemplateVersion)
}

export async function getTaskTemplateVersion(versionId: number) {
  return api.get(`/task-template-versions/${versionId}`).then((response) => response.data.data as TaskTemplateVersion)
}

export async function updateTaskTemplateVersion(versionId: number, payload: UpdateTaskTemplateVersionPayload) {
  return api.put(`/task-template-versions/${versionId}`, payload).then((response) => response.data.data as TaskTemplateVersion)
}

export async function validateTaskTemplateVersion(versionId: number) {
  return api.post(`/task-template-versions/${versionId}/validate`).then((response) => response.data.data as TemplateValidationResult)
}

export async function publishTaskTemplateVersion(versionId: number) {
  return api.post(`/task-template-versions/${versionId}/publish`).then((response) => response.data.data as TaskTemplateVersion)
}

export async function deprecateTaskTemplateVersion(versionId: number) {
  return api.post(`/task-template-versions/${versionId}/deprecate`).then((response) => response.data.data as TaskTemplateVersion)
}

export async function previewTaskTemplateVersion(
  versionId: number,
  role: PreviewRole,
  formData: Record<string, unknown>,
) {
  return api.post(`/task-template-versions/${versionId}/preview`, { role, formData })
    .then((response) => response.data.data as TemplatePreview)
}

export async function listTaskFieldTypes() {
  return api.get('/task-field-types').then((response) => response.data.data as FieldTypeMetadata[])
}
