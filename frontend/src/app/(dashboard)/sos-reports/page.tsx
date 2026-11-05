'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage } from '@/lib/api-error'
import { sosReportApi, type SosReport } from '@/lib/sos-report-api'
import {
  SosUploadCancelledError,
  describeUploadError,
  uploadProgressLabel,
  uploadSosReport,
  type SosUploadProgress,
} from '@/lib/sos-report-upload'
import {
  ACCEPTED_SUFFIXES,
  MAX_UPLOAD_BYTES,
  REPORT_STATUS,
  formatBytes,
  formatDateTime,
  hasAcceptedSuffix,
  isFinished,
} from '@/lib/sos-report-format'
import { usePermission } from '@/hooks/usePermission'
import { toast } from '@/design-system/figma-neutral/toast'
import '@/design-system/figma-neutral/index.css'
import {
  Alert,
  Button,
  DataManagementPage,
  EmptyState,
  ErrorState,
  FilterBar,
  NeutralAlertDialog,
  PageHeader,
  Pagination,
  Progress,
  SearchInput,
  Select,
  StatusBadge,
  Table,
} from '@/design-system/figma-neutral/components'
import { PendingApprovals } from './PendingApprovals'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: REPORT_STATUS.pending.label },
  { value: 'parsing', label: REPORT_STATUS.parsing.label },
  { value: 'parsed', label: REPORT_STATUS.parsed.label },
  { value: 'failed', label: REPORT_STATUS.failed.label },
]

