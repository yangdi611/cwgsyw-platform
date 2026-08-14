'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  Button,
  Checkbox,
  Field,
  Input,
  NeutralDialog,
  Select,
  Textarea,
} from '@/design-system/figma-neutral/components'

interface GroupFormData {
  name: string
  description: string
  leaderId: number | null
  memberIds: number[]
}

interface UserOption {
  id: number
  username: string
  realName: string
  groupId: number | null
  groupName?: string
}

interface GroupDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  group?: { id: number; name: string; description?: string; leaderId?: number | null } | null
  onClose: () => void
  onSuccess: () => void
}

export default function GroupDialog({ open, mode, group, onClose, onSuccess }: GroupDialogProps) {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<GroupFormData>({
    defaultValues: { name: '', description: '', leaderId: null, memberIds: [] },
  })

  const { data: usersData } = useQuery({
    queryKey: ['all-users-for-group'],
    queryFn: () => api.get('/users', { params: { page: 1, size: 200 } }).then((r) => {
      const records = r.data.data?.records ?? []
      return records as UserOption[]
    }),
    enabled: open,
  })

  const { data: groupsData } = useQuery({
    queryKey: ['all-groups-for-dialog'],
    queryFn: () => api.get('/groups').then((r) => r.data.data as { id: number; name: string }[]),
    enabled: open,
  })

  const sortedUsers = useMemo(() => {
    if (!usersData) return []
    const groupMap = new Map((groupsData || []).map((item) => [item.id, item.name]))
    return [...usersData]
      .sort((a, b) => {
        const aHasGroup = a.groupId != null ? 1 : 0
        const bHasGroup = b.groupId != null ? 1 : 0
        if (aHasGroup !== bHasGroup) return aHasGroup - bHasGroup
        return (a.realName || a.username).localeCompare(b.realName || b.username, 'zh-CN')
      })
      .map((user) => ({ ...user, groupName: user.groupId ? groupMap.get(user.groupId) : undefined }))
  }, [usersData, groupsData])

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && group) {
      reset({
        name: group.name,
        description: group.description || '',
        leaderId: group.leaderId ?? null,
        memberIds: [],
      })
    } else {
      reset({ name: '', description: '', leaderId: null, memberIds: [] })
    }
  }, [open, mode, group, reset])

  const selectedMemberIds = watch('memberIds')
  const leaderId = watch('leaderId')

  const onSubmit = async (data: GroupFormData) => {
    try {
      if (mode === 'create') {
        await api.post('/groups', {
          name: data.name,
          description: data.description,
          leaderId: data.leaderId || undefined,
          memberIds: data.memberIds.length > 0 ? data.memberIds : undefined,
        })
        toast.success('组创建成功')
      } else {
        await api.put(`/groups/${group!.id}`, {
          name: data.name,
          description: data.description,
          leaderId: data.leaderId,
        })
        toast.success('组更新成功')
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '操作失败'))
    }
  }

  return (
    <NeutralDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={mode === 'create' ? '新建组' : '编辑组'}
      showClose={false}
      footer={
        <div className="cwgsyw-form__actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" form="group-dialog-form" variant="primary" loading={isSubmitting}>
            {isSubmitting ? '保存中…' : '保存'}
          </Button>
        </div>
      }
    >
      <form id="group-dialog-form" className="cwgsyw-form" noValidate onSubmit={handleSubmit(onSubmit)}>
        <Field
          htmlFor="name"
          label="组名称"
          required
          state={errors.name ? 'error' : 'default'}
          errorText={errors.name?.message}
        >
          <Input
            maxLength={64}
            placeholder="请输入组名称"
            {...register('name', {
              required: '组名称不能为空',
              maxLength: { value: 64, message: '组名称不能超过64个字符' },
            })}
          />
        </Field>
        <Field
          htmlFor="description"
          label="描述"
          state={errors.description ? 'error' : 'default'}
          errorText={errors.description?.message}
        >
          <Textarea
            rows={2}
            maxLength={255}
            placeholder="请输入组描述"
            {...register('description', { maxLength: { value: 255, message: '组描述不能超过255个字符' } })}
          />
        </Field>
        <Field htmlFor="leaderId" label="组长">
          <Select
            id="leaderId"
            placeholder="不指定组长"
            value={leaderId == null ? '' : String(leaderId)}
            options={[
              { value: '', label: '不指定组长' },
              ...sortedUsers.map((user) => ({
                value: String(user.id),
                label: `${user.realName || user.username}${user.groupName ? ` (${user.groupName})` : ''}`,
              })),
            ]}
            onChange={(value) => setValue('leaderId', value === '' ? null : Number(value))}
          />
        </Field>
        {mode === 'create' ? (
          <div>
            <div className="cwgsyw-type-label-sm">组员</div>
            <div className="cwgsyw-stack-list">
              {sortedUsers.map((user) => (
                <div key={user.id} className="cwgsyw-stack-list__item">
                  <Checkbox
                    label={`${user.realName || user.username}${user.groupName ? `（${user.groupName}）` : ''}`}
                    checked={selectedMemberIds.includes(user.id)}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setValue('memberIds', [...selectedMemberIds, user.id])
                      } else {
                        setValue('memberIds', selectedMemberIds.filter((id) => id !== user.id))
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </form>
    </NeutralDialog>
  )
}
