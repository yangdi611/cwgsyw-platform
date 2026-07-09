/**
 * Shared utility functions for CMDB Admin components
 */

import type { CiModelAdminItem } from '@/types/cmdb-model'
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
 * Get model display name (prefer displayName over name)
 */
export function getModelDisplayName(model: CiModelAdminItem): string {
  return model.displayName || model.name
}

/**
 * Generate next copy model ID (e.g., "server_copy", "server_copy_2")
 */
export function nextCopyModelId(sourceModelId: string, models: CiModelAdminItem[]): string {
  const existing = new Set(models.map(model => model.modelId))
  let candidate = `${sourceModelId}_copy`
  let index = 2
  while (existing.has(candidate)) {
    candidate = `${sourceModelId}_copy_${index}`
    index += 1
  }
  return candidate
}
