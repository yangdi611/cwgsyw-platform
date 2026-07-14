'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { getApiErrorMessage, isAxiosError } from '@/lib/api-error'
import { Button } from '@/components/v2/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/v2/Dialog'
import { Textarea } from '@/components/v2/Textarea'
import { toast } from 'sonner'

export type GroupLifecycleAction = 'archive' | 'restore' | 'purge'

export interface GroupLifecycleTarget {
  id: number
  name: string
  state: 'active' | 'archived'
  updatedAt?: string | null
  archivedAt?: string | null
}

interface GroupLifecycleBlocker {
  reasonCode: string
  referenceType: string
  count: number
  message: string
  resolution: string
}

interface GroupLifecyclePreflight {
  action: GroupLifecycleAction
  eligible: boolean
  group: {
    id: number
    tenantId: string
    code: string
    name: string
    state: 'active' | 'archived'
    groupType: 'business' | 'unassigned'
    builtin: boolean
    updatedAt: string
    archivedAt?: string | null
  }
  activeCounts: Record<string, number>
  historicalCounts: Record<string, number>
  blockers: GroupLifecycleBlocker[]
  purgeEligibleAt: string | null
  snapshotHash: string
}

interface GroupLifecycleDialogProps {
  action: GroupLifecycleAction
  target: GroupLifecycleTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => Promise<void> | void
}

interface LifecycleErrorPayload {
  errorCode?: string
  data?: GroupLifecyclePreflight
}

const ACTION_COPY: Record<GroupLifecycleAction, { title: string; verb: string; success: string }> = {
  archive: { title: '归档用户组', verb: '归档', success: '用户组已归档' },
  restore: { title: '恢复用户组', verb: '恢复', success: '用户组已恢复' },
  purge: { title: '清除用户组', verb: '永久清除', success: '用户组已永久清除' },
}

function extractConflictPreflight(error: unknown): GroupLifecyclePreflight | undefined {
  if (!isAxiosError(error) || error.response?.status !== 409) return undefined
  const payload = error.response.data as LifecycleErrorPayload | undefined
  return payload?.data
}

function extractLifecycleErrorCode(error: unknown): string | undefined {
  if (!isAxiosError(error)) return undefined
  const payload = error.response?.data as LifecycleErrorPayload | undefined
  return payload?.errorCode
}

