'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shared'
import { usePermission } from '@/hooks/usePermission'
import { ModelCatalogTab } from './components/ModelCatalogTab'
import { AssociationsTab } from './components/AssociationsTab'
import { AttributeGroupsTab } from './components/AttributeGroupsTab'

export default function AdminPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [tab, setTab] = useState<'catalog' | 'attribute-groups' | 'associations'>('catalog')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('cmdb_model', 'read')) router.replace('/cmdb')
  }, [isHydrated, hasPermission, router])

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader eyebrow="CMDB" title="模型管理" subtitle="管理 CI 模型、属性、关联定义与分类配置。" />

      {/* Tab switcher */}
      <div className="flex gap-1 border-b mb-6">
        <button
          onClick={() => setTab('catalog')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'catalog'
              ? 'border-v2-primary text-v2-primary'
              : 'border-transparent text-v2-muted hover:text-v2-fg'
          }`}
        >
          模型目录
        </button>
        <button
          onClick={() => setTab('attribute-groups')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'attribute-groups'
              ? 'border-v2-primary text-v2-primary'
              : 'border-transparent text-v2-muted hover:text-v2-fg'
          }`}
        >
          属性分组
        </button>
        <button
          onClick={() => setTab('associations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'associations'
              ? 'border-v2-primary text-v2-primary'
              : 'border-transparent text-v2-muted hover:text-v2-fg'
          }`}
        >
          关联定义
        </button>
      </div>

      {tab === 'catalog' && <ModelCatalogTab />}
      {tab === 'attribute-groups' && <AttributeGroupsTab />}
      {tab === 'associations' && <AssociationsTab />}
    </div>
  )
}
