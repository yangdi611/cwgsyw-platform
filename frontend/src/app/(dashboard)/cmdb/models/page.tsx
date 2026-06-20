'use client'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Search, ChevronLeft, ChevronRight, Grid3x3, Boxes, Settings } from 'lucide-react'

// AC10 (Issue #64): 本页为纯浏览目录（只读）。模型/属性的管理操作统一走 /cmdb/admin。
interface CiModelVO {
  id: number; name: string; displayName: string; group: string; groupName: string
  isBuiltIn: boolean; instanceCount: number; attributes: any[]; createdAt: string; updatedAt: string
}

const MODEL_GROUPS = [
  { code: 'infra', name: '基础设施' },
  { code: 'biz', name: '业务应用' },
  { code: 'network', name: '网络设备' },
  { code: 'security', name: '安全设备' },
  { code: 'cloud', name: '云资源' },
]

export default function CmdbModelsPage() {
  const router = useRouter()
  const { hasPermission } = usePermission()

  const [groupFilter, setGroupFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const size = 20

  useEffect(() => {
    if (!hasPermission('cmdb_model', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data, isLoading } = useQuery({
    queryKey: ['cmdb-models', search, groupFilter, page],
    queryFn: () => api.get('/cmdb/models', {
      params: { keyword: search || undefined, group: groupFilter || undefined, page, size },
    }).then(r => r.data.data),
    enabled: hasPermission('cmdb_model', 'read'),
  })

  const models = (data?.records ?? []) as CiModelVO[]
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / size)

  return (
    <div className="flex gap-6">
      {/* Left: group filter */}
      <div className="w-44 shrink-0">
        <h3 className="text-sm font-medium mb-2 text-muted-foreground">模型分组</h3>
        <div className="space-y-1">
          <button
            onClick={() => { setGroupFilter(''); setPage(1) }}
            className={cn('block w-full text-left px-3 py-1.5 rounded text-sm transition-colors',
              !groupFilter ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
          >全部</button>
          {MODEL_GROUPS.map(g => (
            <button
              key={g.code}
              onClick={() => { setGroupFilter(g.code); setPage(1) }}
              className={cn('block w-full text-left px-3 py-1.5 rounded text-sm transition-colors',
                groupFilter === g.code ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            >{g.name}</button>
          ))}
        </div>
      </div>

      {/* Right: model table */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">CMDB 模型</h1>
          <div className="flex gap-2">
            <Link href="/cmdb/instances/2d-view" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <Grid3x3 className="h-4 w-4 mr-1" />2D 视图
            </Link>
            {/* 管理入口（浏览页只读，CRUD 走 /cmdb/admin） */}
            <PermissionGuard resource="cmdb_model" action="update">
              <Link href="/cmdb/admin" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <Settings className="h-4 w-4 mr-1" />配置管理
              </Link>
            </PermissionGuard>
          </div>
        </div>

        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="搜索模型名称..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">加载中...</p>
        ) : models.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">暂无模型数据</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标识</TableHead>
                  <TableHead>显示名</TableHead>
                  <TableHead>分组</TableHead>
                  <TableHead>内置</TableHead>
                  <TableHead>实例数</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link href={`/cmdb/instances/by-model/${m.name}`} className="font-medium hover:underline">{m.name}</Link>
                    </TableCell>
                    <TableCell>{m.displayName}</TableCell>
                    <TableCell><Badge variant="outline">{m.groupName}</Badge></TableCell>
                    <TableCell>{m.isBuiltIn && <Badge variant="secondary">内置</Badge>}</TableCell>
                    <TableCell>{m.instanceCount}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/cmdb/instances/by-model/${m.name}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                        <Boxes className="h-3.5 w-3.5" />查看实例
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">共 {total} 条</span>
              <div className="flex gap-2 items-center">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">{page} / {totalPages || 1}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
