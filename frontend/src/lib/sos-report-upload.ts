import type { AxiosInstance } from 'axios'
import api from './api'
import { getApiErrorCode, getApiErrorMessage } from './api-error'
import type { SosReport } from './sos-report-api'
import { formatBytes, formatDuration } from './sos-report-format'

export interface SosUploadProgress {
  phase: 'preparing' | 'uploading' | 'assembling'
  /** 只按服务器已确认的分片计算。浏览器发出的字节可能还停在 Cloudflare，不算进度。 */
  percent: number
  uploadedBytes: number
  totalBytes: number
  remainingSeconds?: number
}

interface UploadSession {
  uploadId: string
  chunkSize: number
  chunkCount: number
}

type UploadClient = Pick<AxiosInstance, 'post' | 'delete'>
type Wait = (ms: number, signal: AbortSignal) => Promise<void>

export class SosUploadCancelledError extends Error {}

/** 大于 Cloudflare 的 120 秒时限，让它先返回 524，再由重试接手。 */
const REQUEST_TIMEOUT_MS = 150_000
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000]
const NETWORK_FAILURE = '网络不稳定或服务器响应超时，自动重试后仍未成功。请检查网络后重新上传。'

const waitFor: Wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(new SosUploadCancelledError())
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status
}

function isTransient(error: unknown): boolean {
  const status = statusOf(error)
  if (status == null) return true
  return status >= 500 || status === 408 || status === 429 || getApiErrorCode(error) === 'SOS_UPLOAD_ASSEMBLING'
}

async function withRetry<T>(request: () => Promise<T>, signal: AbortSignal, wait: Wait): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request()
    } catch (error) {
      if (signal.aborted || attempt >= RETRY_DELAYS_MS.length || !isTransient(error)) throw error
      await wait(RETRY_DELAYS_MS[attempt], signal)
    }
  }
}

/** 传之前先算摘要，重复文件不用等传完才被拒绝。crypto.subtle 只在 HTTPS 和 localhost 可用，算不出来就不带。 */
async function digestFile(file: File): Promise<string | undefined> {
  try {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    return undefined
  }
}

export async function uploadSosReport(
  file: File,
  onProgress: (progress: SosUploadProgress) => void,
  signal: AbortSignal,
  { client = api, wait = waitFor, now = Date.now }: { client?: UploadClient; wait?: Wait; now?: () => number } = {},
): Promise<SosReport> {
  const totalBytes = file.size
  const config = { timeout: REQUEST_TIMEOUT_MS, signal }
  let uploadId: string | undefined
  try {
    onProgress({ phase: 'preparing', percent: 0, uploadedBytes: 0, totalBytes })
    const sha256 = await digestFile(file)
    if (signal.aborted) throw new SosUploadCancelledError()

    const session = await withRetry(
      () =>
        client
          .post('/sos-reports/uploads', { fileName: file.name, fileSize: totalBytes, sha256 }, config)
          .then((response) => response.data.data as UploadSession),
      signal,
      wait,
    )
    uploadId = session.uploadId
    const startedAt = now()
    onProgress({ phase: 'uploading', percent: 0, uploadedBytes: 0, totalBytes })

    for (let index = 0; index < session.chunkCount; index += 1) {
      const start = index * session.chunkSize
      const end = Math.min(start + session.chunkSize, totalBytes)
      await withRetry(
        () => {
          const form = new FormData()
          form.append('chunk', file.slice(start, end))
          return client.post(`/sos-reports/uploads/${uploadId}/chunks/${index}`, form, {
            ...config,
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        },
        signal,
        wait,
      )
      const elapsedMs = now() - startedAt
      onProgress({
        phase: 'uploading',
        percent: Math.round((end / totalBytes) * 100),
        uploadedBytes: end,
        totalBytes,
        remainingSeconds: Math.round(((elapsedMs / end) * (totalBytes - end)) / 1000),
      })
    }

    onProgress({ phase: 'assembling', percent: 100, uploadedBytes: totalBytes, totalBytes })
    return await withRetry(
      () => client.post(`/sos-reports/uploads/${uploadId}/complete`, undefined, config).then((response) => response.data.data as SosReport),
      signal,
      wait,
    )
  } catch (error) {
    // 分片可能含凭据，失败后马上清理。这里失败也没关系，服务器会在会话过期后清理。
    if (uploadId) client.delete(`/sos-reports/uploads/${uploadId}`).catch(() => undefined)
    if (signal.aborted) throw new SosUploadCancelledError()
    throw error
  }
}

export function uploadProgressLabel(progress: SosUploadProgress): string {
  if (progress.phase === 'preparing') return '正在校验文件…'
  if (progress.phase === 'assembling') return '已全部上传，服务器正在合并文件…'
  const uploaded = `已上传 ${formatBytes(progress.uploadedBytes)} / ${formatBytes(progress.totalBytes)}`
  const remaining = progress.remainingSeconds != null && progress.uploadedBytes < progress.totalBytes
    ? `，预计还需 ${formatDuration(progress.remainingSeconds)}`
    : ''
  return `${uploaded}${remaining}。请勿刷新或关闭页面`
}

/** Cloudflare 的错误不带 errorCode，内容是英文，不直接展示给用户。 */
export function describeUploadError(error: unknown): string {
  if (getApiErrorCode(error)) return getApiErrorMessage(error, '上传失败')
  const status = statusOf(error)
  if (status == null || status >= 500) return NETWORK_FAILURE
  return `上传请求被拒绝（HTTP ${status}）`
}