export default function SosReportsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { hasPermission, isHydrated } = usePermission()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [deleting, setDeleting] = useState<SosReport | null>(null)
  const [uploadProgress, setUploadProgress] = useState<SosUploadProgress | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const canRead = hasPermission('sos_report', 'read')

  useEffect(() => {
    if (isHydrated && !canRead) router.replace('/')
  }, [isHydrated, canRead, router])

  const query = useQuery({
    queryKey: ['sos-reports', keyword, status, page],
    queryFn: () => sosReportApi.list({ keyword: keyword || undefined, status: status || undefined, page, size: PAGE_SIZE }),
    enabled: canRead,
    // 有未结束的解析时自动刷新，全部结束后停止。
    refetchInterval: (state) => (state.state.data?.records.some((report) => !isFinished(report.status)) ? 3000 : false),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const controller = new AbortController()
      abortRef.current = controller
      setUploadError(null)
      return uploadSosReport(file, setUploadProgress, controller.signal)
    },
    onSuccess: () => {
      toast.success('上传成功，正在后台解析')
      queryClient.invalidateQueries({ queryKey: ['sos-reports'] })
    },
    onError: (error) => {
      if (error instanceof SosUploadCancelledError) toast.message('已取消上传')
      else setUploadError(describeUploadError(error))
    },
    onSettled: () => {
      setUploadProgress(null)
      abortRef.current = null
      if (inputRef.current) inputRef.current.value = ''
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => sosReportApi.remove(id),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['sos-reports'] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, '删除失败')),
    onSettled: () => setDeleting(null),
  })

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const problem = !hasAcceptedSuffix(file.name)
      ? '只支持 .tar.xz 和 .tar.gz 格式'
      : file.size > MAX_UPLOAD_BYTES
        ? '文件不能超过 200 MB'
        : null
    if (problem) {
      toast.error(problem)
      event.target.value = ''
      return
    }
    uploadMutation.mutate(file)
  }

  const records = query.data?.records ?? []
  const total = query.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const uploading = uploadMutation.isPending
  const canDelete = hasPermission('sos_report', 'delete')

  // 整页刷新或关闭会中断上传。站内跳转不受影响，上传会在后台继续。
  useEffect(() => {
    if (!uploading) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uploading])

  return (
    <>
      <DataManagementPage
        embedded
        className="cwgsyw-sos-report"
        header={
          <PageHeader
            showEyebrow={false}
            showBreadcrumb={false}
            title="SOS 报告"
            subtitle="上传 Linux 主机的 sosreport，解析成结构化数据，并通过审批录入 CMDB。原始压缩包解析后即删除。"
            actions={
              <div className="cwgsyw-inline-controls">
                <Button type="button" variant="secondary" size="sm" onClick={() => router.push('/sos-reports/mappings')}>
                  字段映射规则
                </Button>
                {hasPermission('sos_report', 'upload') ? (
                  <>
                    <Button type="button" size="sm" loading={uploading} onClick={() => inputRef.current?.click()}>
                      {uploading ? '上传中…' : '上传报告'}
                    </Button>
                    {uploading ? (
                      <Button type="button" variant="secondary" size="sm" onClick={() => abortRef.current?.abort()}>
                        取消上传
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
            }
          />
        }
        filter={
          <FilterBar
            search={
              <SearchInput
                size="sm"
                placeholder="搜索文件名、主机名、序列号或 IP…"
                aria-label="搜索 SOS 报告"
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value)
                  setPage(1)
                }}
              />
            }
            filterItems={
              <Select
                size="sm"
                aria-label="解析状态"
                value={status}
                options={STATUS_OPTIONS}
                onChange={(value) => {
                  setStatus(value)
                  setPage(1)
                }}
              />
            }
          />
        }
        content={
          <div className="cwgsyw-form">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_SUFFIXES.join(',')}
              aria-label="选择 SOS 报告文件"
              className="cwgsyw-sr-only"
              onChange={onFileChange}
            />
            {uploadError ? (
              <Alert tone="danger" title="上传失败" description={uploadError} onDismiss={() => setUploadError(null)} />
            ) : null}
            {uploadProgress != null ? (
              <Progress value={uploadProgress.percent} label={uploadProgressLabel(uploadProgress)} showLabel showPercentage size="sm" tone="neutral" />
            ) : null}
            <PendingApprovals />
            {query.isError ? (
              <ErrorState description={getApiErrorMessage(query.error, '无法加载 SOS 报告')} retry={<Button type="button" variant="secondary" size="sm" onClick={() => query.refetch()}>重试</Button>} />
            ) : (
              <>
                <Table
                  className="cwgsyw-cmdb-table"
                  density="compact"
                  showSearch={false}
                  columns={[
                    { key: 'fileName', label: '文件' },
                    { key: 'status', label: '状态' },
                    { key: 'hostname', label: '主机名' },
                    { key: 'primaryIp', label: 'IP' },
                    { key: 'serialNumber', label: '序列号' },
                    { key: 'size', label: '大小' },
                    { key: 'createdBy', label: '上传者' },
                    { key: 'createdAt', label: '上传时间' },
                    { key: 'actions', label: <span className="cwgsyw-sr-only">操作</span>, align: 'right' },
                  ]}
                  rows={records.map((report) => ({
                    id: String(report.id),
                    cells: {
                      fileName: <Link href={`/sos-reports/${report.id}`}>{report.fileName}</Link>,
                      status: <StatusBadge label={REPORT_STATUS[report.status].label} status={REPORT_STATUS[report.status].tone} />,
                      hostname: report.hostname || '—',
                      primaryIp: report.primaryIp || '—',
                      serialNumber: report.serialNumber || '—',
                      size: formatBytes(report.fileSize),
                      createdBy: report.createdByName || '—',
                      createdAt: formatDateTime(report.createdAt),
                      actions: canDelete ? (
                        <Button type="button" variant="ghost" size="sm" aria-label={`删除 ${report.fileName}`} onClick={() => setDeleting(report)}>
                          删除
                        </Button>
                      ) : null,
                    },
                  }))}
                  state={query.isLoading ? 'loading' : records.length === 0 ? 'empty' : 'data'}
                  empty={
                    <EmptyState
                      title={keyword || status ? '没有符合条件的报告' : '还没有 SOS 报告'}
                      description={keyword || status ? '请调整搜索条件。' : '点击右上角“上传报告”，上传主机上生成的 sosreport 压缩包。'}
                    />
                  }
                />
                <Pagination page={page} pageCount={pageCount} totalCount={total} onPageChange={setPage} />
              </>
            )}
          </div>
        }
      />
      <NeutralAlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="删除 SOS 报告"
        description={`确定删除“${deleting?.fileName ?? ''}”吗？已写入 CMDB 的数据不受影响。`}
        intent="destructive"
        confirmLabel="删除"
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id)
        }}
      />
    </>
  )
}
