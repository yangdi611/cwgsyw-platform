'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePermission } from '@/hooks/usePermission'
import { ModelCatalogTab } from './components/ModelCatalogTab'
import { AssociationsTab } from './components/AssociationsTab'
import { AttributeGroupsTab } from './components/AttributeGroupsTab'
import '@/design-system/figma-neutral/index.css'
import {
  Breadcrumb,
  DataManagementPage,
  PageHeader,
  Tabs,
} from '@/design-system/figma-neutral/components'

export default function AdminPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [tab, setTab] = useState<'catalog' | 'attribute-groups' | 'associations'>('catalog')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_model', 'read')) router.replace('/cmdb')
  }, [isHydrated, hasPermission, router])

  return (
    <DataManagementPage
      header={
        <PageHeader
          eyebrow="CMDB"
          title="模型管理"
          subtitle="管理 CI 模型、属性、关联定义与分类配置。"
          breadcrumb={
            <Breadcrumb
              items={[
                { href: '/', label: '工作台' },
                { href: '/cmdb', label: 'CMDB' },
                { label: '模型管理' },
              ]}
            />
          }
        />
      }
      content={
        <Tabs
          value={tab}
          onChange={(id) => setTab(id as typeof tab)}
          items={[
            { id: 'catalog', label: '模型目录', panel: <ModelCatalogTab /> },
            { id: 'attribute-groups', label: '属性分组', panel: <AttributeGroupsTab /> },
            { id: 'associations', label: '关联定义', panel: <AssociationsTab /> },
          ]}
        />
      }
    />
  )
}
