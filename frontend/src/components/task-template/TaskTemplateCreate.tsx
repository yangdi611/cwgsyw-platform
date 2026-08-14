'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from '@/design-system/figma-neutral/toast'
import { createTaskTemplate } from '@/lib/task-template-api'
import { getApiErrorMessage } from '@/lib/api-error'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  Card,
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
      header={
        <PageHeader
          eyebrow="统一任务平台"
          title="新建模板"
          subtitle="先定义模板身份，创建后进入三栏设计器配置字段、条件、公式和统计语义。"
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/tasks', label: '我的任务' },
                { href: '/tasks/templates', label: '任务模板' },
                { label: '新建模板' },
              ]}
            />
          }
          actions={
            <Button type="button" variant="primary" disabled={!code || !name || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? '创建中' : '创建并设计'}
            </Button>
          }
        />
      }
      form={
        <Card title="模板身份" description="发布后编码作为稳定标识，不随名称变化。">
          <div className="cwgsyw-form">
            <div className="cwgsyw-permission-grid">
              <Field label="模板编码" required helperText="只允许小写字母、数字和下划线。">
                <Input
                  value={code}
                  placeholder="database_daily_inspection"
                  onChange={(event) => setCode(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                />
              </Field>
              <Field label="模板名称" required>
                <Input value={name} placeholder="每日数据库巡检" onChange={(event) => setName(event.target.value)} />
              </Field>
            </div>
            <Field label="分类">
              <Input value={category} placeholder="巡检 / 汇报 / 资料收集" onChange={(event) => setCategory(event.target.value)} />
            </Field>
            <Field label="描述">
              <Textarea value={description} rows={4} placeholder="说明模板适用场景和执行目标" onChange={(event) => setDescription(event.target.value)} />
            </Field>
            <div className="cwgsyw-form__actions">
              <Button type="button" variant="secondary" onClick={() => router.push('/tasks/templates')}>取消</Button>
              <Button type="button" variant="primary" disabled={!code || !name || create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? '创建中' : '创建并设计'}
              </Button>
            </div>
          </div>
        </Card>
      }
    />
  )
}
