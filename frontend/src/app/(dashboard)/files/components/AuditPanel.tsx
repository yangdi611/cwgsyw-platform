'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, EmptyState, Pagination, StatusBadge, Table } from '@/design-system/figma-neutral/components'
import type { SharedFileAuditLog } from './types'

const AUDIT_PAGE_SIZE = 20

const AUDIT_ACTION_LABELS: Record<string, string> = {
  upload: '上传',
  delete: '删除文件',
  create_folder: '新建文件夹',
  delete_folder: '删除文件夹',
  acl_update: '修改权限',
}

const AUDIT_ACTION_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  upload: 'success',
  create_folder: 'success',
  delete: 'danger',
  delete_folder: 'danger',
  acl_update: 'warning',
}

export function AuditPanel() {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)

  const { data } = useQuery<{ records: SharedFileAuditLog[]; total: number }>({
    queryKey: ['shared-file-audit', page],
    queryFn: () =>
      api
        .get('/audit-logs', { params: { module: 'shared_file', page, size: AUDIT_PAGE_SIZE } })
        .then((response) => response.data.data),
    enabled: open,
  })

  const records = data?.records ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE))

  return (
    <section className="cwgsyw-devices-panel cwgsyw-files-audit">
      <header className="cwgsyw-devices-panel__head">
        <span>操作日志</span>
        <span className="cwgsyw-inline-controls">
          <Link href="/admin/audit?module=shared_file">查看全部</Link>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setOpen((current) => !current)
              setPage(1)
            }}
          >
            {open ? '收起' : '展开'}
          </Button>
        </span>
      </header>
      <div className="cwgsyw-devices-panel__body">
        {open ? (
          <>
            <Table
              showSearch={false}
              className="cwgsyw-cmdb-table"
              density="compact"
              columns={[
                { key: 'createdAt', label: '时间' },
                { key: 'action', label: '操作' },
                { key: 'target', label: '对象' },
                { key: 'operatorName', label: '操作人' },
                { key: 'remark', label: '备注' },
              ]}
              rows={records.map((record) => ({
                id: String(record.id),
                cells: {
                  createdAt: new Date(record.createdAt).toLocaleString('zh-CN'),
                  action: (
                    <StatusBadge
                      label={AUDIT_ACTION_LABELS[record.action] ?? record.action}
                      status={AUDIT_ACTION_TONE[record.action] ?? 'neutral'}
                    />
                  ),
                  target: `${record.targetType}${record.targetId ? ` #${record.targetId}` : ''}`,
                  operatorName: record.operatorName,
                  remark: record.remark,
                },
              }))}
              state={records.length === 0 ? 'empty' : 'data'}
              empty={<EmptyState showIcon={false} title="暂无操作记录" description="打开后会加载最近的共享文件审计。" />}
            />
            {total > AUDIT_PAGE_SIZE ? (
              <Pagination page={page} pageCount={pageCount} totalCount={total} onPageChange={setPage} />
            ) : null}
          </>
        ) : (
          <p className="cwgsyw-devices-panel__hint">展开后查看最近的上传、删除和权限变更。</p>
        )}
      </div>
    </section>
  )
}
