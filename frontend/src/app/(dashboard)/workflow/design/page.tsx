'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/api-error'
import { toast } from '@/design-system/figma-neutral/toast'
import '@/design-system/figma-neutral/index.css'
import {
  Alert,
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

export default function NewWorkflowDesignPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [xml, setXml] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name || !key) {
      toast.error('请填写流程名称和 Key')
      return
    }
    if (!xml) {
      toast.error('请设计流程画布内容')
      return
    }
    // Replace the process id in the XML with the user's key — Flowable
    // derives the definition key from <process id="...">, not from the API field.
    const finalXml = xml.replace(/<bpmn:process id="[^"]*"/, `<bpmn:process id="${key}"`)
    setSaving(true)
    try {
      await api.post('/workflow/definitions', { name, key, category, description, xml: finalXml })
      toast.success('流程定义已保存')
      router.push('/workflow/admin')
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormSettingsPage
      className="cwgsyw-workflow cwgsyw-workflow-design"
      header={
        <PageHeader
          showEyebrow={false}
          showBreadcrumb={false}
          title="设计新流程"
          subtitle="拖拽左侧元素到画布中设计流程，选中节点后在右侧属性面板配置审批人和条件。"
          actions={
            <div className="cwgsyw-workflow__header-actions cwgsyw-designer__actions">
              <Button type="button" variant="secondary" size="sm" onClick={() => router.back()}>
                取消
              </Button>
              <Button type="button" size="sm" loading={saving} disabled={saving} onClick={handleSave}>
                {saving ? '部署中...' : '保存并部署'}
              </Button>
            </div>
          }
        />
      }
      form={
        <div className="cwgsyw-form">
          <div className="cwgsyw-workflow-design__fields">
            <Field label="流程名称" htmlFor="flowName" required>
              <Input
                id="flowName"
                size="sm"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="如: 变更审批流"
              />
            </Field>
            <Field label="流程 Key" htmlFor="flowKey" required>
              <Input
                id="flowKey"
                size="sm"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="如: changeDocApproval"
              />
            </Field>
            <Field label="分类" htmlFor="category">
              <Input
                id="category"
                size="sm"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="审批流程"
              />
            </Field>
            <Field label="描述" htmlFor="desc">
              <Input
                id="desc"
                size="sm"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="流程用途说明"
              />
            </Field>
          </div>
          <Alert
            tone="info"
            title="配置指南：让审批人出现"
            showDismiss={false}
            description="点击箭头线而不是 Gateway 菱形，右侧会出现 Condition。上面箭头填通过条件，下面箭头填拒绝条件。选中 User Task 后，在 Flowable Assignment 面板配置审批人。Condition 在连接线上，不在网关上。多级审批等于多个 User Task 加多个网关串联。"
          />
          <div className="cwgsyw-designer__canvas cwgsyw-designer__pane">
            <BpmnEditor onChange={setXml} />
          </div>
        </div>
      }
    />
  )
}
