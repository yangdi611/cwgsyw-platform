package com.cwgsyw.platform.module.sosreport.parser;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.cwgsyw.platform.module.sosreport.parser.SosHardwareFixtures.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 存储：操作系统可见的磁盘、多路径、LVM 和各厂商 RAID 卡工具的输出。 */
@SuppressWarnings("unchecked")
class SosStorageParserTest {

    // ─── 磁盘 ────────────────────────────────────────────────────────────────

    @Test
    void enrichesDisksWithFirmwareLocationAndSmart() {
        Map<String, Object> facts = parse(files());
        Map<String, Object> sda = row(facts, "storage.disks", "name", "sda");
        assertEquals("ATA", sda.get("vendor"));
        assertEquals("INTEL SSDSC2KB480G8", sda.get("model"));
        assertEquals("PHYF812345678", sda.get("serial"));
        assertEquals("XCV10132", sda.get("firmware"));
        assertEquals("0x55cd2e414f6d1234", sda.get("wwn"));
        assertEquals("0:0:0:0", sda.get("hctl"));
        assertEquals("sata", sda.get("transport"));
        assertEquals(false, sda.get("rotational"));
        assertEquals("Solid State Device", sda.get("rotationRate"));
        assertEquals("PASSED", sda.get("smartHealth"));
        assertEquals(12345, sda.get("powerOnHours"));
        assertEquals(27, sda.get("temperatureC"));
        assertEquals(3, sda.get("reallocatedSectors"));
        assertTrue(hasIssue(facts, "磁盘 sda 重映射扇区 3"));

        Map<String, Object> nvme = row(facts, "storage.disks", "name", "nvme0n1");
        assertEquals("VDV10131", nvme.get("firmware"));
        assertEquals("pci-0000:5f:00.0-nvme-1", nvme.get("location"));
        assertEquals(20123, nvme.get("powerOnHours"));
        assertEquals(31, nvme.get("temperatureC"));
        assertEquals(92, nvme.get("percentageUsed"));
        assertEquals(0, nvme.get("mediaErrors"));
        assertTrue(hasIssue(facts, "磁盘 nvme0n1 寿命已用 92%"));
    }

    @Test
    void readsNvmeFirmwareFromNvmeListWithoutSmartctl() {
        Map<String, String> files = files();
        files.remove("sos_commands/nvme/smartctl_--all_.dev.nvme0n1");
        Map<String, Object> nvme = row(parse(files), "storage.disks", "name", "nvme0n1");
        assertEquals("VDV10131", nvme.get("firmware"));
    }

    @Test
    void parsesMultipathAndLvm() {
        Map<String, Object> facts = parse(files());
        Map<String, Object> mpath = rows(facts, "storage.multipaths").get(0);
        assertEquals("mpatha", mpath.get("name"));
        assertEquals("36005076303ffc5a60000000000001234", mpath.get("wwid"));
        assertEquals("IBM", mpath.get("vendor"));
        assertEquals("2107900", mpath.get("product"));
        assertEquals("50G", mpath.get("size"));
        assertEquals(2, mpath.get("paths"));
        assertEquals(1, mpath.get("activePaths"));
        assertTrue(hasIssue(facts, "多路径 mpatha 有 1 条路径不可用"));

        Map<String, Object> vg = rows(facts, "storage.volumeGroups").get(0);
        assertEquals("rootvg", vg.get("name"));
        assertEquals("<445.62g", vg.get("size"));
        assertEquals("100.00g", vg.get("free"));
        assertEquals(2, vg.get("lvCount"));
        assertEquals(List.of("root"), rows(facts, "storage.logicalVolumes").stream().map(row -> row.get("name")).toList(), "不含内部卷");
        List<Map<String, Object>> pvs = rows(facts, "storage.physicalVolumes");
        assertEquals(List.of("/dev/sda3", "/dev/sdb"), pvs.stream().map(row -> row.get("device")).toList(), "不含非 PV 设备");
        assertEquals("rootvg", pvs.get(0).get("volumeGroup"));
        assertFalse(pvs.get(1).containsKey("volumeGroup"));
        assertEquals("50.00g", pvs.get(1).get("size"));
    }

    // ─── RAID 卡 ─────────────────────────────────────────────────────────────

