'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { downloadSharedFile, fetchSharedFileBlob } from '@/lib/shared-file-content'
import { usePermission } from '@/hooks/usePermission'
import { Button, buttonVariants } from '@/components/design-system'
import Link from 'next/link'
import { ArrowLeft, Download, File } from 'lucide-react'
import { WorkspaceShell, WorkspaceToolbar } from '@/components/shared'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

interface FileDetail {
  id: number
  name: string
  originalName: string
  fileType: string
  sizeBytes: number
  createdByName: string
  createdAt: string
}

interface FileDetailResponse {
  data: FileDetail
}

// ─── DOCX Preview ─────────────────────────────────────────────────────────────

function DocxPreview({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { renderAsync } = await import('docx-preview')
        const res = await fetch(url)
        const buf = await res.arrayBuffer()
        if (cancelled || !containerRef.current) return
        await renderAsync(buf, containerRef.current)
      } catch {
        if (!cancelled) setError('无法预览此文件，请下载后查看。')
      }
    }
    load()
    return () => { cancelled = true }
  }, [url])

  if (error) return <div className="p-8 text-muted-foreground text-center">{error}</div>
  return <div ref={containerRef} className="w-full h-full overflow-auto p-4 bg-white" />
}

// ─── XLSX Preview ─────────────────────────────────────────────────────────────

function XlsxPreview({ url }: { url: string }) {
  const [rows, setRows] = useState<string[][] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { readSheet } = await import('read-excel-file/browser')
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Failed to fetch spreadsheet: ${res.status}`)
        const spreadsheetRows = await readSheet(await res.blob())
        if (cancelled) return
        setRows(spreadsheetRows.map(row => row.map(cell => cell == null ? '' : String(cell))))
      } catch {
        if (!cancelled) setError('无法预览此文件，请下载后查看。')
      }
    }
    load()
    return () => { cancelled = true }
  }, [url])

  if (error) return <div className="p-8 text-muted-foreground text-center">{error}</div>
  if (!rows) return <div className="p-8 text-muted-foreground text-center">加载中...</div>
  return (
    <div className="w-full h-full overflow-auto p-4 bg-white">
      <table className="min-w-full border-collapse text-sm text-foreground">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, columnIndex) => (
                <td key={columnIndex} className="whitespace-pre-wrap border px-2 py-1 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FilePreviewPage() {
  const params = useParams()
  const router = useRouter()
  const { hasPermission, isHydrated } = usePermission()
  const id = params.id as string

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('shared_file', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const canRead = isHydrated && hasPermission('shared_file', 'read')
  const { data: detailData, isError: detailError, refetch: refetchDetail } = useQuery<FileDetailResponse>({
    queryKey: ['file-detail', id],
    queryFn: () => api.get(`/files/${id}`).then(r => r.data),
    enabled: !!id && canRead,
  })

  const { data: previewBlob, isError: previewError, refetch: refetchPreview } = useQuery<Blob>({
    queryKey: ['file-preview-content', id],
    queryFn: () => fetchSharedFileBlob(id, 'preview', 'preview').then((result) => result.blob),
    enabled: !!id && canRead,
  })

  const file = detailData?.data
  const previewUrl = useMemo(
    () => (previewBlob ? URL.createObjectURL(previewBlob) : undefined),
    [previewBlob],
  )

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const ext = file?.fileType?.toLowerCase() ?? ''
  const isPdf = ext === 'pdf'
  const isDocx = ext === 'docx' || ext === 'doc'
  const isLegacyXls = (file?.originalName ?? file?.name ?? '').toLowerCase().endsWith('.xls')
  const isXlsx = ext === 'xlsx' && !isLegacyXls
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)

  const handleDownload = async () => {
    try {
      await downloadSharedFile(id, file?.originalName ?? file?.name ?? 'download')
    } catch {
      toast.error('下载失败')
    }
  }

  const loadFailed = detailError || previewError
  const retry = () => {
    void refetchDetail()
    void refetchPreview()
  }

  return (
    <WorkspaceShell
      height="viewport"
      className="-m-4 md:-m-6"
      toolbar={(
        <WorkspaceToolbar
          leading={(
            <Link href="/files" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回
            </Link>
          )}
          title={file?.name ?? (loadFailed ? '无法加载文件' : '加载中...')}
          subtitle={file ? `${file.createdByName} · ${formatBytes(file.sizeBytes)} · ${new Date(file.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}` : undefined}
          actions={(
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!file || loadFailed}>
              <Download className="h-4 w-4 mr-1.5" />下载
            </Button>
          )}
        />
      )}
    >
      <div className="flex min-h-0 flex-1 overflow-hidden bg-muted/30">
        {loadFailed ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <p>无法加载文件。文件可能不存在或你没有访问权限。</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={retry}>重试</Button>
              <Link href="/files" className={buttonVariants({ variant: 'outline', size: 'sm' })}>返回文件列表</Link>
            </div>
          </div>
        ) : !previewUrl ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            加载中...
          </div>
        ) : isPdf ? (
          <iframe
            src={previewUrl}
            className="w-full h-full border-0"
            title={file?.name}
          />
        ) : isDocx ? (
          <DocxPreview url={previewUrl} />
        ) : isXlsx ? (
          <XlsxPreview url={previewUrl} />
        ) : isLegacyXls ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
            <File className="h-16 w-16 opacity-30" />
            <p className="text-sm">旧版 Excel 文件暂不支持在线预览，请下载后查看</p>
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1.5" />
              下载文件
            </Button>
          </div>
        ) : isImage ? (
          <div className="flex items-center justify-center h-full p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={file?.name}
              className="max-w-full max-h-full object-contain rounded shadow"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <File className="h-16 w-16 opacity-30" />
            <p className="text-sm">此文件类型不支持在线预览</p>
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1.5" />
              下载文件
            </Button>
          </div>
        )}
      </div>
    </WorkspaceShell>
  )
}
