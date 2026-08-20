'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { getApiErrorMessage } from '@/lib/api-error'
import '@/components/task-runtime/tasks.css'
import { IdentityIconAction } from '@/components/identity/IdentityActions'
import {
  Button,
  NeutralAlertDialog,
  NeutralDialog,
  SearchInput,
} from '@/design-system/figma-neutral/components'

interface GroupMember {
  userId: number
  username: string
  realName: string
  email: string
  roleNames: string[]
}

interface SearchUser {
  id: number
  username: string
  realName: string
  groupId: number | null
}

interface MemberDialogProps {
  groupId: number
  groupName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function MemberDialog({ groupId, groupName, open, onOpenChange }: MemberDialogProps) {
  return <MemberDialogContent key={groupId} groupId={groupId} groupName={groupName} open={open} onOpenChange={onOpenChange} />
}

function MemberDialogContent({ groupId, groupName, open, onOpenChange }: MemberDialogProps) {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [loading, setLoading] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<GroupMember | null>(null)

  const { data: members = [], refetch: loadMembers } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      try {
        const res = await api.get(`/groups/${groupId}/members`)
        return res.data.data as GroupMember[]
      } catch {
        toast.error('加载成员列表失败')
        return []
      }
    },
    enabled: open && groupId > 0,
  })

  const searchUsers = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults([])
      return
    }
    try {
      const res = await api.get('/users', { params: { keyword, page: 1, size: 20 } })
      const allUsers = res.data.data?.records ?? []
      const memberIds = new Set(members.map((member) => member.userId))
      const available = (allUsers as SearchUser[]).filter((user) => !memberIds.has(user.id))
      setSearchResults(available)
    } catch (err) {
      console.warn('搜索用户失败', err)
    }
  }, [members])

  useEffect(() => {
    const timer = setTimeout(() => void searchUsers(searchKeyword), 250)
    return () => clearTimeout(timer)
  }, [searchKeyword, searchUsers])

  const handleAdd = async (userId: number) => {
    setLoading(true)
    try {
      await api.post(`/groups/${groupId}/members`, { userId })
      toast.success('成员已加入')
      loadMembers()
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '加入失败'))
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setLoading(true)
    try {
      await api.delete(`/groups/${groupId}/members/${removeTarget.userId}`)
      toast.success('成员已移除')
      setRemoveTarget(null)
      loadMembers()
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '移除失败'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <NeutralDialog
        className="cwgsyw-identity-dialog"
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSearchKeyword('')
            setSearchResults([])
          }
          onOpenChange(nextOpen)
        }}
        title={`${groupName} — 成员管理`}
        size="lg"
      >
        <div className="cwgsyw-split cwgsyw-identity-form">
          <section className="cwgsyw-split__pane">
            <div className="cwgsyw-split__pane-head cwgsyw-type-label-sm">当前成员 ({members.length})</div>
            <div className="cwgsyw-split__pane-body">
              {members.length === 0 ? (
                <p className="cwgsyw-stack-list__empty">暂无成员</p>
              ) : (
                members.map((member) => (
                  <div key={member.userId} className="cwgsyw-stack-list__item">
                    <span>
                      <strong>{member.realName || member.username}</strong>
                      <span className="cwgsyw-type-label-xs"> @{member.username}</span>
                    </span>
                    <IdentityIconAction label={`移除 ${member.realName || member.username}`} icon="trash" danger disabled={loading} onClick={() => setRemoveTarget(member)} />
                  </div>
                ))
              )}
            </div>
          </section>
          <section className="cwgsyw-split__pane">
            <div className="cwgsyw-split__pane-head">
              <SearchInput
                size="sm"
                value={searchKeyword}
                placeholder="搜索用户..."
                onChange={(event) => setSearchKeyword(event.target.value)}
                onClear={() => setSearchKeyword('')}
              />
            </div>
            <div className="cwgsyw-split__pane-body">
              {searchResults.length === 0 ? (
                <p className="cwgsyw-stack-list__empty">{searchKeyword ? '无匹配用户' : '输入关键词搜索'}</p>
              ) : (
                searchResults.map((user) => (
                  <div key={user.id} className="cwgsyw-stack-list__item">
                    <span>
                      <strong>{user.realName || user.username}</strong>
                      <span className="cwgsyw-type-label-xs"> @{user.username}</span>
                    </span>
                    <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => handleAdd(user.id)}>
                      加入
                    </Button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </NeutralDialog>

      <NeutralAlertDialog
        open={!!removeTarget}
        title="确认移除"
        description={`确定要将 ${removeTarget?.realName || removeTarget?.username || ''} 从 ${groupName} 移除吗？`}
        intent="destructive"
        confirmLabel="移除"
        onConfirm={handleRemove}
        onOpenChange={(next) => {
          if (!next) setRemoveTarget(null)
        }}
      />
    </>
  )
}
