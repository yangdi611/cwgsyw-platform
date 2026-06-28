'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { wikiApi } from '@/lib/wiki-api'
import { Button } from '@/components/v2/Button'
import { Checkbox } from '@/components/v2/Checkbox'
import { Switch } from '@/components/v2/Switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/v2/Dialog'
import { cn } from '@/lib/utils'
import type { WikiAclEntry } from '@/types/wiki'

type SubjectType = 'role' | 'group' | 'user'
const PERMS = ['read', 'write', 'delete', 'publish'] as const
type Perm = (typeof PERMS)[number]
const PERM_LABELS: Record<Perm, string> = { read: '读', write: '写', delete: '删', publish: '发布' }

interface Subject {
  id: number
  name: string
}

const TABS: { key: SubjectType; label: string }[] = [
  { key: 'role', label: '角色' },
  { key: 'group', label: '组' },
  { key: 'user', label: '人员' },
]

export function WikiAclDialog({
  pageId,
  pageTitle,
  open,
  onOpenChange,
}: {
  pageId: number
  pageTitle: string
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [inherited, setInherited] = useState(true)
  const [tab, setTab] = useState<SubjectType>('role')
  // key = `${type}:${id}` → Set<Perm>
  const [grants, setGrants] = useState<Map<string, Set<Perm>>>(new Map())

  const { data: acl } = useQuery({
    queryKey: ['wiki-acl', pageId],
    queryFn: () => wikiApi.getAcl(pageId),
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
    setInherited(acl.inherited)
    const m = new Map<string, Set<Perm>>()
    for (const e of acl.entries ?? []) {
      m.set(`${e.subjectType}:${e.subjectId}`, new Set(e.permissions as Perm[]))
    }
    setGrants(m)
  }, [acl])

  const subjects: Subject[] = useMemo(() => {
    if (tab === 'role') return rolesData?.data?.records ?? []
    if (tab === 'group') return groupsData?.data ?? []
    return (usersData?.data?.records ?? []).map((u) => ({
      id: u.id,
      name: u.realName || u.username,
    }))
  }, [tab, rolesData, groupsData, usersData])

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
      const entries: WikiAclEntry[] = []
      for (const [key, perms] of grants.entries()) {
        const [type, idStr] = key.split(':')
        entries.push({
          subjectType: type,
          subjectId: Number(idStr),
          subjectName: '',
          permissions: [...perms],
        })
      }
      return wikiApi.setAcl(pageId, { pageId: pageId, inherited, entries })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki-page', pageId] })
      queryClient.invalidateQueries({ queryKey: ['wiki-acl', pageId] })
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
          <DialogTitle>页面权限设置：{pageTitle}</DialogTitle>
          <DialogDescription>
            覆盖式继承：开启「继承」沿用父页面权限；关闭后仅以下勾选的对象可访问（管理员始终可访问）。
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-md border border-v2-border bg-v2-surface px-3 py-2">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-v2-fg">继承父页面权限</div>
            <div className="text-xs text-v2-muted">
              {inherited ? '当前沿用父级（或全员开放）' : '当前为自定义权限'}
            </div>
          </div>
          <Switch checked={inherited} onCheckedChange={(v) => setInherited(v)} />
        </div>

        {!inherited && (
          <>
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
                    return (
                      <tr key={s.id} className="border-b border-v2-border/50">
                        <td className="py-2 text-v2-fg">{s.name}</td>
                        {PERMS.map((p) => (
                          <td key={p} className="w-14">
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={set?.has(p) ?? false}
                                onCheckedChange={() => togglePerm(s.id, p)}
                              />
                            </div>
                          </td>
                        ))}
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
          </>
        )}

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
