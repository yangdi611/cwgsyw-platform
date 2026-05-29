'use client'

import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface GroupMember {
  user_id: number
  username: string
  real_name: string
  email: string
  role_names: string[]
}

interface SearchUser {
  id: number
  username: string
  real_name: string
  group_id: number | null
}

interface MemberDialogProps {
  groupId: number
  groupName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function MemberDialog({ groupId, groupName, open, onOpenChange }: MemberDialogProps) {
  const [members, setMembers] = useState<GroupMember[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [loading, setLoading] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<GroupMember | null>(null)

  const loadMembers = useCallback(async () => {
    try {
      const res = await api.get(`/groups/${groupId}/members`)
      setMembers(res.data.data as GroupMember[])
    } catch {
      toast.error('加载成员列表失败')
    }
  }, [groupId])

  const searchUsers = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults([])
      return
    }
    try {
      const res = await api.get('/users', { params: { keyword, page: 1, size: 20 } })
      const allUsers = res.data.data?.records ?? []
      const memberIds = new Set(members.map(m => m.user_id))
      const available = (allUsers as SearchUser[]).filter(u => !memberIds.has(u.id))
      setSearchResults(available)
    } catch {
      // 搜索静默失败
    }
  }, [members])

  useEffect(() => {
    if (open) {
      loadMembers()
      setSearchKeyword('')
      setSearchResults([])
    }
  }, [open, loadMembers])

  useEffect(() => {
    searchUsers(searchKeyword)
  }, [searchKeyword, searchUsers])

  const handleAdd = async (userId: number) => {
    setLoading(true)
    try {
      await api.post(`/groups/${groupId}/members`, { userId })
      toast.success('成员已加入')
      loadMembers()
    } catch (err: any) {
      toast.error(err.response?.data?.message || '加入失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setLoading(true)
    try {
      await api.delete(`/groups/${groupId}/members/${removeTarget.user_id}`)
      toast.success('成员已移除')
      setRemoveTarget(null)
      loadMembers()
    } catch (err: any) {
      toast.error(err.response?.data?.message || '移除失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{groupName} — 成员管理</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 min-h-[300px] max-h-[400px]">
          {/* Left: current members */}
          <div className="flex-1 border rounded-md flex flex-col">
            <div className="bg-muted px-3 py-2 text-sm font-medium border-b">
              当前成员 ({members.length})
            </div>
            <div className="flex-1 overflow-y-auto">
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">暂无成员</p>
              ) : (
                members.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between px-3 py-2 border-b last:border-0">
                    <div>
                      <span className="text-sm font-medium">{m.real_name || m.username}</span>
                      <span className="text-xs text-muted-foreground ml-1">@{m.username}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 h-auto px-1 py-0 text-xs"
                      disabled={loading}
                      onClick={() => setRemoveTarget(m)}
                    >
                      移除
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: search + add */}
          <div className="flex-1 flex flex-col gap-2">
            <Input
              placeholder="搜索用户..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex-1 border rounded-md overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {searchKeyword ? '无匹配用户' : '输入关键词搜索'}
                </p>
              ) : (
                searchResults.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-3 py-2 border-b last:border-0">
                    <div>
                      <span className="text-sm font-medium">{u.real_name || u.username}</span>
                      <span className="text-xs text-muted-foreground ml-1">@{u.username}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-500 h-auto px-1 py-0 text-xs"
                      disabled={loading}
                      onClick={() => handleAdd(u.id)}
                    >
                      加入
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Remove confirmation */}
      <Dialog open={!!removeTarget} onOpenChange={(o) => { if (!o) setRemoveTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认移除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要将 <strong>{removeTarget?.real_name || removeTarget?.username}</strong> 从 {groupName} 移除吗？
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>取消</Button>
            <Button className="bg-red-500 hover:bg-red-600" onClick={handleRemove}>移除</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
