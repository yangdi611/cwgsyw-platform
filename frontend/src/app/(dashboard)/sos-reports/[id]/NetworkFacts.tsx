'use client'

import type { SosFacts } from '@/lib/sos-report-api'
import { factRows } from '@/lib/sos-report-format'
import { FactTable, Section, type FactRow } from './FactParts'

function transceiverRows(interfaces: FactRow[]): FactRow[] {
  return interfaces.flatMap((row) => {
    const transceiver = row.transceiver
    if (!transceiver || typeof transceiver !== 'object') return []
    return [{ name: row.name, ...(transceiver as FactRow) }]
  })
}

export function NetworkFacts({ facts }: { facts: SosFacts | undefined }) {
  const bonds = factRows(facts, 'network.bonds').map((bond) => ({
    ...bond,
    memberNames: Array.isArray(bond.members)
      ? (bond.members as FactRow[]).map((member) => `${String(member.name)}（${String(member.status ?? '未知')}）`)
      : [],
  }))
  const interfaces = factRows(facts, 'network.interfaces')

  return (
    <div className="cwgsyw-sos-report__sections">
      <Section title="网络明细">
        <FactTable
          title="网卡"
          columns={[
            { key: 'name', label: '名称' },
            { key: 'master', label: '所属 bond' },
            { key: 'mac', label: 'MAC' },
            { key: 'ipv4', label: 'IPv4' },
            { key: 'speed', label: '速率' },
            { key: 'linkDetected', label: '链路' },
            { key: 'mtu', label: 'MTU' },
            { key: 'driver', label: '驱动' },
            { key: 'driverVersion', label: '驱动版本' },
            { key: 'firmware', label: '固件' },
            { key: 'vendor', label: '厂商' },
            { key: 'model', label: '型号' },
            { key: 'location', label: '位置' },
            { key: 'port', label: '端口类型' },
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
            { key: 'activeMember', label: '当前活动成员' },
            { key: 'memberNames', label: '成员' },
          ]}
          rows={bonds}
          empty="没有配置 bond"
        />
        <FactTable
          title="VLAN"
          columns={[
            { key: 'name', label: '名称' },
            { key: 'parent', label: '父接口' },
            { key: 'vlanId', label: 'VLAN ID' },
            { key: 'state', label: '状态' },
            { key: 'ipv4', label: 'IPv4' },
          ]}
          rows={factRows(facts, 'network.vlans')}
          hideWhenEmpty
        />
        <FactTable
          title="光模块"
          columns={[
            { key: 'name', label: '网卡' },
            { key: 'identifier', label: '封装' },
            { key: 'type', label: '类型' },
            { key: 'vendor', label: '厂商' },
            { key: 'partNumber', label: '料号' },
            { key: 'serialNumber', label: '序列号' },
            { key: 'wavelength', label: '波长' },
            { key: 'length', label: '传输距离' },
          ]}
          rows={transceiverRows(interfaces)}
          hideWhenEmpty
        />
        <FactTable
          title="InfiniBand"
          columns={[
            { key: 'device', label: '设备' },
            { key: 'port', label: '端口' },
            { key: 'type', label: '型号' },
            { key: 'firmware', label: '固件' },
            { key: 'state', label: '状态' },
            { key: 'physicalState', label: '物理状态' },
            { key: 'rate', label: '速率' },
            { key: 'linkLayer', label: '链路层' },
            { key: 'portGuid', label: '端口 GUID' },
          ]}
          rows={factRows(facts, 'network.infiniband')}
          hideWhenEmpty
        />
        <FactTable
          title="光纤通道"
          columns={[
            { key: 'host', label: '端口' },
            { key: 'wwpn', label: 'WWPN' },
            { key: 'wwnn', label: 'WWNN' },
            { key: 'state', label: '状态' },
            { key: 'speed', label: '速率' },
            { key: 'symbolicName', label: '型号与版本' },
          ]}
          rows={factRows(facts, 'network.fcHosts')}
          hideWhenEmpty
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
    </div>
  )
}
