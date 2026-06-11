'use client'
import { useEffect, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface UserFormData {
  username: string
  password: string
  real_name: string
  email: string
  phone: string
  group_id: number | null
  role_ids: number[]
}

interface UserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: {
    id?: number
    username?: string
    real_name?: string
    email?: string
    phone?: string
    group_id?: number
    status?: number
  }
}

export default function UserDialog({ open, onOpenChange, user }: UserDialogProps) {
  const queryClient = useQueryClient()
  const isEdit = !!user?.id

  const defaultValues: UserFormData = {
    username: '',
    password: '',
    real_name: '',
    email: '',
    phone: '',
    group_id: null,
    role_ids: [],
  }

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<UserFormData>({
    defaultValues,
  })

  // Fetch user detail for edit mode
  const { data: userDetail } = useQuery({
    queryKey: ['user', user?.id],
    queryFn: () =>
      api.get(`/users/${user!.id}`).then((r) => r.data.data as UserFormData & { phone?: string; group_id?: number | null; status?: number }),
    enabled: open && !!user?.id,
  })

  // Fetch groups for dropdown
  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then(r => r.data.data as Array<{ id: number; name: string }>),
    enabled: open,
  })

  // Fetch roles for checkbox group
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () =>
      api
        .get('/rbac/roles', { params: { page: 1, size: 50 } })
        .then((r) => r.data.data.records as Array<{ id: number; name: string; code: string; scope: string; description: string }>),
    enabled: open,
  })

  const toggleRole = useCallback(
    (roleId: number, checked: boolean, current: number[]) =>
      checked ? [...current, roleId] : current.filter((id) => id !== roleId),
    [],
  )

  useEffect(() => {
    if (open) {
      if (isEdit && userDetail) {
        reset({
          username: userDetail.username ?? '',
          password: '',
          real_name: (userDetail as any).real_name ?? '',
          email: userDetail.email ?? '',
          phone: (userDetail as any).phone ?? '',
          group_id: (userDetail as any).group_id ?? null,
          role_ids: (userDetail as any).role_ids ?? [],
        })
      } else if (!isEdit) {
        reset(defaultValues)
      }
    }
  }, [open, isEdit, userDetail, reset])

  const createMutation = useMutation({
    mutationFn: (data: UserFormData) =>
      api.post('/users', {
        username: data.username,
        password: data.password,
        real_name: data.real_name,
        email: data.email,
        phone: data.phone,
        group_id: data.group_id,
        role_ids: data.role_ids,
      }),
    onSuccess: () => {
      toast.success('用户已创建')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onOpenChange(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: UserFormData) =>
      api.put(`/users/${user!.id}`, {
        real_name: data.real_name,
        email: data.email,
        phone: data.phone,
        group_id: data.group_id,
        password: data.password || undefined,
        role_ids: data.role_ids,
      }),
    onSuccess: () => {
      toast.success('用户已更新')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onOpenChange(false)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '更新失败'),
  })

  const onSubmit = (data: UserFormData) => {
    if (isEdit) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑用户' : '新增用户'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!isEdit && (
            <div className="space-y-1.5">
              <Label>用户名 *</Label>
              <Input {...register('username', { required: '请输入用户名' })} placeholder="登录用户名" />
              {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{isEdit ? '密码（留空不修改）' : '密码 *'}</Label>
            <Input
              type="password"
              {...register('password', isEdit ? {} : { required: '请输入密码', minLength: { value: 6, message: '密码至少6位' } })}
              placeholder={isEdit ? '留空则不修改密码' : '至少6位'}
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>姓名</Label>
            <Input {...register('real_name')} placeholder="真实姓名" />
          </div>

          <div className="space-y-1.5">
            <Label>邮箱</Label>
            <Input {...register('email')} type="email" placeholder="example@company.com" />
          </div>

          <div className="space-y-1.5">
            <Label>手机号</Label>
            <Input
              {...register('phone', {
                pattern: {
                  value: /^1[3-9]\d{9}$/,
                  message: '请输入正确手机号',
                },
              })}
              placeholder="11位手机号"
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>所属组织</Label>
            <select
              {...register('group_id', { setValueAs: (v) => (v === '' ? null : Number(v)) })}
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
            >
              <option value="">请选择组织</option>
              {(groupsData ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <Label>分配角色</Label>
            <Controller
              control={control}
              name="role_ids"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  {(rolesData ?? []).map((role) => {
                    const checked = field.value.includes(role.id)
                    return (
                      <label
                        key={role.id}
                        className="flex items-start gap-2 cursor-pointer rounded-md border p-2 hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={checked}
                          className="mt-0.5"
                          onCheckedChange={(v: boolean) =>
                            field.onChange(toggleRole(role.id, v, field.value))
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium leading-none">
                              {role.name}
                            </span>
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                              {role.scope}
                            </Badge>
                          </div>
                          {role.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {role.description}
                            </p>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
