import api from './api'

export type SosReportStatus = 'pending' | 'parsing' | 'parsed' | 'failed'
export type SosRequestStatus = 'pending_approval' | 'applied' | 'rejected' | 'apply_failed'
export type SosMappingState = 'preset' | 'confirmed' | 'stale' | 'suggested' | 'unmappable' | 'pending' | 'manual_only'
export type SosFacts = Record<string, unknown>

export interface SosReport {
  id: number
  fileName: string
  fileSize: number
  status: SosReportStatus
  errorCode?: string
  errorMessage?: string
  sosVersion?: string
  hostname?: string
  serialNumber?: string
  primaryIp?: string
  systemUuid?: string
  collectedAt?: string
  parsedAt?: string
  createdAt: string
  createdByName?: string
  warnings?: string[]
  facts?: SosFacts
}

export interface SosReportPage {
  records: SosReport[]
  total: number
  page: number
  size: number
}

export interface SosOption {
  id: string
  name: string
}

export interface SosPreviewField {
  fieldKey: string
  name: string
  groupId?: string
  fieldType: string
  required: boolean
  editable: boolean
  unique: boolean
  excluded: boolean
  origin: 'preset' | 'confirmed' | 'manual' | 'none'
  factKey?: string
  factLabel?: string
  transform?: string
  ruleSource?: 'manual' | 'ai'
  aiConfidence?: number
  aiReason?: string
  value?: unknown
  currentValue?: unknown
  changed: boolean
  problem?: string
  options?: SosOption[]
}

export interface SosCmdbPreview {
  modelCode: string
  action: 'create' | 'update' | 'conflict'
  targetInstanceId?: number
  targetInstanceName?: string
  instanceName?: string
  workflowConfigured: boolean
  canSubmit: boolean
  pendingMappingCount: number
  blockingReasons: string[]
  warnings: string[]
  fields: SosPreviewField[]
}

export interface SosCmdbDraft {
  instanceName?: string
  overrides?: Record<string, unknown>
  excludedFields?: string[]
}

/** 提交时保存的字段快照，审批内容以它为准。 */
export interface SosFieldDetail {
  fieldKey: string
  name: string
  value?: unknown
  currentValue?: unknown
  origin: 'preset' | 'confirmed' | 'manual' | 'none'
  factLabel?: string
  ruleSource?: 'manual' | 'ai'
  aiConfidence?: number
  aiReason?: string
}

export interface SosCmdbRequest {
  id: number
  reportId: number
  action: 'create' | 'update'
  targetInstanceId?: number
  instanceName: string
  proposedFields: Record<string, unknown>
  fieldDetails?: SosFieldDetail[]
  status: SosRequestStatus
  resultInstanceId?: number
  failureMessage?: string
  submitterName?: string
  decidedAt?: string
  decisionComment?: string
  createdAt: string
}

export interface SosPendingApproval {
  requestId: number
  reportId: number
  taskName?: string
  action: 'create' | 'update'
  targetInstanceId?: number
  instanceName: string
  modelCode: string
  proposedFields: Record<string, unknown>
  fieldDetails?: SosFieldDetail[]
  submitterName?: string
  createdAt: string
}

export interface SosFieldMapping {
  fieldKey: string
  name: string
  groupId?: string
  fieldType: string
  required: boolean
  unique: boolean
  builtIn: boolean
  supported: boolean
  state: SosMappingState
  source?: 'manual' | 'ai'
  factKey?: string
  factLabel?: string
  transform?: string
  transformArgs?: { map?: Record<string, string> }
  aiVerdict?: 'mapped' | 'ambiguous' | 'unmappable'
  aiConfidence?: number
  aiReason?: string
  options?: SosOption[]
}

export interface SosMappingOverview {
  modelCode: string
  pendingCount: number
  aiAvailable: boolean
  fields: SosFieldMapping[]
}

export interface SosFact {
  key: string
  label: string
  type: 'STRING' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'LIST'
  unit?: string
  description: string
}

export interface SosFactCatalog {
  facts: SosFact[]
  transforms: { code: string; label: string }[]
}

export interface SaveSosMapping {
  status: 'confirmed' | 'unmappable'
  factKey?: string
  transform?: string
  transformArgs?: { map: Record<string, string> }
}

export interface SosSuggestResult {
  suggested: number
  ambiguous: number
  unmappable: number
  remaining: number
  rejected: { fieldKey: string; reason: string }[]
}

/** 上传和 AI 调用都比普通请求慢，默认 30 秒的超时不够。 */
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000
const AI_TIMEOUT_MS = 60 * 1000

export const sosReportApi = {
  upload: (file: File, onProgress: (percent: number) => void, signal: AbortSignal) => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post('/sos-reports/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: UPLOAD_TIMEOUT_MS,
        signal,
        onUploadProgress: (event) => {
          if (event.total) onProgress(Math.round((event.loaded / event.total) * 100))
        },
      })
      .then((response) => response.data.data as SosReport)
  },
  list: (params: { keyword?: string; status?: string; page: number; size: number }) =>
    api.get('/sos-reports', { params }).then((response) => response.data.data as SosReportPage),
  detail: (id: string) => api.get(`/sos-reports/${id}`).then((response) => response.data.data as SosReport),
  remove: (id: number) => api.delete(`/sos-reports/${id}`),
  preview: (id: string, draft: SosCmdbDraft) =>
    api.post(`/sos-reports/${id}/cmdb-preview`, draft).then((response) => response.data.data as SosCmdbPreview),
  submit: (id: string, draft: SosCmdbDraft) =>
    api.post(`/sos-reports/${id}/cmdb-requests`, draft).then((response) => response.data.data as SosCmdbRequest),
  requests: (id: string) =>
    api.get(`/sos-reports/${id}/cmdb-requests`).then((response) => response.data.data as SosCmdbRequest[]),
  approvals: () => api.get('/sos-reports/approvals').then((response) => response.data.data as SosPendingApproval[]),
  decide: (requestId: number, body: { approved: boolean; comment?: string }) =>
    api.post(`/sos-reports/cmdb-requests/${requestId}/decision`, body),
  mappings: () => api.get('/sos-reports/mappings').then((response) => response.data.data as SosMappingOverview),
  catalog: () => api.get('/sos-reports/fact-catalog').then((response) => response.data.data as SosFactCatalog),
  saveMapping: (fieldKey: string, body: SaveSosMapping) =>
    api.put(`/sos-reports/mappings/${encodeURIComponent(fieldKey)}`, body).then((response) => response.data.data as SosFieldMapping),
  removeMapping: (fieldKey: string) => api.delete(`/sos-reports/mappings/${encodeURIComponent(fieldKey)}`),
  suggest: () =>
    api.post('/sos-reports/mappings/suggestions', {}, { timeout: AI_TIMEOUT_MS }).then((response) => response.data.data as SosSuggestResult),
}
