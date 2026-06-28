'use client'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import api from '@/lib/api'
import { toast } from 'sonner'

interface Props {
  taskId: string
  onDone: () => void
}

export function ApprovalActions({ taskId, onDone }: Props) {
  const [comment, setComment] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (approved: boolean) =>
      api.post('/workflow/approve', { taskId, approved, comment }),
    onSuccess: (_data, approved) => {
      toast.success(approved ? '已通过审批' : '已拒绝')
      queryClient.invalidateQueries({ queryKey: ['workflow-tasks'] })
      onDone()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '操作失败'),
  })

  return (
    <div className="space-y-3 mt-4 p-4 border rounded-lg bg-muted/50">
      <div className="space-y-1">
        <Label>审批意见（可选）</Label>
        <Textarea value={comment} onChange={e => setComment(e.target.value)}
          placeholder="填写审批意见..." rows={2} />
      </div>
      <div className="flex gap-2">
        <Button onClick={() => mutation.mutate(true)} disabled={mutation.isPending}
          className="flex-1">
          通过
        </Button>
        <Button variant="destructive" onClick={() => mutation.mutate(false)}
          disabled={mutation.isPending} className="flex-1">
          拒绝
        </Button>
      </div>
    </div>
  )
}
