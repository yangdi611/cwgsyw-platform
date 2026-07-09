/**
 * Shared utility functions for CMDB Admin components
 */

import type { CiModelVO, ApiErrorLike } from './types'
import { Server, Database, Network, Box } from 'lucide-react'

/**
 * Icon map for model groups
 */
export const GROUP_ICONS: Record<string, typeof Server> = {
  box: Box,
  server: Server,
  database: Database,
  network: Network,
}

/**
 * Extract error message from API error
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) return fallback
  const apiError = error as ApiErrorLike
  return apiError.response?.data?.message ?? apiError.message ?? fallback
}

/**
 * Get model display name (prefer displayName over name)
 */
export function getModelDisplayName(model: CiModelVO): string {
  return model.displayName || model.name
}

/**
 * Generate next copy model ID (e.g., "server_copy", "server_copy_2")
 */
export function nextCopyModelId(sourceModelId: string, models: CiModelVO[]): string {
  const existing = new Set(models.map(model => model.modelId))
  let candidate = `${sourceModelId}_copy`
  let index = 2
  while (existing.has(candidate)) {
    candidate = `${sourceModelId}_copy_${index}`
    index += 1
  }
  return candidate
}
