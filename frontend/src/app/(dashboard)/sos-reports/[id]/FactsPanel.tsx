'use client'

import type { ReactNode } from 'react'
import type { SosReport } from '@/lib/sos-report-api'
import { fact, factRows, factStrings, formatValue } from '@/lib/sos-report-format'
import { Chip, Table } from '@/design-system/figma-neutral/components'
import { SosPanel } from '../SosPanel'

type Definition = [label: string, key: string, unit?: string]

const IDENTITY: Definition[] = [
  ['主机名', 'system.hostname'],
  ['序列号', 'system.serialNumber'],
  ['系统 UUID', 'system.uuid'],
  ['厂商', 'system.manufacturer'],
  ['型号', 'system.productName'],
  ['主机类型', 'system.hostType'],
  ['主板', 'baseboard.productName'],
  ['BIOS 版本', 'bios.version'],
  ['BIOS 日期', 'bios.releaseDate'],
]

const OS: Definition[] = [
  ['发行版本', 'os.release'],
  ['内核', 'os.kernel'],
  ['架构', 'os.arch'],
  ['时区', 'os.timezone'],
  ['SELinux', 'os.selinux'],
  ['启动方式', 'os.bootMode'],
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
  ['内存插槽', 'memory.slotsTotal', '个'],
  ['已用插槽', 'memory.slotsUsed', '个'],
  ['交换分区', 'memory.swapGb', 'GB'],
  ['磁盘合计（系统可见）', 'storage.totalDiskGb', 'GB'],
]

const NETWORK: Definition[] = [
  ['主 IP', 'network.primaryIp'],
  ['主网卡', 'network.primaryInterface'],
  ['默认网关', 'network.defaultGateway'],
  ['全部 IPv4', 'network.ipv4Addresses'],
  ['DNS', 'network.dnsServers'],
  ['NTP', 'network.ntpServers'],
]

function Definitions({ facts, items }: { facts: SosReport['facts']; items: Definition[] }) {
  return (
    <dl className="cwgsyw-devices-defs">
      {items.map(([label, key, unit]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>{formatValue(fact(facts, key), unit)}</dd>
        </div>
      ))}
    </dl>
  )
}

function FactTable({ title, columns, rows, empty }: {
  title: string
  columns: { key: string; label: string }[]
  rows: Record<string, unknown>[]
  empty: string
}) {
  return (
    <SosPanel title={title} flush>
      <Table
        className="cwgsyw-cmdb-table"
        density="compact"
        showSearch={false}
        columns={columns}
        rows={rows.map((row, index) => ({
          id: String(index),
          cells: Object.fromEntries(columns.map((column) => [column.key, formatValue(row[column.key])])) as Record<string, ReactNode>,
        }))}
        state={rows.length === 0 ? 'empty' : 'data'}
        empty={empty}
      />
    </SosPanel>
  )
}

function Tags({ title, values, empty, tone }: { title: string; values: string[]; empty: string; tone?: 'danger' }) {
  return (
    <SosPanel title={`${title}（${values.length}）`}>
      {values.length === 0 ? (
        <p className="cwgsyw-sos-report__note">{empty}</p>
      ) : (
        <div className="cwgsyw-sos-report__tags">
          {values.map((value) => <Chip key={value} label={value} tone={tone} />)}
        </div>
      )}
    </SosPanel>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="cwgsyw-sos-report__stack">
      <h2 className="cwgsyw-sos-report__section-title">{title}</h2>
      {children}
    </section>
  )
}

export function FactsPanel({ report }: { report: SosReport }) {
  const facts = report.facts
  const bonds = factRows(facts, 'network.bonds').map((bond) => ({
    ...bond,
    memberNames: Array.isArray(bond.members)
      ? (bond.members as Record<string, unknown>[]).map((member) => `${String(member.name)}（${String(member.status ?? '未知')}）`)
      : [],
  }))
  const interfaces = factRows(facts, 'network.interfaces')
  const failed = factStrings(facts, 'software.failedServices')

  return (
    <div className="cwgsyw-sos-report__sections">
      <Section title="基本信息">
        <SosPanel title="主机身份"><Definitions facts={facts} items={IDENTITY} /></SosPanel>
        <SosPanel title="硬件"><Definitions facts={facts} items={HARDWARE} /></SosPanel>
        <SosPanel title="操作系统"><Definitions facts={facts} items={OS} /></SosPanel>
        <SosPanel title="网络"><Definitions facts={facts} items={NETWORK} /></SosPanel>
      </Section>
      <Section title="网络与存储明细">
        <FactTable
          title="网卡"
          columns={[
            { key: 'name', label: '名称' },
            { key: 'master', label: '所属 bond' },
            { key: 'mac', label: 'MAC' },
            { key: 'ipv4', label: 'IPv4' },
            { key: 'speed', label: '速率' },
            { key: 'linkDetected', label: '链路' },
            { key: 'driver', label: '驱动' },
            { key: 'firmware', label: '固件' },
          ]}
          rows={interfaces}
          empty="报告中没有网卡信息"
        />
        <FactTable
          title="Bond"
          columns={[
            { key: 'name', label: '名称' },
            { key: 'mode', label: '模式' },
            { key: 'status', label: '状态' },
            { key: 'memberNames', label: '成员' },
          ]}
          rows={bonds}
          empty="没有配置 bond"
        />
        <FactTable
          title="磁盘"
          columns={[
            { key: 'name', label: '名称' },
            { key: 'sizeGb', label: '容量 (GB)' },
            { key: 'type', label: '类型' },
            { key: 'vendor', label: '厂商' },
            { key: 'model', label: '型号' },
            { key: 'serial', label: '序列号' },
          ]}
          rows={factRows(facts, 'storage.disks')}
          empty="报告中没有磁盘信息"
        />
        <FactTable
          title="文件系统"
          columns={[
            { key: 'mountPoint', label: '挂载点' },
            { key: 'device', label: '设备' },
            { key: 'sizeGb', label: '容量 (GB)' },
            { key: 'usedPercent', label: '使用率' },
          ]}
          rows={factRows(facts, 'storage.filesystems')}
          empty="报告中没有文件系统信息"
        />
        <FactTable
          title="软 RAID"
          columns={[
            { key: 'name', label: '名称' },
            { key: 'level', label: '级别' },
            { key: 'state', label: '状态' },
            { key: 'members', label: '成员盘' },
          ]}
          rows={factRows(facts, 'storage.softwareRaids')}
          empty="没有软 RAID"
        />
        <FactTable
          title="监听端口"
          columns={[
            { key: 'protocol', label: '协议' },
            { key: 'address', label: '地址' },
            { key: 'port', label: '端口' },
            { key: 'process', label: '进程' },
          ]}
          rows={factRows(facts, 'network.listeningPorts')}
          empty="报告中没有监听端口信息"
        />
      </Section>
      <Section title="服务">
        <div className="cwgsyw-sos-report__split">
          <Tags title="失败的服务" values={failed} empty="没有失败的服务" tone="danger" />
          <Tags title="运行中的服务" values={factStrings(facts, 'software.runningServices')} empty="报告中没有服务信息" />
        </div>
      </Section>
    </div>
  )
}