export default function GroupLifecycleDialog({
  action,
  target,
  open,
  onOpenChange,
  onSuccess,
}: GroupLifecycleDialogProps) {
  const [reason, setReason] = useState('')
  const [confirmationName, setConfirmationName] = useState('')
  const [purgeConfirmed, setPurgeConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [conflictPreflight, setConflictPreflight] = useState<GroupLifecyclePreflight | null>(null)

  const preflightQuery = useQuery<GroupLifecyclePreflight>({
    queryKey: ['group-lifecycle-preflight', target?.id, action],
    queryFn: () => api
      .get(`/groups/${target?.id}/lifecycle-preflight`, { params: { action } })
      .then((response) => response.data.data as GroupLifecyclePreflight),
    enabled: open && target !== null,
    retry: false,
  })

  const preflight = conflictPreflight ?? preflightQuery.data
  const reasonLength = reason.trim().length
  const reasonValid = reasonLength >= 10 && reasonLength <= 500
  const confirmationValid = confirmationName === preflight?.group.name
  const canSubmit = Boolean(
    preflight?.eligible
      && reasonValid
      && confirmationValid
      && (action !== 'purge' || purgeConfirmed)
      && !submitting,
  )
  const copy = ACTION_COPY[action]

  const blockerSummary = useMemo(() => {
    if (!preflight || preflight.blockers.length === 0) return null
    return preflight.blockers.reduce((total, blocker) => total + blocker.count, 0)
  }, [preflight])

  const refreshPreflight = async () => {
    setConflictPreflight(null)
    await preflightQuery.refetch()
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && submitting) return
    onOpenChange(nextOpen)
  }

  const handleSubmit = async () => {
    if (!target || !preflight || !canSubmit) return
    setSubmitting(true)
    try {
      await api.post(`/groups/${target.id}/${action}`, {
        reason: reason.trim(),
        confirmationName,
        expectedUpdatedAt: preflight.group.updatedAt,
        ...(action === 'purge'
          ? { expectedArchivedAt: preflight.group.archivedAt ?? target.archivedAt }
          : {}),
      })
      toast.success(copy.success)
      onOpenChange(false)
      await onSuccess()
    } catch (error: unknown) {
      const latestPreflight = extractConflictPreflight(error)
      const errorCode = extractLifecycleErrorCode(error)
      if (latestPreflight) {
        setConflictPreflight(latestPreflight)
      } else if (isAxiosError(error) && error.response?.status === 409) {
        await refreshPreflight()
      }
      toast.error(
        getApiErrorMessage(error, `${copy.verb}失败`),
        errorCode ? { description: errorCode } : undefined,
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="group-lifecycle-preflight">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {action === 'restore'
              ? '恢复只会重新启用用户组，不会恢复历史成员、角色授权或资源 ACL。'
              : action === 'purge'
                ? '永久清除不可恢复，仅允许清除已过保留期且除审计外无任何历史引用的用户组。'
                : '归档不会级联修改成员、授权、ACL 或业务数据；存在活动引用时系统会阻止操作。'}
          </DialogDescription>
        </DialogHeader>

        {preflightQuery.isLoading && (
          <div className="rounded-v2-md border border-v2-border bg-v2-surface-soft p-6 text-center text-sm text-v2-muted">
            正在检查用户组引用…
          </div>
        )}

        {preflightQuery.isError && !preflight && (
          <div className="space-y-3 rounded-v2-md border border-v2-danger-border bg-v2-danger-soft p-4 text-sm text-v2-danger">
            <p>{getApiErrorMessage(preflightQuery.error, '无法加载操作预检')}</p>
            <Button variant="secondary" size="sm" onClick={() => void refreshPreflight()}>
              重新检查
            </Button>
          </div>
        )}

        {preflight && (
          <div className="space-y-4">
            <div className={preflight.eligible
              ? 'rounded-v2-md border border-v2-success-border bg-v2-success-soft p-3 text-sm text-v2-success'
              : 'rounded-v2-md border border-v2-warning-border bg-v2-warning-soft p-3 text-sm text-v2-warning'}>
              {preflight.eligible
                ? `预检通过，可以${copy.verb}“${preflight.group.name}”。`
                : `预检未通过：${preflight.blockers.length} 类引用、共 ${blockerSummary ?? 0} 项需要先处理。`}
            </div>

            {preflight.blockers.length > 0 && (
              <div className="max-h-56 overflow-auto rounded-v2-md border border-v2-border">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-v2-surface-soft text-v2-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">阻塞原因</th>
                      <th className="px-3 py-2 text-right font-medium">数量</th>
                      <th className="px-3 py-2 font-medium">处理建议</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-v2-border">
                    {preflight.blockers.map((blocker) => (
                      <tr key={blocker.referenceType} data-testid={`group-lifecycle-blocker-${blocker.referenceType}`}>
                        <td className="px-3 py-2">
                          <div>{blocker.message}</div>
                          <code className="text-xs text-v2-muted" data-testid={`group-lifecycle-blocker-reason-${blocker.referenceType}`}>
                            {blocker.reasonCode}
                          </code>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{blocker.count}</td>
                        <td className="px-3 py-2 text-v2-muted">{blocker.resolution}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="group-lifecycle-reason" className="text-sm font-medium text-v2-fg">
                操作原因
              </label>
              <Textarea
                id="group-lifecycle-reason"
                data-testid="group-lifecycle-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="请输入 10–500 个字符，说明本次操作原因"
              />
              <output className="sr-only" data-testid="group-lifecycle-reason-code">
                {reasonValid ? 'VALID' : 'GROUP_LIFECYCLE_REASON_INVALID'}
              </output>
              <div className="flex justify-between text-xs text-v2-muted">
                <span>{reasonLength > 0 && !reasonValid ? '原因长度必须为 10–500 个字符' : '原因会写入审计记录'}</span>
                <span className="tabular-nums">{reasonLength}/500</span>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="group-lifecycle-confirmation" className="text-sm font-medium text-v2-fg">
                输入组名称确认
              </label>
              <input
                id="group-lifecycle-confirmation"
                data-testid="group-lifecycle-confirmation"
                className="h-10 w-full rounded-v2-md border border-v2-border bg-v2-surface px-3 text-sm text-v2-fg outline-none focus:border-v2-primary"
                value={confirmationName}
                onChange={(event) => setConfirmationName(event.target.value)}
                autoComplete="off"
                placeholder={preflight.group.name}
              />
              {confirmationName.length > 0 && !confirmationValid && (
                <p className="text-xs text-v2-danger">必须与“{preflight.group.name}”完全一致。</p>
              )}
            </div>

            {action === 'purge' && (
              <label className="flex items-start gap-2 rounded-v2-md border border-v2-danger-border bg-v2-danger-soft p-3 text-sm text-v2-danger">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  data-testid="group-lifecycle-purge-irreversible"
                  checked={purgeConfirmed}
                  onChange={(event) => setPurgeConfirmed(event.target.checked)}
                />
                我确认永久清除后无法恢复，并已核对保留期与全部历史引用。
              </label>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button
            variant={action === 'purge' ? 'danger' : 'primary'}
            data-testid="group-lifecycle-submit"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            {submitting ? `${copy.verb}中…` : copy.verb}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
