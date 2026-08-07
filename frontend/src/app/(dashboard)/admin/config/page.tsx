'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from '@/components/design-system'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shared'
import { Mail, Bell, FileText } from 'lucide-react'

type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'

const WATERMARK_POSITION_LABELS: Record<WatermarkPosition, string> = {
  'top-left': '左上角',
  'top-right': '右上角',
  'bottom-left': '左下角',
  'bottom-right': '右下角',
  center: '居中',
}

const WATERMARK_POSITION_CLASSES: Record<WatermarkPosition, string> = {
  'top-left': 'left-4 top-4',
  'top-right': 'right-4 top-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  center: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
}

const tabs = [
  { id: 'smtp', label: '邮箱配置', icon: Mail },
  { id: 'monitoring', label: '监控集成', icon: Bell },
  { id: 'watermark', label: '文档水印', icon: FileText },
] as const

type TabId = (typeof tabs)[number]['id']

export default function AdminConfigPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabId>('smtp')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('notification', 'manage')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: config = {} } = useQuery<Record<string, string>>({
    queryKey: ['admin-config'],
    queryFn: () => api.get('/admin/config').then(r => r.data.data),
    enabled: hasPermission('notification', 'manage'),
  })

  // SMTP
  const [smtpEnabled, setSmtpEnabled] = useState(false)
  const [host, setHost] = useState('')
  const [port, setPort] = useState('465')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [from, setFrom] = useState('')
  const [fromName, setFromName] = useState('IT运维平台')
  const [ssl, setSsl] = useState(true)
  // Watermark
  const [watermarkEnabled, setWatermarkEnabled] = useState(false)
  const [watermarkText, setWatermarkText] = useState('')
  const [watermarkOpacity, setWatermarkOpacity] = useState('0.3')
  const [watermarkAngle, setWatermarkAngle] = useState('45')
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>('bottom-right')

  const [prometheusEnabled, setPrometheusEnabled] = useState(false)
  const [prometheusUrl, setPrometheusUrl] = useState('')
  const [prometheusInterval, setPrometheusInterval] = useState('60')

  // Initialize form state from config when it loads (one-time sync with guard)
  const [initialized, setInitialized] = useState(false)
  useEffect(() => {
    if (!config || Object.keys(config).length === 0 || initialized) return
    // Query data hydrates this editable form once; subsequent refetches must not overwrite user input.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSmtpEnabled(config['smtp.enabled'] === 'true')
    setHost(config['smtp.host'] ?? '')
    setPort(config['smtp.port'] ?? '465')
    setUsername(config['smtp.username'] ?? '')
    setPassword(config['smtp.password'] ?? '')
    setFrom(config['smtp.from'] ?? '')
    setFromName(config['smtp.from_name'] ?? 'IT运维平台')
    setSsl(config['smtp.ssl'] !== 'false')
    setWatermarkEnabled(config['watermark.enabled'] === 'true')
    setWatermarkText(config['watermark.text'] ?? '')
    setWatermarkOpacity(config['watermark.opacity'] ?? '0.3')
    setWatermarkAngle(config['watermark.angle'] ?? '45')
    setWatermarkPosition((config['watermark.position'] as WatermarkPosition) ?? 'bottom-right')
    setPrometheusEnabled(config['prometheus.enabled'] === 'true')
    setPrometheusUrl(config['prometheus.url'] ?? '')
    setPrometheusInterval(config['prometheus.scrape_interval'] ?? '60')
    setInitialized(true)
  }, [config, initialized])

  const smtpMutation = useMutation({
    mutationFn: () => api.put('/admin/config/smtp', { enabled: smtpEnabled, host, port: Number(port), username, password, from, fromName, ssl }),
    onSuccess: () => { toast.success('SMTP 配置已保存'); queryClient.invalidateQueries({ queryKey: ['admin-config'] }) },
    onError: () => toast.error('保存失败'),
  })

  const watermarkMutation = useMutation({
    mutationFn: () => api.put('/admin/config/watermark', {
      enabled: watermarkEnabled,
      text: watermarkText,
      opacity: Number(watermarkOpacity),
      angle: Number(watermarkAngle),
      position: watermarkPosition,
    }),
    onSuccess: () => { toast.success('水印配置已保存'); queryClient.invalidateQueries({ queryKey: ['admin-config'] }) },
    onError: () => toast.error('保存失败'),
  })

  const prometheusMutation = useMutation({
    mutationFn: () => api.put('/admin/config/prometheus', {
      enabled: prometheusEnabled,
      url: prometheusUrl,
      scrapeInterval: prometheusInterval,
    }),
    onSuccess: () => {
      toast.success('Prometheus 配置已保存')
      queryClient.invalidateQueries({ queryKey: ['admin-config'] })
    },
    onError: () => toast.error('保存失败'),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="系统管理"
        title="系统配置"
        subtitle="配置邮件服务、监控集成与文档水印等系统级参数。"
      />
      <div className="flex gap-6">
        {/* Left: Tab navigation */}
        <nav className="w-44 flex-shrink-0 space-y-1">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left
                  ${activeTab === tab.id
                    ? 'bg-v2-primary-soft text-v2-primary font-medium'
                    : 'text-v2-muted hover:bg-v2-surface-hover hover:text-v2-fg'
                  }`}
              >
                <Icon className="size-4 flex-shrink-0" />
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* Right: Configuration panels */}
        <div className="flex-1 min-w-0">

          {/* SMTP */}
          {activeTab === 'smtp' && (
            <div className="border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">邮件服务 (SMTP)</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch checked={smtpEnabled} onCheckedChange={setSmtpEnabled} id="smtp-enabled" />
                  <Label htmlFor="smtp-enabled">启用邮件发送</Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>SMTP 服务器</Label>
                    <Input value={host} onChange={e => setHost(e.target.value)} placeholder="smtp.example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>端口</Label>
                    <Input value={port} onChange={e => setPort(e.target.value)} placeholder="465" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>用户名</Label>
                    <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="user@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>密码</Label>
                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>发件人地址</Label>
                    <Input value={from} onChange={e => setFrom(e.target.value)} placeholder="noreply@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>发件人名称</Label>
                    <Input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="IT运维平台" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={ssl} onCheckedChange={setSsl} id="smtp-ssl" />
                  <Label htmlFor="smtp-ssl">使用 SSL</Label>
                </div>
                <Button size="default" variant="default" onClick={() => smtpMutation.mutate()} disabled={smtpMutation.isPending}>
                  保存 SMTP 配置
                </Button>
              </div>
            </div>
          )}

          {/* Monitoring */}
          {activeTab === 'monitoring' && (
            <div className="border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Prometheus 告警集成</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch checked={prometheusEnabled} onCheckedChange={setPrometheusEnabled} id="prometheus-enabled" />
                  <Label htmlFor="prometheus-enabled">启用 Prometheus 告警同步</Label>
                </div>
                <div className="space-y-1.5">
                  <Label>Prometheus 地址</Label>
                  <Input
                    value={prometheusUrl}
                    onChange={e => setPrometheusUrl(e.target.value)}
                    placeholder="http://prometheus:9090"
                  />
                  <p className="text-xs text-muted-foreground">Prometheus Server API 地址（无需尾部斜杠）</p>
                </div>
                <div className="space-y-1.5">
                  <Label>同步间隔（秒）</Label>
                  <Input
                    type="number"
                    min="10"
                    value={prometheusInterval}
                    onChange={e => setPrometheusInterval(e.target.value)}
                    placeholder="60"
                  />
                  <p className="text-xs text-muted-foreground">从 Prometheus 拉取告警的间隔时间</p>
                </div>
                <Button size="default" variant="default" onClick={() => prometheusMutation.mutate()} disabled={prometheusMutation.isPending}>
                  保存 Prometheus 配置
                </Button>
              </div>
            </div>
          )}

          {/* Watermark */}
          {activeTab === 'watermark' && (
            <div className="border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">文档水印</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch checked={watermarkEnabled} onCheckedChange={setWatermarkEnabled} id="watermark-enabled" />
                  <Label htmlFor="watermark-enabled">启用水印</Label>
                </div>
                <div className="space-y-1.5">
                  <Label>水印文字</Label>
                  <Input value={watermarkText} onChange={e => setWatermarkText(e.target.value)} placeholder="内部资料 请勿外传" />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>透明度 (0-1)</Label>
                    <Input type="number" min="0" max="1" step="0.05" value={watermarkOpacity} onChange={e => setWatermarkOpacity(e.target.value)} placeholder="0.3" />
                    <p className="text-xs text-muted-foreground">0 为完全透明，1 为完全不透明</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="watermark-angle">角度 (-180° 至 180°)</Label>
                    <Input
                      id="watermark-angle"
                      type="number"
                      min="-180"
                      max="180"
                      step="1"
                      value={watermarkAngle}
                      onChange={e => setWatermarkAngle(e.target.value)}
                      placeholder="45"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>水印位置</Label>
                    <Select value={watermarkPosition} onValueChange={v => setWatermarkPosition(v as WatermarkPosition)}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择位置">
                          {(v: WatermarkPosition) => WATERMARK_POSITION_LABELS[v] ?? '选择位置'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top-left">左上角</SelectItem>
                        <SelectItem value="top-right">右上角</SelectItem>
                        <SelectItem value="bottom-left">左下角</SelectItem>
                        <SelectItem value="bottom-right">右下角</SelectItem>
                        <SelectItem value="center">居中</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>即时预览</Label>
                  <div
                    data-testid="watermark-preview"
                    className="relative h-48 overflow-hidden rounded-lg border bg-v2-surface text-v2-muted"
                  >
                    <div className="absolute inset-4 rounded border border-dashed border-v2-border" />
                    {watermarkEnabled ? (
                      <span
                        data-testid="watermark-preview-text"
                        className={`absolute max-w-[80%] whitespace-nowrap font-semibold text-v2-fg ${WATERMARK_POSITION_CLASSES[watermarkPosition]}`}
                        style={{
                          opacity: Math.min(1, Math.max(0, Number(watermarkOpacity) || 0)),
                          rotate: `${Math.min(180, Math.max(-180, Number(watermarkAngle) || 0))}deg`,
                        }}
                      >
                        {watermarkText || 'IT运维平台'}
                      </span>
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-sm">水印已关闭</span>
                    )}
                  </div>
                </div>
                <Button size="default" variant="default" onClick={() => watermarkMutation.mutate()} disabled={watermarkMutation.isPending}>
                  保存水印配置
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
