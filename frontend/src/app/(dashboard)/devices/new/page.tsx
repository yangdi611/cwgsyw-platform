'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { CiInstanceSelect } from '@/components/cmdb/CiInstanceSelect'

export default function NewDevicePage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    ip: '',
    device_type: 'server',
    category: '',
    description: '',
    ci_instance_id: null as number | null,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/devices', form),
    onSuccess: (res) => {
      toast.success('设备已创建')
      router.push(`/devices/${res.data.data.id}`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '创建失败'),
  })

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/devices" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-2xl font-bold">新增设备</h1>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>设备名称 *</Label>
          <Input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="例：数据库服务器-01"
          />
        </div>

        <div className="space-y-1.5">
          <Label>IP 地址</Label>
          <Input
            value={form.ip}
            onChange={e => setForm(f => ({ ...f, ip: e.target.value }))}
            placeholder="例：192.168.1.100"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>设备类型</Label>
            <Select value={form.device_type} onValueChange={v => setForm(f => ({ ...f, device_type: v ?? 'server' }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="server">服务器</SelectItem>
                <SelectItem value="network">网络设备</SelectItem>
                <SelectItem value="security">安全设备</SelectItem>
                <SelectItem value="cloud">云资源</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>分类标签</Label>
            <Input
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              placeholder="例：生产环境、MySQL"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>备注</Label>
          <Textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="设备用途、位置等备注信息"
            rows={3}
          />
        </div>

        <div className="space-y-1.5">
          <Label>关联 CMDB 实例</Label>
          <CiInstanceSelect
            value={form.ci_instance_id}
            onChange={id => setForm(f => ({ ...f, ci_instance_id: id }))}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!form.name || createMutation.isPending}
          >
            {createMutation.isPending ? '创建中...' : '创建设备'}
          </Button>
          <Link href="/devices" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground h-9">
            取消
          </Link>
        </div>
      </div>
    </div>
  )
}
