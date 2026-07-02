'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Upload, Download, ChevronRight, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface CsvImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  model: string
}

interface CsvImportPreviewVO {
  batchId: string; totalRows: number; toCreate: number; toUpdate: number
  toSkip: number; failedRows: { rowNumber: number; reason: string }[]
  encoding: string; previewData: Record<string, any>[]
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
  const [step, setStep] = useState(0) // 0=upload, 1=preview, 2=progress/done
  const [format, setFormat] = useState<'csv' | 'json'>('csv') // csv | json/ndjson（§7）
  const [file, setFile] = useState<File | null>(null)
  const [conflictStrategy, setConflictStrategy] = useState('override')
  const [encoding, setEncoding] = useState('UTF-8')
  const [importMode, setImportMode] = useState('merge') // JSON 导入模式（§7.2）
  const [uniqueKeyFields, setUniqueKeyFields] = useState('') // JSON 唯一键（逗号分隔，空=按 name）
  const [batchId, setBatchId] = useState('')
  const [preview, setPreview] = useState<CsvImportPreviewVO | null>(null)
  const [result, setResult] = useState<CsvImportResultVO | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep(0); setFormat('csv'); setFile(null); setConflictStrategy('override'); setEncoding('UTF-8')
    setImportMode('merge'); setUniqueKeyFields('')
    setBatchId(''); setPreview(null); setResult(null)
  }, [])

  const handleClose = (v: boolean) => {
    if (!v) { onOpenChange(false); setTimeout(reset, 200) }
  }

  useEffect(() => { if (open) reset() }, [open, reset])

  // Download template
  const downloadTemplate = async () => {
    try {
      const res = await api.get('/cmdb/instances/import/template', {
        params: { model }, responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url; a.download = `${model}_import_template.csv`; a.click()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      toast.error('下载模板失败')
    }
  }

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('请选择文件')
      const fd = new FormData()
      fd.append('file', file)
      fd.append('model', model)
      if (format === 'json') {
        fd.append('mode', importMode)
        if (uniqueKeyFields.trim()) fd.append('uniqueKeyFields', uniqueKeyFields.trim())
        const res = await api.post('/cmdb/instances/import/json/preview', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        return res.data.data as CsvImportPreviewVO
      }
      fd.append('conflictStrategy', conflictStrategy)
      if (encoding) fd.append('encoding', encoding)
      const res = await api.post('/cmdb/instances/import/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data.data as CsvImportPreviewVO
    },
    onSuccess: (data) => {
      setPreview(data)
      setBatchId(data.batchId)
      setStep(1)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '预览失败'),
  })

  // Execute mutation
  const executeMutation = useMutation({
    mutationFn: () => {
      const url = format === 'json'
        ? '/cmdb/instances/import/json/execute'
        : '/cmdb/instances/import/execute'
      return api.post(url, { batchId }).then(r => r.data.data as CsvImportResultVO)
    },
    onSuccess: (data) => {
      setResult(data)
      setStep(2)
      if (data.failed > 0) toast.warning(`导入完成，${data.failed} 条失败`)
      else toast.success(`导入完成，创建 ${data.created}，更新 ${data.updated}`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '执行失败'),
  })

  // Poll progress
  const { data: progress } = useQuery<CsvImportProgressVO>({
    queryKey: ['csv-import-progress', batchId],
    queryFn: () => api.get(`/cmdb/instances/import/${batchId}/progress`).then(r => r.data.data),
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
    } catch { toast.error('下载失败') }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>批量导入 — 模型: {model}</DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 text-sm mb-4">
          {['上传文件', '预览确认', '执行导入'].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="h-4 w-4 text-v2-muted" />}
              <span className={step === i ? 'font-medium text-v2-fg' : step > i ? 'text-green-600' : 'text-v2-muted'}>
                {step > i ? <CheckCircle className="inline h-4 w-4 mr-1" /> : `${i + 1}. `}{label}
              </span>
            </div>
          ))}
        </div>

        {/* Step 0: Upload */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>导入格式</Label>
              <Select value={format} onValueChange={v => { setFormat((v as 'csv' | 'json') ?? 'csv'); setFile(null) }}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string) => (v === 'json' ? 'JSON / NDJSON（含 table 结构化字段）' : 'CSV（标量字段）')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV（标量字段）</SelectItem>
                  <SelectItem value="json">JSON / NDJSON（含 table 结构化字段）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {format === 'csv' && (
              <Button size="sm" variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" />下载 CSV 模板
              </Button>
            )}
            <div className="space-y-1.5">
              <Label>选择{format === 'json' ? ' JSON / NDJSON ' : ' CSV '}文件 *</Label>
              <Input type="file" accept={format === 'json' ? '.json,.ndjson,.jsonl,.txt' : '.csv'} ref={fileInputRef}
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
              {format === 'json' && (
                <p className="text-xs text-v2-muted">支持 JSON 数组或 NDJSON（一行一对象）。顶层 name 为实例名，其余键含 table 数组（每行带 row_id）进入字段数据。</p>
              )}
            </div>

            {format === 'csv' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>冲突策略</Label>
                  <Select value={conflictStrategy} onValueChange={v => setConflictStrategy(v ?? 'override')}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) => ({ override: '覆盖更新', skip: '跳过', error: '报错' } as Record<string, string>)[v] ?? v}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="override">覆盖更新</SelectItem>
                      <SelectItem value="skip">跳过</SelectItem>
                      <SelectItem value="error">报错</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>文件编码</Label>
                  <Select value={encoding} onValueChange={v => setEncoding(v ?? 'UTF-8')}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTF-8">UTF-8</SelectItem>
                      <SelectItem value="GBK">GBK</SelectItem>
                      <SelectItem value="GB2312">GB2312</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>导入模式</Label>
                  <Select value={importMode} onValueChange={v => setImportMode(v ?? 'merge')}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string) => ({
                          merge: '合并（只更新出现的字段）',
                          replace_fields: '字段替换（出现即覆盖）',
                          baseline_replace: '基线重导（table 按 row_id 全量对齐）',
                        } as Record<string, string>)[v] ?? v}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="merge">合并（只更新出现的字段）</SelectItem>
                      <SelectItem value="replace_fields">字段替换（出现即覆盖）</SelectItem>
                      <SelectItem value="baseline_replace">基线重导（table 按 row_id 全量对齐）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>唯一键字段（可选）</Label>
                  <Input value={uniqueKeyFields} onChange={e => setUniqueKeyFields(e.target.value)}
                    placeholder="如 asset_no（留空按 name 匹配）" />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => handleClose(false)}>取消</Button>
              <Button size="sm" onClick={() => previewMutation.mutate()} disabled={!file || previewMutation.isPending}>
                {previewMutation.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />解析中...</> : '下一步'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Preview */}
        {step === 1 && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                { label: '总行数', value: preview.totalRows, color: '' },
                { label: '新建', value: preview.toCreate, color: 'text-green-600' },
                { label: '更新', value: preview.toUpdate, color: 'text-blue-600' },
                { label: '跳过', value: preview.toSkip, color: 'text-yellow-600' },
              ].map((s, i) => (
                <div key={i} className="p-3 border rounded">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-v2-muted">{s.label}</div>
                </div>
              ))}
            </div>

            {preview.failedRows.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-v2-danger mb-2">
                  <XCircle className="inline h-4 w-4 mr-1" />失败行 ({preview.failedRows.length})
                </h4>
                <div className="max-h-32 overflow-auto border rounded">
                  <Table>
                    <TableHeader><TableRow><TableHead>行号</TableHead><TableHead>原因</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {preview.failedRows.slice(0, 20).map((r, i) => (
                        <TableRow key={i}><TableCell>{r.rowNumber}</TableCell><TableCell>{r.reason}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {preview.previewData.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">数据预览（前 {Math.min(5, preview.previewData.length)} 行）</h4>
                <div className="max-h-40 overflow-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>{Object.keys(preview.previewData[0]).map(k => <TableHead key={k}>{k}</TableHead>)}</TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.previewData.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>{Object.values(row).map((v, j) => <TableCell key={j}>{String(v ?? '')}</TableCell>)}</TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep(0)}>返回</Button>
              <Button size="sm" onClick={() => executeMutation.mutate()}
                disabled={executeMutation.isPending || preview.totalRows === 0}>
                {executeMutation.isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />导入中...</> : '确认导入'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Result */}
        {step === 2 && (
          <div className="space-y-4">
            {executeMutation.isPending && progress && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>处理进度</span>
                  <span>{progress.processed} / {progress.totalRows}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${progress.totalRows ? (progress.processed / progress.totalRows) * 100 : 0}%` }} />
                </div>
              </div>
            )}

            {result && (
              <>
                <div className="grid grid-cols-4 gap-3 text-center">
                  {[
                    { label: '总计', value: result.totalRows },
                    { label: '创建', value: result.created, color: 'text-green-600' },
                    { label: '更新', value: result.updated, color: 'text-blue-600' },
                    { label: '失败', value: result.failed, color: 'text-v2-danger' },
                  ].map((s, i) => (
                    <div key={i} className="p-3 border rounded">
                      <div className={`text-2xl font-bold ${s.color ?? ''}`}>{s.value}</div>
                      <div className="text-xs text-v2-muted">{s.label}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-v2-muted">耗时: {(result.durationMs / 1000).toFixed(1)}s</p>

                {result.failed > 0 && format === 'csv' && (
                  <Button size="sm" variant="outline" onClick={downloadFailedRows}>
                    <Download className="h-4 w-4 mr-1" />下载失败行
                  </Button>
                )}
              </>
            )}

            <div className="flex justify-end">
              <Button size="sm" onClick={() => handleClose(false)}>完成</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
