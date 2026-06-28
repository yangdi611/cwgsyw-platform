'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Download, File } from 'lucide-react'

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
  fileType: string
  sizeBytes: number
  createdByName: string
  createdAt: string
}

interface PreviewUrlResponse {
  data: { url: string }
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
      } catch (e) {
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
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const XLSX = await import('xlsx')
        const res = await fetch(url)
        const buf = await res.arrayBuffer()
        if (cancelled) return
        const wb = XLSX.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const tableHtml = XLSX.utils.sheet_to_html(ws)
        if (!cancelled) setHtml(tableHtml)
      } catch (e) {
        if (!cancelled) setError('无法预览此文件，请下载后查看。')
      }
    }
    load()
    return () => { cancelled = true }
  }, [url])

  if (error) return <div className="p-8 text-muted-foreground text-center">{error}</div>
  if (!html) return <div className="p-8 text-muted-foreground text-center">加载中...</div>
  return (
    <div
      className="w-full h-full overflow-auto p-4 bg-white"
      dangerouslySetInnerHTML={{ __html: html }}
    />
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

  const { data: detailData } = useQuery<FileDetailResponse>({
    queryKey: ['file-detail', id],
    queryFn: () => api.get(`/files/${id}`).then(r => r.data),
    enabled: !!id,
  })

  const { data: urlData } = useQuery<PreviewUrlResponse>({
    queryKey: ['file-preview-url', id],
    queryFn: () => api.get(`/files/${id}/preview-url`).then(r => r.data),
    enabled: !!id,
  })

  const file = detailData?.data
  const previewUrl = urlData?.data?.url

  const ext = file?.fileType?.toLowerCase() ?? ''
  const isPdf = ext === 'pdf'
  const isDocx = ext === 'docx' || ext === 'doc'
  const isXlsx = ext === 'xlsx' || ext === 'xls'
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)

  const handleDownload = async () => {
    const res = await api.get(`/files/${id}/download-url`)
    const url: string = res.data?.data?.url ?? res.data?.url
    if (url) {
      const a = document.createElement('a')
      a.href = url
      a.download = file?.name ?? 'download'
      a.target = '_blank'
      a.click()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
        <Link href="/files" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate text-v2-fg">{file?.name ?? '加载中...'}</h1>
          {file && (
            <p className="text-xs text-muted-foreground">
              {file.createdByName} · {formatBytes(file.sizeBytes)} ·{' '}
              {new Date(file.createdAt).toLocaleString('zh-CN', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1.5" />
          下载
        </Button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 min-h-0 overflow-hidden bg-muted/30">
        {!previewUrl ? (
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
    </div>
  )
}
