// 复用 [id] 的类型定义
export { DOC_TYPE_LABEL, DOC_TYPE_TONE } from '@/app/(dashboard)/change-docs/[id]/components/types'
export type { TemplateVO } from '@/app/(dashboard)/change-docs/[id]/components/types'

export interface CiSnapshot {
  instanceId: number
  instanceName: string
  modelName: string
  modelId: number
}
