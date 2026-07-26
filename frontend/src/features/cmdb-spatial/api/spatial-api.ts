import api from '@/lib/api'
import type { AxiosResponse } from 'axios'
import type { SpatialCandidate, SpatialLayoutSummary, SpatialLayoutVersion, SpatialLocateResult, SpatialRoom, SpatialRuntime, SpatialValidationResult } from '../model/types'

export interface SpatialAsset { assetId: number; originalName: string; contentType: string; byteSize: number; pixelWidth: number; pixelHeight: number; createdAt: string }

function unwrap<T>(promise: Promise<AxiosResponse<{ data: T }>>) {
  return promise.then((response) => response.data.data as T)
}

export const spatialQueryKeys = {
  layouts: (includeArchived = false) => ['cmdb', 'spatial', 'layouts', includeArchived] as const,
  rooms: (keyword: string, configured: boolean) => ['cmdb', 'spatial', 'rooms', keyword, configured] as const,
  published: (roomId: number) => ['cmdb', 'spatial', 'published', roomId] as const,
  draft: (layoutId: number) => ['cmdb', 'spatial', 'draft', layoutId] as const,
  runtime: (layoutId: number) => ['cmdb', 'spatial', 'runtime', layoutId] as const,
  versions: (layoutId: number) => ['cmdb', 'spatial', 'versions', layoutId] as const,
}

export function listSpatialLayouts(includeArchived = false) { return unwrap<SpatialLayoutSummary[]>(api.get('/cmdb/spatial/layouts', { params: { includeArchived } })) }
export function listSpatialRooms(keyword = '', configured = false) { return unwrap<SpatialRoom[]>(api.get('/cmdb/spatial/rooms', { params: { keyword, configured, page: 1, size: 100 } })) }
export function getPublishedSpatialLayout(roomId: number) { return unwrap<SpatialLayoutVersion>(api.get(`/cmdb/spatial/rooms/${roomId}/published`)) }
export function getSpatialDraft(layoutId: number) { return unwrap<SpatialLayoutVersion>(api.get(`/cmdb/spatial/layouts/${layoutId}/draft`)) }
export function getSpatialRuntime(layoutId: number) { return unwrap<SpatialRuntime>(api.get(`/cmdb/spatial/layouts/${layoutId}/runtime`)) }
export function listSpatialVersions(layoutId: number) { return unwrap<SpatialLayoutVersion[]>(api.get(`/cmdb/spatial/layouts/${layoutId}/versions`)) }
export function getRackCandidates(layoutId: number, keyword = '') { return unwrap<SpatialCandidate[]>(api.get(`/cmdb/spatial/layouts/${layoutId}/rack-candidates`, { params: { keyword, page: 1, size: 100 } })) }
export function getFacilityCandidates(layoutId: number, keyword = '', modelId = '') { return unwrap<SpatialCandidate[]>(api.get(`/cmdb/spatial/layouts/${layoutId}/facility-candidates`, { params: { keyword, modelId, page: 1, size: 100 } })) }
export function locateSpatial(keyword: string) { return unwrap<SpatialLocateResult[]>(api.get('/cmdb/spatial/locate', { params: { keyword, size: 20 } })) }
export function saveSpatialDraft(layoutId: number, revision: number, document: SpatialLayoutVersion['document']) {
  return api.put(`/cmdb/spatial/layouts/${layoutId}/draft`, { revision, schemaVersion: 1, document }).then((response) => response.data.data as SpatialLayoutVersion)
}
export function validateSpatialDraft(layoutId: number) { return api.post(`/cmdb/spatial/layouts/${layoutId}/draft/validate`).then((response) => response.data.data as SpatialValidationResult) }
export function publishSpatialDraft(layoutId: number, revision: number, changeSummary: string) { return api.post(`/cmdb/spatial/layouts/${layoutId}/publish`, { revision, changeSummary }).then((response) => response.data.data as SpatialLayoutVersion) }
export function createSpatialLayout(roomInstanceId: number, name: string) { return api.post('/cmdb/spatial/layouts', { roomInstanceId, name }).then((response) => response.data.data as SpatialLayoutSummary) }
export function archiveSpatialLayout(layoutId: number) { return api.post(`/cmdb/spatial/layouts/${layoutId}/archive`).then(() => undefined) }
export function restoreActiveSpatialLayout(layoutId: number) { return api.post(`/cmdb/spatial/layouts/${layoutId}/restore-active`).then(() => undefined) }
export function uploadReferenceImage(layoutId: number, file: File) { const form = new FormData(); form.append('file', file); return api.post(`/cmdb/spatial/layouts/${layoutId}/assets/reference`, form).then((response) => response.data.data as SpatialAsset) }
