'use client'

import { Suspense, use, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/api-error'
import { toast } from '@/design-system/figma-neutral/toast'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  Field,
  FormSettingsPage,
  Input,
  LoadingState,
  PageHeader,
} from '@/design-system/figma-neutral/components'

const BpmnEditor = dynamic(() => import('@/components/workflow/BpmnEditor'), {
  ssr: false,
  loading: () => <LoadingState label="加载编辑器" />,
})

interface DefDetail {
  id: string
  name: string
  key: string
  category: string
  description: string
  version: number
  xml: string
}

function EditForm({ processKey, versionId }: { processKey: string; versionId?: string | null }) {
  const decodedKey = decodeURIComponent(processKey)
  const router = useRouter()
  const [detail, setDetail] = useState<DefDetail | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [xml, setXml] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // If editing from a specific version, load that version directly
    if (versionId) {
      api.get(`/workflow/definitions/${encodeURIComponent(versionId)}`).then((r) => {
        const d: DefDetail = r.data.data
        setDetail(d)
        setName(d.name)
        setCategory(d.category || '')
        setDescription(d.description || '')
        setXml(d.xml)
        setLoading(false)
      }).catch(() => {
        toast.error('获取流程定义失败')
        router.push('/workflow/admin')
      })
      return
    }
    // Otherwise find the latest version by key
    api.get('/workflow/definitions', { params: { page: 1, size: 100 } }).then((r) => {
      const defs: DefDetail[] = r.data.data?.records ?? []
      const match = defs.find((d: { key: string; name?: string }) => d.key === decodedKey)
      if (match) {
        return api.get(`/workflow/definitions/${encodeURIComponent(match.id)}`)
      }
      throw new Error('not found')
    }).then((r) => {
      const d: DefDetail = r.data.data
      setDetail(d)
      setName(d.name)
      setCategory(d.category || '')
      setDescription(d.description || '')
      setXml(d.xml)
      setLoading(false)
    }).catch(() => {
      toast.error('获取流程定义失败')
      router.push('/workflow/admin')
    })
  }, [decodedKey, router, versionId])

  const handleSave = async () => {
    if (!name) {
      toast.error('请填写流程名称')
      return
    }
    if (!xml) {
      toast.error('流程画布不能为空')
      return
    }
    if (!detail) return
    setSaving(true)
    try {
      // Inject the correct key into the BPMN XML — editor template always uses id="Process_1"
      const finalXml = xml.replace(/<bpmn:process id="[^"]*"/, `<bpmn:process id="${detail.key}"`)
      await api.put(`/workflow/definitions/key/${detail.key}/update`, {
        name,
        key: detail.key,
        category,
        description,
        xml: finalXml,
      })
      toast.success(`流程定义已更新 (v${(detail.version ?? 0) + 1})`)
      router.push('/workflow/admin')
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '更新失败'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingState label="加载流程定义" />
  }

  return (
    <FormSettingsPage
      header={
        <PageHeader
          eyebrow="流程中心"
          title={`编辑流程: ${name}`}
          subtitle={`当前版本: v${detail?.version} | 修改后将创建新版本`}
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/workflow/design', label: '流程中心' },
                { href: '/workflow/admin', label: '流程配置' },
                { label: name || decodedKey },
              ]}
            />
          }
          actions={
            <div className="cwgsyw-designer__actions">
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                取消
              </Button>
              <Button type="button" loading={saving} disabled={saving} onClick={handleSave}>
                {saving ? '部署中...' : '保存新版本'}
              </Button>
            </div>
          }
        />
      }
      form={
        <div className="cwgsyw-form">
          <div className="cwgsyw-filter-grid">
            <Field label="流程名称" htmlFor="flowName" required>
              <Input id="flowName" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="流程 Key" htmlFor="flowKey" helperText="Key 不可修改">
              <Input id="flowKey" value={detail?.key} disabled />
            </Field>
            <Field label="分类" htmlFor="category">
              <Input id="category" value={category} onChange={(event) => setCategory(event.target.value)} />
            </Field>
            <Field label="描述" htmlFor="desc">
              <Input id="desc" value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>
          </div>
          <div className="cwgsyw-designer__canvas cwgsyw-designer__pane">
            <BpmnEditor initialXml={xml} onChange={setXml} />
          </div>
        </div>
      }
    />
  )
}

export default function EditWorkflowDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <Suspense fallback={<LoadingState label="加载流程定义" />}>
      <EditPageInner id={id} />
    </Suspense>
  )
}

function EditPageInner({ id }: { id: string }) {
  const searchParams = useSearchParams()
  const versionId = searchParams.get('version')
  return <EditForm key={id} processKey={id} versionId={versionId} />
}
