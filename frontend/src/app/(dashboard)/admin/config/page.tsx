'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/design-system/figma-neutral/toast'
import api from '@/lib/api'
import { usePermission } from '@/hooks/usePermission'
import '@/design-system/figma-neutral/index.css'
import {
  Button,
  Card,
  Field,
  FormSettingsPage,
  Input,
  PageHeader,
  Select,
  Switch,
  Tabs,
} from '@/design-system/figma-neutral/components'

type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
type TabId = 'smtp' | 'monitoring' | 'watermark'

const WATERMARK_POSITION_LABELS: Record<WatermarkPosition, string> = {
  'top-left': '左上角',
  'top-right': '右上角',
  'bottom-left': '左下角',
  'bottom-right': '右下角',
  center: '居中',
}

export default function AdminConfigPage() {
  const { hasPermission, isHydrated } = usePermission()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('smtp')

  useEffect(() => {
    if (!isHydrated) return
    if (!hasPermission('notification', 'manage')) router.replace('/')
  }, [isHydrated, hasPermission, router])

  const { data: config } = useQuery<Record<string, string>>({
    queryKey: ['admin-config'],
    queryFn: () => api.get('/admin/config').then((r) => r.data.data),
    enabled: hasPermission('notification', 'manage'),
  })

  return (
    <AdminConfigForm
      key={config ? 'loaded' : 'loading'}
      config={config ?? {}}
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
    />
  )
}

interface AdminConfigFormProps {
  config: Record<string, string>
  activeTab: TabId
  onActiveTabChange: (tab: TabId) => void
}

