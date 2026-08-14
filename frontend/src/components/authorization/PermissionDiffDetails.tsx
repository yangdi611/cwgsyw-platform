'use client'

import { Alert, StatusBadge } from '@/design-system/figma-neutral/components'

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
    return <div className="rounded-[var(--cwgsyw-radius-lg)] border border-[var(--cwgsyw-border-default)] p-3 text-sm">
      <div className="font-medium cwgsyw-type-body-sm">新模型多出此权限，请确认最终是否保留</div>
      <div className="mt-1 space-y-1 cwgsyw-type-label-sm">
        <p>不保留：进入“用户管理 → 授权”，撤销新模型记录 {sourceIds(detail.assignmentSources, true)}。</p>
        <p>需要保留：进入“用户管理 → 编辑”，在旧角色分配中补齐能提供此权限的同名角色，确保切换前两侧一致。</p>
      </div>
    </div>
  }
  return <div className="rounded-[var(--cwgsyw-radius-lg)] border border-[var(--cwgsyw-border-default)] p-3 text-sm">
    <div className="font-medium cwgsyw-type-body-sm">新模型缺少此权限，请确认最终是否保留</div>
    <div className="mt-1 space-y-1 cwgsyw-type-label-sm">
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
  return <div className="rounded-[var(--cwgsyw-radius-lg)] border border-[var(--cwgsyw-border-default)] p-3">
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium cwgsyw-type-body-sm">{title}</span>
      <StatusBadge label={allowed ? '拥有权限' : '无此权限'} status={allowed ? 'success' : 'danger'} />
    </div>
    {sources.length > 0
      ? <ul className="mt-2 space-y-1 text-xs cwgsyw-type-label-sm">
        {sources.map((source, index) => <li key={`${source.roleId}-${source.assignmentId ?? 'legacy'}-${index}`}>
          {sourceLabel(source, assignment)}
        </li>)}
      </ul>
      : <p className="mt-2 text-xs cwgsyw-type-label-sm">没有可提供该权限的{assignment ? '有效 assignment' : '旧角色'}。</p>}
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

  return <div className="space-y-3 rounded-[var(--cwgsyw-radius-xl)] border border-[var(--cwgsyw-status-warning-border)] bg-[var(--cwgsyw-bg-surface)] p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <div className="flex items-center gap-2 font-semibold cwgsyw-type-body-sm">
          功能权限差异明细
        </div>
        <p className="mt-1 text-sm cwgsyw-type-label-sm">逐项处理后刷新预检；同一权限在旧角色和新 assignment 中必须一致。</p>
      </div>
      <StatusBadge label={`${accounts.length} 个账户 · ${details.length} 项权限`} status="warning" />
    </div>
    <div className="divide-y divide-[var(--cwgsyw-border-subtle)] ">
      {accounts.map((account) => <div key={account.userId} className="space-y-3 py-4">
        <div className="font-medium cwgsyw-type-body-sm">
          {account.realName || account.username}
          <span className="ml-2 text-sm font-normal cwgsyw-type-label-sm">@{account.username} · ID {account.userId}</span>
        </div>
        {account.details.map((detail) => <div key={detail.permissionCode}
          className="space-y-3 rounded-[var(--cwgsyw-radius-lg)] border border-[var(--cwgsyw-border-default)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium cwgsyw-type-body-sm">{detail.permissionName || detail.permissionCode}</span>
            <code className="cwgsyw-type-label-sm">{detail.permissionCode}</code>
            <StatusBadge label={detail.assignmentAllowed ? '新模型多出' : '新模型缺少'} status="warning" />
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