    @Test
    void parsesStorcliControllersDrivesAndEmptyBays() {
        Map<String, String> files = files();
        files.put("sos_commands/storcli/storcli64_.call_show_all", STORCLI_SUMMARY);
        files.put("sos_commands/storcli/storcli64_.call.eall.sall_show_all", STORCLI_DRIVES);
        Map<String, Object> facts = parse(files);

        Map<String, Object> controller = rows(facts, "storage.raidControllers").get(0);
        assertEquals("storcli", controller.get("tool"));
        assertEquals("AVAGO MegaRAID SAS 9361-8i", controller.get("model"));
        assertEquals("SK71234567", controller.get("serialNumber"));
        assertEquals("4.680.00-8417", controller.get("firmwareVersion"));
        assertEquals("24.21.0-0067", controller.get("firmwarePackage"));
        assertEquals("6.36.00.2_4.19.08.00_0x06180203", controller.get("biosVersion"));
        assertEquals("07.705.02.00-rh1", controller.get("driverVersion"));
        assertEquals("3b:00.0", controller.get("pciAddress"));
        assertEquals("PCIe Slot 1", controller.get("location"), "按 PCI 地址关联到 DMI 插槽");
        assertEquals("Optimal", controller.get("status"));
        assertEquals("1024MB", controller.get("cacheSize"));
        assertEquals("CVPM02", controller.get("batteryModel"));
        assertEquals(4, controller.get("physicalDriveCount"));

        List<Map<String, Object>> vds = rows(facts, "storage.raidVirtualDrives");
        assertEquals(List.of("0/0", "1/1"), vds.stream().map(row -> row.get("id")).toList());
        assertEquals("RAID5", vds.get(1).get("level"));
        assertEquals("7.276 TB", vds.get(1).get("size"));
        assertEquals("data", vds.get(1).get("name"));

        Map<String, Object> s0 = row(facts, "storage.raidPhysicalDrives", "location", "/c0/e252/s0");
        assertEquals("PHDV7234567A480BGN", s0.get("serialNumber"));
        assertEquals("SCV10111", s0.get("firmware"));
        assertEquals("ATA", s0.get("vendor"));
        assertEquals("INTEL SSDSC2KB480G7", s0.get("model"));
        assertEquals("55cd2e414e5fca5b", s0.get("wwn"));
        assertEquals("447.130 GB", s0.get("rawSize"));
        assertEquals(22, s0.get("temperatureC"));
        assertEquals(0, s0.get("mediaErrors"));
        assertEquals(false, s0.get("smartAlert"));
        assertEquals("Offln", row(facts, "storage.raidPhysicalDrives", "location", "/c0/e252/s3").get("state"));

        List<Map<String, Object>> empty = rows(facts, "storage.raidPhysicalDrives").stream()
            .filter(row -> Boolean.FALSE.equals(row.get("installed"))).toList();
        assertEquals(List.of("/c0/e252/s4", "/c0/e252/s5", "/c0/e252/s6", "/c0/e252/s7"),
            empty.stream().map(row -> row.get("location")).toList(), "背板 8 个槽位，4 块盘，其余为空槽位");
        assertEquals(true, empty.get(0).get("inferred"));

        assertTrue(hasIssue(facts, "逻辑盘 storcli 控制器 0 / 1/1 状态：Dgrd"));
        assertTrue(hasIssue(facts, "物理盘 /c0/e252/s3 状态：Offln"));
        assertFalse(hasIssue(facts, "/c0/e252/s4"), "空槽位不是告警");
    }

