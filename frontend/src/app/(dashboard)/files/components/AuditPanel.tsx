'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Card, StatusBadge } from '@/components/design-system'
import { ScrollText, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SharedFileAuditLog } from './types'

const AUDIT_ACTION_LABELS: Record<string, string> = {
  upload: '上传',
  delete: '删除文件',
  create_folder: '新建文件夹',
  delete_folder: '删除文件夹',
  acl_update: '修改权限',
}
const AUDIT_ACTION_VARIANT: Record<string, 'ok' | 'warn' | 'danger' | 'neutral'> = {
  upload: 'ok',
  create_folder: 'ok',
  delete: 'danger',
  delete_folder: 'danger',
  acl_update: 'warn',
}

export function AuditPanel() {
  const [open, setOpen] = useState(false)

  const { data } = useQuery<{ data: { records: SharedFileAuditLog[] } }>({
    queryKey: ['shared-file-audit'],
    queryFn: () =>
      api.get('/audit-logs', { params: { module: 'shared_file', page: 1, size: 10 } }).then((r) => r.data),
    enabled: open,
  })

  const records = data?.data?.records ?? []

  return (
    <Card className="p-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-v2-fg">
          <ScrollText className="h-4 w-4 text-v2-muted" />
          操作日志
        </span>
        <span className="flex items-center gap-3">
          <Link
            href="/admin/audit?module=shared_file"
            className="text-xs text-v2-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            查看全部 →
          </Link>
          <ChevronRight className={cn('h-4 w-4 text-v2-muted transition-transform', open && 'rotate-90')} />
        </span>
      </button>
      {open && (
        <div className="border-t border-v2-border px-4 py-2">
          {records.length === 0 ? (
            <p className="py-4 text-center text-xs text-v2-muted">暂无操作记录</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-v2-muted">
                  <th className="py-1.5 text-left font-medium">时间</th>
                  <th className="py-1.5 text-left font-medium">操作</th>
                  <th className="py-1.5 text-left font-medium">对象</th>
                  <th className="py-1.5 text-left font-medium">操作人</th>
                  <th className="py-1.5 text-left font-medium">备注</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t border-v2-border/50">
                    <td className="whitespace-nowrap py-1.5 text-v2-muted">
                      {new Date(r.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="py-1.5">
                      <StatusBadge status={AUDIT_ACTION_VARIANT[r.action] ?? 'neutral'}>
                        {AUDIT_ACTION_LABELS[r.action] ?? r.action}
                      </StatusBadge>
                    </td>
                    <td className="py-1.5 text-v2-muted">
                      {r.targetType}
                      {r.targetId ? ` #${r.targetId}` : ''}
                    </td>
                    <td className="py-1.5 text-v2-fg">{r.operatorName}</td>
                    <td className="max-w-[200px] truncate py-1.5 text-v2-muted">{r.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Card>
  )
}
