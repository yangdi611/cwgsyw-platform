'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiErrorMessage } from '@/lib/api-error'
import { sosReportApi, type SosFieldDetail, type SosPendingApproval } from '@/lib/sos-report-api'
import { aiFields, aiNote, fieldSourceLabel, formatValue } from '@/lib/sos-report-format'
import { toast } from '@/design-system/figma-neutral/toast'
import { Alert, Badge, Button, Field, NeutralDialog, Table, Textarea } from '@/design-system/figma-neutral/components'

/** 审批人在这里看到将要写入 CMDB 的全部内容，再决定通过或驳回。 */
export function ApprovalDialog({ approval, onClose }: { approval: SosPendingApproval; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [comment, setComment] = useState('')
  const [reasonMissing, setReasonMissing] = useState(false)

  const decide = useMutation({
    mutationFn: (approved: boolean) => sosReportApi.decide(approval.requestId, { approved, comment: comment.trim() || undefined }),
    onSuccess: (_, approved) => {
      toast.success(approved ? '已通过' : '已驳回')
      queryClient.invalidateQueries({ queryKey: ['sos-report-approvals'] })
      queryClient.invalidateQueries({ queryKey: ['sos-report-cmdb-requests'] })
      queryClient.invalidateQueries({ queryKey: ['sos-report-cmdb-preview'] })
      onClose()
    },
    onError: (error) => toast.error(getApiErrorMessage(error, '审批失败')),
  })

  const reject = () => {
    if (!comment.trim()) {
      setReasonMissing(true)
      return
    }
    decide.mutate(false)
  }

  // 快照是提交时保存的，审批人看到的来源不受之后规则变化影响。
  const fields: SosFieldDetail[] = approval.fieldDetails
    ?? Object.entries(approval.proposedFields ?? {}).map(([fieldKey, value]) => ({ fieldKey, name: fieldKey, value, origin: 'none' }))
  const isCreate = approval.action === 'create'
  const suggestedByAi = aiFields(fields)

  return (
    <NeutralDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`审批入库：${approval.instanceName}`}
      description={`${isCreate ? '新增' : '更新'} CMDB 主机实例${approval.submitterName ? ` · 提交人 ${approval.submitterName}` : ''}`}
      size="lg"
      footer={
        <div className="cwgsyw-form__actions">
          <Button type="button" variant="secondary" size="sm" disabled={decide.isPending} onClick={reject}>
            驳回
          </Button>
          <Button type="button" size="sm" loading={decide.isPending} onClick={() => decide.mutate(true)}>
            通过并写入 CMDB
          </Button>
        </div>
      }
    >
      <div className="cwgsyw-sos-report__stack">
        <Alert
          tone="info"
          showDismiss={false}
          title={isCreate ? '通过后将新增实例' : `通过后将更新实例 #${approval.targetInstanceId ?? ''}`}
          description="写入时会重新校验。如果审批期间出现重复的序列号或 IP，审批结果保留，申请会标记为写入失败。"
        />
        {suggestedByAi.length > 0 ? (
          <Alert
            tone="warning"
            showDismiss={false}
            title={`${suggestedByAi.length} 个字段使用了 AI 建议的映射规则，请重点核对`}
            description={`${suggestedByAi.map((field) => field.name).join('、')}。AI 只建议“取报告里的哪项数据”，规则已由管理员确认，字段的值仍来自报告。`}
          />
        ) : (
          <Alert tone="info" showDismiss={false} title="没有使用 AI 建议" description="所有字段都来自预置规则、人工配置的规则或人工填写。" />
        )}
        <Table
          className="cwgsyw-cmdb-table"
          density="compact"
          showSearch={false}
          columns={[
            { key: 'field', label: '字段' },
            ...(isCreate ? [] : [{ key: 'current', label: 'CMDB 现有值' }]),
            { key: 'value', label: '将写入的值' },
            { key: 'source', label: '来源' },
            { key: 'ai', label: 'AI 依据' },
          ]}
          rows={fields.map((field) => ({
            id: field.fieldKey,
            cells: {
              field: field.name,
              current: formatValue(field.currentValue),
              value: formatValue(field.value),
              source: field.ruleSource === 'ai'
                ? <span><Badge label="AI 建议" tone="info" /> {fieldSourceLabel(field)}</span>
                : fieldSourceLabel(field),
              ai: aiNote(field),
            },
          }))}
          state={fields.length === 0 ? 'empty' : 'data'}
          empty="只修改实例名称"
        />
        <Field
          label="审批意见"
          helperText="驳回时必须填写。"
          errorText="驳回时请填写原因"
          showError={reasonMissing}
        >
          <Textarea
            value={comment}
            maxLength={500}
            onChange={(event) => {
              setComment(event.target.value)
              setReasonMissing(false)
            }}
          />
        </Field>
      </div>
    </NeutralDialog>
  )
}
