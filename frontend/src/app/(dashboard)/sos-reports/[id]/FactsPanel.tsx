'use client'

import { useState } from 'react'
import type { SosFacts, SosReport } from '@/lib/sos-report-api'
import { factStrings } from '@/lib/sos-report-format'
import { Tabs } from '@/design-system/figma-neutral/components'
import { SosPanel } from '../SosPanel'
import { BmcFacts } from './BmcFacts'
import { Definitions, Section, Tags, type Definition } from './FactParts'
import { HardwareFacts } from './HardwareFacts'
import { NetworkFacts } from './NetworkFacts'
import { StorageFacts } from './StorageFacts'

const IDENTITY: Definition[] = [
  ['主机名', 'system.hostname'],
  ['完整域名', 'system.fqdn'],
  ['序列号', 'system.serialNumber'],
  ['系统 UUID', 'system.uuid'],
  ['厂商', 'system.manufacturer'],
  ['型号', 'system.productName'],
  ['产品系列', 'system.family'],
  ['主机类型', 'system.hostType'],
  ['机箱', 'chassis.type'],
  ['机箱高度', 'chassis.heightU', 'U'],
  ['资产标签', 'chassis.assetTag'],
  ['主板', 'baseboard.productName'],
  ['主板序列号', 'baseboard.serialNumber'],
  ['BIOS 版本', 'bios.version'],
  ['BIOS 日期', 'bios.releaseDate'],
  ['BMC IP', 'bmc.ipAddress'],
  ['BMC 固件', 'bmc.firmwareVersion'],
]

const OS: Definition[] = [
  ['发行版本', 'os.release'],
  ['内核', 'os.kernel'],
  ['架构', 'os.arch'],
  ['时区', 'os.timezone'],
  ['SELinux', 'os.selinux'],
  ['启动方式', 'os.bootMode'],
  ['安全启动', 'os.secureBoot', undefined, { enabled: '已开启', disabled: '未开启', unsupported: '不支持' }],
  ['安装日期（近似）', 'os.installDate'],
  ['软件包', 'software.packageCount', '个'],
]

const HARDWARE: Definition[] = [
  ['CPU 型号', 'cpu.model'],
  ['物理 CPU', 'cpu.sockets', '颗'],
  ['物理核心', 'cpu.cores', '核'],
  ['逻辑 CPU', 'cpu.threads', '线程'],
  ['实配内存', 'memory.installedGb', 'GB'],
  ['系统可用内存', 'memory.usableGb', 'GiB'],
  ['内存类型', 'memory.type'],
  ['内存速率', 'memory.speed'],
  ['内存插槽', 'memory.slotsTotal', '个'],
  ['已用插槽', 'memory.slotsUsed', '个'],
  ['最大支持内存', 'memory.maxCapacity'],
  ['交换分区', 'memory.swapGb', 'GB'],
  ['磁盘合计（系统可见）', 'storage.totalDiskGb', 'GB'],
]

const NETWORK: Definition[] = [
  ['主 IP', 'network.primaryIp'],
  ['主网卡', 'network.primaryInterface'],
  ['默认网关', 'network.defaultGateway'],
  ['全部 IPv4', 'network.ipv4Addresses'],
  ['全部 IPv6', 'network.ipv6Addresses'],
  ['DNS', 'network.dnsServers'],
  ['NTP', 'network.ntpServers'],
]

const CPU_DETAIL: Definition[] = [
  ['厂商', 'cpu.vendor'],
  ['家族', 'cpu.family'],
  ['型号编号', 'cpu.modelId'],
  ['步进', 'cpu.stepping'],
  ['最高主频', 'cpu.maxMhz', 'MHz'],
  ['每核线程', 'cpu.threadsPerCore'],
  ['NUMA 节点', 'cpu.numaNodes', '个'],
  ['虚拟化', 'cpu.virtualization'],
  ['L2 缓存', 'cpu.l2Cache'],
  ['L3 缓存', 'cpu.l3Cache'],
  ['微码版本', 'cpu.microcode'],
  ['内存纠错', 'memory.errorCorrection'],
  ['大页', 'memory.hugepagesTotal', '页'],
  ['透明大页', 'memory.transparentHugepage'],
]

