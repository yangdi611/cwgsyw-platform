package com.cwgsyw.platform.module.sosreport.parser;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.cwgsyw.platform.module.sosreport.parser.SosHardwareFixtures.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 网络、BMC 和操作系统运行状态。 */
@SuppressWarnings("unchecked")
class SosNetworkBmcOsParserTest {

    // ─── 网络 ────────────────────────────────────────────────────────────────

    @Test
    void enrichesInterfacesWithPciTransceiverAndLinkDetails() {
        Map<String, Object> facts = parse(files());
        Map<String, Object> nic = row(facts, "network.interfaces", "name", "ens5f0");
        assertEquals("2.8.20-k", nic.get("driverVersion"));
        assertEquals("6.80 0x80003d05 1.2007.0", nic.get("firmware"));
        assertEquals("Full", nic.get("duplex"));
        assertEquals("FIBRE", nic.get("port"));
        assertEquals(9000, nic.get("mtu"));
        assertEquals("UP", nic.get("state"));
        assertEquals("Intel", nic.get("vendor"));
        assertEquals("XL710 40GbE Controller", nic.get("model"));
        assertEquals("Integrated NIC 1", nic.get("location"));
        assertEquals("1", nic.get("numaNode"));
        assertEquals(List.of("2001:db8::5/64"), nic.get("ipv6"));

        Map<String, Object> transceiver = (Map<String, Object>) nic.get("transceiver");
        assertEquals("SFP", transceiver.get("identifier"));
        assertEquals("LC", transceiver.get("connector"));
        assertEquals("FINISAR CORP.", transceiver.get("vendor"));
        assertEquals("FTLX8571D3BCL", transceiver.get("partNumber"));
        assertEquals("AQA0B1C", transceiver.get("serialNumber"));
        assertEquals("850nm", transceiver.get("wavelength"));
        assertEquals("300m", transceiver.get("length"));

        assertEquals(List.of("2001:db8::5"), facts.get("network.ipv6Addresses"), "不含链路本地地址");
        Map<String, Object> vlan = row(facts, "network.vlans", "name", "ens5f0.100");
        assertEquals("ens5f0", vlan.get("parent"));
        assertEquals(100, vlan.get("vlanId"));
        assertEquals(List.of("10.100.0.5/24"), vlan.get("ipv4"));
        assertEquals(List.of("10.0.0.32"), facts.get("network.ntpServers"), "ntpd 的本地时钟伪地址不算时间源");
    }

    @Test
    void parsesInfinibandAndFibreChannel() {
        Map<String, Object> facts = parse(files());
        Map<String, Object> ib = rows(facts, "network.infiniband").get(0);
        assertEquals("mlx5_0", ib.get("device"));
        assertEquals(1, ib.get("port"));
        assertEquals("MT4123", ib.get("type"));
        assertEquals("20.31.1014", ib.get("firmware"));
        assertEquals("Active", ib.get("state"));
        assertEquals("200", ib.get("rate"));

        Map<String, Object> fc = rows(facts, "network.fcHosts").get(0);
        assertEquals("host1", fc.get("host"));
        assertEquals("21:00:00:24:ff:7d:12:34", fc.get("wwpn"), "取 fc_host 本身，不取父设备");
        assertEquals("20:00:00:24:ff:7d:12:34", fc.get("wwnn"));
        assertEquals("Linkdown", fc.get("state"));
        assertFalse(fc.containsKey("speed"), "unknown 视为空");
        assertTrue(hasIssue(facts, "FC 端口 host1 状态：Linkdown"));
    }

    // ─── BMC ─────────────────────────────────────────────────────────────────

