'use client'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus, Server, Network, Shield, Cloud, HardDrive } from 'lucide-react'
import { PermissionGuard } from '@/components/shared/PermissionGuard'

interface Device {
  id: number
  name: string
  ip: string
  device_type: string
  category: string
  group_name: string
  description: string
}

const typeConfig: Record<string, { label: string; icon: React.ElementType }> = {
  server:   { label: '服务器',   icon: Server },
  network:  { label: '网络设备', icon: Network },
  security: { label: '安全设备', icon: Shield },
  cloud:    { label: '云资源',   icon: Cloud },
  other:    { label: '其他',     icon: HardDrive },
}

export default function DevicesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.get('/devices').then(r => r.data.data.records as Device[]),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">设备密码库</h1>
        <PermissionGuard resource="device" action="create">
          <Link href="/devices/new" className={buttonVariants({ variant: 'default', size: 'sm' })}>
            <Plus className="h-4 w-4 mr-1" />新增设备
          </Link>
        </PermissionGuard>
      </div>

      {isLoading ? <p className="text-muted-foreground">加载中...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data ?? []).map(device => {
            const tc = typeConfig[device.device_type] ?? typeConfig.other
            const Icon = tc.icon
            return (
              <Link key={device.id} href={`/devices/${device.id}`}
                className="p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors block">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-md mt-0.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{device.name}</span>
                      <Badge variant="outline" className="text-xs">{tc.label}</Badge>
                      {device.category && (
                        <Badge variant="secondary" className="text-xs">{device.category}</Badge>
                      )}
                    </div>
                    {device.ip && <p className="text-sm text-muted-foreground mt-0.5">{device.ip}</p>}
                    {device.group_name && (
                      <p className="text-xs text-muted-foreground mt-1">{device.group_name}</p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
          {(data ?? []).length === 0 && (
            <p className="text-muted-foreground col-span-2 text-center py-12">
              暂无设备，点击右上角新增
            </p>
          )}
        </div>
      )}
    </div>
  )
}
