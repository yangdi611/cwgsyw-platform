'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Server, Plus, X } from 'lucide-react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'

interface AssociationDef {
  defId: string
  name: string
  srcModelId: string
  dstModelId: string
}
interface RelationVO {
  id: number
  defId: string
  srcInstanceId: number
  srcInstanceName?: string
  dstInstanceId: number
  metadata?: Record<string, unknown> | null
}
interface RackOption {
  id: number
  name: string
}

/**
 * 设备详情页「所在机柜」卡片（spec §5.5 P2）。当前设备作为 dst，
 * 通过 reverse-defs 找到 rack_contains_* 这类 def（src=rack），选机柜后调反向建边接口。
 * 仅当该模型存在 src 为机柜的反向 def 时显示。
 */
export function RackAssignmentCard({ instanceId }: { instanceId: string }) {
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const canWrite = hasPermission('cmdb_relation', 'create')
  const [open, setOpen] = useState(false)
  const [defId, setDefId] = useState('')
  const [rackId, setRackId] = useState('')
  const [uStart, setUStart] = useState('')
  const [uEnd, setUEnd] = useState('')
  const [rackKeyword, setRackKeyword] = useState('')

  // 反向 def：当前实例作为 dst 的关联定义，过滤出 src 是机柜（rack）的
  const { data: reverseDefs } = useQuery<AssociationDef[]>({
    queryKey: ['cmdb-reverse-defs', instanceId],
    queryFn: () => api.get(`/cmdb/instances/${instanceId}/relations/reverse-defs`).then((r: any) => r.data.data),
  })
  const rackDefs = (reverseDefs ?? []).filter((d) => d.srcModelId === 'rack')

  // 当前已建立的反向关联（用于展示"所在机柜"）
  const { data: relations } = useQuery<RelationVO[]>({
    queryKey: ['cmdb-relations', instanceId],
    queryFn: () => api.get(`/cmdb/instances/${instanceId}/relations`).then((r: any) => r.data.data),
  })
  const rackDefIds = new Set(rackDefs.map((d) => d.defId))
  const rackMemberships = (relations ?? []).filter(
    (rel) => rackDefIds.has(rel.defId) && String(rel.dstInstanceId) === String(instanceId),
  )

  // 机柜候选列表
  const { data: rackList } = useQuery<RackOption[]>({
    queryKey: ['cmdb-rack-options', rackKeyword],
    queryFn: () =>
      api
        .get(`/cmdb/instances`, { params: { model: 'rack', keyword: rackKeyword, page: 1, size: 20 } })
        .then((r: any) => (r.data.data?.records ?? r.data.data?.list ?? r.data.data ?? []) as RackOption[]),
    enabled: open,
  })

  const assignMutation = useMutation({
    mutationFn: async () => {
      // 建反向关联（rack→device）。
      await api.post(`/cmdb/instances/${instanceId}/relations/reverse`, {
        defId,
        srcInstanceId: Number(rackId),
      })
      // U 位是设备属性（决策6），写进设备 attrs —— 机柜视图读的正是 attrs.u_start/u_end。
      const fieldsData: Record<string, unknown> = {}
      if (uStart.trim()) fieldsData.u_start = uStart.trim()
      if (uEnd.trim()) fieldsData.u_end = uEnd.trim()
      if (Object.keys(fieldsData).length > 0) {
        await api.put(`/cmdb/instances/${instanceId}`, { fieldsData })
      }
    },
    onSuccess: () => {
      toast.success('已装入机柜')
      queryClient.invalidateQueries({ queryKey: ['cmdb-relations', instanceId] })
      queryClient.invalidateQueries({ queryKey: ['cmdb-instance'] })
      queryClient.invalidateQueries({ queryKey: ['rack-layout'] })
      setOpen(false)
      setDefId(''); setRackId(''); setUStart(''); setUEnd('')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '装机失败'),
  })

  const removeMutation = useMutation({
    mutationFn: (relId: number) => api.delete(`/cmdb/instances/${instanceId}/relations/${relId}`),
    onSuccess: () => {
      toast.success('已移出机柜')
      queryClient.invalidateQueries({ queryKey: ['cmdb-relations', instanceId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '移除失败'),
  })

  // 模型不支持装入机柜则不渲染
  if (rackDefs.length === 0) return null

  return (
    <div className="rounded-xl border border-v2-border bg-v2-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-v2-border bg-v2-surface-soft">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-v2-muted">
          <Server className="h-3.5 w-3.5" />
          所在机柜
        </span>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={() => { setDefId(rackDefs[0]?.defId ?? ''); setOpen(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1" />装入机柜
          </Button>
        )}
      </div>
      <div className="px-4 py-3">
        {rackMemberships.length === 0 ? (
          <span className="text-sm text-v2-subtle">未装入任何机柜</span>
        ) : (
          <ul className="space-y-1.5">
            {rackMemberships.map((rel) => {
              return (
                <li key={rel.id} className="flex items-center justify-between text-sm">
                  <span className="text-v2-fg">
                    {rel.srcInstanceName ?? `机柜 #${rel.srcInstanceId}`}
                  </span>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(rel.id)}
                      className="text-v2-danger hover:opacity-70"
                      title="移出机柜"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>装入机柜</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {rackDefs.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs">关联类型</Label>
                <Select value={defId} onValueChange={(v) => setDefId(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择关联类型">
                      {(v: string) => rackDefs.find((d) => d.defId === v)?.name ?? '选择关联类型'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {rackDefs.map((d) => <SelectItem key={d.defId} value={d.defId}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">机柜</Label>
              <Input
                placeholder="搜索机柜名称…"
                value={rackKeyword}
                onChange={(e) => setRackKeyword(e.target.value)}
              />
              <Select value={rackId} onValueChange={(v) => setRackId(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="选择机柜">
                    {(v: string) => (rackList ?? []).find((r) => String(r.id) === v)?.name ?? '选择机柜'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(rackList ?? []).map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">起始 U 位</Label>
                <Input type="number" value={uStart} onChange={(e) => setUStart(e.target.value)} placeholder="如 1" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">结束 U 位</Label>
                <Input type="number" value={uEnd} onChange={(e) => setUEnd(e.target.value)} placeholder="如 2" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
              <Button
                onClick={() => assignMutation.mutate()}
                disabled={!defId || !rackId || assignMutation.isPending}
              >
                确认装入
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
