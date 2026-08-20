'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePermission } from '@/hooks/usePermission'
import { ModelCatalogTab } from './components/ModelCatalogTab'
import { AssociationsTab } from './components/AssociationsTab'
import { AttributeGroupsTab } from './components/AttributeGroupsTab'
import '@/design-system/figma-neutral/index.css'
import {
  DataManagementPage,
  Icon,
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
      className="cwgsyw-cmdb-page cwgsyw-cmdb-admin"
      header={
        <header className="cwgsyw-cmdb-admin__header">
          <div className="cwgsyw-cmdb-overview__catalog-title">
            <h1>模型管理</h1>
            <span className="cwgsyw-cmdb-overview__catalog-note">
              <Icon name="chevron-next" size="sm" aria-hidden="true" />
              <span>管理模型、属性分组与关联定义。</span>
              <Icon name="chevron-previous" size="sm" aria-hidden="true" />
            </span>
          </div>
        </header>
      }
      content={
        <Tabs
          style="cmdb"
          size="sm"
          value={tab}
          onChange={(id) => setTab(id as typeof tab)}
          items={[
            { id: 'catalog', label: '模型目录', panel: <div className="cwgsyw-cmdb-admin__panel"><ModelCatalogTab /></div> },
            { id: 'attribute-groups', label: '属性分组', panel: <div className="cwgsyw-cmdb-admin__panel"><AttributeGroupsTab /></div> },
            { id: 'associations', label: '关联定义', panel: <div className="cwgsyw-cmdb-admin__panel"><AssociationsTab /></div> },
          ]}
        />
      }
    />
  )
}
