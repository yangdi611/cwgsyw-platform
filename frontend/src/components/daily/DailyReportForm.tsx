'use client'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface FormData {
  reportDate: string
  completedItems: string
  issues: string
  tomorrowPlan: string
  workHours: string
}

interface Props {
  defaultValues?: Partial<FormData>
  onSubmit: (data: FormData) => Promise<void>
  submitLabel?: string
}

export function DailyReportForm({ defaultValues, onSubmit, submitLabel = '保存草稿' }: Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      reportDate: new Date().toISOString().split('T')[0],
      ...defaultValues,
    },
  })

  const handleFormSubmit = async (data: FormData) => {
    try {
      await onSubmit(data)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      toast.error(err?.response?.data?.message ?? '操作失败')
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="reportDate">日报日期</Label>
        <Input id="reportDate" type="date" {...register('reportDate', { required: '请选择日期' })} />
        {errors.reportDate && <p className="text-sm text-destructive">{errors.reportDate.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="completedItems">今日完成事项 *</Label>
        <Textarea id="completedItems" rows={5} placeholder="请描述今日完成的工作内容..."
          {...register('completedItems', { required: '请填写今日完成事项' })} />
        {errors.completedItems && <p className="text-sm text-destructive">{errors.completedItems.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="issues">遇到的问题及处理结果</Label>
        <Textarea id="issues" rows={3} placeholder="如无问题可填写「无」..."
          {...register('issues')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tomorrowPlan">明日工作计划 *</Label>
        <Textarea id="tomorrowPlan" rows={4} placeholder="请描述明日计划..."
          {...register('tomorrowPlan', { required: '请填写明日计划' })} />
        {errors.tomorrowPlan && <p className="text-sm text-destructive">{errors.tomorrowPlan.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="workHours">工时（小时）</Label>
        <Input id="workHours" type="number" step="0.5" min="0" max="24"
          placeholder="8.0" {...register('workHours')} />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '保存中...' : submitLabel}
      </Button>
    </form>
  )
}
