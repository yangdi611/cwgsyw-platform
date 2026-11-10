package com.cwgsyw.platform.module.sosreport.parser;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static com.cwgsyw.platform.module.sosreport.parser.SosHardwareFixtures.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 硬件部件：DMI、CPU、PCI、GPU，以及固件清单和事实目录（PARSER_VERSION 2）。 */
@SuppressWarnings("unchecked")
class SosHardwareInventoryTest {

    // ─── DMI ─────────────────────────────────────────────────────────────────

    @Test
    void parsesSystemBoardBiosAndChassis() {
        Map<String, Object> facts = parse(files());
        assertEquals("db-01.example.org", facts.get("system.fqdn"));
        assertEquals("PowerEdge", facts.get("system.family"));
        assertFalse(facts.containsKey("system.version"), "Not Specified 视为空");
        assertEquals(".ABC1234.CNFCP0081B0123.", facts.get("baseboard.serialNumber"));
        assertEquals("A00", facts.get("baseboard.version"));
        assertFalse(facts.containsKey("baseboard.assetTag"));
        assertEquals("2.12", facts.get("bios.revision"));
        assertEquals("4.40", facts.get("bios.firmwareRevision"));
        assertEquals("64 MB", facts.get("bios.romSize"));
        assertEquals("Rack Mount Chassis", facts.get("chassis.type"));
        assertEquals("IT-0042", facts.get("chassis.assetTag"));
        assertEquals(2, facts.get("chassis.heightU"));
        assertEquals(2, facts.get("chassis.powerCords"));
        assertTrue(hasIssue(facts, "机箱散热状态：Warning"));
    }

    @Test
    void listsEveryCpuSocketIncludingEmptyOnes() {
        Map<String, Object> facts = parse(files());
        List<Map<String, Object>> sockets = rows(facts, "hardware.processors");
        assertEquals(2, sockets.size());
        Map<String, Object> cpu1 = sockets.get(0);
        assertEquals("CPU1", cpu1.get("socket"));
        assertEquals(true, cpu1.get("installed"));
        assertEquals("4000 MHz", cpu1.get("maxSpeed"));
        assertEquals(24, cpu1.get("cores"));
        assertFalse(cpu1.containsKey("serialNumber"));
        assertEquals(false, sockets.get(1).get("installed"));
        assertEquals("空槽位", sockets.get(1).get("status"));
        assertEquals(1, facts.get("cpu.sockets"), "空插座不计入颗数");
    }

    @Test
    void listsEveryMemorySlotWithVendorAndPartNumber() {
        Map<String, Object> facts = parse(files());
        List<Map<String, Object>> modules = rows(facts, "hardware.memoryModules");
        assertEquals(List.of("A1", "A2", "B1"), modules.stream().map(row -> row.get("locator")).toList());

        Map<String, Object> a1 = modules.get(0);
        assertEquals(32L, a1.get("sizeGb"));
        assertEquals("Samsung（00CE00B300CE）", a1.get("manufacturer"), "JEDEC 编码换成厂商名");
        assertEquals("M393A4K40CB2-CVF", a1.get("partNumber"));
        assertEquals("2666 MT/s", a1.get("configuredSpeed"));
        assertEquals(2, a1.get("rank"));
        assertEquals(true, a1.get("ecc"));
        assertFalse(a1.containsKey("bankLocator"));
        assertEquals("SK Hynix", modules.get(1).get("manufacturer"));

        Map<String, Object> empty = modules.get(2);
        assertEquals(false, empty.get("installed"));
        assertEquals("空槽位", empty.get("status"));
        assertFalse(empty.containsKey("type"), "空槽位不带类型");

        assertEquals("DDR4", facts.get("memory.type"));
        assertEquals("2666 MT/s", facts.get("memory.speed"));
        assertEquals("3 TB", facts.get("memory.maxCapacity"));
        assertEquals("Multi-bit ECC", facts.get("memory.errorCorrection"));
        assertEquals(16, facts.get("memory.hugepagesTotal"));
        assertEquals(2048, facts.get("memory.hugepageSizeKb"));
        assertEquals("madvise", facts.get("memory.transparentHugepage"));
        assertTrue(hasIssue(facts, "内存条料号不一致"));
    }

