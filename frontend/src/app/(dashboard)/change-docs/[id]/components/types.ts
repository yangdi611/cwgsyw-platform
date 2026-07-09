import type { FieldConfigVO } from '@/components/change-doc/tableFieldTypes'

export type DocType = 'application' | 'plan' | 'general'

export interface ChangeDocVO {
  id: number
  changeNo: string
  title: string
  status: string
  applicationTemplateId: number | null
  applicationTemplateName: string | null
  planTemplateId: number | null
  planTemplateName: string | null
  applicantId: number
  applicantName: string
  applyTime: string
  approvedAt: string | null
  approverId: number | null
  approverName: string | null
  approverComment: string | null
  createdAt: string
  updatedAt: string
  fieldsData: Record<string, unknown>
  applicationFieldConfig: FieldConfigVO[] | null
  planFieldConfig: FieldConfigVO[] | null
}

export interface TemplateVO {
  id: number
  name: string
  docType: DocType
  active: boolean
  hasDocx: boolean
}

export interface LinkedCiInstanceVO {
  id: number
  name: string
  modelName: string
  impactLevel?: string
}

export type StatusVariant = 'ok' | 'warn' | 'danger' | 'neutral'

export function statusMeta(s: string): { variant: StatusVariant; label: string } {
  if (s === 'draft') return { variant: 'neutral', label: '草稿' }
  if (s === 'pending') return { variant: 'warn', label: '待审批' }
  if (s === 'plan_pending') return { variant: 'warn', label: '待补填方案' }
  if (s === 'approved') return { variant: 'ok', label: '已通过' }
  if (s === 'rejected') return { variant: 'danger', label: '已拒绝' }
  return { variant: 'neutral', label: s || '未知' }
}

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  application: '申请单',
  plan: '方案',
  general: '通用',
}

export const DOC_TYPE_TONE: Record<DocType, 'ok' | 'warn' | 'neutral'> = {
  application: 'ok',
  plan: 'warn',
  general: 'neutral',
}
