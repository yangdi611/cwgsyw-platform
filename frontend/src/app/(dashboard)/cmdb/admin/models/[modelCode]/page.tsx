'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, Card, CardContent } from '@/components/design-system'
import { toast } from 'sonner'
import Link from 'next/link'
import { getApiErrorMessage } from '@/lib/api-error'
import { ArrowLeft, Plus } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { AttributeList } from './components/AttributeList'
import { AddAttributeDialog } from './components/AddAttributeDialog'
import { EditAttributeDialog } from './components/EditAttributeDialog'
import type { CiAttributeResponse } from '@/types/cmdb-model'
import type {
  AttributeAdminItem,
  AttributeAdminModel,
  AttributeGroupAdminItem,
  CreateAttributePayload,
  UpdateAttributePayload,
} from './components/types'
import { toAttributeAdminItem } from './components/types'

export default function ModelDetailPage() {
  const { modelCode } = useParams<{ modelCode: string }>()
  const { hasPermission } = usePermission()
  const queryClient = useQueryClient()
  const canReadAttributes = hasPermission('cmdb_attribute', 'read')
  const canCreateAttributes = hasPermission('cmdb_attribute', 'create')
  const canUpdateAttributes = hasPermission('cmdb_attribute', 'update')
  const canDeleteAttributes = hasPermission('cmdb_attribute', 'delete')

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingAttr, setEditingAttr] = useState<AttributeAdminItem | null>(null)

  const { data: model } = useQuery<AttributeAdminModel>({
    queryKey: ['cmdb-model', modelCode],
    queryFn: () => api.get(`/cmdb/models/${modelCode}`).then((r) => r.data.data),
  })

  const { data: attributes = [] } = useQuery<AttributeAdminItem[]>({
    queryKey: ['cmdb-model-attrs', modelCode],
    enabled: canReadAttributes,
    queryFn: () =>
      api
        .get(`/cmdb/models/${modelCode}/attributes`)
        .then((r) => (r.data.data as CiAttributeResponse[]).map(toAttributeAdminItem)),
  })

  const { data: groups = [] } = useQuery<AttributeGroupAdminItem[]>({
    queryKey: ['cmdb-model-groups', modelCode],
    enabled: canCreateAttributes,
    queryFn: () => api.get(`/cmdb/models/${modelCode}/attribute-groups`).then((r) => r.data.data),
  })

  const createAttrMutation = useMutation({
    mutationFn: (payload: CreateAttributePayload) =>
      api.post(`/cmdb/models/${modelCode}/attributes`, payload),
    onSuccess: () => {
      toast.success('属性已创建')
      setAddDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-attrs', modelCode] })
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })

  const updateAttrMutation = useMutation({
    mutationFn: (payload: UpdateAttributePayload) => {
      if (!editingAttr) return Promise.reject()
      return api.put(`/cmdb/models/${modelCode}/attributes/${editingAttr.id}`, payload)
    },
    onSuccess: () => {
      toast.success('属性已更新')
      setEditingAttr(null)
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-attrs', modelCode] })
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })

  const deleteAttrMutation = useMutation({
    mutationFn: (attrId: number) => api.delete(`/cmdb/models/${modelCode}/attributes/${attrId}`),
    onSuccess: () => {
      toast.success('属性已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-model-attrs', modelCode] })
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/cmdb/admin"
            className="inline-flex h-9 items-center gap-1.5 rounded-v2-md px-3 text-sm font-semibold text-v2-muted transition-colors hover:bg-v2-surface-hover hover:text-v2-fg"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
          <div>
            <h1 className="text-xl font-bold text-v2-fg">{model?.displayName ?? modelCode}</h1>
            <p className="mt-0.5 font-v2-mono text-xs text-v2-muted">{modelCode}</p>
          </div>
        </div>
        {canCreateAttributes && (
          <Button variant="primary" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            新建属性
          </Button>
        )}
      </div>

      {/* Attributes List */}
      <Card>
        <CardContent className="p-6">
          {!canReadAttributes ? (
            <p className="py-8 text-center text-sm text-v2-muted">无权查看模型属性。</p>
          ) : attributes.length === 0 ? (
            <p className="py-8 text-center text-sm text-v2-muted">
              该模型暂无属性。点击右上角「新建属性」开始配置。
            </p>
          ) : (
            <AttributeList
              attributes={attributes}
              canUpdate={canUpdateAttributes}
              canDelete={canDeleteAttributes}
              onEdit={setEditingAttr}
              onDelete={(attr) => deleteAttrMutation.mutate(attr.id)}
            />
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      {addDialogOpen && (
        <AddAttributeDialog
          open
          groups={groups}
          isPending={createAttrMutation.isPending}
          onClose={() => setAddDialogOpen(false)}
          onCreate={(data) => createAttrMutation.mutate(data)}
        />
      )}

      {/* Edit Dialog */}
      {editingAttr && (
        <EditAttributeDialog
          key={editingAttr.id}
          attr={editingAttr}
          isPending={updateAttrMutation.isPending}
          onClose={() => setEditingAttr(null)}
          onUpdate={(data) => updateAttrMutation.mutate(data)}
        />
      )}
    </div>
  )
}
