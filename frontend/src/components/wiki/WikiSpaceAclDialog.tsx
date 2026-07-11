'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { wikiApi } from '@/lib/wiki-api'
import { Button } from '@/components/v2/Button'
import { Checkbox } from '@/components/v2/Checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/v2/Dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { WikiSpaceAclEntry } from '@/types/wiki'

const FORCED_REASON_LABELS: Record<string, string> = {
  admin_scope: '管理员角色，始终拥有全部权限',
  role_permission: '该角色自带此权限（角色管理中配置），无法在此收回',
  creator: '空间创建人，始终拥有全部权限',
  space_acl: '已通过空间授权命中',
}

type SubjectType = 'role' | 'group' | 'user'
// 空间级 ACL 不含 read —— 所有登录用户默认可读，此处仅管理写权限（见 SPEC 3.3/9.6 节）
const PERMS = ['create', 'update', 'delete', 'publish'] as const
type Perm = (typeof PERMS)[number]
const PERM_LABELS: Record<Perm, string> = { create: '建', update: '写', delete: '删', publish: '发布' }

interface Subject {
  id: number
  name: string
}

const TABS: { key: SubjectType; label: string }[] = [
  { key: 'role', label: '角色' },
  { key: 'group', label: '组' },
  { key: 'user', label: '人员' },
]

export function WikiSpaceAclDialog({
  spaceId,
  spaceName,
  open,
  onOpenChange,
}: {
  spaceId: number
  spaceName: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<SubjectType>('role')
  // key = `${type}:${id}` → Set<Perm>
  const [grants, setGrants] = useState<Map<string, Set<Perm>>>(new Map())

  const { data: acl } = useQuery({
    queryKey: ['wiki-space-acl', spaceId],
    queryFn: () => wikiApi.getSpaceAcl(spaceId),
    enabled: open,
  })

  const { data: rolesData } = useQuery<{ data: { records: Subject[] } }>({
    queryKey: ['acl-roles'],
    queryFn: () => api.get('/rbac/roles', { params: { page: 1, size: 100 } }).then((r) => r.data),
    enabled: open,
  })
  const { data: groupsData } = useQuery<{ data: Subject[] }>({
    queryKey: ['acl-groups'],
    queryFn: () => api.get('/groups').then((r) => r.data),
    enabled: open,
  })
  const { data: usersData } = useQuery<{ data: { records: { id: number; realName?: string; username: string }[] } }>({
    queryKey: ['acl-users'],
    queryFn: () => api.get('/users', { params: { page: 1, size: 200 } }).then((r) => r.data),
    enabled: open,
  })

  useEffect(() => {
    if (!acl) return
    const m = new Map<string, Set<Perm>>()
    for (const e of acl.entries ?? []) {
      m.set(`${e.subjectType}:${e.subjectId}`, new Set(e.permissions as Perm[]))
    }
    // The loaded ACL initializes the dialog's editable permission matrix.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGrants(m)
  }, [acl])

  // 候选对象 = 选择器接口列出的全量对象 ⋃ 已保存 ACL / 强制项里出现的对象。
  // 选择器接口（/groups、/users、/rbac/roles）在当前用户权限不足时会 403，仅回落到空列表，
  // 若不做并集，已经写入的授权行会随之从表格里“消失”——即使后端数据完好无损。
  const subjects: Subject[] = useMemo(() => {
    const base: Subject[] =
      tab === 'role'
        ? (rolesData?.data?.records ?? [])
        : tab === 'group'
          ? (groupsData?.data ?? [])
          : (usersData?.data?.records ?? []).map((u) => ({ id: u.id, name: u.realName || u.username }))

    const known = new Map<number, Subject>(base.map((s) => [s.id, s]))
    const merge = (subjectType: SubjectType, subjectId: number, subjectName: string) => {
      if (subjectType !== tab || known.has(subjectId)) return
      known.set(subjectId, { id: subjectId, name: subjectName })
    }
    for (const e of acl?.entries ?? []) merge(e.subjectType as SubjectType, e.subjectId, e.subjectName)
    for (const g of acl?.forcedEntries ?? []) merge(g.subjectType as SubjectType, g.subjectId, g.subjectName)
    return Array.from(known.values())
  }, [tab, rolesData, groupsData, usersData, acl])

  // key = `${type}:${id}` → { perms: Set<Perm>, reason: string }（目前空间弹窗只会算出 role 维度的强制项）
  const forced = useMemo(() => {
    const m = new Map<string, { perms: Set<string>; reason: string }>()
    for (const g of acl?.forcedEntries ?? []) {
      m.set(`${g.subjectType}:${g.subjectId}`, { perms: new Set(g.permissions), reason: g.reason })
    }
    return m
  }, [acl])

  const togglePerm = (subjectId: number, perm: Perm) => {
    const key = `${tab}:${subjectId}`
    setGrants((prev) => {
      const next = new Map(prev)
      const set = new Set(next.get(key) ?? [])
      if (set.has(perm)) set.delete(perm)
      else set.add(perm)
      if (set.size === 0) next.delete(key)
      else next.set(key, set)
      return next
    })
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const entries: WikiSpaceAclEntry[] = []
      for (const [key, perms] of grants.entries()) {
        const [type, idStr] = key.split(':')
        entries.push({
          subjectType: type,
          subjectId: Number(idStr),
          subjectName: '',
          permissions: [...perms],
        })
      }
      return wikiApi.setSpaceAcl(spaceId, { spaceId, entries })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki-spaces'] })
      queryClient.invalidateQueries({ queryKey: ['wiki-space-acl', spaceId] })
      toast.success('权限设置已保存')
      onOpenChange(false)
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '保存失败'
      toast.error(msg)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>空间权限设置：{spaceName}</DialogTitle>
          <DialogDescription>
            兼容权限模式：所有登录用户默认可读；角色授权已冻结，请改用用户或组管理写权限。
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 border-b border-v2-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                tab === t.key
                  ? 'border-b-2 border-v2-primary text-v2-primary'
                  : 'text-v2-muted hover:text-v2-fg',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-v2-surface">
              <tr className="border-b border-v2-border text-xs text-v2-muted">
                <th className="py-2 text-left font-medium">{TABS.find((t) => t.key === tab)?.label}</th>
                {PERMS.map((p) => (
                  <th key={p} className="w-14 py-2 text-center font-medium">
                    {PERM_LABELS[p]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => {
                const key = `${tab}:${s.id}`
                const set = grants.get(key)
                const forcedEntry = forced.get(key)
                return (
                  <tr key={s.id} className="border-b border-v2-border/50">
                    <td className="py-2 text-v2-fg">{s.name}</td>
                    {PERMS.map((p) => {
                      const isForced = forcedEntry?.perms.has(p) ?? false
                      const checkbox = (
                        <Checkbox
                          checked={isForced || (set?.has(p) ?? false)}
                          disabled={isForced || tab === 'role'}
                          onCheckedChange={() => togglePerm(s.id, p)}
                        />
                      )
                      return (
                        <td key={p} className="w-14">
                          <div className="flex items-center justify-center">
                            {isForced ? (
                              <Tooltip>
                                <TooltipTrigger>{checkbox}</TooltipTrigger>
                                <TooltipContent>
                                  {FORCED_REASON_LABELS[forcedEntry!.reason] ?? '已天然拥有此权限'}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              checkbox
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              {subjects.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-v2-muted">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="primary" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
