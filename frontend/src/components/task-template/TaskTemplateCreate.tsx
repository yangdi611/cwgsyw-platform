'use client'

import { useMutation } from '@tanstack/react-query'
import { WandSparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { DetailHeader, FormShell } from '@/components/shared'
import { Button, Card, Input, Label, Textarea } from '@/components/design-system'
import { createTaskTemplate } from '@/lib/task-template-api'
import { getApiErrorMessage } from '@/lib/api-error'

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
    <FormShell width="form">
      <DetailHeader
        backHref="/tasks/templates"
        eyebrow="任务模板"
        title="新建模板"
        subtitle="先定义模板身份，创建后进入三栏设计器配置字段、条件、公式和统计语义。"
      />
      <Card className="mx-auto max-w-3xl space-y-5 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>模板编码 *</Label>
            <Input value={code} onChange={(event) => setCode(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="database_daily_inspection" />
            <p className="text-xs text-v2-muted">发布后作为稳定标识，不随名称变化。</p>
          </div>
          <div className="space-y-1.5">
            <Label>模板名称 *</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="每日数据库巡检" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>分类</Label>
            <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="巡检 / 汇报 / 资料收集" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>描述</Label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="说明模板适用场景和执行目标" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="primary" disabled={!code || !name || create.isPending} onClick={() => create.mutate()}>
            <WandSparkles className="h-4 w-4" />创建并设计
          </Button>
        </div>
      </Card>
    </FormShell>
  )
}
