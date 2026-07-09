/**
 * Safe error message extraction from API errors
 * Handles Axios errors, Error objects, and unknown shapes
 */

import type { ApiError } from '@/types/api'

/**
 * Extract error message from unknown error object
 * @param error - Unknown error (from catch block)
 * @param fallback - Default message if extraction fails
 * @returns Human-readable error message
 */
export function getApiErrorMessage(error: unknown, fallback = '操作失败'): string {
  // Axios error with response
  if (isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined
    if (data?.message) return data.message
    if (data?.errorCode) return data.errorCode
    if (error.message) return error.message
  }

  // Standard Error object
  if (error instanceof Error) {
    return error.message
  }

  // String error
  if (typeof error === 'string') {
    return error
  }

  // Unknown shape
  return fallback
}

/**
 * Type guard for Axios-like errors
 */
export function isAxiosError(error: unknown): error is {
  response?: { status: number; data: unknown }
  message: string
} {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    'message' in error
  )
}

/**
 * Extract error code from API error (if available)
 */
export function getApiErrorCode(error: unknown): string | undefined {
  if (isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined
    return data?.errorCode
  }
  return undefined
}
