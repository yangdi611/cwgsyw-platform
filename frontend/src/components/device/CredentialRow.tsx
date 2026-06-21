'use client'
import { useState } from 'react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Eye, EyeOff, Copy, Trash2 } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface Props {
  credentialId: number
  username: string
  description?: string
  onDeleted?: () => void
}

export function CredentialRow({ credentialId, username, description, onDeleted }: Props) {
  const [password, setPassword] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { hasPermission } = usePermission()
  const canReveal = hasPermission('device', 'view_password')
  const canDelete = hasPermission('device', 'delete')

  const reveal = async () => {
    if (password) { setPassword(null); return }
    setLoading(true)
    try {
      const res = await api.get(`/devices/credentials/${credentialId}/reveal`)
      setPassword(res.data.data)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '获取密码失败')
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    try {
      let pwd = password
      if (!pwd) {
        const res = await api.get(`/devices/credentials/${credentialId}/reveal`)
        pwd = res.data.data
        // intentionally NOT calling setPassword — don't expose on screen
      }
      // Try modern clipboard API, fall back to execCommand for HTTP (non-HTTPS) environments
      try {
        await navigator.clipboard.writeText(pwd!)
      } catch {
        const el = document.createElement('textarea')
        el.value = pwd!
        el.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
      toast.success('密码已复制到剪贴板')
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '获取密码失败')
    }
  }

  const deleteCred = async () => {
    if (!confirm(`确定要删除账号 "${username}" 吗？`)) return
    setDeleting(true)
    try {
      await api.delete(`/devices/credentials/${credentialId}`)
      toast.success('账号已删除')
      onDeleted?.()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div>
        <span className="font-medium text-sm">{username}</span>
        {description && <span className="text-xs text-v2-muted ml-2">{description}</span>}
      </div>
      <div className="flex items-center gap-1">
        {password ? (
          <>
            <code className="text-sm bg-muted px-2 py-0.5 rounded select-all mr-1">{password}</code>
          </>
        ) : (
          <span className="text-sm text-v2-muted tracking-widest mr-2">••••••••</span>
        )}
        {/* Copy button — always visible, auto-reveals if needed */}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copy} title="复制密码">
          <Copy className="h-3.5 w-3.5" />
        </Button>
        {canReveal && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reveal} disabled={loading} title={password ? '隐藏密码' : '查看密码'}>
            {password ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        )}
        {canDelete && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-v2-danger hover:text-v2-danger" onClick={deleteCred} disabled={deleting} title="删除账号">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
