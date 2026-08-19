'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from '@/design-system/figma-neutral/toast'
import { createTaskTemplate } from '@/lib/task-template-api'
import { getApiErrorMessage } from '@/lib/api-error'
import { TaskPanel } from '@/components/task-runtime/TaskEmpty'
import '@/design-system/figma-neutral/index.css'
import '@/components/task-runtime/tasks.css'
import {
  Button,
  Field,
  FormSettingsPage,
  Input,
  PageHeader,
  Textarea,
} from '@/design-system/figma-neutral/components'

export function TaskTemplateCreate() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const create = useMutation({
    mutationFn: () => createTaskTemplate({
      code,
      name,
      category: category || undefined,
      description: description || undefined,
      layout: { sections: [{ key: 'main', title: '任务内容', columns: 1 }] },
      fields: [],
    }),
    onSuccess: (template) => {
      toast.success('模板草稿已创建')
      const version = template.versions.find((item) => item.status === 'draft')
      router.push(version
        ? `/tasks/templates/${template.id}/versions/${version.id}`
        : `/tasks/templates/${template.id}`)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, '创建模板失败')),
  })

  return (
    <FormSettingsPage
      embedded
      className="cwgsyw-tasks-page cwgsyw-tasks-page--create"
      header={
        <PageHeader
          showEyebrow={false}
          showBreadcrumb={false}
          title="新建模板"
          subtitle="先定义模板身份，创建后进入三栏设计器配置字段、条件、公式和统计语义。"
          actions={
            <Button type="button" size="sm" variant="primary" disabled={!code || !name || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? '创建中' : '创建并设计'}
            </Button>
          }
        />
      }
      form={
        <TaskPanel title="模板身份" description="发布后编码作为稳定标识，不随名称变化。">
          <div className="cwgsyw-form cwgsyw-tasks-create-form">
            <div className="cwgsyw-tasks-create-grid">
              <Field label="模板编码" required helperText="只允许小写字母、数字和下划线。">
                <Input
                  size="sm"
                  value={code}
                  placeholder="database_daily_inspection"
                  onChange={(event) => setCode(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                />
              </Field>
              <Field label="模板名称" required>
                <Input size="sm" value={name} placeholder="每日数据库巡检" onChange={(event) => setName(event.target.value)} />
              </Field>
              <div className="cwgsyw-tasks-create-grid__wide">
                <Field label="分类">
                  <Input size="sm" value={category} placeholder="巡检 / 汇报 / 资料收集" onChange={(event) => setCategory(event.target.value)} />
                </Field>
              </div>
              <div className="cwgsyw-tasks-create-grid__wide">
                <Field label="描述">
                  <Textarea size="sm" value={description} rows={4} placeholder="说明模板适用场景和执行目标" onChange={(event) => setDescription(event.target.value)} />
                </Field>
              </div>
            </div>
            <div className="cwgsyw-form__actions cwgsyw-tasks-create-actions">
              <Button type="button" size="sm" variant="secondary" onClick={() => router.push('/tasks/templates')}>取消</Button>
              <Button type="button" size="sm" variant="primary" disabled={!code || !name || create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? '创建中' : '创建并设计'}
              </Button>
            </div>
          </div>
        </TaskPanel>
      }
    />
  )
}
