'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import { useRouter } from 'next/navigation'

type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'

export default function AdminConfigPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!hasPermission('notification', 'manage')) router.replace('/')
  }, [hasPermission, router])

  const { data: config = {} } = useQuery<Record<string, string>>({
    queryKey: ['admin-config'],
    queryFn: () => api.get('/admin/config').then(r => r.data.data),
    enabled: hasPermission('notification', 'manage'),
  })

  const [smtpEnabled, setSmtpEnabled] = useState(false)
  const [host, setHost] = useState('')
  const [port, setPort] = useState('465')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [from, setFrom] = useState('')
  const [fromName, setFromName] = useState('IT运维平台')
  const [ssl, setSsl] = useState(true)

  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderCron, setReminderCron] = useState('0 0 17 * * MON-FRI')
  const [reminderTemplate, setReminderTemplate] = useState('')

  const [watermarkEnabled, setWatermarkEnabled] = useState(false)
  const [watermarkText, setWatermarkText] = useState('')
  const [watermarkOpacity, setWatermarkOpacity] = useState('0.3')
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>('bottom-right')

  const [prometheusEnabled, setPrometheusEnabled] = useState(false)
  const [prometheusUrl, setPrometheusUrl] = useState('')
  const [prometheusInterval, setPrometheusInterval] = useState('60')

  useEffect(() => {
    if (!config || Object.keys(config).length === 0) return
    setSmtpEnabled(config['smtp.enabled'] === 'true')
    setHost(config['smtp.host'] ?? '')
    setPort(config['smtp.port'] ?? '465')
    setUsername(config['smtp.username'] ?? '')
    setPassword(config['smtp.password'] ?? '')
    setFrom(config['smtp.from'] ?? '')
    setFromName(config['smtp.from_name'] ?? 'IT运维平台')
    setSsl(config['smtp.ssl'] !== 'false')
    setReminderEnabled(config['notify.reminder.enabled'] === 'true')
    setReminderCron(config['notify.reminder.cron'] ?? '0 0 17 * * MON-FRI')
    setReminderTemplate(config['notify.reminder.template'] ?? '')
    setWatermarkEnabled(config['watermark.enabled'] === 'true')
    setWatermarkText(config['watermark.text'] ?? '')
    setWatermarkOpacity(config['watermark.opacity'] ?? '0.3')
    setWatermarkPosition((config['watermark.position'] as WatermarkPosition) ?? 'bottom-right')
    setPrometheusEnabled(config['prometheus.enabled'] === 'true')
    setPrometheusUrl(config['prometheus.url'] ?? '')
    setPrometheusInterval(config['prometheus.scrape_interval'] ?? '60')
  }, [config])

  const smtpMutation = useMutation({
    mutationFn: () => api.put('/admin/config/smtp', {
      enabled: smtpEnabled,
      host,
      port: Number(port),
      username,
      password,
      from,
      from_name: fromName,
      ssl,
    }),
    onSuccess: () => {
      toast.success('SMTP 配置已保存')
      queryClient.invalidateQueries({ queryKey: ['admin-config'] })
    },
    onError: () => toast.error('保存失败'),
  })

  const notifyMutation = useMutation({
    mutationFn: () => api.put('/admin/config/notification', {
      reminder_enabled: reminderEnabled,
      reminder_cron: reminderCron,
      reminder_template: reminderTemplate,
    }),
    onSuccess: () => {
      toast.success('提醒配置已保存')
      queryClient.invalidateQueries({ queryKey: ['admin-config'] })
    },
    onError: () => toast.error('保存失败'),
  })

  const watermarkMutation = useMutation({
    mutationFn: () => api.put('/admin/config/watermark', {
      enabled: watermarkEnabled,
      text: watermarkText,
      opacity: Number(watermarkOpacity),
      position: watermarkPosition,
    }),
    onSuccess: () => {
      toast.success('水印配置已保存')
      queryClient.invalidateQueries({ queryKey: ['admin-config'] })
    },
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
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">系统配置</h1>

      {/* SMTP */}
      <section className="border rounded-lg p-6 mb-6">
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
          <Button onClick={() => smtpMutation.mutate()} disabled={smtpMutation.isPending}>
            保存 SMTP 配置
          </Button>
        </div>
      </section>

      {/* Reminder */}
      <section className="border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">日报提醒</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={reminderEnabled} onCheckedChange={setReminderEnabled} id="reminder-enabled" />
            <Label htmlFor="reminder-enabled">启用日报提醒</Label>
          </div>
          <div className="space-y-1.5">
            <Label>提醒时间 (Spring Cron)</Label>
            <Input
              value={reminderCron}
              onChange={e => setReminderCron(e.target.value)}
              placeholder="0 0 17 * * MON-FRI"
            />
            <p className="text-xs text-muted-foreground">示例：0 0 17 * * MON-FRI（每工作日 17:00）</p>
          </div>
          <div className="space-y-1.5">
            <Label>提醒消息内容</Label>
            <Textarea
              value={reminderTemplate}
              onChange={e => setReminderTemplate(e.target.value)}
              rows={3}
              placeholder="您今日尚未提交工作日报，请尽快填写。"
            />
          </div>
          <Button onClick={() => notifyMutation.mutate()} disabled={notifyMutation.isPending}>
            保存提醒配置
          </Button>
        </div>
      </section>

      {/* Prometheus */}
      <section className="border rounded-lg p-6 mb-6">
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
          <Button onClick={() => prometheusMutation.mutate()} disabled={prometheusMutation.isPending}>
            保存 Prometheus 配置
          </Button>
        </div>
      </section>

      {/* Watermark */}
      <section className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">文档水印</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={watermarkEnabled} onCheckedChange={setWatermarkEnabled} id="watermark-enabled" />
            <Label htmlFor="watermark-enabled">启用水印</Label>
          </div>
          <div className="space-y-1.5">
            <Label>水印文字</Label>
            <Input
              value={watermarkText}
              onChange={e => setWatermarkText(e.target.value)}
              placeholder="内部资料 请勿外传"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>透明度 (0-1)</Label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={watermarkOpacity}
                onChange={e => setWatermarkOpacity(e.target.value)}
                placeholder="0.3"
              />
              <p className="text-xs text-muted-foreground">0 为完全透明，1 为完全不透明</p>
            </div>
            <div className="space-y-1.5">
              <Label>水印位置</Label>
              <Select value={watermarkPosition} onValueChange={v => setWatermarkPosition(v as WatermarkPosition)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择位置" />
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
          <Button onClick={() => watermarkMutation.mutate()} disabled={watermarkMutation.isPending}>
            保存水印配置
          </Button>
        </div>
      </section>
    </div>
  )
}