    @Test
    void parsesMegaCli() {
        Map<String, String> files = new HashMap<>();
        files.put("sos_commands/megacli/opt.MegaRAID.MegaCli.MegaCli64_-AdpAllInfo_-aALL", """
            Adapter #0

            ==============================================================================
                                Versions
                            ================
            Product Name    : PERC H730P Mini
            Serial No       : 5BC0ABC
            FW Package Build: 25.5.6.0009

                            Image Versions in Flash:
                            ================
            BIOS Version       : 6.33.01.0_4.19.08.00_0x06120304
            FW Version         : 4.300.00-8366

                            PCI Info
                            ================
            Bus Number      : 2
            Device Number   : 0
            Function Number : 0

                            Device Present
                            ================
            Virtual Drives    : 1
              Degraded        : 0
              Offline         : 0
              Failed Disks    : 1
            """);
        files.put("sos_commands/megacli/opt.MegaRAID.MegaCli.MegaCli64_LDPDInfo_-aALL", """
            Adapter #0

            Number of Virtual Disks: 1
            Virtual Drive: 0 (Target Id: 0)
            Name                :
            RAID Level          : Primary-1, Secondary-3, RAID Level Qualifier-0
            Size                : 557.75 GB
            State               : Optimal
            PD: 0 Information
            Enclosure Device ID: 32
            Slot Number: 0
            Device Id: 0
            WWN: 5000C500A1B2C3D4
            Media Error Count: 0
            Predictive Failure Count: 0
            PD Type: SAS
            Raw Size: 279.396 GB [0x22ecb25c Sectors]
            Firmware state: Online, Spun Up
            Device Firmware Level: LS0A
            Inquiry Data: SEAGATE ST300MM0008     LS0AS0K2BG4D
            Drive Temperature :28C (82.40 F)
            Media Type: Hard Disk Device

            PD: 1 Information
            Enclosure Device ID: 32
            Slot Number: 1
            Media Error Count: 5
            Firmware state: Online, Spun Up
            """);
        Map<String, Object> facts = parse(files);
        Map<String, Object> controller = rows(facts, "storage.raidControllers").get(0);
        assertEquals("PERC H730P Mini", controller.get("model"));
        assertEquals("5BC0ABC", controller.get("serialNumber"));
        assertEquals("4.300.00-8366", controller.get("firmwareVersion"));
        assertEquals("02:00.0", controller.get("pciAddress"));
        Map<String, Object> vd = rows(facts, "storage.raidVirtualDrives").get(0);
        assertEquals("RAID10", vd.get("level"));
        assertEquals("Optimal", vd.get("state"));
        Map<String, Object> pd0 = row(facts, "storage.raidPhysicalDrives", "location", "Adapter0/E32/S0");
        assertEquals("LS0A", pd0.get("firmware"));
        assertEquals("279.396 GB", pd0.get("size"));
        assertEquals(28, pd0.get("temperatureC"));
        assertEquals("SEAGATE ST300MM0008     LS0AS0K2BG4D", pd0.get("inquiry"));
        assertEquals(5, row(facts, "storage.raidPhysicalDrives", "location", "Adapter0/E32/S1").get("mediaErrors"));
        assertTrue(hasIssue(facts, "Failed Disks：1"));
        assertTrue(hasIssue(facts, "物理盘 Adapter0/E32/S1 介质错误 5"));
    }

    @Test
    void parsesSsacli() {
        Map<String, String> files = files();
        files.put("sos_commands/hpssm/ssacli_ctrl_all_show_config_detail", """

            Smart Array P440ar in Slot 0 (Embedded)
               Bus Interface: PCI
               Slot: 0
               Serial Number: PDNLH0BRH7V0UP
               Controller Status: OK
               Firmware Version: 6.60
               Total Cache Size: 2.0
               Battery/Capacitor Status: Failed (Replace Batteries/Capacitors)
               Driver Name: hpsa
               PCI Address (Domain:Bus:Device.Function): 0000:3B:00.0

               Array: A
                  Interface Type: SAS
                  Status: OK

                  Logical Drive: 1
                     Size: 558.9 GB
                     Fault Tolerance: 1+0
                     Status: OK
                     Disk Name: /dev/sda

                  physicaldrive 1I:1:1
                     Port: 1I
                     Box: 1
                     Bay: 1
                     Status: OK
                     Interface Type: SAS
                     Size: 600 GB
                     Firmware Revision: HPD7
                     Serial Number: S0K2ABCD
                     Model: HP      EG0600FBVFP
                     Current Temperature (C): 31

               Unassigned

                  physicaldrive 1I:1:2
                     Bay: 2
                     Status: Predictive Failure
                     Serial Number: S0K2EFGH

               SEP (Vendor ID PMCSIERA, Model SRCv8x6G) 380
                  Device Number: 380
                  Firmware Version: RevB
            """);
        Map<String, Object> facts = parse(files);
        Map<String, Object> controller = rows(facts, "storage.raidControllers").get(0);
        assertEquals("Smart Array P440ar", controller.get("model"));
        assertEquals("0", controller.get("slot"));
        assertEquals("6.60", controller.get("firmwareVersion"), "SEP 的固件版本不能覆盖控制器");
        assertEquals("2.0 GB", controller.get("cacheSize"));
        assertEquals("PCIe Slot 1", controller.get("location"));
        Map<String, Object> vd = rows(facts, "storage.raidVirtualDrives").get(0);
        assertEquals("RAID10", vd.get("level"));
        assertEquals("/dev/sda", vd.get("osDevice"));
        assertEquals("A", vd.get("array"));
        Map<String, Object> pd = row(facts, "storage.raidPhysicalDrives", "location", "1I:1:1");
        assertEquals("HP EG0600FBVFP", pd.get("model"));
        assertEquals("HPD7", pd.get("firmware"));
        assertEquals("1", pd.get("slot"));
        assertEquals(31, pd.get("temperatureC"));
        assertFalse(row(facts, "storage.raidPhysicalDrives", "location", "1I:1:2").containsKey("array"));
        assertTrue(hasIssue(facts, "电池/电容状态：Failed"));
        assertTrue(hasIssue(facts, "物理盘 1I:1:2 状态：Predictive Failure"));
    }

