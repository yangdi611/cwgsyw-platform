'use client'

import type { SosFacts } from '@/lib/sos-report-api'
import { factRows } from '@/lib/sos-report-format'
import { FactTable, Section, slotTitle } from './FactParts'

export function StorageFacts({ facts }: { facts: SosFacts | undefined }) {
  const physical = factRows(facts, 'storage.raidPhysicalDrives')
  const controllers = factRows(facts, 'storage.raidControllers')
  const disks = factRows(facts, 'storage.disks').map((row) => ({ ...row, type: row.type ?? row.transport }))

  return (
    <div className="cwgsyw-sos-report__sections">
      <Section title="存储">
        <FactTable
          title="磁盘"
          columns={[
            { key: 'name', label: '名称' },
            { key: 'sizeGb', label: '容量 (GB)' },
            { key: 'type', label: '类型' },
            { key: 'vendor', label: '厂商' },
            { key: 'model', label: '型号' },
            { key: 'serial', label: '序列号' },
            { key: 'firmware', label: '固件' },
            { key: 'location', label: '物理路径' },
            { key: 'smartHealth', label: 'SMART' },
            { key: 'powerOnHours', label: '通电小时' },
            { key: 'temperatureC', label: '温度 (℃)' },
            { key: 'percentageUsed', label: '寿命已用 (%)' },
          ]}
          rows={disks}
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
      </Section>
      <Section title="RAID 卡">
        <FactTable
          title="RAID 卡"
          columns={[
            { key: 'tool', label: '来源' },
            { key: 'controller', label: '编号' },
            { key: 'location', label: '位置' },
            { key: 'model', label: '型号' },
            { key: 'serialNumber', label: '序列号' },
            { key: 'firmwareVersion', label: '固件' },
            { key: 'biosVersion', label: 'BIOS' },
            { key: 'driverVersion', label: '驱动版本' },
            { key: 'status', label: '状态' },
            { key: 'cacheSize', label: '缓存' },
            { key: 'batteryStatus', label: '电池/电容' },
            { key: 'physicalDriveCount', label: '物理盘数' },
          ]}
          rows={controllers}
          empty="报告中没有 RAID 卡信息。RAID 卡后的物理盘需要主机安装 storcli、perccli、ssacli 等厂商工具，sos 才能采集"
        />
        <FactTable
          title="RAID 逻辑盘"
          columns={[
            { key: 'controller', label: '控制器' },
            { key: 'id', label: '编号' },
            { key: 'name', label: '名称' },
            { key: 'level', label: '级别' },
            { key: 'state', label: '状态' },
            { key: 'size', label: '容量' },
            { key: 'osDevice', label: '系统设备' },
          ]}
          rows={factRows(facts, 'storage.raidVirtualDrives')}
          hideWhenEmpty
        />
        <FactTable
          title={slotTitle('RAID 物理盘', physical)}
          columns={[
            { key: 'controller', label: '控制器' },
            { key: 'location', label: '槽位' },
            { key: 'status', label: '状态' },
            { key: 'state', label: '盘状态' },
            { key: 'size', label: '容量' },
            { key: 'interface', label: '接口' },
            { key: 'mediaType', label: '介质' },
            { key: 'vendor', label: '厂商' },
            { key: 'model', label: '型号' },
            { key: 'serialNumber', label: '序列号' },
            { key: 'firmware', label: '固件' },
            { key: 'temperatureC', label: '温度 (℃)' },
          ]}
          rows={physical.map((row) => (row.installed === false
            ? { ...row, status: row.state, state: undefined }
            : { ...row, status: '已安装' }))}
          hideWhenEmpty
        />
      </Section>
      <Section title="多路径与 LVM">
        <FactTable
          title="多路径设备"
          columns={[
            { key: 'name', label: '名称' },
            { key: 'wwid', label: 'WWID' },
            { key: 'vendor', label: '厂商' },
            { key: 'product', label: '型号' },
            { key: 'size', label: '容量' },
            { key: 'paths', label: '路径数' },
            { key: 'activePaths', label: '可用路径' },
          ]}
          rows={factRows(facts, 'storage.multipaths')}
          hideWhenEmpty
        />
        <FactTable
          title="LVM 卷组"
          columns={[
            { key: 'name', label: '卷组' },
            { key: 'size', label: '容量' },
            { key: 'free', label: '剩余' },
            { key: 'pvCount', label: 'PV 数' },
            { key: 'lvCount', label: 'LV 数' },
          ]}
          rows={factRows(facts, 'storage.volumeGroups')}
          empty="报告中没有 LVM 信息"
        />
        <FactTable
          title="LVM 逻辑卷"
          columns={[
            { key: 'name', label: '逻辑卷' },
            { key: 'volumeGroup', label: '卷组' },
            { key: 'size', label: '容量' },
            { key: 'attributes', label: '属性' },
          ]}
          rows={factRows(facts, 'storage.logicalVolumes')}
          hideWhenEmpty
        />
        <FactTable
          title="LVM 物理卷"
          columns={[
            { key: 'device', label: '设备' },
            { key: 'volumeGroup', label: '卷组' },
            { key: 'size', label: '容量' },
            { key: 'free', label: '剩余' },
          ]}
          rows={factRows(facts, 'storage.physicalVolumes')}
          hideWhenEmpty
        />
      </Section>
    </div>
  )
}
