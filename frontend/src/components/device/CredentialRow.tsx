'use client'
import { useState } from 'react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Eye, EyeOff, Copy } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface Props {
  credentialId: number
  username: string
  description?: string
}

export function CredentialRow({ credentialId, username, description }: Props) {
  const [password, setPassword] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { hasPermission } = usePermission()
  const canReveal = hasPermission('device', 'view_password')

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

  const copy = () => {
    if (password) {
      navigator.clipboard.writeText(password)
      toast.success('已复制到剪贴板')
    }
  }

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div>
        <span className="font-medium text-sm">{username}</span>
        {description && <span className="text-xs text-muted-foreground ml-2">{description}</span>}
      </div>
      <div className="flex items-center gap-2">
        {password ? (
          <>
            <code className="text-sm bg-muted px-2 py-0.5 rounded select-all">{password}</code>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copy}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <span className="text-sm text-muted-foreground tracking-widest">••••••••</span>
        )}
        {canReveal && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reveal} disabled={loading}>
            {password ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
    </div>
  )
}
