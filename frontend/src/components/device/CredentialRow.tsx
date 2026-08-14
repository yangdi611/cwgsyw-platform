'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/design-system/figma-neutral/toast'
import { getApiErrorMessage } from '@/lib/api-error'
import { usePermission } from '@/hooks/usePermission'
import {
  Button,
  Input,
  NeutralAlertDialog,
} from '@/design-system/figma-neutral/components'

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
  const res = await api.get(`/devices/credentials/${credentialId}/reveal`)
  return res.data.data
}

export function CredentialRow({ credentialId, username, description, onDeleted }: Props) {
  const [password, setPassword] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editUsername, setEditUsername] = useState(username)
  const [editPassword, setEditPassword] = useState('')
  const [editDescription, setEditDescription] = useState(description ?? '')
  const { hasPermission } = usePermission()
  const canReveal = hasPermission('device', 'view_password')
  const canDelete = hasPermission('device', 'delete')
  const canUpdate = hasPermission('device', 'update')

  useEffect(() => {
    if (!password) return
    const timer = setTimeout(() => setPassword(null), 30_000)
    return () => clearTimeout(timer)
  }, [password])

  const reveal = async () => {
    if (password) {
      setPassword(null)
      return
    }
    setLoading(true)
    try {
      setPassword(await fetchPassword(credentialId))
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '获取密码失败'))
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    try {
      const nextPassword = password ?? await fetchPassword(credentialId)
      try {
        await navigator.clipboard.writeText(nextPassword)
      } catch {
        const element = document.createElement('textarea')
        element.value = nextPassword
        element.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
        document.body.appendChild(element)
        element.select()
        document.execCommand('copy')
        document.body.removeChild(element)
      }
      toast.success('密码已复制到剪贴板')
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '获取密码失败'))
    }
  }

  const deleteCred = async () => {
    setDeleting(true)
    try {
      await api.delete(`/devices/credentials/${credentialId}`)
      toast.success('账号已删除')
      setConfirmDelete(false)
      onDeleted?.()
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '删除失败'))
    } finally {
      setDeleting(false)
    }
  }

  const saveEdit = async () => {
    try {
      await api.put(`/devices/credentials/${credentialId}`, {
        username: editUsername,
        password: editPassword || undefined,
        description: editDescription,
      })
      toast.success('账号已更新')
      setEditPassword('')
      setEditing(false)
      onDeleted?.()
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '更新失败'))
    }
  }

  return (
    <div className="cwgsyw-stack-list__item">
      <div>
        {editing ? (
          <div className="cwgsyw-inline-controls">
            <Input value={editUsername} maxLength={128} onChange={(event) => setEditUsername(event.target.value)} />
            <Input type="password" value={editPassword} maxLength={1024} placeholder="留空不修改密码" onChange={(event) => setEditPassword(event.target.value)} />
            <Input value={editDescription} maxLength={255} placeholder="备注" onChange={(event) => setEditDescription(event.target.value)} />
            <Button type="button" variant="secondary" size="sm" disabled={!editUsername} onClick={saveEdit}>
              保存
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setEditPassword('') }}>
              取消
            </Button>
          </div>
        ) : (
          <span>
            <strong>{username}</strong>
            {description ? <span className="cwgsyw-type-label-xs"> {description}</span> : null}
          </span>
        )}
      </div>
      <div className="cwgsyw-inline-controls">
        {password ? <code className="cwgsyw-type-body-sm">{password}</code> : <span className="cwgsyw-type-label-sm">••••••••</span>}
        {canReveal ? (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={copy}>
              复制
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={reveal}>
              {password ? '隐藏' : '查看'}
            </Button>
          </>
        ) : null}
        {canUpdate && !editing ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            编辑
          </Button>
        ) : null}
        {canDelete ? (
          <Button type="button" variant="ghost" size="sm" leadingIcon="trash" disabled={deleting} onClick={() => setConfirmDelete(true)}>
            删除
          </Button>
        ) : null}
      </div>
      <NeutralAlertDialog
        open={confirmDelete}
        title="确认删除"
        description={`确定要删除账号 “${username}” 吗？`}
        intent="destructive"
        confirmLabel="删除"
        onConfirm={deleteCred}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(false)
        }}
      />
    </div>
  )
}
