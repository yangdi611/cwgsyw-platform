'use client'
import { useState, useEffect } from 'react'
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

/** Generate an RSA-OAEP key pair, returning null if Web Crypto is unavailable (HTTP non-localhost). */
async function genKeyPair(): Promise<CryptoKeyPair | null> {
  if (!window.crypto?.subtle) return null
  return window.crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  )
}

/** Export public key as base64 SPKI (what the backend expects). */
async function exportPubKey(kp: CryptoKeyPair): Promise<string> {
  const spki = await window.crypto.subtle.exportKey('spki', kp.publicKey)
  return btoa(String.fromCharCode(...new Uint8Array(spki)))
}

/** RSA-OAEP decrypt cipherBase64 with the private key. */
async function rsaDecrypt(cipherBase64: string, privateKey: CryptoKey): Promise<string> {
  const bytes = Uint8Array.from(atob(cipherBase64), (c) => c.charCodeAt(0))
  const plain = await window.crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, bytes)
  return new TextDecoder().decode(plain)
}

/**
 * Fetch the password for a credential.
 *
 * On HTTPS / localhost the full envelope-encryption path is used:
 *   1. Generate ephemeral RSA-OAEP key pair in the browser.
 *   2. Send public key to the backend with the reveal request.
 *   3. Backend encrypts the plaintext with the public key before sending.
 *   4. Decrypt locally — plaintext is never on the wire.
 *
 * On plain HTTP (dev LAN) Web Crypto is unavailable; falls back to the
 * existing plaintext path so the feature still works in dev.
 */
async function fetchPassword(credentialId: number): Promise<string> {
  const kp = await genKeyPair()
  if (kp) {
    const pubKey = await exportPubKey(kp)
    const res = await api.get(`/devices/credentials/${credentialId}/reveal`, {
      params: { clientPublicKey: pubKey },
    })
    return rsaDecrypt(res.data.data, kp.privateKey)
  }
  // Fallback: HTTP env without Web Crypto
  const res = await api.get(`/devices/credentials/${credentialId}/reveal`)
  return res.data.data
}

export function CredentialRow({ credentialId, username, description, onDeleted }: Props) {
  const [password, setPassword] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { hasPermission } = usePermission()
  const canReveal = hasPermission('device', 'view_password')
  const canDelete = hasPermission('device', 'delete')

  // Auto-clear revealed password after 30 s
  useEffect(() => {
    if (!password) return
    const t = setTimeout(() => setPassword(null), 30_000)
    return () => clearTimeout(t)
  }, [password])

  const reveal = async () => {
    if (password) { setPassword(null); return }
    setLoading(true)
    try {
      setPassword(await fetchPassword(credentialId))
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '获取密码失败')
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    try {
      const pwd = password ?? await fetchPassword(credentialId)
      // Don't call setPassword — keep it off-screen when copying silently
      try {
        await navigator.clipboard.writeText(pwd)
      } catch {
        const el = document.createElement('textarea')
        el.value = pwd
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
          <code className="text-sm bg-muted px-2 py-0.5 rounded select-all mr-1">{password}</code>
        ) : (
          <span className="text-sm text-v2-muted tracking-widest mr-2">••••••••</span>
        )}
        {canReveal && (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copy} title="复制密码">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={reveal} disabled={loading}
              title={password ? '隐藏密码' : '查看密码'}
            >
              {password ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </>
        )}
        {canDelete && (
          <Button
            variant="ghost" size="icon" className="h-7 w-7 text-v2-danger hover:text-v2-danger"
            onClick={deleteCred} disabled={deleting} title="删除账号"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
