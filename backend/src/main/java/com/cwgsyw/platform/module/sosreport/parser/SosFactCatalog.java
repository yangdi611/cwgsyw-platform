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
        fact("system.hostname", "主机名", FactType.STRING, null, "操作系统主机名"),
        fact("system.serialNumber", "整机序列号", FactType.STRING, null, "DMI 中的系统序列号，占位值视为空"),
        fact("system.uuid", "系统 UUID", FactType.STRING, null, "DMI 中的系统 UUID"),
        fact("system.manufacturer", "厂商", FactType.STRING, null, "DMI 中的整机厂商"),
        fact("system.productName", "产品型号", FactType.STRING, null, "DMI 中的整机型号"),
        fact("system.hostType", "主机类型", FactType.STRING, null, "physical 或 virtual，依据 DMI 和 lscpu 判断"),
        fact("baseboard.manufacturer", "主板厂商", FactType.STRING, null, "DMI 中的主板厂商"),
        fact("baseboard.productName", "主板型号", FactType.STRING, null, "DMI 中的主板型号"),
        fact("bios.vendor", "BIOS 厂商", FactType.STRING, null, "DMI 中的 BIOS 厂商"),
        fact("bios.version", "BIOS 版本", FactType.STRING, null, "DMI 中的 BIOS 版本"),
        fact("bios.releaseDate", "BIOS 发布日期", FactType.DATE, null, "DMI 中的 BIOS 发布日期，格式 yyyy-MM-dd"),

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

        fact("cpu.model", "CPU 型号", FactType.STRING, null, "CPU 型号名称"),
        fact("cpu.vendor", "CPU 厂商", FactType.STRING, null, "CPU 厂商"),
        fact("cpu.sockets", "物理 CPU 颗数", FactType.INTEGER, "颗", "已安装的物理 CPU 数量，以 DMI 为准"),
        fact("cpu.cores", "物理核心总数", FactType.INTEGER, "核", "所有 CPU 的物理核心总数"),
        fact("cpu.threads", "逻辑 CPU 总数", FactType.INTEGER, "线程", "所有 CPU 的逻辑线程总数"),

        fact("memory.installedGb", "实配内存", FactType.INTEGER, "GB", "已安装内存条容量合计，以 DMI 为准"),
        fact("memory.usableGb", "操作系统可用内存", FactType.DECIMAL, "GiB", "操作系统看到的内存总量，小于实配内存"),
        fact("memory.slotsTotal", "内存插槽总数", FactType.INTEGER, "个", "主板内存插槽总数"),
        fact("memory.slotsUsed", "已用内存插槽数", FactType.INTEGER, "个", "已插内存条的插槽数"),
        fact("memory.swapGb", "交换分区", FactType.INTEGER, "GB", "交换分区总容量"),

        fact("network.primaryIp", "主 IP", FactType.STRING, null, "默认路由所在网卡的 IPv4 地址"),
        fact("network.primaryInterface", "主网卡", FactType.STRING, null, "默认路由所在的网卡名"),
        fact("network.defaultGateway", "默认网关", FactType.STRING, null, "默认路由的网关地址"),
        fact("network.ipv4Addresses", "全部 IPv4 地址", FactType.LIST, null, "除回环外的 IPv4 地址列表"),
        fact("network.dnsServers", "DNS 服务器", FactType.LIST, null, "resolv.conf 中的 nameserver 列表"),
        fact("network.ntpServers", "NTP 服务器", FactType.LIST, null, "chrony.conf 中的 server 和 pool 列表"),
        fact("network.interfaces", "网卡列表", FactType.LIST, null, "物理网卡和 bond 的详情，每项含名称、MAC、速率、驱动等"),
        fact("network.bonds", "Bond 列表", FactType.LIST, null, "bond 的详情，每项含模式、状态和成员网卡"),
        fact("network.listeningPorts", "监听端口", FactType.LIST, null, "TCP 监听端口列表，每项含端口、地址和进程名"),

        fact("storage.totalDiskGb", "磁盘容量合计", FactType.INTEGER, "GB", "操作系统可见物理盘的容量合计，不含 md 和 LVM；RAID 卡后的物理盘不可见"),
        fact("storage.disks", "磁盘列表", FactType.LIST, null, "操作系统可见的磁盘，每项含名称、容量、型号、序列号"),
        fact("storage.filesystems", "文件系统列表", FactType.LIST, null, "已挂载的本地文件系统，每项含挂载点、容量和使用率"),
        fact("storage.softwareRaids", "软 RAID 列表", FactType.LIST, null, "md 设备，每项含名称、级别和成员盘"),

        fact("software.packageCount", "软件包数量", FactType.INTEGER, "个", "已安装的 RPM 数量"),
        fact("software.packages", "软件包列表", FactType.LIST, null, "已安装的 RPM 全名"),
        fact("software.runningServices", "运行中的服务", FactType.LIST, null, "状态为 running 的 systemd 服务"),
        fact("software.failedServices", "失败的服务", FactType.LIST, null, "状态为 failed 的 systemd 服务"));

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
