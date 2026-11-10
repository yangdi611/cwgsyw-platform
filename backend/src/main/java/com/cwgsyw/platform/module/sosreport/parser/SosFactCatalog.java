package com.cwgsyw.platform.module.sosreport.parser;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 解析器能产出的事实目录。映射规则和 AI 建议都只能引用这里的 key。
 *
 * <p>目录是静态定义，不含任何主机的真实值，因此可以发给 AI。
 */
public final class SosFactCatalog {

    public enum FactType { STRING, INTEGER, DECIMAL, BOOLEAN, DATE, LIST }

    public record Fact(String key, String label, FactType type, String unit, String description) {
    }

    private static final List<Fact> FACTS = List.of(
        // 整机
        fact("system.hostname", "主机名", FactType.STRING, null, "操作系统主机名"),
        fact("system.fqdn", "完整域名", FactType.STRING, null, "hostname -f 的结果，不含点时不记录"),
        fact("system.serialNumber", "整机序列号", FactType.STRING, null, "DMI 中的系统序列号，占位值视为空；无 dmidecode 时取 sysfs"),
        fact("system.uuid", "系统 UUID", FactType.STRING, null, "DMI 中的系统 UUID"),
        fact("system.manufacturer", "厂商", FactType.STRING, null, "DMI 中的整机厂商"),
        fact("system.productName", "产品型号", FactType.STRING, null, "DMI 中的整机型号；ARM 平台无 DMI 时取设备树 model"),
        fact("system.version", "整机版本", FactType.STRING, null, "DMI 中的系统版本"),
        fact("system.skuNumber", "SKU 编号", FactType.STRING, null, "DMI 中的 SKU Number"),
        fact("system.family", "产品系列", FactType.STRING, null, "DMI 中的 Family"),
        fact("system.hostType", "主机类型", FactType.STRING, null, "physical 或 virtual，依据 DMI 和 lscpu 判断"),
        fact("baseboard.manufacturer", "主板厂商", FactType.STRING, null, "DMI 中的主板厂商"),
        fact("baseboard.productName", "主板型号", FactType.STRING, null, "DMI 中的主板型号"),
        fact("baseboard.serialNumber", "主板序列号", FactType.STRING, null, "DMI 中的主板序列号"),
        fact("baseboard.version", "主板版本", FactType.STRING, null, "DMI 中的主板版本"),
        fact("baseboard.assetTag", "主板资产标签", FactType.STRING, null, "DMI 中的主板 Asset Tag"),
        fact("bios.vendor", "BIOS 厂商", FactType.STRING, null, "DMI 中的 BIOS 厂商"),
        fact("bios.version", "BIOS 版本", FactType.STRING, null, "DMI 中的 BIOS 版本"),
        fact("bios.releaseDate", "BIOS 发布日期", FactType.DATE, null, "DMI 中的 BIOS 发布日期，格式 yyyy-MM-dd"),
        fact("bios.revision", "BIOS 修订号", FactType.STRING, null, "DMI 中的 BIOS Revision"),
        fact("bios.firmwareRevision", "嵌入式控制器固件版本", FactType.STRING, null, "DMI 中的 Firmware Revision，多数厂商填写 EC 或 BMC 固件版本"),
        fact("bios.romSize", "BIOS ROM 容量", FactType.STRING, null, "DMI 中的 ROM Size"),
        fact("chassis.manufacturer", "机箱厂商", FactType.STRING, null, "DMI 中的机箱厂商"),
        fact("chassis.type", "机箱类型", FactType.STRING, null, "DMI 中的机箱类型，如 Rack Mount Chassis"),
        fact("chassis.serialNumber", "机箱序列号", FactType.STRING, null, "DMI 中的机箱序列号"),
        fact("chassis.assetTag", "机箱资产标签", FactType.STRING, null, "DMI 中的机箱 Asset Tag"),
        fact("chassis.heightU", "机箱高度", FactType.INTEGER, "U", "DMI 中的机箱高度"),
        fact("chassis.powerCords", "电源线数量", FactType.INTEGER, "根", "DMI 中的 Number Of Power Cords"),

        // 操作系统
        fact("os.family", "操作系统类型", FactType.STRING, null, "内核类型，如 linux"),
        fact("os.name", "操作系统名称", FactType.STRING, null, "os-release 的 PRETTY_NAME"),
        fact("os.release", "操作系统发行版本", FactType.STRING, null, "system-release 的完整文本"),
        fact("os.versionId", "操作系统版本号", FactType.STRING, null, "os-release 的 VERSION_ID"),
        fact("os.kernel", "内核版本", FactType.STRING, null, "uname -r"),
        fact("os.arch", "CPU 架构", FactType.STRING, null, "uname -m，如 x86_64、aarch64"),
        fact("os.timezone", "时区", FactType.STRING, null, "timedatectl 的时区名称"),
        fact("os.selinux", "SELinux 状态", FactType.STRING, null, "enforcing、permissive 或 disabled"),
        fact("os.bootMode", "启动方式", FactType.STRING, null, "uefi 或 bios，依据挂载信息判断"),
        fact("os.installDate", "系统安装日期", FactType.DATE, null, "最早的软件包安装日期，近似值，格式 yyyy-MM-dd"),
        fact("os.secureBoot", "安全启动", FactType.STRING, null, "enabled、disabled 或 unsupported，来自 mokutil --sb-state"),
        fact("os.uptime", "运行时长", FactType.STRING, null, "采集时 uptime 的运行时长原文"),
        fact("os.loadAverage", "系统负载", FactType.STRING, null, "采集时 1、5、15 分钟平均负载"),
        fact("os.tunedProfile", "调优配置", FactType.STRING, null, "tuned-adm active 的当前配置"),
        fact("os.kdumpStatus", "kdump 状态", FactType.STRING, null, "operational 或 not_operational"),
        fact("os.firewall", "防火墙状态", FactType.STRING, null, "firewalld 的 running 或 not_running"),
        fact("os.kernelTainted", "内核污染标志", FactType.INTEGER, null, "/proc/sys/kernel/tainted，0 表示未加载非官方模块且无异常"),
        fact("os.ntpSynchronized", "时钟已同步", FactType.BOOLEAN, null, "timedatectl 的 System clock synchronized"),
        fact("os.ntpService", "时间同步服务", FactType.STRING, null, "timedatectl 的 NTP service"),
        fact("os.timeSource", "当前时间源", FactType.STRING, null, "chronyc tracking 的 Reference ID"),
        fact("os.timeOffset", "时钟偏差", FactType.STRING, null, "chronyc tracking 的 System time"),
        fact("os.timeLeapStatus", "闰秒状态", FactType.STRING, null, "chronyc tracking 的 Leap status，Normal 为正常"),

        // CPU
        fact("cpu.model", "CPU 型号", FactType.STRING, null, "CPU 型号名称"),
        fact("cpu.vendor", "CPU 厂商", FactType.STRING, null, "CPU 厂商"),
        fact("cpu.sockets", "物理 CPU 颗数", FactType.INTEGER, "颗", "已安装的物理 CPU 数量，以 DMI 为准"),
        fact("cpu.cores", "物理核心总数", FactType.INTEGER, "核", "所有 CPU 的物理核心总数"),
        fact("cpu.threads", "逻辑 CPU 总数", FactType.INTEGER, "线程", "所有 CPU 的逻辑线程总数"),
        fact("cpu.threadsPerCore", "每核线程数", FactType.INTEGER, "线程", "lscpu 的 Thread(s) per core，2 表示开启超线程"),
        fact("cpu.family", "CPU 家族", FactType.STRING, null, "lscpu 的 CPU family"),
        fact("cpu.modelId", "CPU 型号编号", FactType.STRING, null, "lscpu 的 Model"),
        fact("cpu.stepping", "CPU 步进", FactType.STRING, null, "lscpu 的 Stepping"),
        fact("cpu.maxMhz", "最高主频", FactType.DECIMAL, "MHz", "lscpu 的 CPU max MHz"),
        fact("cpu.minMhz", "最低主频", FactType.DECIMAL, "MHz", "lscpu 的 CPU min MHz"),
        fact("cpu.numaNodes", "NUMA 节点数", FactType.INTEGER, "个", "lscpu 的 NUMA node(s)"),
        fact("cpu.virtualization", "虚拟化支持", FactType.STRING, null, "VT-x 或 AMD-V 等"),
        fact("cpu.l1dCache", "L1 数据缓存", FactType.STRING, null, "lscpu 的 L1d cache 原文"),
        fact("cpu.l1iCache", "L1 指令缓存", FactType.STRING, null, "lscpu 的 L1i cache 原文"),
        fact("cpu.l2Cache", "L2 缓存", FactType.STRING, null, "lscpu 的 L2 cache 原文"),
        fact("cpu.l3Cache", "L3 缓存", FactType.STRING, null, "lscpu 的 L3 cache 原文"),
        fact("cpu.microcode", "CPU 微码版本", FactType.STRING, null, "/proc/cpuinfo 的 microcode，仅 x86"),
        fact("cpu.vulnerabilities", "CPU 漏洞缓解状态", FactType.LIST, null, "lscpu 的 Vulnerability 行，每项为“名称: 状态”"),
        fact("hardware.processors", "CPU 插座明细", FactType.LIST, null, "DMI 中每个 CPU 插座，含未安装的空插座；每项含插座名、型号、主频、核数、序列号等"),

        // 内存
        fact("memory.installedGb", "实配内存", FactType.INTEGER, "GB", "已安装内存条容量合计，以 DMI 为准"),
        fact("memory.usableGb", "操作系统可用内存", FactType.DECIMAL, "GiB", "操作系统看到的内存总量，小于实配内存"),
        fact("memory.slotsTotal", "内存插槽总数", FactType.INTEGER, "个", "主板内存插槽总数"),
        fact("memory.slotsUsed", "已用内存插槽数", FactType.INTEGER, "个", "已插内存条的插槽数"),
        fact("memory.swapGb", "交换分区", FactType.INTEGER, "GB", "交换分区总容量"),
        fact("memory.type", "内存类型", FactType.STRING, null, "第一条已安装内存的类型，如 DDR4"),
        fact("memory.speed", "内存运行速率", FactType.STRING, null, "第一条已安装内存的配置速率，如 3200 MT/s"),
        fact("memory.maxCapacity", "最大支持内存", FactType.STRING, null, "DMI Physical Memory Array 的 Maximum Capacity，仅有一个阵列时记录"),
        fact("memory.errorCorrection", "内存纠错方式", FactType.STRING, null, "DMI 中的 Error Correction Type，如 Multi-bit ECC"),
        fact("memory.hugepagesTotal", "大页数量", FactType.INTEGER, "页", "/proc/meminfo 的 HugePages_Total"),
        fact("memory.hugepageSizeKb", "大页大小", FactType.INTEGER, "KB", "/proc/meminfo 的 Hugepagesize"),
        fact("memory.transparentHugepage", "透明大页", FactType.STRING, null, "always、madvise 或 never"),
        fact("hardware.memoryModules", "内存插槽明细", FactType.LIST, null, "DMI 中每个内存插槽，含空槽位；每项含位置、容量、类型、速率、厂商、序列号、料号、Rank"),

        // 板卡、电源与 BMC
        fact("hardware.pciDevices", "PCI 板卡", FactType.LIST, null, "lspci 中的存储、网络、显示、加速、FC、IB 设备；每项含地址、厂商、型号、驱动、插槽、NUMA、PCIe 链路、料号和序列号"),
        fact("hardware.pciSlots", "PCIe 插槽", FactType.LIST, null, "DMI 中每个扩展槽，含空插槽；每项含名称、类型、占用状态和总线地址"),
        fact("hardware.onboardDevices", "板载设备", FactType.LIST, null, "DMI 中的板载网卡、显卡、存储控制器及其总线地址"),
        fact("hardware.powerSupplies", "电源模块", FactType.LIST, null, "DMI 中每个电源位，含未安装的空位；每项含位置、厂商、型号、序列号、功率、状态"),
        fact("hardware.gpus", "GPU 与加速卡", FactType.LIST, null, "nvidia-smi 的 GPU 详情和 lspci 中的其他显示、加速设备"),
        fact("hardware.fruDevices", "FRU 信息", FactType.LIST, null, "ipmitool fru print 中每个部件的厂商、型号、料号、序列号"),
        fact("hardware.sensors", "传感器", FactType.LIST, null, "ipmitool sensor list，每项含读数、单位、状态和临界阈值，最多 500 项"),
        fact("hardware.sensorAlerts", "异常传感器", FactType.LIST, null, "状态不是 ok 的阈值类传感器"),
        fact("hardware.selEvents", "BMC 事件日志", FactType.LIST, null, "ipmitool sel elist 最近 100 条，按时间倒序"),
        fact("hardware.chassisFaults", "机箱故障", FactType.LIST, null, "ipmitool chassis status 中为 true 的故障项"),
        fact("hardware.firmwareInventory", "固件版本清单", FactType.LIST, null, "BIOS、BMC、CPU 微码、网卡、RAID 卡、磁盘、GPU、HCA、HBA、电源的固件版本汇总"),
        fact("bmc.source", "BMC 信息来源", FactType.STRING, null, "ipmitool 或 idracadm"),
        fact("bmc.type", "BMC 类型", FactType.STRING, null, "可识别时记录，如 iDRAC"),
        fact("bmc.ipAddress", "BMC IP", FactType.STRING, null, "ipmitool lan print 或 iDRAC 的当前 IPv4 地址"),
        fact("bmc.ipSource", "BMC IP 来源", FactType.STRING, null, "Static 或 DHCP"),
        fact("bmc.netmask", "BMC 子网掩码", FactType.STRING, null, "BMC 的子网掩码"),
        fact("bmc.gateway", "BMC 网关", FactType.STRING, null, "BMC 的默认网关"),
        fact("bmc.macAddress", "BMC MAC", FactType.STRING, null, "BMC 管理口的 MAC 地址"),
        fact("bmc.vlanId", "BMC VLAN", FactType.STRING, null, "BMC 的 802.1q VLAN ID，未启用时不记录"),
        fact("bmc.lanChannel", "BMC LAN 通道", FactType.STRING, null, "取得 IP 的 IPMI 通道号，默认通道时不记录"),
        fact("bmc.firmwareVersion", "BMC 固件版本", FactType.STRING, null, "ipmitool mc info 的 Firmware Revision 或 iDRAC 固件版本"),
        fact("bmc.ipmiVersion", "IPMI 版本", FactType.STRING, null, "mc info 或 DMI type 38 的 IPMI 规范版本"),
        fact("bmc.interface", "IPMI 接口类型", FactType.STRING, null, "DMI type 38 的接口类型，如 KCS"),
        fact("bmc.manufacturer", "BMC 厂商", FactType.STRING, null, "mc info 的 Manufacturer Name"),
        fact("bmc.manufacturerId", "BMC 厂商编号", FactType.STRING, null, "mc info 的 Manufacturer ID（IANA 编号）"),
        fact("bmc.productName", "BMC 产品名", FactType.STRING, null, "mc info 的 Product Name"),
        fact("bmc.deviceRevision", "BMC 硬件版本", FactType.STRING, null, "mc info 的 Device Revision"),
        fact("bmc.powerState", "整机电源状态", FactType.STRING, null, "BMC 报告的 System Power"),
        fact("bmc.selEntries", "BMC 事件条数", FactType.INTEGER, "条", "ipmitool sel info 的 Entries"),
        fact("bmc.selPercentUsed", "BMC 事件日志占用", FactType.STRING, null, "ipmitool sel info 的 Percent Used"),
        fact("bmc.serviceTag", "服务编号", FactType.STRING, null, "Dell iDRAC 的 Service Tag"),
        fact("bmc.hostSystemModel", "BMC 报告的整机型号", FactType.STRING, null, "Dell iDRAC 的 System Model"),

        // 网络
        fact("network.primaryIp", "主 IP", FactType.STRING, null, "默认路由所在网卡的 IPv4 地址"),
        fact("network.primaryInterface", "主网卡", FactType.STRING, null, "默认路由所在的网卡名"),
        fact("network.defaultGateway", "默认网关", FactType.STRING, null, "默认路由的网关地址"),
        fact("network.ipv4Addresses", "全部 IPv4 地址", FactType.LIST, null, "除回环外的 IPv4 地址列表"),
        fact("network.ipv6Addresses", "全部 IPv6 地址", FactType.LIST, null, "scope global 的 IPv6 地址列表"),
        fact("network.dnsServers", "DNS 服务器", FactType.LIST, null, "resolv.conf 中的 nameserver 列表"),
        fact("network.ntpServers", "NTP 服务器", FactType.LIST, null, "chrony.conf 和 ntp.conf 中的 server 和 pool 列表"),
        fact("network.interfaces", "网卡列表", FactType.LIST, null, "网卡和 bond 的详情，每项含名称、MAC、速率、驱动、固件、型号、插槽、MTU、光模块等"),
        fact("network.bonds", "Bond 列表", FactType.LIST, null, "bond 的详情，每项含模式、状态和成员网卡"),
        fact("network.vlans", "VLAN 列表", FactType.LIST, null, "ip -d link 中的 VLAN 接口，每项含父接口和 VLAN ID"),
        fact("network.listeningPorts", "监听端口", FactType.LIST, null, "TCP 监听端口列表，每项含端口、地址和进程名"),
        fact("network.infiniband", "InfiniBand 端口", FactType.LIST, null, "ibstat 中每个 HCA 端口的型号、固件、GUID、状态和速率"),
        fact("network.fcHosts", "光纤通道端口", FactType.LIST, null, "每个 fc_host 的 WWPN、WWNN、速率、状态和型号"),

        // 存储
        fact("storage.totalDiskGb", "磁盘容量合计", FactType.INTEGER, "GB", "操作系统可见物理盘的容量合计，不含 md 和 LVM；RAID 卡后的物理盘不可见"),
        fact("storage.disks", "磁盘列表", FactType.LIST, null, "操作系统可见的磁盘，每项含名称、容量、型号、序列号、固件、WWN、物理路径、SMART 健康"),
        fact("storage.filesystems", "文件系统列表", FactType.LIST, null, "已挂载的本地文件系统，每项含挂载点、容量和使用率"),
        fact("storage.softwareRaids", "软 RAID 列表", FactType.LIST, null, "md 设备，每项含名称、级别和成员盘"),
        fact("storage.raidControllers", "RAID 卡", FactType.LIST, null, "storcli、perccli、MegaCli、ssacli、arcconf、sas3ircu 报告的控制器，含型号、序列号、固件、BIOS、驱动、缓存、电池"),
        fact("storage.raidVirtualDrives", "RAID 逻辑盘", FactType.LIST, null, "RAID 卡上的逻辑盘，每项含级别、状态、容量"),
        fact("storage.raidPhysicalDrives", "RAID 物理盘", FactType.LIST, null, "RAID 卡后的物理盘，含槽位、型号、序列号、固件、状态；背板槽位数已知时补出空槽位"),
        fact("storage.multipaths", "多路径设备", FactType.LIST, null, "multipath -ll 中的 LUN，每项含 WWID、厂商、型号、容量和路径状态"),
        fact("storage.volumeGroups", "LVM 卷组", FactType.LIST, null, "vgs 中的卷组，每项含容量和剩余空间"),
        fact("storage.logicalVolumes", "LVM 逻辑卷", FactType.LIST, null, "lvs 中的逻辑卷，不含内部卷"),
        fact("storage.physicalVolumes", "LVM 物理卷", FactType.LIST, null, "pvs 中的物理卷"),

        // 软件
        fact("software.packageCount", "软件包数量", FactType.INTEGER, "个", "已安装的 RPM 或 deb 数量"),
        fact("software.packageFormat", "软件包格式", FactType.STRING, null, "rpm 或 deb"),
        fact("software.packages", "软件包列表", FactType.LIST, null, "已安装的 RPM 全名，或 deb 的“名称_版本_架构”"),
        fact("software.runningServices", "运行中的服务", FactType.LIST, null, "状态为 running 的 systemd 服务"),
        fact("software.failedServices", "失败的服务", FactType.LIST, null, "状态为 failed 的 systemd 服务"),
        fact("software.enabledServices", "开机自启的服务", FactType.LIST, null, "systemctl list-unit-files 中为 enabled 的服务"),
        fact("software.kernelModules", "已加载的内核模块", FactType.LIST, null, "lsmod 中的模块名"),

        // 健康
        fact("health.issues", "硬件与系统告警", FactType.LIST, null, "解析中发现的异常：SMART、RAID、传感器、电源、机箱、多路径、bond、服务、时钟同步等"));

    private static final Map<String, Fact> BY_KEY = FACTS.stream().collect(
        Collectors.toMap(Fact::key, Function.identity(), (a, b) -> a, LinkedHashMap::new));

    private SosFactCatalog() {
    }

    private static Fact fact(String key, String label, FactType type, String unit, String description) {
        return new Fact(key, label, type, unit, description);
    }

    public static List<Fact> all() {
        return FACTS;
    }

    public static Optional<Fact> find(String key) {
        return Optional.ofNullable(key).map(BY_KEY::get);
    }
}
