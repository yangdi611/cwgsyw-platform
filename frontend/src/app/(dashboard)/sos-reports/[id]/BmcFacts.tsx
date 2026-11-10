'use client'

import type { SosFacts } from '@/lib/sos-report-api'
import { factRows, factStrings } from '@/lib/sos-report-format'
import { SosPanel } from '../SosPanel'
import { Definitions, FactTable, Section, Tags, type Definition } from './FactParts'

const BMC: Definition[] = [
  ['BMC IP', 'bmc.ipAddress'],
  ['IP 来源', 'bmc.ipSource'],
  ['子网掩码', 'bmc.netmask'],
  ['网关', 'bmc.gateway'],
  ['MAC', 'bmc.macAddress'],
  ['VLAN', 'bmc.vlanId'],
  ['类型', 'bmc.type'],
  ['固件版本', 'bmc.firmwareVersion'],
  ['IPMI 版本', 'bmc.ipmiVersion'],
  ['接口', 'bmc.interface'],
  ['厂商', 'bmc.manufacturer'],
  ['产品名', 'bmc.productName'],
  ['整机电源', 'bmc.powerState'],
  ['服务编号', 'bmc.serviceTag'],
  ['事件条数', 'bmc.selEntries', '条'],
  ['事件日志占用', 'bmc.selPercentUsed'],
]

export function BmcFacts({ facts }: { facts: SosFacts | undefined }) {
  const hasBmc = Object.keys(facts ?? {}).some((key) => key.startsWith('bmc.'))

  return (
    <div className="cwgsyw-sos-report__sections">
      <Section title="BMC 与传感器">
        <SosPanel title="BMC">
          {hasBmc ? (
            <Definitions facts={facts} items={BMC} />
          ) : (
            <p className="cwgsyw-sos-report__note">报告中没有 BMC 信息。需要主机安装 ipmitool 并加载 IPMI 驱动，sos 才能采集</p>
          )}
        </SosPanel>
        <Tags title="机箱故障" values={factStrings(facts, 'hardware.chassisFaults')} empty="没有机箱故障" tone="danger" hideWhenEmpty />
        <FactTable
          title="异常传感器"
          columns={[
            { key: 'name', label: '传感器' },
            { key: 'value', label: '读数' },
            { key: 'unit', label: '单位' },
            { key: 'status', label: '状态' },
            { key: 'lowerCritical', label: '下限' },
            { key: 'upperCritical', label: '上限' },
          ]}
          rows={factRows(facts, 'hardware.sensorAlerts')}
          hideWhenEmpty
        />
        <FactTable
          title="传感器"
          columns={[
            { key: 'name', label: '传感器' },
            { key: 'value', label: '读数' },
            { key: 'unit', label: '单位' },
            { key: 'status', label: '状态' },
            { key: 'lowerCritical', label: '下限' },
            { key: 'upperCritical', label: '上限' },
          ]}
          rows={factRows(facts, 'hardware.sensors')}
          hideWhenEmpty
        />
        <FactTable
          title="FRU 部件"
          columns={[
            { key: 'device', label: '部件' },
            { key: 'boardManufacturer', label: '主板厂商' },
            { key: 'boardProduct', label: '主板型号' },
            { key: 'boardPartNumber', label: '主板料号' },
            { key: 'boardSerial', label: '主板序列号' },
            { key: 'productManufacturer', label: '产品厂商' },
            { key: 'productName', label: '产品名' },
            { key: 'productPartNumber', label: '产品料号' },
            { key: 'productSerial', label: '产品序列号' },
            { key: 'chassisSerial', label: '机箱序列号' },
          ]}
          rows={factRows(facts, 'hardware.fruDevices')}
          hideWhenEmpty
        />
        <FactTable
          title="BMC 事件日志（最近 100 条）"
          columns={[
            { key: 'date', label: '日期' },
            { key: 'time', label: '时间' },
            { key: 'sensor', label: '传感器' },
            { key: 'event', label: '事件' },
            { key: 'direction', label: '方向' },
          ]}
          rows={factRows(facts, 'hardware.selEvents')}
          hideWhenEmpty
        />
      </Section>
    </div>
  )
}