function AdminConfigForm({ config, activeTab, onActiveTabChange }: AdminConfigFormProps) {
  const queryClient = useQueryClient()

  const [smtpEnabled, setSmtpEnabled] = useState(config['smtp.enabled'] === 'true')
  const [host, setHost] = useState(config['smtp.host'] ?? '')
  const [port, setPort] = useState(config['smtp.port'] ?? '465')
  const [username, setUsername] = useState(config['smtp.username'] ?? '')
  const [password, setPassword] = useState(config['smtp.password'] ?? '')
  const [from, setFrom] = useState(config['smtp.from'] ?? '')
  const [fromName, setFromName] = useState(config['smtp.from_name'] ?? 'IT运维平台')
  const [ssl, setSsl] = useState(config['smtp.ssl'] !== 'false')
  const [watermarkEnabled, setWatermarkEnabled] = useState(config['watermark.enabled'] === 'true')
  const [watermarkText, setWatermarkText] = useState(config['watermark.text'] ?? '')
  const [watermarkOpacity, setWatermarkOpacity] = useState(config['watermark.opacity'] ?? '0.3')
  const [watermarkAngle, setWatermarkAngle] = useState(config['watermark.angle'] ?? '45')
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>((config['watermark.position'] as WatermarkPosition) ?? 'bottom-right')
  const [prometheusEnabled, setPrometheusEnabled] = useState(config['prometheus.enabled'] === 'true')
  const [prometheusUrl, setPrometheusUrl] = useState(config['prometheus.url'] ?? '')
  const [prometheusInterval, setPrometheusInterval] = useState(config['prometheus.scrape_interval'] ?? '60')

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
    <FormSettingsPage
      embedded
      className="cwgsyw-admin-config"
      header={
        <PageHeader
          showEyebrow={false}
          showBreadcrumb={false}
          title="系统配置"
          subtitle="配置邮件服务、监控集成与文档水印等系统级参数。"
        />
      }
      form={
        <Tabs
          style="cmdb"
          size="sm"
          value={activeTab}
          onChange={(value) => onActiveTabChange(value as TabId)}
          items={[
            {
              id: 'smtp',
              label: '邮箱配置',
              panel: (
                <Card title="邮件服务 (SMTP)">
                  <div className="cwgsyw-form">
                    <Switch id="smtp-enabled" label="启用邮件发送" checked={smtpEnabled} onChange={(event) => setSmtpEnabled(event.target.checked)} />
                    <div className="cwgsyw-filter-grid">
                      <Field label="SMTP 服务器">
                        <Input value={host} onChange={(event) => setHost(event.target.value)} placeholder="smtp.example.com" />
                      </Field>
                      <Field label="端口">
                        <Input value={port} onChange={(event) => setPort(event.target.value)} placeholder="465" />
                      </Field>
                      <Field label="用户名">
                        <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="user@example.com" />
                      </Field>
                      <Field label="密码">
                        <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
                      </Field>
                      <Field label="发件人地址">
                        <Input value={from} onChange={(event) => setFrom(event.target.value)} placeholder="noreply@example.com" />
                      </Field>
                      <Field label="发件人名称">
                        <Input value={fromName} onChange={(event) => setFromName(event.target.value)} placeholder="IT运维平台" />
                      </Field>
                    </div>
                    <Switch id="smtp-ssl" label="使用 SSL" checked={ssl} onChange={(event) => setSsl(event.target.checked)} />
                    <Button type="button" size="sm" onClick={() => smtpMutation.mutate()} disabled={smtpMutation.isPending}>保存 SMTP 配置</Button>
                  </div>
                </Card>
              ),
            },
            {
              id: 'monitoring',
              label: '监控集成',
              panel: (
                <Card title="Prometheus 告警集成">
                  <div className="cwgsyw-form">
                    <Switch id="prometheus-enabled" label="启用 Prometheus 告警同步" checked={prometheusEnabled} onChange={(event) => setPrometheusEnabled(event.target.checked)} />
                    <Field label="Prometheus 地址" helperText="Prometheus Server API 地址（无需尾部斜杠）">
                      <Input value={prometheusUrl} onChange={(event) => setPrometheusUrl(event.target.value)} placeholder="http://prometheus:9090" />
                    </Field>
                    <Field label="同步间隔（秒）" helperText="从 Prometheus 拉取告警的间隔时间">
                      <Input type="number" min={10} value={prometheusInterval} onChange={(event) => setPrometheusInterval(event.target.value)} placeholder="60" />
                    </Field>
                    <Button type="button" size="sm" onClick={() => prometheusMutation.mutate()} disabled={prometheusMutation.isPending}>保存 Prometheus 配置</Button>
                  </div>
                </Card>
              ),
            },
            {
              id: 'watermark',
              label: '文档水印',
              panel: (
                <Card title="文档水印">
                  <div className="cwgsyw-form">
                    <Switch id="watermark-enabled" label="启用水印" checked={watermarkEnabled} onChange={(event) => setWatermarkEnabled(event.target.checked)} />
                    <Field label="水印文字">
                      <Input value={watermarkText} onChange={(event) => setWatermarkText(event.target.value)} placeholder="内部资料 请勿外传" />
                    </Field>
                    <div className="cwgsyw-filter-grid">
                      <Field label="透明度 (0-1)" helperText="0 为完全透明，1 为完全不透明">
                        <Input type="number" min={0} max={1} step="0.05" value={watermarkOpacity} onChange={(event) => setWatermarkOpacity(event.target.value)} placeholder="0.3" />
                      </Field>
                      <Field label="角度 (-180° 至 180°)">
                        <Input id="watermark-angle" type="number" min={-180} max={180} step={1} value={watermarkAngle} onChange={(event) => setWatermarkAngle(event.target.value)} placeholder="45" />
                      </Field>
                      <Field label="水印位置">
                        <Select
                          value={watermarkPosition}
                          onChange={(value) => setWatermarkPosition(value as WatermarkPosition)}
                          options={(Object.keys(WATERMARK_POSITION_LABELS) as WatermarkPosition[]).map((value) => ({ value, label: WATERMARK_POSITION_LABELS[value] }))}
                        />
                      </Field>
                    </div>
                    <Field label="即时预览">
                      <div data-testid="watermark-preview" className="cwgsyw-watermark-preview">
                        <div className="cwgsyw-watermark-preview__frame" />
                        {watermarkEnabled ? (
                          <span
                            data-testid="watermark-preview-text"
                            className="cwgsyw-watermark-preview__text"
                            data-position={watermarkPosition}
                            style={{
                              opacity: Math.min(1, Math.max(0, Number(watermarkOpacity) || 0)),
                              rotate: `${Math.min(180, Math.max(-180, Number(watermarkAngle) || 0))}deg`,
                            }}
                          >
                            {watermarkText || 'IT运维平台'}
                          </span>
                        ) : (
                          <span className="cwgsyw-watermark-preview__off">水印已关闭</span>
                        )}
                      </div>
                    </Field>
                    <Button type="button" size="sm" onClick={() => watermarkMutation.mutate()} disabled={watermarkMutation.isPending}>保存水印配置</Button>
                  </div>
                </Card>
              ),
            },
          ]}
        />
      }
    />
  )
}