const RUNTIME: Definition[] = [
  ['运行时长', 'os.uptime'],
  ['系统负载', 'os.loadAverage'],
  ['调优配置', 'os.tunedProfile'],
  ['kdump', 'os.kdumpStatus', undefined, { operational: '就绪', not_operational: '未就绪' }],
  ['防火墙', 'os.firewall', undefined, { running: '运行中', not_running: '未运行' }],
  ['内核污染标志', 'os.kernelTainted'],
  ['时钟已同步', 'os.ntpSynchronized'],
  ['时间同步服务', 'os.ntpService'],
  ['当前时间源', 'os.timeSource'],
  ['时钟偏差', 'os.timeOffset'],
]

function Overview({ facts }: { facts: SosFacts | undefined }) {
  return (
    <div className="cwgsyw-sos-report__sections">
      <Section title="健康">
        <Tags title="硬件与系统告警" values={factStrings(facts, 'health.issues')} empty="解析中没有发现告警" tone="danger" />
      </Section>
      <Section title="基本信息">
        <SosPanel title="主机身份"><Definitions facts={facts} items={IDENTITY} /></SosPanel>
        <SosPanel title="硬件"><Definitions facts={facts} items={HARDWARE} /></SosPanel>
        <SosPanel title="操作系统"><Definitions facts={facts} items={OS} /></SosPanel>
        <SosPanel title="网络"><Definitions facts={facts} items={NETWORK} /></SosPanel>
      </Section>
    </div>
  )
}

function SystemFacts({ facts }: { facts: SosFacts | undefined }) {
  return (
    <div className="cwgsyw-sos-report__sections">
      <Section title="系统">
        <SosPanel title="运行状态"><Definitions facts={facts} items={RUNTIME} /></SosPanel>
        <SosPanel title="CPU 与内存参数"><Definitions facts={facts} items={CPU_DETAIL} /></SosPanel>
        <Tags title="CPU 漏洞缓解" values={factStrings(facts, 'cpu.vulnerabilities')} empty="报告中没有 CPU 漏洞信息" hideWhenEmpty />
      </Section>
      <Section title="服务">
        <div className="cwgsyw-sos-report__split">
          <Tags title="失败的服务" values={factStrings(facts, 'software.failedServices')} empty="没有失败的服务" tone="danger" />
          <Tags title="运行中的服务" values={factStrings(facts, 'software.runningServices')} empty="报告中没有服务信息" />
        </div>
        <Tags title="开机自启的服务" values={factStrings(facts, 'software.enabledServices')} empty="报告中没有服务启用信息" hideWhenEmpty />
        <Tags title="已加载的内核模块" values={factStrings(facts, 'software.kernelModules')} empty="报告中没有内核模块信息" hideWhenEmpty />
      </Section>
    </div>
  )
}

export function FactsPanel({ report }: { report: SosReport }) {
  const facts = report.facts
  const [tab, setTab] = useState('overview')
  const issues = factStrings(facts, 'health.issues').length

  return (
    <div className="cwgsyw-sos-report__facts-tabs">
      <Tabs
        style="underline"
        size="sm"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: issues > 0 ? `概览（${issues} 项告警）` : '概览', panel: <Overview facts={facts} /> },
          { id: 'hardware', label: '硬件部件', panel: <HardwareFacts facts={facts} /> },
          { id: 'storage', label: '存储', panel: <StorageFacts facts={facts} /> },
          { id: 'network', label: '网络', panel: <NetworkFacts facts={facts} /> },
          { id: 'bmc', label: 'BMC 与传感器', panel: <BmcFacts facts={facts} /> },
          { id: 'system', label: '系统与软件', panel: <SystemFacts facts={facts} /> },
        ]}
      />
    </div>
  )
}
