'use client'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { usePermission } from '@/hooks/usePermission'

interface ChangeDocListItem {
  id: number
  changeNo: string
  templateName: string
  status: string
  applicantName: string
  createdAt: string
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft:    { label: '草稿',   variant: 'secondary' },
  pending:  { label: '待审批', variant: 'default' },
  approved: { label: '已通过', variant: 'outline' },
  rejected: { label: '已拒绝', variant: 'destructive' },
}

export default function ChangeDocsPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('change_doc', 'read')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: docs = [], isLoading } = useQuery<ChangeDocListItem[]>({
    queryKey: ['change-docs'],
    queryFn: () => api.get('/change-docs').then(r => r.data.data),
    enabled: hasPermission('change_doc', 'read'),
  })

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">变更文档</h1>
          <p className="text-sm text-muted-foreground mt-1">管理 IT 变更申请单和变更方案</p>
        </div>
        {hasPermission('change_doc', 'create') && (
          <Link href="/change-docs/new" className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">新建变更</Link>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">加载中...</p>
      ) : docs.length === 0 ? (
        <p className="text-muted-foreground text-sm">暂无变更文档</p>
      ) : (
        <div className="border rounded-lg divide-y">
          {docs.map(doc => {
            const st = STATUS_MAP[doc.status] ?? { label: doc.status, variant: 'secondary' as const }
            return (
              <div key={doc.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Badge variant={st.variant}>{st.label}</Badge>
                  <div>
                    <Link href={`/change-docs/${doc.id}`} className="font-medium hover:underline">
                      {doc.changeNo}{doc.templateName ? ` — ${doc.templateName}` : ''}
                    </Link>
                    <p className="text-xs text-muted-foreground">{doc.applicantName} · {new Date(doc.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</p>
                  </div>
                </div>
                <Link href={`/change-docs/${doc.id}`} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-muted">查看</Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
