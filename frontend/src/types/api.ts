/**
 * Core API type contracts
 * Based on backend response patterns observed in the codebase
 */

/**
 * Generic API response wrapper
 * Backend typically wraps data in { code, message, data }
 */
export interface ApiResponse<T> {
  code?: number
  message?: string
  data: T
}

/**
 * Paginated response shape
 * Backend uses { records, total, size?, current? }
 */
export interface PaginatedResponse<T> {
  records: T[]
  total: number
  size?: number
  current?: number
}

/**
 * API error response shape
 * Backend returns { code?, message?, errorCode?, data? }
 */
export interface ApiError {
  code?: number
  message?: string
  errorCode?: string
  data?: unknown
}

/**
 * Helper to extract data from axios response
 * Usage: const users = extractData(response)
 */
export function extractData<T>(response: { data: ApiResponse<T> }): T {
  return response.data.data
}

/**
 * Helper to extract paginated data
 * Usage: const { records, total } = extractPaginated(response)
 */
export function extractPaginated<T>(
  response: { data: ApiResponse<PaginatedResponse<T>> }
): PaginatedResponse<T> {
  return response.data.data
}
