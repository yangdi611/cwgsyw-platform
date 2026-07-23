import api from '@/lib/api'
import type { DraftAttachment } from '@/lib/task-runtime-api'
import type { PageResult, TaskFieldDefinition } from '@/lib/task-template-api'

export type ApprovalActionName = 'approve' | 'return_for_changes' | 'return_previous_node' | 'terminate'

export interface ApprovalFieldComment {
  fieldKey: string
  severity: 'info' | 'warning' | 'error'
  comment: string
}

export interface ApprovalAttachmentComment {
  attachmentId: number
  comment: string
}

export interface ApprovalAction {
  id: number
  flowableTaskId: string
  nodeKey: string
  nodeName: string
  action: ApprovalActionName
  approverId: number
  approverSnapshot: Record<string, unknown>
  comment?: string
  fieldComments: ApprovalFieldComment[]
  attachmentComments: ApprovalAttachmentComment[]
  createdAt: string
}

export interface ApprovalRound {
  id: number
  taskId: number
  submissionId: number
  schemeVersionId: number
  roundNumber: number
  processInstanceId?: string
  processDefinitionId?: string
  status: 'pending' | 'in_review' | 'approved' | 'changes_requested' | 'terminated' | 'failed'
  result?: string
  startedBy: number
  startedAt: string
  endedAt?: string
  actions: ApprovalAction[]
}

export interface ApprovalTaskSummary {
  approvalTaskId: string
  taskId: number
  submissionId: number
  approvalRoundId: number
  title: string
  nodeKey: string
  nodeName: string
  priority: string
  businessDate?: string
  dueAt?: string
  overdue: boolean
  createdAt: string
}

export interface ApprovalTaskDetail {
  task: ApprovalTaskSummary
  round: ApprovalRound
  submissionVersion: number
  formData: Record<string, unknown>
  computedValues: Record<string, unknown>
  fields: TaskFieldDefinition[]
  attachments: Array<DraftAttachment & { sensitive: boolean }>
  allowedActions: ApprovalActionName[]
}

export interface ApprovalActionPayload {
  action: ApprovalActionName
  comment?: string
  fieldComments: ApprovalFieldComment[]
  attachmentComments: ApprovalAttachmentComment[]
}

export interface PublishedApprovalScheme {
  id: number
  name: string
  description?: string
  latestVersionId: number
  ownerGroupId?: number
  latestVersion?: {
    id: number
    version: number
    status: string
  }
}

export async function listPublishedApprovalSchemes() {
  const page = await api.get('/approval-schemes', {
    params: { status: 'published', page: 1, size: 200 },
  }).then((response) => response.data.data as PageResult<PublishedApprovalScheme>)
  return page.records.filter((scheme) => scheme.latestVersionId && scheme.latestVersion?.status === 'published')
}

export async function getApprovalTask(approvalTaskId: string) {
  return api.get(`/approvals/tasks/${encodeURIComponent(approvalTaskId)}`)
    .then((response) => response.data.data as ApprovalTaskDetail)
}

export async function actOnApprovalTask(approvalTaskId: string, payload: ApprovalActionPayload) {
  return api.post(`/approvals/tasks/${encodeURIComponent(approvalTaskId)}/actions`, payload)
    .then((response) => response.data.data as ApprovalRound)
}

export async function downloadApprovalAttachment(approvalTaskId: string, attachmentId: number, fileName: string) {
  const response = await api.get(
    `/approvals/tasks/${encodeURIComponent(approvalTaskId)}/attachments/${attachmentId}/download`,
    { responseType: 'blob' },
  )
  const url = URL.createObjectURL(response.data as Blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function listTaskApprovalRounds(taskId: number) {
  return api.get(`/tasks/${taskId}/approval-rounds`)
    .then((response) => response.data.data as ApprovalRound[])
}

export function approvalActionLabel(action: ApprovalActionName) {
  return {
    approve: '通过',
    return_for_changes: '退回修改',
    return_previous_node: '退回上一节点',
    terminate: '终止',
  }[action]
}
