'use client'

import { AlertTriangle } from 'lucide-react'
import { StatusBadge } from '@/components/v2/StatusBadge'

export interface PermissionSource {
  roleId: number
  roleCode: string
  roleName: string
  assignmentId?: number
  scopeType?: string
  scopeId?: number
  scopeName?: string
  originType?: string
}

export interface PermissionDiff {
  userId: number
  username: string
  realName?: string
  permissionCode: string
  permissionName?: string
  legacyAllowed: boolean
  assignmentAllowed: boolean
  legacySources: PermissionSource[]
  assignmentSources: PermissionSource[]
}

function sourceLabel(source: PermissionSource, assignment: boolean) {
  const role = `${source.roleName || source.roleCode}（${source.roleCode} / 角色 #${source.roleId}）`
  if (!assignment) return role
  const scope = source.scopeName
    || (source.scopeType === 'group' ? `组 #${source.scopeId}` : source.scopeType)
  const assignmentId = source.assignmentId ? `assignment #${source.assignmentId}` : '新 assignment'
  return `${role} · ${scope || '未知作用域'} · ${assignmentId}`
}

function sourceIds(sources: PermissionSource[], assignment: boolean) {
  const values = sources.map((source) => assignment
    ? source.assignmentId && `#${source.assignmentId}`
    : source.roleId && `#${source.roleId}`).filter(Boolean)
  return values.length > 0 ? values.join('、') : '对应记录'
}

function ResolutionHint({ detail }: { detail: PermissionDiff }) {
  if (detail.assignmentAllowed && !detail.legacyAllowed) {
    return <div className="rounded-v2-sm border border-v2-warning-border bg-v2-warning-soft p-3 text-sm">
      <div className="font-medium text-v2-fg">新模型多出此权限，请确认最终是否保留</div>
      <div className="mt-1 space-y-1 text-v2-muted">
        <p>不保留：进入“用户管理 → 授权”，撤销新模型记录 {sourceIds(detail.assignmentSources, true)}。</p>
        <p>需要保留：进入“用户管理 → 编辑”，在旧角色分配中补齐能提供此权限的同名角色，确保切换前两侧一致。</p>
      </div>
    </div>
  }
  return <div className="rounded-v2-sm border border-v2-warning-border bg-v2-warning-soft p-3 text-sm">
    <div className="font-medium text-v2-fg">新模型缺少此权限，请确认最终是否保留</div>
    <div className="mt-1 space-y-1 text-v2-muted">
      <p>需要保留：进入“用户管理 → 授权”，分配包含此权限的功能角色，并选择正确的租户或用户组作用域。</p>
      <p>不再保留：进入“用户管理 → 编辑”，移除旧角色记录 {sourceIds(detail.legacySources, false)}。</p>
    </div>
  </div>
}

function ModelSources({ title, allowed, sources, assignment }: {
  title: string
  allowed: boolean
  sources: PermissionSource[]
  assignment: boolean
}) {
  return <div className="rounded-v2-sm border border-v2-border bg-v2-surface-soft p-3">
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium text-v2-fg">{title}</span>
      <StatusBadge status={allowed ? 'ok' : 'danger'}>{allowed ? '拥有权限' : '无此权限'}</StatusBadge>
    </div>
    {sources.length > 0
      ? <ul className="mt-2 space-y-1 text-xs text-v2-muted">
        {sources.map((source, index) => <li key={`${source.roleId}-${source.assignmentId ?? 'legacy'}-${index}`}>
          {sourceLabel(source, assignment)}
        </li>)}
      </ul>
      : <p className="mt-2 text-xs text-v2-muted">没有可提供该权限的{assignment ? '有效 assignment' : '旧角色'}。</p>}
  </div>
}

export function PermissionDiffDetails({ details }: { details: PermissionDiff[] }) {
  if (details.length === 0) return null
  const accounts = Array.from(details.reduce((groups, detail) => {
    const current = groups.get(detail.userId) ?? {
      userId: detail.userId,
      username: detail.username,
      realName: detail.realName,
      details: [] as PermissionDiff[],
    }
    current.details.push(detail)
    groups.set(detail.userId, current)
    return groups
  }, new Map<number, { userId: number; username: string; realName?: string; details: PermissionDiff[] }>()).values())

  return <div className="space-y-3 rounded-v2-md border border-v2-warning-border bg-v2-surface p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <div className="flex items-center gap-2 font-semibold text-v2-fg">
          <AlertTriangle className="h-4 w-4 text-v2-warning" />功能权限差异明细
        </div>
        <p className="mt-1 text-sm text-v2-muted">逐项处理后刷新预检；同一权限在旧角色和新 assignment 中必须一致。</p>
      </div>
      <StatusBadge status="warn">{accounts.length} 个账户 · {details.length} 项权限</StatusBadge>
    </div>
    <div className="divide-y divide-v2-border border-y border-v2-border">
      {accounts.map((account) => <div key={account.userId} className="space-y-3 py-4">
        <div className="font-medium text-v2-fg">
          {account.realName || account.username}
          <span className="ml-2 text-sm font-normal text-v2-muted">@{account.username} · ID {account.userId}</span>
        </div>
        {account.details.map((detail) => <div key={detail.permissionCode}
          className="space-y-3 rounded-v2-sm border border-v2-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-v2-fg">{detail.permissionName || detail.permissionCode}</span>
            <code className="rounded bg-v2-surface-soft px-1.5 py-0.5 text-xs text-v2-muted">{detail.permissionCode}</code>
            <StatusBadge status="warn">{detail.assignmentAllowed ? '新模型多出' : '新模型缺少'}</StatusBadge>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <ModelSources title="旧角色模型" allowed={detail.legacyAllowed}
              sources={detail.legacySources} assignment={false} />
            <ModelSources title="新 assignment 模型" allowed={detail.assignmentAllowed}
              sources={detail.assignmentSources} assignment />
          </div>
          <ResolutionHint detail={detail} />
        </div>)}
      </div>)}
    </div>
  </div>
}
