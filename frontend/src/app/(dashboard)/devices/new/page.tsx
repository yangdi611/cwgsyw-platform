'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const DEVICE_TYPES = [
  { value: 'server',   label: '服务器' },
  { value: 'network',  label: '网络设备' },
  { value: 'security', label: '安全设备' },
  { value: 'cloud',    label: '云资源' },
  { value: 'other',    label: '其他' },
]

export default function NewDevicePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', ip: '', device_type: 'server', category: '', description: '',
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('请填写设备名称'); return }
    setLoading(true)
    try {
      await api.post('/devices', form)
      toast.success('设备已创建')
      router.push('/devices')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? '创建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">新增设备</h1>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>设备名称 *</Label>
          <Input value={form.name} onChange={set('name')} placeholder="例：生产数据库主机" required />
        </div>
        <div className="space-y-2">
          <Label>IP 地址</Label>
          <Input value={form.ip} onChange={set('ip')} placeholder="192.168.1.100" />
        </div>
        <div className="space-y-2">
          <Label>设备类型</Label>
          <select value={form.device_type} onChange={set('device_type')}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
            {DEVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>分类标签</Label>
          <Input value={form.category} onChange={set('category')} placeholder="例：数据库、核心网络" />
        </div>
        <div className="space-y-2">
          <Label>备注</Label>
          <Textarea value={form.description} onChange={set('description')} rows={3} />
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>{loading ? '创建中...' : '创建设备'}</Button>
          <Button type="button" variant="outline" onClick={() => router.push('/devices')}>取消</Button>
        </div>
      </form>
    </div>
  )
}
