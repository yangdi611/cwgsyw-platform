'use client'

import { useCallback, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  Button,
  Chip,
  Field,
  Input,
  MetricCard,
  NeutralDialog,
  Progress,
  Select,
  Table,
} from '@/design-system/figma-neutral/components'

interface CsvImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  model: string
}

interface CsvImportPreviewVO {
  batchId: string; totalRows: number; toCreate: number; toUpdate: number
  toSkip: number; failedRows: { rowNumber: number; reason: string }[]
  encoding: string; previewData: Record<string, unknown>[]
}

interface CsvImportProgressVO {
  batchId: string; status: string; totalRows: number; processed: number
  created: number; updated: number; skipped: number; failed: number
}

interface CsvImportResultVO {
  batchId: string; totalRows: number; created: number; updated: number
  skipped: number; failed: number; durationMs: number
}

export function CsvImportDialog({ open, onOpenChange, model }: CsvImportDialogProps) {
  const [step, setStep] = useState(0)
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [file, setFile] = useState<File | null>(null)
  const [conflictStrategy, setConflictStrategy] = useState('override')
  const [encoding, setEncoding] = useState('UTF-8')
  const [importMode, setImportMode] = useState('merge')
  const [uniqueKeyFields, setUniqueKeyFields] = useState('')
  const [batchId, setBatchId] = useState('')
  const [preview, setPreview] = useState<CsvImportPreviewVO | null>(null)
  const [result, setResult] = useState<CsvImportResultVO | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lifecycleRef = useRef(0)

  const reset = useCallback(() => {
    setStep(0); setFormat('csv'); setFile(null); setConflictStrategy('override'); setEncoding('UTF-8')
    setImportMode('merge'); setUniqueKeyFields('')
    setBatchId(''); setPreview(null); setResult(null)
  }, [])

  const handleClose = (v: boolean) => {
    if (!v) {
      lifecycleRef.current += 1
      reset()
      onOpenChange(false)
    }
  }

  const downloadTemplate = async () => {
    try {
      const res = await api.get('/cmdb/instances/import/template', { params: { model }, responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url; a.download = `${model}_import_template.csv`; a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('下载模板失败')
    }
  }

  const previewMutation = useMutation({
    mutationFn: async () => {
      const lifecycle = lifecycleRef.current
      if (!file) throw new Error('请选择文件')
      const fd = new FormData()
      fd.append('file', file)
      fd.append('model', model)
      if (format === 'json') {
        fd.append('mode', importMode)
        if (uniqueKeyFields.trim()) fd.append('uniqueKeyFields', uniqueKeyFields.trim())
        const res = await api.post('/cmdb/instances/import/json/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        return { data: res.data.data as CsvImportPreviewVO, lifecycle }
      }
      fd.append('conflictStrategy', conflictStrategy)
      if (encoding) fd.append('encoding', encoding)
      const res = await api.post('/cmdb/instances/import/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      return { data: res.data.data as CsvImportPreviewVO, lifecycle }
    },
    onSuccess: ({ data, lifecycle }) => {
      if (lifecycle !== lifecycleRef.current) return
      setPreview(data)
      setBatchId(data.batchId)
      setStep(1)
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '预览失败')),
  })

  const executeMutation = useMutation({
    mutationFn: () => {
      const lifecycle = lifecycleRef.current
      const url = format === 'json' ? '/cmdb/instances/import/json/execute' : '/cmdb/instances/import/execute'
      return api.post(url, { batchId }).then((r) => ({ data: r.data.data as CsvImportResultVO, lifecycle }))
    },
    onSuccess: ({ data, lifecycle }) => {
      if (lifecycle !== lifecycleRef.current) return
      setResult(data)
      setStep(2)
      if (data.failed > 0) toast.warning(`导入完成，${data.failed} 条失败`)
      else toast.success(`导入完成，创建 ${data.created}，更新 ${data.updated}`)
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, '执行失败')),
  })

  const { data: progress } = useQuery<CsvImportProgressVO>({
    queryKey: ['csv-import-progress', batchId],
    queryFn: () => api.get(`/cmdb/instances/import/${batchId}/progress`).then((r) => r.data.data),
    enabled: step === 2 && executeMutation.isPending && format === 'csv',
    refetchInterval: 1500,
  })

  const downloadFailedRows = async () => {
    try {
      const res = await api.get(`/cmdb/instances/import/${batchId}/failed-rows`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url; a.download = `import_failed_${batchId}.csv`; a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('下载失败')
    }
  }

  return (
    <NeutralDialog open={open} onOpenChange={handleClose} title={`批量导入 — 模型: ${model}`} size="lg">
      <div className="cwgsyw-inline-controls">
        {['上传文件', '预览确认', '执行导入'].map((label, i) => (
          <Chip key={label} label={`${i + 1}. ${label}`} selected={step === i} />
        ))}
      </div>

      {step === 0 ? (
        <div className="cwgsyw-form">
          <Field label="导入格式">
            <Select
              value={format}
              options={[
                { value: 'csv', label: 'CSV（标量字段）' },
                { value: 'json', label: 'JSON / NDJSON（含 table 结构化字段）' },
              ]}
              onChange={(v) => { setFormat((v as 'csv' | 'json') || 'csv'); setFile(null) }}
            />
          </Field>
          {format === 'csv' ? <Button type="button" size="sm" variant="secondary" onClick={() => void downloadTemplate()}>下载 CSV 模板</Button> : null}
          <Field label={`选择${format === 'json' ? ' JSON / NDJSON ' : ' CSV '}文件`} required>
            <Input type="file" accept={format === 'json' ? '.json,.ndjson,.jsonl,.txt' : '.csv'} ref={fileInputRef} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          {format === 'csv' ? (
            <>
              <Field label="冲突策略">
                <Select
                  value={conflictStrategy}
                  options={[
                    { value: 'override', label: '覆盖更新' },
                    { value: 'skip', label: '跳过' },
                    { value: 'error', label: '报错' },
                  ]}
                  onChange={(v) => setConflictStrategy(v || 'override')}
                />
              </Field>
              <Field label="文件编码">
                <Select
                  value={encoding}
                  options={[
                    { value: 'UTF-8', label: 'UTF-8' },
                    { value: 'GBK', label: 'GBK' },
                    { value: 'GB2312', label: 'GB2312' },
                  ]}
                  onChange={(v) => setEncoding(v || 'UTF-8')}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="导入模式">
                <Select
                  value={importMode}
                  options={[
                    { value: 'merge', label: '合并（只更新出现的字段）' },
                    { value: 'replace_fields', label: '字段替换（出现即覆盖）' },
                    { value: 'baseline_replace', label: '基线重导（table 按 row_id 全量对齐）' },
                  ]}
                  onChange={(v) => setImportMode(v || 'merge')}
                />
              </Field>
              <Field label="唯一键字段（可选）">
                <Input value={uniqueKeyFields} onChange={(e) => setUniqueKeyFields(e.target.value)} placeholder="如 asset_no（留空按 name 匹配）" />
              </Field>
            </>
          )}
          <div className="cwgsyw-inline-controls">
            <Button type="button" variant="secondary" onClick={() => handleClose(false)}>取消</Button>
            <Button type="button" disabled={!file || previewMutation.isPending} onClick={() => previewMutation.mutate()}>
              {previewMutation.isPending ? '解析中...' : '下一步'}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 1 && preview ? (
        <div className="cwgsyw-stack-list">
          <div className="cwgsyw-inline-controls">
            <MetricCard label="总行数" value={String(preview.totalRows)} />
            <MetricCard label="新建" value={String(preview.toCreate)} tone="success" />
            <MetricCard label="更新" value={String(preview.toUpdate)} tone="warning" />
            <MetricCard label="跳过" value={String(preview.toSkip)} />
          </div>
          {preview.failedRows.length > 0 ? (
            <Table
              showSearch={false}
              columns={[{ key: 'row', label: '行号' }, { key: 'reason', label: '原因' }]}
              rows={preview.failedRows.slice(0, 20).map((r, i) => ({ id: String(i), cells: { row: String(r.rowNumber), reason: r.reason } }))}
            />
          ) : null}
          {preview.previewData.length > 0 ? (
            <Table
              showSearch={false}
              columns={Object.keys(preview.previewData[0]).map((k) => ({ key: k, label: k }))}
              rows={preview.previewData.slice(0, 5).map((row, i) => ({
                id: String(i),
                cells: Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v ?? '')])),
              }))}
            />
          ) : null}
          <div className="cwgsyw-inline-controls">
            <Button type="button" variant="secondary" onClick={() => setStep(0)}>返回</Button>
            <Button type="button" disabled={executeMutation.isPending || preview.totalRows === 0} onClick={() => executeMutation.mutate()}>
              {executeMutation.isPending ? '导入中...' : '确认导入'}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="cwgsyw-stack-list">
          {executeMutation.isPending && progress ? (
            <Progress value={progress.totalRows ? (progress.processed / progress.totalRows) * 100 : 0} label={`${progress.processed} / ${progress.totalRows}`} />
          ) : null}
          {result ? (
            <>
              <div className="cwgsyw-inline-controls">
                <MetricCard label="总计" value={String(result.totalRows)} />
                <MetricCard label="创建" value={String(result.created)} tone="success" />
                <MetricCard label="更新" value={String(result.updated)} tone="warning" />
                <MetricCard label="失败" value={String(result.failed)} tone={result.failed ? 'danger' : 'neutral'} />
              </div>
              <p className="cwgsyw-type-label-sm">耗时: {(result.durationMs / 1000).toFixed(1)}s</p>
              {result.failed > 0 && format === 'csv' ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => void downloadFailedRows()}>下载失败行</Button>
              ) : null}
            </>
          ) : null}
          <Button type="button" onClick={() => handleClose(false)}>完成</Button>
        </div>
      ) : null}
    </NeutralDialog>
  )
}