    @Test
    void parsesBmcNetworkFirmwareFruSensorsAndEvents() {
        Map<String, Object> facts = parse(files());
        assertEquals("ipmitool", facts.get("bmc.source"));
        assertEquals("10.9.0.21", facts.get("bmc.ipAddress"), "默认通道是 0.0.0.0 时看通道 1");
        assertEquals("1", facts.get("bmc.lanChannel"));
        assertEquals("Static Address", facts.get("bmc.ipSource"));
        assertEquals("255.255.255.0", facts.get("bmc.netmask"));
        assertEquals("10.9.0.1", facts.get("bmc.gateway"));
        assertEquals("d0:94:66:aa:bb:cc", facts.get("bmc.macAddress"));
        assertFalse(facts.containsKey("bmc.vlanId"));
        assertEquals("4.40", facts.get("bmc.firmwareVersion"));
        assertEquals("DELL Inc", facts.get("bmc.manufacturer"));
        assertFalse(facts.containsKey("bmc.productName"), "Unknown 产品名不记录");
        assertEquals("on", facts.get("bmc.powerState"));

        List<Map<String, Object>> fru = rows(facts, "hardware.fruDevices");
        assertEquals(1, fru.size(), "没有字段的 FRU 不保留");
        assertEquals("CNFCP0081B0123", fru.get(0).get("boardSerial"));
        assertEquals("Mon Jan  1 00:00:00 2018", fru.get(0).get("boardMfgDate"));

        assertEquals(4, rows(facts, "hardware.sensors").size());
        List<Map<String, Object>> alerts = rows(facts, "hardware.sensorAlerts");
        assertEquals(List.of("Fan1"), alerts.stream().map(row -> row.get("name")).toList(), "离散传感器不按阈值判断");
        assertEquals("360.000", alerts.get(0).get("lowerCritical"));

        assertEquals(312, facts.get("bmc.selEntries"));
        List<Map<String, Object>> events = rows(facts, "hardware.selEvents");
        assertEquals("2", events.get(0).get("id"), "最近的事件在前");
        assertEquals("Power Supply AC lost", events.get(1).get("event"));
        assertEquals(List.of("Drive Fault"), facts.get("hardware.chassisFaults"));

        assertTrue(hasIssue(facts, "传感器 Fan1 状态 cr"));
        assertTrue(hasIssue(facts, "BMC 事件日志已用 95%"));
        assertTrue(hasIssue(facts, "机箱故障：Drive Fault"));
    }

    @Test
    void fallsBackToIdracAndDmiIpmiInfo() {
        Map<String, String> files = new HashMap<>();
        files.put("sos_commands/hardware/dmidecode", DMIDECODE);
        files.put("sos_commands/dellrac/idracadm7_getsysinfo", """
            RAC Information:
            RAC Date/Time           = Mon Nov  9 10:00:00 2026
            Firmware Version        = 4.40.00.00
            Current IP Address      = 10.9.0.22
            Current IP Gateway      = 10.9.0.1
            Current IP Netmask      = 255.255.255.0
            DHCP Enabled            = 0
            MAC Address             = d0:94:66:aa:bb:cd

            System Information:
            System Model            = PowerEdge R740
            Service Tag             = ABC1234
            Power Status            = ON
            """);
        Map<String, Object> facts = parse(files);
        assertEquals("idracadm", facts.get("bmc.source"));
        assertEquals("iDRAC", facts.get("bmc.type"));
        assertEquals("10.9.0.22", facts.get("bmc.ipAddress"));
        assertEquals("Static", facts.get("bmc.ipSource"));
        assertEquals("4.40.00.00", facts.get("bmc.firmwareVersion"));
        assertEquals("ABC1234", facts.get("bmc.serviceTag"));
        assertEquals("2.0", facts.get("bmc.ipmiVersion"), "来自 DMI type 38");
        assertEquals("KCS (Keyboard Control Style)", facts.get("bmc.interface"));
    }

    // ─── 系统和软件 ──────────────────────────────────────────────────────────

    @Test
    void parsesOperatingSystemRuntimeState() {
        Map<String, Object> facts = parse(files());
        assertEquals("120 days, 3:01", facts.get("os.uptime"));
        assertEquals("0.00, 0.01, 0.05", facts.get("os.loadAverage"));
        assertEquals("disabled", facts.get("os.secureBoot"));
        assertEquals("throughput-performance", facts.get("os.tunedProfile"));
        assertEquals("not_operational", facts.get("os.kdumpStatus"));
        assertEquals("not_running", facts.get("os.firewall"));
        assertEquals(0, facts.get("os.kernelTainted"));
        assertEquals(false, facts.get("os.ntpSynchronized"));
        assertEquals("active", facts.get("os.ntpService"));
        assertEquals("0A00001F (10.0.0.31)", facts.get("os.timeSource"));
        assertEquals("Normal", facts.get("os.timeLeapStatus"));
        assertTrue(hasIssue(facts, "kdump 未就绪"));
        assertTrue(hasIssue(facts, "系统时钟未与时间源同步"));
    }

    @Test
    void parsesEnabledServicesModulesAndDebPackages() {
        Map<String, String> files = files();
        files.put("sos_commands/dpkg/dpkg_-l", """
            Desired=Unknown/Install/Remove/Purge/Hold
            ||/ Name           Version      Architecture Description
            +++-==============-============-============-=================================
            ii  bash           5.0-4        amd64        GNU Bourne Again SHell
            rc  oldpkg         1.0          amd64        removed package
            """);
        Map<String, Object> facts = parse(files);
        assertEquals(List.of("sshd.service"), facts.get("software.enabledServices"));
        assertEquals(List.of("i40e", "megaraid_sas"), facts.get("software.kernelModules"));
        assertEquals(List.of("bash_5.0-4_amd64"), facts.get("software.packages"));
        assertEquals(1, facts.get("software.packageCount"));
        assertEquals("deb", facts.get("software.packageFormat"));
    }
}
