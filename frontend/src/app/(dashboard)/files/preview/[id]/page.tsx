'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { downloadSharedFile, fetchSharedFileBlob } from '@/lib/shared-file-content'
import { usePermission } from '@/hooks/usePermission'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  DetailDrawerPage,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/design-system/figma-neutral/components'

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

function DocxPreview({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { renderAsync } = await import('docx-preview')
        const response = await fetch(url)
        const buffer = await response.arrayBuffer()
        if (cancelled || !containerRef.current) return
        await renderAsync(buffer, containerRef.current)
      } catch {
        if (!cancelled) setError('无法预览此文件，请下载后查看。')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [url])

  if (error) return <EmptyState title="无法预览" description={error} showAction={false} />
  return <div ref={containerRef} className="cwgsyw-preview" />
}

function XlsxPreview({ url }: { url: string }) {
  const [rows, setRows] = useState<string[][] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { readSheet } = await import('read-excel-file/browser')
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Failed to fetch spreadsheet: ${response.status}`)
        const spreadsheetRows = await readSheet(await response.blob())
        if (cancelled) return
        setRows(spreadsheetRows.map((row) => row.map((cell) => (cell == null ? '' : String(cell)))))
      } catch {
        if (!cancelled) setError('无法预览此文件，请下载后查看。')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [url])

  if (error) return <EmptyState title="无法预览" description={error} showAction={false} />
  if (!rows) return <LoadingState label="正在加载表格…" />
  return (
    <div className="cwgsyw-preview">
      <table>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, columnIndex) => (
                <td key={columnIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

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
    queryFn: () => api.get(`/files/${id}`).then((response) => response.data),
    enabled: !!id && canRead,
  })

  const { data: previewBlob, isError: previewError, refetch: refetchPreview } = useQuery<Blob>({
    queryKey: ['file-preview-content', id],
    queryFn: () => fetchSharedFileBlob(id, 'preview', 'preview').then((result) => result.blob),
    enabled: !!id && canRead,
  })

  const file = detailData?.data
  const previewUrl = useMemo(() => (previewBlob ? URL.createObjectURL(previewBlob) : undefined), [previewBlob])

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
    <DetailDrawerPage
      embedded
      className="cwgsyw-files cwgsyw-files-preview"
      header={
        <PageHeader
          showEyebrow={false}
          showBreadcrumb={false}
          title={file?.name ?? (loadFailed ? '无法加载文件' : '文件预览')}
          subtitle={
            file
              ? `${file.createdByName} · ${formatBytes(file.sizeBytes)} · ${new Date(file.createdAt).toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : '查看共享文件内容，或下载后离线打开。'
          }
          actions={
            <div className="cwgsyw-inline-controls">
              <Button type="button" variant="secondary" size="sm" onClick={() => router.push('/files')}>
                返回
              </Button>
              <Button type="button" size="sm" disabled={!file || loadFailed} onClick={() => void handleDownload()}>
                下载
              </Button>
            </div>
          }
        />
      }
      content={
        loadFailed ? (
          <ErrorState
            title="无法加载文件"
            description="文件可能不存在或你没有访问权限。"
            retry={
              <div className="cwgsyw-inline-controls">
                <Button type="button" variant="secondary" size="sm" onClick={retry}>
                  重试
                </Button>
                <Link href="/files">返回文件列表</Link>
              </div>
            }
          />
        ) : !previewUrl ? (
          <LoadingState label="正在加载预览…" />
        ) : isPdf ? (
          <iframe src={previewUrl} className="cwgsyw-preview" title={file?.name} />
        ) : isDocx ? (
          <DocxPreview url={previewUrl} />
        ) : isXlsx ? (
          <XlsxPreview url={previewUrl} />
        ) : isLegacyXls ? (
          <EmptyState
            title="旧版 Excel 暂不支持预览"
            description="请下载后查看。"
            action={
              <Button type="button" variant="primary" onClick={() => void handleDownload()}>
                下载文件
              </Button>
            }
          />
        ) : isImage ? (
          <div className="cwgsyw-preview">
            <img src={previewUrl} alt={file?.name} />
          </div>
        ) : (
          <EmptyState
            title="此文件类型不支持在线预览"
            description="请下载后查看。"
            action={
              <Button type="button" variant="primary" onClick={() => void handleDownload()}>
                下载文件
              </Button>
            }
          />
        )
      }
    />
  )
}
