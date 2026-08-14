'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { getApiErrorMessage } from '@/lib/api-error'
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
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  Button,
  DetailDrawerPage,
  EmptyState,
  PageHeader,
} from '@/design-system/figma-neutral/components'

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
    <>
      <DetailDrawerPage
        header={
          <PageHeader
            eyebrow="CMDB"
            title={model?.displayName ?? modelCode}
            subtitle={modelCode}
            breadcrumb={
              <Breadcrumb
                items={[
                  { href: '/', label: '工作台' },
                  { href: '/cmdb', label: 'CMDB' },
                  { href: '/cmdb/admin', label: '模型管理' },
                  { label: model?.displayName ?? modelCode },
                ]}
              />
            }
            actions={
              canCreateAttributes ? (
                <Button type="button" onClick={() => setAddDialogOpen(true)}>
                  新建属性
                </Button>
              ) : undefined
            }
          />
        }
        content={
          !canReadAttributes ? (
            <EmptyState title="无权查看模型属性" description="当前账号没有 cmdb_attribute:read 权限。" />
          ) : attributes.length === 0 ? (
            <EmptyState title="该模型暂无属性" description="点击右上角「新建属性」开始配置。" />
          ) : (
            <AttributeList
              attributes={attributes}
              canUpdate={canUpdateAttributes}
              canDelete={canDeleteAttributes}
              onEdit={setEditingAttr}
              onDelete={(attr) => deleteAttrMutation.mutate(attr.id)}
            />
          )
        }
      />

      {addDialogOpen ? (
        <AddAttributeDialog
          open
          groups={groups}
          isPending={createAttrMutation.isPending}
          onClose={() => setAddDialogOpen(false)}
          onCreate={(data) => createAttrMutation.mutate(data)}
        />
      ) : null}

      {editingAttr ? (
        <EditAttributeDialog
          key={editingAttr.id}
          attr={editingAttr}
          isPending={updateAttrMutation.isPending}
          onClose={() => setEditingAttr(null)}
          onUpdate={(data) => updateAttrMutation.mutate(data)}
        />
      ) : null}
    </>
  )
}