    @Test
    void parsesArcconfAndSas3ircu() {
        Map<String, String> files = new HashMap<>();
        files.put("sos_commands/arcconf/arcconf_getconfig_1", """
            Controllers found: 1
            ----------------------------------------------------------------------
            Controller information
            ----------------------------------------------------------------------
               Controller Status                          : Optimal
               Controller Model                           : Adaptec ASR8805
               Controller Serial Number                   : 7A4613E4ABC
               --------------------------------------------------------
               Controller Version Information
               --------------------------------------------------------
               BIOS                                       : 7.17-0 (33556)
               Firmware                                   : 7.17-0 (33556)
               Driver                                     : 1.2-1 (50877)
            ----------------------------------------------------------------------
            Logical device information
            ----------------------------------------------------------------------
            Logical Device number 0
               Logical Device name                        : sys
               RAID level                                 : 1
               Status of Logical Device                   : Optimal
               Size                                       : 285568 MB
            ----------------------------------------------------------------------
            Physical Device information
            ----------------------------------------------------------------------
                  Device #0
                     Device is a Hard drive
                     State                                : Online
                     Transfer Speed                       : SAS 12.0 Gb/s
                     Reported Channel,Device(T:L)         : 0,0(0:0)
                     Reported Location                    : Enclosure 0, Slot 3
                     Vendor                               : SEAGATE
                     Model                                : ST300MM0008
                     Firmware                             : TT31
                     Serial number                        : S0K2BG4D
                  Device #1
                     Device is an Enclosure services device
                     Reported Location                    : Enclosure 0
                     Vendor                               : ADAPTEC
            """);
        files.put("sos_commands/sas3ircu/sas3ircu_0_display", """
            Avago Technologies SAS3 IR Configuration Utility.
            Read configuration has been initiated for controller 0
            ------------------------------------------------------------------------
            Controller information
            ------------------------------------------------------------------------
              Controller type                         : SAS3008
              BIOS version                            : 8.37.00.00
              Firmware version                        : 16.00.01.00
              Slot                                    : 3
              Bus                                     : 24
              Device                                  : 0
              Function                                : 0
            ------------------------------------------------------------------------
            IR Volume information
            ------------------------------------------------------------------------
            IR volume 1
              Status of volume                        : Okay (OKY)
              RAID level                              : RAID1
              Size (in MB)                            : 285148
            ------------------------------------------------------------------------
            Physical device information
            ------------------------------------------------------------------------
            Initiator at ID #0

            Device is a Hard disk
              Enclosure #                             : 1
              Slot #                                  : 0
              State                                   : Optimal (OPT)
              Size (in MB)/(in sectors)               : 286102/585937499
              Manufacturer                            : SEAGATE
              Model Number                            : ST300MM0008
              Firmware Revision                       : TT31
              Serial No                               : S0K2BG4D
              Protocol                                : SAS
              Drive Type                              : SAS_HDD

            Device is a Enclosure services device
              Enclosure #                             : 1
              Slot #                                  : 8
            ------------------------------------------------------------------------
            Enclosure information
            ------------------------------------------------------------------------
              Enclosure#                              : 1
              Numslots                                : 4
              StartSlot                               : 0
            ------------------------------------------------------------------------
            SAS3IRCU: Command DISPLAY Completed Successfully.
            """);
        Map<String, Object> facts = parse(files);
        Map<String, Object> adaptec = row(facts, "storage.raidControllers", "tool", "arcconf");
        assertEquals("Adaptec ASR8805", adaptec.get("model"));
        assertEquals("7.17-0 (33556)", adaptec.get("firmwareVersion"));
        assertEquals("1.2-1 (50877)", adaptec.get("driverVersion"));
        assertEquals("RAID1", row(facts, "storage.raidVirtualDrives", "tool", "arcconf").get("level"));
        Map<String, Object> arcDrive = row(facts, "storage.raidPhysicalDrives", "location", "Enclosure 0, Slot 3");
        assertEquals("TT31", arcDrive.get("firmware"));
        assertEquals("S0K2BG4D", arcDrive.get("serialNumber"));
        assertEquals("3", arcDrive.get("slot"));
        assertEquals("Online", arcDrive.get("state"));
        assertEquals(1, rows(facts, "storage.raidPhysicalDrives").stream().filter(row -> "arcconf".equals(row.get("tool"))).count(),
            "背板设备不是物理盘");

        Map<String, Object> lsi = row(facts, "storage.raidControllers", "tool", "sas3ircu");
        assertEquals("SAS3008", lsi.get("model"));
        assertEquals("16.00.01.00", lsi.get("firmwareVersion"));
        assertEquals("18:00.0", lsi.get("pciAddress"));
        assertEquals("Okay (OKY)", row(facts, "storage.raidVirtualDrives", "tool", "sas3ircu").get("state"));
        Map<String, Object> lsiDrive = row(facts, "storage.raidPhysicalDrives", "location", "E1/S0");
        assertEquals("ST300MM0008", lsiDrive.get("model"));
        assertEquals("286102 MB", lsiDrive.get("size"));
        List<Object> empty = rows(facts, "storage.raidPhysicalDrives").stream()
            .filter(row -> "sas3ircu".equals(row.get("tool")) && Boolean.FALSE.equals(row.get("installed")))
            .map(row -> row.get("location")).toList();
        assertEquals(List.of("E1/S1", "E1/S2", "E1/S3"), empty);
        assertTrue(issues(facts).isEmpty(), String.valueOf(issues(facts)));
    }

