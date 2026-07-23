import api from '@/lib/api'
import type { PageResult, TaskTemplateVersion, TemplateValidationResult } from '@/lib/task-template-api'

export type ExecutionStatus = 'not_started' | 'in_progress' | 'submitted' | 'changes_requested' | 'completed' | 'cancelled' | 'exception_closed'
export type ApprovalStatus = 'not_required' | 'not_started' | 'in_review' | 'approved' | 'changes_requested' | 'terminated' | 'failed'

export interface TaskActions {
  canStart: boolean
  canEditDraft: boolean
  canSubmit: boolean
  canCancel: boolean
  canReassign: boolean
  canRemind: boolean
  canViewSensitive: boolean
}

export interface TaskSummary {
  id: number
  title: string
  description?: string
  planId?: number
  templateVersionId: number
  templateName: string
  businessDate?: string
  plannedStartAt?: string
  dueAt?: string
  priority: 'low' | 'normal' | 'high' | 'critical'
  executionStatus: ExecutionStatus
  approvalStatus?: ApprovalStatus
  assigneeId?: number
  groupId?: number
  overdue: boolean
  actions: TaskActions
}

export interface DraftAttachment {
  id: number
  fieldKey: string
  fileName: string
  fileType?: string
  sizeBytes: number
  checksum?: string
  uploadedAt: string
}

export interface TaskDraft {
  id?: number
  taskId: number
  revision: number
  formData: Record<string, unknown>
  attachments: DraftAttachment[]
  lastSavedBy?: number
  lastSavedAt?: string
}

export interface TaskSubmission {
  id: number
  taskId: number
  templateVersionId: number
  version: number
  formData: Record<string, unknown>
  computedValues: Record<string, unknown>
  organizationSnapshot: Record<string, unknown>
  ciReferencesSnapshot: Record<string, unknown>
  status: string
  effective: boolean
  supersedesSubmissionId?: number
  submittedBy: number
  submittedAt: string
  attachments: Array<DraftAttachment & { sensitive: boolean }>
}

export interface TaskSubmissionFieldChange {
  before: unknown
  after: unknown
}

export interface TaskSubmissionDiff {
  against: number
  submissionId: number
  changes: Record<string, TaskSubmissionFieldChange>
}

export interface AggregateReferencePreview {
  fieldKey: string
  metricId: number
  from: string
  to: string
  groupId?: number
  systemValue?: number
  manualValue?: number
  difference?: number
  selectedSourceRole: string
  selectedValue?: number
  sourceTaskCount: number
  factIds: number[]
  taskIds: number[]
  submissionIds: number[]
}

export interface TaskEvent {
  id: number
  eventType: string
  operatorId?: number
  eventData: Record<string, unknown>
  createdAt: string
}

export interface TaskDetail {
  task: TaskSummary
  template: TaskTemplateVersion
  draft: TaskDraft
  currentSubmission?: TaskSubmission
  timeline: TaskEvent[]
  actions: TaskActions
}

export interface CreateOneOffTaskPayload {
  templateVersionId: number
  approvalSchemeVersionId?: number
  title: string
  description?: string
  plannedStartAt: string
  dueAt: string
  priority: 'low' | 'normal' | 'high' | 'critical'
  assigneeId: number
  groupId?: number
  ciScopeConfig?: Record<string, unknown>
}

export async function listTasks(params: Record<string, unknown>) {
  return api.get('/tasks', { params }).then((response) => response.data.data as PageResult<TaskSummary>)
}

export async function createOneOffTask(payload: CreateOneOffTaskPayload) {
  return api.post('/tasks/one-off', payload).then((response) => response.data.data as TaskSummary)
}

export async function getTask(taskId: number) {
  return api.get(`/tasks/${taskId}`).then((response) => response.data.data as TaskDetail)
}

export async function startTask(taskId: number) { return api.post(`/tasks/${taskId}/start`) }
export async function remindTask(taskId: number) { return api.post(`/tasks/${taskId}/remind`) }
export async function cancelTask(taskId: number, reason: string) { return api.post(`/tasks/${taskId}/cancel`, { reason }) }

export async function saveTaskDraft(taskId: number, revision: number, formData: Record<string, unknown>) {
  return api.put(`/tasks/${taskId}/draft`, { revision, formData }).then((response) => response.data.data as TaskDraft)
}

export async function validateTask(taskId: number) {
  return api.post(`/tasks/${taskId}/validate`).then((response) => response.data.data as TemplateValidationResult)
}

export async function previewAggregateReferences(taskId: number) {
  return api.post(`/tasks/${taskId}/aggregate-references/preview`)
    .then((response) => response.data.data as AggregateReferencePreview[])
}

export async function submitTask(taskId: number, draftRevision: number, idempotencyKey: string) {
  return api.post(`/tasks/${taskId}/submissions`, { draftRevision, idempotencyKey }).then((response) => response.data.data)
}

export async function uploadTaskAttachment(taskId: number, revision: number, fieldKey: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('fieldKey', fieldKey)
  formData.append('revision', String(revision))
  return api.post(`/tasks/${taskId}/draft/attachments`, formData).then((response) => response.data.data as DraftAttachment)
}

export async function deleteTaskAttachment(taskId: number, revision: number, attachmentId: number) {
  return api.delete(`/tasks/${taskId}/draft/attachments/${attachmentId}`, { params: { revision } })
}

export async function listTaskSubmissions(taskId: number) {
  return api.get(`/tasks/${taskId}/submissions`).then((response) => response.data.data as TaskSubmission[])
}

export async function getTaskSubmissionDiff(taskId: number, submissionId: number, against: number) {
  return api.get(`/tasks/${taskId}/submissions/${submissionId}/diff`, { params: { against } })
    .then((response) => response.data.data as TaskSubmissionDiff)
}

export async function downloadTaskSubmissionAttachment(taskId: number, submissionId: number, attachmentId: number, fileName: string) {
  const response = await api.get(
    `/tasks/${taskId}/submissions/${submissionId}/attachments/${attachmentId}/download`,
    { responseType: 'blob' },
  )
  const url = URL.createObjectURL(response.data as Blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