    @Test
    void listsPowerSuppliesAndSlotsIncludingEmptyOnes() {
        Map<String, Object> facts = parse(files());
        Map<String, Object> psu1 = row(facts, "hardware.powerSupplies", "location", "PSU1");
        assertEquals("0D2CVPA02", psu1.get("model"));
        assertEquals("CNDED0081A0123", psu1.get("serialNumber"));
        assertEquals("750 W", psu1.get("maxPower"));
        assertEquals(true, psu1.get("installed"));
        Map<String, Object> psu2 = row(facts, "hardware.powerSupplies", "location", "PSU2");
        assertEquals(false, psu2.get("installed"));
        assertEquals("空槽位", psu2.get("status"));

        Map<String, Object> slot1 = row(facts, "hardware.pciSlots", "designation", "PCIe Slot 1");
        assertEquals("3b:00.0", slot1.get("busAddress"));
        Map<String, Object> slot2 = row(facts, "hardware.pciSlots", "designation", "PCIe Slot 2");
        assertEquals("空槽位", slot2.get("status"));
        assertFalse(slot2.containsKey("busAddress"), "空插槽的总线地址无效，不记录");

        assertEquals("5e:00.0", row(facts, "hardware.onboardDevices", "designation", "Integrated NIC 1").get("busAddress"));
    }

    @Test
    void fallsBackToSysfsDmiWhenDmidecodeIsMissing() {
        Map<String, String> files = new HashMap<>();
        files.put("sys/devices/virtual/dmi/id/product_serial", "SN-SYSFS\n");
        files.put("sys/class/dmi/id/sys_vendor", "Huawei\n");
        files.put("sys/firmware/devicetree/base/model", "Phytium FT-2000+/64 Board\n");
        Map<String, Object> facts = parse(files);
        assertEquals("SN-SYSFS", facts.get("system.serialNumber"));
        assertEquals("Huawei", facts.get("system.manufacturer"));
        assertEquals("Phytium FT-2000+/64 Board", facts.get("system.productName"));
    }

    // ─── CPU ─────────────────────────────────────────────────────────────────

    @Test
    void parsesCpuDetailsAndMicrocode() {
        Map<String, Object> facts = parse(files());
        assertEquals("6", facts.get("cpu.family"));
        assertEquals("85", facts.get("cpu.modelId"));
        assertEquals("7", facts.get("cpu.stepping"));
        assertEquals(2, facts.get("cpu.threadsPerCore"));
        assertEquals(new java.math.BigDecimal("4000"), facts.get("cpu.maxMhz"));
        assertEquals("VT-x", facts.get("cpu.virtualization"));
        assertEquals("36608K", facts.get("cpu.l3Cache"));
        assertEquals("0x5003302", facts.get("cpu.microcode"));
        assertEquals(List.of("Meltdown: Not affected", "Spectre v2: Mitigation; Enhanced IBRS"), facts.get("cpu.vulnerabilities"));
    }

    // ─── PCI ─────────────────────────────────────────────────────────────────

    @Test
    void keepsOnlyAssetRelevantPciDevicesWithLocationAndVpd() {
        Map<String, Object> facts = parse(files());
        List<Map<String, Object>> devices = rows(facts, "hardware.pciDevices");
        assertEquals(List.of("03:00.0", "3b:00.0", "5e:00.0", "af:00.0", "d8:00.0"),
            devices.stream().map(row -> row.get("address")).toList(), "主机桥不保留");

        Map<String, Object> raid = row(facts, "hardware.pciDevices", "address", "3b:00.0");
        assertEquals("RAID 控制器", raid.get("category"));
        assertEquals("Broadcom / LSI", raid.get("vendor"));
        assertEquals("1000", raid.get("vendorId"));
        assertEquals("005d", raid.get("deviceId"));
        assertEquals("Broadcom / LSI MegaRAID SAS 9361-8i", raid.get("subsystem"));
        assertEquals("02", raid.get("revision"));
        assertEquals("PCIe Slot 1", raid.get("location"));
        assertEquals("8GT/s x8", raid.get("linkStatus"));
        assertEquals("megaraid_sas", raid.get("driver"));
        assertEquals("0", raid.get("numaNode"));

        Map<String, Object> nic = row(facts, "hardware.pciDevices", "address", "5e:00.0");
        assertEquals("Integrated NIC 1", nic.get("location"));
        assertEquals("XL710 40GbE Controller", nic.get("productName"));
        assertEquals("X710DA2G2P5", nic.get("partNumber"));
        assertEquals("A0B1C2D3E4F5", nic.get("vpdSerialNumber"));
        assertEquals("3c-fd-fe-ff-ff-a1-b2-c3", nic.get("serialNumber"));
        assertEquals("5GT/s x8（降级）", nic.get("linkStatus"));
        assertEquals("光纤通道 HBA", row(facts, "hardware.pciDevices", "address", "d8:00.0").get("category"));
    }

    // ─── GPU ─────────────────────────────────────────────────────────────────