    @Test
    void parsesStorcliTablesWithoutTypeColumn() {
        Map<String, String> files = files();
        String older = STORCLI_SUMMARY
            .replace("Model                Sp Type", "Model                Sp")
            .replace("INTEL SSDSC2KB480G7  U  -", "INTEL SSDSC2KB480G7  U")
            .replace("ST4000NM0025         U  -", "ST4000NM0025         U");
        files.put("sos_commands/storcli/storcli64_.call_show_all", older);
        Map<String, Object> facts = parse(files);
        assertEquals("INTEL SSDSC2KB480G7", row(facts, "storage.raidPhysicalDrives", "location", "/c0/e252/s0").get("model"),
            "没有 Type 列时型号的最后一个词不能被当成 Sp");
        assertEquals("ST4000NM0025", row(facts, "storage.raidPhysicalDrives", "location", "/c0/e252/s3").get("model"));
        assertEquals(4, rows(facts, "storage.raidPhysicalDrives").stream().filter(row -> Boolean.FALSE.equals(row.get("installed"))).count());
    }

    @Test
    void skipsEmptyBayInferenceWhenSomeDrivesWereNotParsed() {
        Map<String, String> files = files();
        // 背板报告 5 块盘，但只解析到 4 块：不推算空槽位，避免把有盘的槽位标成空。
        files.put("sos_commands/storcli/storcli64_.call_show_all", STORCLI_SUMMARY.replace("252 OK        8  4", "252 OK        8  5"));
        Map<String, Object> facts = parse(files);
        assertTrue(rows(facts, "storage.raidPhysicalDrives").stream().noneMatch(row -> Boolean.FALSE.equals(row.get("installed"))));
    }
}
