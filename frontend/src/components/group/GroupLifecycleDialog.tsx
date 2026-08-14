'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { getApiErrorMessage, isAxiosError } from '@/lib/api-error'
import { toast } from '@/design-system/figma-neutral/toast'
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Input,
  LoadingState,
  NeutralDialog,
  Table,
  Textarea,
} from '@/design-system/figma-neutral/components'

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

  const description = action === 'restore'
    ? '恢复只会重新启用用户组，不会恢复历史成员、角色授权或资源 ACL。'
    : action === 'purge'
      ? '永久清除不可恢复，仅允许清除已过保留期且除审计外无任何历史引用的用户组。'
      : '归档不会级联修改成员、授权、ACL 或业务数据；存在活动引用时系统会阻止操作。'

  return (
    <NeutralDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={copy.title}
      description={description}
      size="lg"
      showClose={false}
      footer={
        <div className="cwgsyw-form__actions">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button
            type="button"
            variant={action === 'purge' ? 'destructive' : 'primary'}
            data-testid="group-lifecycle-submit"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            loading={submitting}
          >
            {submitting ? `${copy.verb}中…` : copy.verb}
          </Button>
        </div>
      }
    >
      <div className="cwgsyw-form" data-testid="group-lifecycle-preflight">
        {preflightQuery.isLoading ? <LoadingState label="正在检查用户组引用…" /> : null}

        {preflightQuery.isError && !preflight ? (
          <Alert
            tone="danger"
            title="无法加载操作预检"
            description={getApiErrorMessage(preflightQuery.error, '无法加载操作预检')}
            showDismiss={false}
            action={
              <Button type="button" variant="secondary" size="sm" onClick={() => void refreshPreflight()}>
                重新检查
              </Button>
            }
          />
        ) : null}

        {preflight ? (
          <>
            <Alert
              tone={preflight.eligible ? 'success' : 'warning'}
              title={preflight.eligible ? '预检通过' : '预检未通过'}
              description={
                preflight.eligible
                  ? `可以${copy.verb}“${preflight.group.name}”。`
                  : `${preflight.blockers.length} 类引用、共 ${blockerSummary ?? 0} 项需要先处理。`
              }
              showDismiss={false}
            />

            {preflight.blockers.length > 0 ? (
              <Table
                showSearch={false}
                columns={[
                  { key: 'message', label: '阻塞原因' },
                  { key: 'count', label: '数量', align: 'right' },
                  { key: 'resolution', label: '处理建议' },
                ]}
                rows={preflight.blockers.map((blocker) => ({
                  id: blocker.referenceType,
                  cells: {
                    message: (
                      <div data-testid={`group-lifecycle-blocker-${blocker.referenceType}`}>
                        <div>{blocker.message}</div>
                        <code data-testid={`group-lifecycle-blocker-reason-${blocker.referenceType}`}>{blocker.reasonCode}</code>
                      </div>
                    ),
                    count: blocker.count,
                    resolution: blocker.resolution,
                  },
                }))}
              />
            ) : null}

            <Field
              htmlFor="group-lifecycle-reason"
              label="操作原因"
              helperText={reasonLength > 0 && !reasonValid ? '原因长度必须为 10–500 个字符' : '原因会写入审计记录'}
              state={reasonLength > 0 && !reasonValid ? 'error' : 'default'}
            >
              <Textarea
                id="group-lifecycle-reason"
                data-testid="group-lifecycle-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="请输入 10–500 个字符，说明本次操作原因"
              />
            </Field>
            <output className="sr-only" data-testid="group-lifecycle-reason-code">
              {reasonValid ? 'VALID' : 'GROUP_LIFECYCLE_REASON_INVALID'}
            </output>
            <p className="cwgsyw-type-label-xs">{reasonLength}/500</p>

            <Field
              htmlFor="group-lifecycle-confirmation"
              label="输入组名称确认"
              state={confirmationName.length > 0 && !confirmationValid ? 'error' : 'default'}
              errorText={confirmationName.length > 0 && !confirmationValid ? `必须与“${preflight.group.name}”完全一致。` : undefined}
            >
              <Input
                id="group-lifecycle-confirmation"
                data-testid="group-lifecycle-confirmation"
                value={confirmationName}
                onChange={(event) => setConfirmationName(event.target.value)}
                autoComplete="off"
                placeholder={preflight.group.name}
              />
            </Field>

            {action === 'purge' ? (
              <Checkbox
                label="我确认永久清除后无法恢复，并已核对保留期与全部历史引用。"
                data-testid="group-lifecycle-purge-irreversible"
                checked={purgeConfirmed}
                onChange={(event) => setPurgeConfirmed(event.target.checked)}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </NeutralDialog>
  )
}