    @Test
    void listsGpusFromNvidiaSmiWithoutDuplicatingLspci() {
        Map<String, Object> facts = parse(files());
        List<Map<String, Object>> gpus = rows(facts, "hardware.gpus");
        assertEquals(1, gpus.size(), "同一张卡不重复，BMC 显卡不算 GPU");
        Map<String, Object> gpu = gpus.get(0);
        assertEquals("af:00.0", gpu.get("busId"));
        assertEquals("NVIDIA A100-PCIE-40GB", gpu.get("model"));
        assertEquals("1320221012345", gpu.get("serialNumber"));
        assertEquals("92.00.25.00.08", gpu.get("vbios"));
        assertEquals("40960 MiB", gpu.get("memoryTotal"));
        assertEquals("33 C", gpu.get("temperature"));
        assertEquals("535.104.05", gpu.get("driverVersion"));
        assertEquals("nvidia-smi", gpu.get("source"));

        Map<String, String> files = files();
        files.remove("sos_commands/nvidia/nvidia-smi_-q");
        Map<String, Object> fromPci = rows(parse(files), "hardware.gpus").get(0);
        assertEquals("lspci", fromPci.get("source"));
        assertEquals("NVIDIA", fromPci.get("vendor"));
    }

    // ─── 汇总 ────────────────────────────────────────────────────────────────

    @Test
    void buildsFirmwareInventoryAcrossComponents() {
        Map<String, String> files = files();
        files.put("sos_commands/storcli/storcli64_.call_show_all", STORCLI_SUMMARY);
        files.put("sos_commands/storcli/storcli64_.call.eall.sall_show_all", STORCLI_DRIVES);
        Map<String, Object> facts = parse(files);
        Set<String> categories = rows(facts, "hardware.firmwareInventory").stream()
            .map(row -> String.valueOf(row.get("category"))).collect(Collectors.toSet());
        assertEquals(Set.of("BIOS", "电源", "CPU 微码", "网卡", "InfiniBand HCA", "FC HBA", "磁盘", "RAID 卡", "RAID 卡 BIOS",
            "RAID 物理盘", "BMC", "GPU VBIOS"), categories);
        Map<String, Object> nic = row(facts, "hardware.firmwareInventory", "category", "网卡");
        assertEquals("ens5f0（Integrated NIC 1）", nic.get("location"));
        assertEquals("XL710 40GbE Controller", nic.get("component"));
        assertEquals("8.08.231", row(facts, "hardware.firmwareInventory", "category", "FC HBA").get("version"));
    }

    @Test
    void emitsOnlyCatalogKeysForFullReport() {
        Map<String, String> files = files();
        files.put("sos_commands/storcli/storcli64_.call_show_all", STORCLI_SUMMARY);
        Set<String> catalog = SosFactCatalog.all().stream().map(SosFactCatalog.Fact::key).collect(Collectors.toSet());
        Map<String, Object> facts = parse(files);
        facts.keySet().forEach(key -> assertTrue(catalog.contains(key), key));
        assertEquals(catalog.size(), SosFactCatalog.all().size(), "目录 key 不重复");
    }

    @Test
    void survivesGarbageInNewSources() {
        Map<String, String> garbage = new HashMap<>();
        files().keySet().forEach(key -> garbage.put(key, "\u0000 garbage : = | ' \n\t\t::\n|||\nCA '\nPort 1:\nDrive /c0/s\n0/0\n252:0\n"));
        garbage.put("sos_commands/storcli/storcli64_.call_show_all", "Controller = x\nVD LIST :\n0/0 RAID1\nEnclosure LIST :\n252 OK 99999 1\n");
        garbage.put("sos_commands/hpssm/ssacli_ctrl_all_show_config_detail", "   orphan: value\nX in Slot\n      physicaldrive\n");
        garbage.put("sos_commands/nvme/nvme_list", "Node\n---- ----\n/dev/\n");
        SosReportParser.Result result = SosReportParser.parse(garbage);
        assertNull(result.facts().get("storage.raidPhysicalDrives"));
    }

    @Test
    void keepsFieldsAfterVpdWhenVpdIsTheLastCapability() {
        Map<String, String> files = files();
        files.put("sos_commands/pci/lspci_-nnvvv", """
            5e:00.0 Ethernet controller [0200]: Intel Corporation Ethernet Controller X710 for 10GbE SFP+ [8086:1572] (rev 02)
            \tCapabilities: [e0] Vital Product Data
            \t\tProduct Name: XL710 40GbE Controller
            \t\tRead-only fields:
            \t\t\t[PN] Part number: X710DA2G2P5
            \t\tEnd
            \tKernel driver in use: i40e
            \tNUMA node: 1
            """);
        Map<String, Object> nic = row(parse(files), "hardware.pciDevices", "address", "5e:00.0");
        assertEquals("X710DA2G2P5", nic.get("partNumber"));
        assertEquals("i40e", nic.get("driver"), "VPD 之后的一级缩进字段不能被当成 VPD");
        assertEquals("1", nic.get("numaNode"));
    }
}
