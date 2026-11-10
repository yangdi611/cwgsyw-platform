'use client'

import type { SosFacts } from '@/lib/sos-report-api'
import { factRows, isEmptySlot } from '@/lib/sos-report-format'
import { FactTable, Section, slotTitle, type FactRow } from './FactParts'

/** PCI 设备的型号：VPD 产品名最准确，其次是子系统名，最后用 lspci 描述。 */
function pciModel(row: FactRow): unknown {
  return row.productName ?? row.subsystem ?? row.description
}

export function FirmwareTable({ facts }: { facts: SosFacts | undefined }) {
  return (
    <FactTable
      title="固件版本"
      columns={[
        { key: 'category', label: '部件' },
        { key: 'component', label: '型号' },
        { key: 'location', label: '位置' },
        { key: 'version', label: '固件版本' },
      ]}
      rows={factRows(facts, 'hardware.firmwareInventory')}
      empty="报告中没有固件版本信息"
    />
  )
}

export function HardwareFacts({ facts }: { facts: SosFacts | undefined }) {
  const processors = factRows(facts, 'hardware.processors')
  const memory = factRows(facts, 'hardware.memoryModules')
  const power = factRows(facts, 'hardware.powerSupplies')
  // 已占用的插槽 DMI 只给出 In Use，这里统一成“已占用”；空插槽由表格显示为标签。
  const slots = factRows(facts, 'hardware.pciSlots').map((row) => ({ ...row, status: isEmptySlot(row) ? row.status : '已占用' }))
  const pci = factRows(facts, 'hardware.pciDevices').map((row) => ({
    ...row,
    model: pciModel(row),
    serial: row.vpdSerialNumber ?? row.serialNumber,
  }))

  return (
    <div className="cwgsyw-sos-report__sections">
      <Section title="处理器与内存">
        <FactTable
          title={slotTitle('CPU 插座', processors)}
          columns={[
            { key: 'socket', label: '插座' },
            { key: 'status', label: '状态' },
            { key: 'model', label: '型号' },
            { key: 'maxSpeed', label: '最高主频' },
            { key: 'currentSpeed', label: '当前主频' },
            { key: 'cores', label: '核数' },
            { key: 'threads', label: '线程' },
            { key: 'serialNumber', label: '序列号' },
            { key: 'partNumber', label: '料号' },
          ]}
          rows={processors}
          empty="报告中没有 CPU 插座信息（需要 dmidecode）"
        />
        <FactTable
          title={slotTitle('内存插槽', memory)}
          columns={[
            { key: 'locator', label: '插槽' },
            { key: 'bankLocator', label: '通道' },
            { key: 'status', label: '状态' },
            { key: 'sizeGb', label: '容量', unit: 'GB' },
            { key: 'type', label: '类型' },
            { key: 'speed', label: '标称速率' },
            { key: 'configuredSpeed', label: '运行速率' },
            { key: 'manufacturer', label: '厂商' },
            { key: 'partNumber', label: '料号' },
            { key: 'serialNumber', label: '序列号' },
            { key: 'rank', label: 'Rank' },
          ]}
          rows={memory}
          empty="报告中没有内存插槽信息（需要 dmidecode）"
        />
      </Section>
      <Section title="电源与扩展槽">
        <FactTable
          title={slotTitle('电源模块', power)}
          columns={[
            { key: 'location', label: '位置' },
            { key: 'status', label: '状态' },
            { key: 'manufacturer', label: '厂商' },
            { key: 'model', label: '型号' },
            { key: 'serialNumber', label: '序列号' },
            { key: 'maxPower', label: '额定功率' },
            { key: 'revision', label: '固件版本' },
          ]}
          rows={power}
          empty="报告中没有电源信息（部分机型的 DMI 不提供）"
        />
        <FactTable
          title={slotTitle('PCIe 插槽', slots)}
          columns={[
            { key: 'designation', label: '插槽' },
            { key: 'status', label: '状态' },
            { key: 'type', label: '规格' },
            { key: 'length', label: '长度' },
            { key: 'busAddress', label: '总线地址' },
            { key: 'deviceCategory', label: '插入设备' },
            { key: 'deviceModel', label: '设备型号' },
          ]}
          rows={slots}
          empty="报告中没有扩展槽信息"
        />
        <FactTable
          title="板载设备"
          columns={[
            { key: 'designation', label: '名称' },
            { key: 'type', label: '类型' },
            { key: 'status', label: '状态' },
            { key: 'busAddress', label: '总线地址' },
            { key: 'deviceModel', label: '设备型号' },
          ]}
          rows={factRows(facts, 'hardware.onboardDevices')}
          hideWhenEmpty
        />
      </Section>
      <Section title="板卡">
        <FactTable
          title="PCI 板卡"
          columns={[
            { key: 'location', label: '位置' },
            { key: 'address', label: '总线地址' },
            { key: 'category', label: '类别' },
            { key: 'vendor', label: '厂商' },
            { key: 'model', label: '型号' },
            { key: 'driver', label: '驱动' },
            { key: 'linkStatus', label: 'PCIe 链路' },
            { key: 'numaNode', label: 'NUMA' },
            { key: 'partNumber', label: '料号' },
            { key: 'serial', label: '序列号' },
            { key: 'source', label: '来源' },
          ]}
          rows={pci}
          empty="报告中没有 PCI 设备信息。主机未安装 pciutils 时 sos 无法运行 lspci，报告里也没有 udev 设备数据库"
        />
        <FactTable
          title="GPU 与加速卡"
          columns={[
            { key: 'location', label: '位置' },
            { key: 'busId', label: '总线地址' },
            { key: 'vendor', label: '厂商' },
            { key: 'model', label: '型号' },
            { key: 'serialNumber', label: '序列号' },
            { key: 'vbios', label: 'VBIOS' },
            { key: 'memoryTotal', label: '显存' },
            { key: 'driverVersion', label: '驱动版本' },
            { key: 'temperature', label: '温度' },
          ]}
          rows={factRows(facts, 'hardware.gpus')}
          hideWhenEmpty
        />
      </Section>
      <Section title="固件">
        <FirmwareTable facts={facts} />
      </Section>
    </div>
  )
}
