'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/v2/Input'
import { Label } from '@/components/v2/Label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/v2/Checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/v2/Select'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared'
import Link from 'next/link'
import {
  Plus, Settings, Server, Database, Network, Box, ArrowRight,
  Trash2, PencilLine, RefreshCw, ChevronDown, MoreVertical, FolderInput, Check, Copy,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger,
  DropdownMenuSubContent, DropdownMenuLabel, DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { usePermission } from '@/hooks/usePermission'
import { ModelCard } from './components/ModelCard'
import { ModelCatalogTab } from './components/ModelCatalogTab'
import { AssociationDefsSection } from './components/AssociationDefsSection'
import { AssociationsTab } from './components/AssociationsTab'
import { AttributeGroupsTab } from './components/AttributeGroupsTab'
import type { CiModelVO, CiAttributeGroupVO } from './components/types'
import { getApiErrorMessage, getModelDisplayName, nextCopyModelId, GROUP_ICONS } from './components/utils'

const ICON_MAP = GROUP_ICONS

interface AssociationAttrVO {
  id: number
  associationKind: string
  fieldKey: string
  name: string
  fieldType: string
  isRequired: boolean
  enumOptions: string | null
  defaultValue: string | null
  sortOrder: number
}

const FIELD_TYPE_OPTIONS = [
  { value: 'singlechar', label: '单行文本' },
  { value: 'int', label: '整数' },
  { value: 'enum', label: '枚举' },
  { value: 'list', label: '列表' },
  { value: 'bool', label: '布尔' },
  { value: 'user', label: '用户' },
  { value: 'date', label: '日期' },
]

const FIELD_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  FIELD_TYPE_OPTIONS.map(o => [o.value, o.label])
)

const DEFAULT_KINDS_DEPRECATED: string[] = []   // legacy placeholder; kind list now comes from /api/cmdb/association-kinds

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

// ─────────────────────────────────────────────────────────────────────────
// Model Catalog Tab — unified view of model groups + models within
// ─────────────────────────────────────────────────────────────────────────

interface ModelGroupVO {
  id: number
  code: string
  name: string
  icon: string | null
  sortOrder: number
  isBuiltIn: boolean
  modelCount: number
}

