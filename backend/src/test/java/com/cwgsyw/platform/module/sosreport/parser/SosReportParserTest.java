package com.cwgsyw.platform.module.sosreport.parser;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SosReportParserTest {

    private static final String DMIDECODE = """
        # dmidecode 3.2
        Handle 0x0001, DMI type 0, 26 bytes
        BIOS Information
        \tVendor: ACME
        \tVersion: 1.2.3
        \tRelease Date: 01/16/2026
        \tCharacteristics:
        \t\tPCI is supported

        Handle 0x0002, DMI type 1, 27 bytes
        System Information
        \tManufacturer: ACME
        \tProduct Name: ACME R1
        \tSerial Number: SN-001
        \tUUID: AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE

        Handle 0x0003, DMI type 2, 15 bytes
        Base Board Information
        \tManufacturer: ACME
        \tProduct Name: Board-X
        \tSerial Number: BOARD-SN-1

        Handle 0x0010, DMI type 4, 48 bytes
        Processor Information
        \tSocket Designation: CPU0
        \tManufacturer: Hygon
        \tVersion: Hygon C86
        \tStatus: Populated, Enabled
        \tCore Count: 32
        \tThread Count: 64

        Handle 0x0011, DMI type 4, 48 bytes
        Processor Information
        \tSocket Designation: CPU1
        \tManufacturer: Hygon
        \tVersion: Hygon C86
        \tStatus: Populated, Enabled
        \tCore Count: 32
        \tThread Count: 64

        Handle 0x0012, DMI type 4, 48 bytes
        Processor Information
        \tSocket Designation: CPU2
        \tStatus: Unpopulated
        \tCore Count: Unknown

        Handle 0x0020, DMI type 17, 40 bytes
        Memory Device
        \tSize: 64 GB
        \tLocator: DIMM0

        Handle 0x0021, DMI type 17, 40 bytes
        Memory Device
        \tSize: 64 GB
        \tLocator: DIMM1

        Handle 0x0022, DMI type 17, 40 bytes
        Memory Device
        \tSize: No Module Installed
        \tLocator: DIMM2
        """;

    private static final String LSCPU = """
        Architecture:          x86_64
        CPU(s):                128
        Thread(s) per core:    2
        Core(s) per socket:    16
        Socket(s):             4
        Vendor ID:             HygonGenuine
        Model name:            Hygon C86-4G (OPN:7420D)
        """;

    private static Map<String, String> baseFiles() {
        Map<String, String> files = new HashMap<>();
        files.put("version.txt", "sosreport: 3.9\nalternatives: unversioned\n");
        files.put("sos_commands/date/date", "Tue Nov  3 15:53:20 CST 2026\n");
        files.put("sos_commands/host/hostname", "web-01\n");
        files.put("etc/hostname", "ignored\n");
        files.put("etc/os-release", "PRETTY_NAME=\"UnionTech OS Server 20\"\nVERSION_ID=\"20\"\n");
        files.put("etc/uos-release", "UnionTech OS Server release 20 (kongli)\n");
        files.put("sos_commands/kernel/uname_-a", "Linux web-01 4.19.0-91.x86_64 #1 SMP Thu Dec 2 20:50:44 CST 2021 x86_64 x86_64 x86_64 GNU/Linux\n");
        files.put("sos_commands/hardware/dmidecode", DMIDECODE);
        files.put("sos_commands/processor/lscpu", LSCPU);
        files.put("sos_commands/memory/free", """
                          total        used        free
            Mem:      528125472     3308160   506600220
            Swap:      33554428           0    33554428
            """);
        files.put("sos_commands/networking/ip_-o_addr", """
            1: lo    inet 127.0.0.1/8 scope host lo\\       valid_lft forever
            6: bond0    inet 10.0.0.61/24 brd 10.0.0.255 scope global bond0\\       valid_lft forever
            7: eth9    inet 192.168.9.1/24 brd 192.168.9.255 scope global eth9\\       valid_lft forever
            """);
        files.put("sos_commands/networking/route_-n", """
            Kernel IP routing table
            Destination     Gateway         Genmask         Flags Metric Ref    Use Iface
            0.0.0.0         10.0.0.254      0.0.0.0         UG    0      0        0 bond0
            10.0.0.0        0.0.0.0         255.255.255.0   U     0      0        0 bond0
            """);
        files.put("etc/resolv.conf", "# comment\nsearch example.org\nnameserver 10.0.0.53\nnameserver 10.0.0.54\n");
        files.put("etc/chrony.conf", "# server ignored.example\nserver 10.0.0.31 iburst\npool ntp.example.org iburst\nkeyfile /etc/chrony.keys\n");
        files.put("sos_commands/systemd/timedatectl", "      Time zone: Asia/Shanghai (CST, +0800)\n");
        files.put("sos_commands/selinux/sestatus", "SELinux status:                 disabled\n");
        files.put("sos_commands/filesys/df_-al_-x_autofs", """
            Filesystem 1K-blocks Used Available Use% Mounted on
            efivarfs 0 0 0 - /sys/firmware/efi/efivars
            /dev/mapper/rootvg-lv_root 209612288 10730160 198882128 6% /
            /dev/sda1 204580 11472 193108 6% /boot/efi
            /dev/mapper/rootvg-lv_root 209612288 10730160 198882128 6% /
            tmpfs 264062736 0 264062736 0% /run
            """);
        files.put("sos_commands/block/lsblk", """
            NAME                          MAJ:MIN RM   SIZE RO TYPE  MOUNTPOINT
            nvme0n1                       259:2    0   3.5T  0 disk
            `-md0                           9:0    0  10.5T  0 raid5 /data02
            sda                             8:0    0 893.3G  0 disk
            |-sda1                          8:1    0   200M  0 part  /boot/efi
            `-sda3                          8:3    0 892.1G  0 part
            sr0                            11:0    1  1024M  0 rom
            loop0                           7:0    0     1G  0 loop
            """);
        files.put("sos_commands/block/blockdev_--report", """
            RO    RA   SSZ   BSZ   StartSec            Size   Device
            rw   256   512  4096          0   3840755982336   /dev/nvme0n1
            rw  8192   512  4096          0    959123030016   /dev/sda
            """);
        files.put("sos_commands/block/udevadm_info_.dev.nvme0n1", "P: /x\nE: ID_MODEL=YMTC-X\nE: ID_SERIAL_SHORT=NV123\n");
        files.put("sos_commands/block/udevadm_info_.dev.sda", "E: ID_VENDOR=3SNIC\nE: ID_MODEL=RAID1\nE: ID_BUS=scsi\n");
        files.put("proc/mdstat", "Personalities : [raid5]\nmd0 : active raid5 nvme3n1[4] nvme2n1[2] nvme1n1[1] nvme0n1[0]\n      11251817472 blocks\n");
        files.put("proc/net/bonding/bond0", """
            Bonding Mode: fault-tolerance (active-backup)
            MII Status: up

            Slave Interface: ens102f0
            MII Status: up
            Speed: 10000 Mbps
            Permanent HW addr: 02:00:00:00:00:01
            """);
        files.put("sos_commands/networking/ethtool_ens102f0", "Settings for ens102f0:\n\tSpeed: 10000Mb/s\n\tLink detected: yes\n");
        files.put("sos_commands/networking/ethtool_-i_ens102f0", "driver: rnp\nfirmware-version: 1.0.1\nbus-info: 0000:01:00.0\n");
        files.put("sos_commands/networking/ethtool_-P_ens102f0", "Permanent address: 02:00:00:00:00:01\n");
        files.put("sos_commands/networking/ethtool_bond0", "Settings for bond0:\n\tSpeed: 10000Mb/s\n");
        files.put("sos_commands/networking/ethtool_-P_bond0", "Permanent address: 00:00:00:00:00:00\n");
        files.put("sos_commands/networking/ethtool_lo", "Settings for lo:\n");
        files.put("sos_commands/networking/netstat_-W_-neopa", """
            Active Internet connections
            Proto Recv-Q Send-Q Local Address Foreign Address State User Inode PID/Program name
            tcp 0 0 0.0.0.0:22 0.0.0.0:* LISTEN 0 2060269 52275/sshd
            tcp 0 0 127.0.0.1:2019 0.0.0.0:* LISTEN 0 15265 52165/./caddy
            tcp6 0 0 :::9100 :::* LISTEN 0 1 1/node_exporter
            tcp 0 0 10.0.0.61:22 10.0.0.1:5 ESTABLISHED 0 1 1/sshd
            """);
        files.put("sos_commands/rpm/sh_-c_rpm_--nodigest_-qa", """
            bash-5.0-1.x86_64                  Sun Sep 20 18:20:23 2026
            sos-3.9-5.noarch                   Thu Sep  3 18:22:25 2026
            not a package line
            """);
        files.put("sos_commands/systemd/systemctl_list-units", """
              UNIT LOAD ACTIVE SUB DESCRIPTION
              sshd.service loaded active running OpenSSH server
            * kdump.service loaded failed failed Crash recovery
              tmp.mount loaded active mounted Temporary
            """);
        return files;
    }

    private static Map<String, Object> facts() {
        return SosReportParser.parse(baseFiles()).facts();
    }

    @Test
    void parsesHostIdentity() {
        Map<String, Object> facts = facts();
        assertEquals("web-01", facts.get("system.hostname"));
        assertEquals("SN-001", facts.get("system.serialNumber"));
        assertEquals("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", facts.get("system.uuid"));
        assertEquals("ACME", facts.get("system.manufacturer"));
        assertEquals("ACME R1", facts.get("system.productName"));
        assertEquals("physical", facts.get("system.hostType"));
        assertEquals("1.2.3", facts.get("bios.version"));
        assertEquals("2026-01-16", facts.get("bios.releaseDate"));
        assertEquals("Board-X", facts.get("baseboard.productName"));
    }

    @Test
    void prefersDmiOverLscpuForCpuCount() {
        Map<String, Object> facts = facts();
        assertEquals(2, facts.get("cpu.sockets"));
        assertEquals(64, facts.get("cpu.cores"));
        assertEquals(128, facts.get("cpu.threads"));
        assertEquals("Hygon C86-4G (OPN:7420D)", facts.get("cpu.model"));
    }

    @Test
    void fallsBackToLscpuWithoutDmi() {
        Map<String, String> files = baseFiles();
        files.remove("sos_commands/hardware/dmidecode");

        SosReportParser.Result result = SosReportParser.parse(files);

        assertEquals(4, result.facts().get("cpu.sockets"));
        assertEquals(64, result.facts().get("cpu.cores"));
        assertFalse(result.facts().containsKey("system.serialNumber"));
        assertFalse(result.facts().containsKey("system.hostType"));
        assertTrue(result.warnings().stream().anyMatch(warning -> warning.contains("序列号")));
        assertTrue(result.warnings().stream().anyMatch(warning -> warning.contains("dmidecode")));
    }

    @Test
    void separatesInstalledAndUsableMemory() {
        Map<String, Object> facts = facts();
        assertEquals(128L, facts.get("memory.installedGb"));
        assertEquals(new BigDecimal("503.7"), facts.get("memory.usableGb"));
        assertEquals(3, facts.get("memory.slotsTotal"));
        assertEquals(2, facts.get("memory.slotsUsed"));
        assertEquals(32L, facts.get("memory.swapGb"));
    }

    @Test
    void parsesOperatingSystem() {
        Map<String, Object> facts = facts();
        assertEquals("linux", facts.get("os.family"));
        assertEquals("UnionTech OS Server 20", facts.get("os.name"));
        assertEquals("UnionTech OS Server release 20 (kongli)", facts.get("os.release"));
        assertEquals("4.19.0-91.x86_64", facts.get("os.kernel"));
        assertEquals("x86_64", facts.get("os.arch"));
        assertEquals("Asia/Shanghai", facts.get("os.timezone"));
        assertEquals("disabled", facts.get("os.selinux"));
        assertEquals("uefi", facts.get("os.bootMode"));
        assertEquals("2026-09-03", facts.get("os.installDate"));
    }

    @Test
    void parsesNetworkFromDefaultRoute() {
        Map<String, Object> facts = facts();
        assertEquals("10.0.0.61", facts.get("network.primaryIp"));
        assertEquals("bond0", facts.get("network.primaryInterface"));
        assertEquals("10.0.0.254", facts.get("network.defaultGateway"));
        assertEquals(List.of("10.0.0.61", "192.168.9.1"), facts.get("network.ipv4Addresses"));
        assertEquals(List.of("10.0.0.53", "10.0.0.54"), facts.get("network.dnsServers"));
        assertEquals(List.of("10.0.0.31", "ntp.example.org"), facts.get("network.ntpServers"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void parsesBondsAndInterfaces() {
        Map<String, Object> facts = facts();
        List<Map<String, Object>> bonds = (List<Map<String, Object>>) facts.get("network.bonds");
        assertEquals("bond0", bonds.get(0).get("name"));
        assertEquals("fault-tolerance (active-backup)", bonds.get(0).get("mode"));
        assertEquals("up", bonds.get(0).get("status"));

        List<Map<String, Object>> interfaces = (List<Map<String, Object>>) facts.get("network.interfaces");
        Map<String, Object> nic = interfaces.stream().filter(row -> "ens102f0".equals(row.get("name"))).findFirst().orElseThrow();
        assertEquals("02:00:00:00:00:01", nic.get("mac"));
        assertEquals("10000Mb/s", nic.get("speed"));
        assertEquals("rnp", nic.get("driver"));
        assertEquals("bond0", nic.get("master"));

        Map<String, Object> bond = interfaces.stream().filter(row -> "bond0".equals(row.get("name"))).findFirst().orElseThrow();
        assertFalse(bond.containsKey("mac"), "全零 MAC 视为空");
        assertEquals(List.of("10.0.0.61/24"), bond.get("ipv4"));
        assertTrue(interfaces.stream().noneMatch(row -> "lo".equals(row.get("name"))));
    }

    @Test
    @SuppressWarnings("unchecked")
    void parsesListeningPortsWithoutPaths() {
        List<Map<String, Object>> ports = (List<Map<String, Object>>) facts().get("network.listeningPorts");
        assertEquals(3, ports.size());
        assertEquals(22, ports.get(0).get("port"));
        assertEquals("sshd", ports.get(0).get("process"));
        assertEquals("caddy", ports.get(1).get("process"), "只保留进程名");
    }

    @Test
    @SuppressWarnings("unchecked")
    void countsOnlyTopLevelDisks() {
        Map<String, Object> facts = facts();
        List<Map<String, Object>> disks = (List<Map<String, Object>>) facts.get("storage.disks");
        assertEquals(List.of("nvme0n1", "sda"), disks.stream().map(row -> row.get("name")).toList());
        assertEquals("YMTC-X", disks.get(0).get("model"));
        assertEquals("NV123", disks.get(0).get("serial"));
        assertEquals("nvme", disks.get(0).get("type"));
        assertEquals("3SNIC", disks.get(1).get("vendor"));
        assertEquals(4800L, facts.get("storage.totalDiskGb"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void parsesFilesystemsAndSoftwareRaid() {
        Map<String, Object> facts = facts();
        List<Map<String, Object>> filesystems = (List<Map<String, Object>>) facts.get("storage.filesystems");
        assertEquals(List.of("/", "/boot/efi"), filesystems.stream().map(row -> row.get("mountPoint")).toList());
        assertEquals(215L, filesystems.get(0).get("sizeGb"));

        List<Map<String, Object>> raids = (List<Map<String, Object>>) facts.get("storage.softwareRaids");
        assertEquals("md0", raids.get(0).get("name"));
        assertEquals("raid5", raids.get(0).get("level"));
        assertEquals(List.of("nvme0n1", "nvme1n1", "nvme2n1", "nvme3n1"), raids.get(0).get("members"));
    }

    @Test
    void parsesPackagesAndServices() {
        Map<String, Object> facts = facts();
        assertEquals(2, facts.get("software.packageCount"));
        assertEquals(List.of("bash-5.0-1.x86_64", "sos-3.9-5.noarch"), facts.get("software.packages"));
        assertEquals(List.of("sshd.service"), facts.get("software.runningServices"));
        assertEquals(List.of("kdump.service"), facts.get("software.failedServices"));
    }

    @Test
    void readsReportMetadata() {
        SosReportParser.Result result = SosReportParser.parse(baseFiles());
        assertEquals("3.9", result.sosVersion());
        assertEquals("Tue Nov  3 15:53:20 CST 2026", result.collectedAt());
    }

    @Test
    void treatsDmiPlaceholdersAsMissing() {
        for (String placeholder : List.of("Not Specified", "To Be Filled By O.E.M.", "Default string", "0123456789", "   ")) {
            Map<String, String> files = baseFiles();
            files.put("sos_commands/hardware/dmidecode", DMIDECODE.replace("SN-001", placeholder));
            assertFalse(SosReportParser.parse(files).facts().containsKey("system.serialNumber"), placeholder);
        }
    }

    @Test
    void treatsAllZeroUuidAsMissing() {
        Map<String, String> files = baseFiles();
        files.put("sos_commands/hardware/dmidecode",
            DMIDECODE.replace("AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE", "00000000-0000-0000-0000-000000000000"));
        assertFalse(SosReportParser.parse(files).facts().containsKey("system.uuid"));
    }

    @Test
    void detectsVirtualMachines() {
        Map<String, String> files = baseFiles();
        files.put("sos_commands/hardware/dmidecode", DMIDECODE.replace("ACME R1", "VMware Virtual Platform"));
        assertEquals("virtual", SosReportParser.parse(files).facts().get("system.hostType"));

        files = baseFiles();
        files.put("sos_commands/processor/lscpu", LSCPU + "Hypervisor vendor:     KVM\n");
        assertEquals("virtual", SosReportParser.parse(files).facts().get("system.hostType"));
    }

    @Test
    void fallsBackToIpRouteWhenRouteCommandIsMissing() {
        Map<String, String> files = baseFiles();
        files.remove("sos_commands/networking/route_-n");
        files.put("sos_commands/networking/ip_route_show_table_all", "default via 10.0.0.1 dev bond0 proto static\n");

        Map<String, Object> facts = SosReportParser.parse(files).facts();

        assertEquals("10.0.0.1", facts.get("network.defaultGateway"));
        assertEquals("10.0.0.61", facts.get("network.primaryIp"));
    }

    @Test
    void doesNotGuessPrimaryIpWhenSeveralInterfacesHaveNoDefaultRoute() {
        Map<String, String> files = baseFiles();
        files.remove("sos_commands/networking/route_-n");

        assertFalse(SosReportParser.parse(files).facts().containsKey("network.primaryIp"));
    }

    @Test
    void sanitizesControlCharactersAndLongValues() {
        Map<String, String> files = baseFiles();
        files.put("sos_commands/host/hostname", "web\u0007-01\u001b[31m\n");
        files.put("sos_commands/hardware/dmidecode", DMIDECODE.replace("ACME R1", "X".repeat(5000)));

        Map<String, Object> facts = SosReportParser.parse(files).facts();

        assertFalse(String.valueOf(facts.get("system.hostname")).contains("\u0007"));
        assertEquals(512, String.valueOf(facts.get("system.productName")).length());
    }

    @Test
    void survivesEmptyAndGarbageInput() {
        assertTrue(SosReportParser.parse(Map.of()).facts().isEmpty());

        Map<String, String> garbage = new HashMap<>();
        baseFiles().keySet().forEach(key -> garbage.put(key, "\u0000 garbage : = \n\t\t::\n0.0.0.0\nmd0 :\n"));
        SosReportParser.parse(garbage);
    }

    @Test
    void emitsOnlyCatalogKeys() {
        Set<String> catalog = SosFactCatalog.all().stream().map(SosFactCatalog.Fact::key).collect(Collectors.toSet());
        Map<String, Object> facts = facts();
        assertFalse(facts.isEmpty());
        facts.keySet().forEach(key -> assertTrue(catalog.contains(key), key));
    }

    /**
     * 用真实报告核对解析结果。样本可能含凭据，不进入仓库：
     * {@code SOS_REPORT_SAMPLE=/path/report.tar.xz SOS_REPORT_OUTPUT=/path/facts.json mvn test -Dtest=SosReportParserTest}
     */
    @Test
    @EnabledIfEnvironmentVariable(named = "SOS_REPORT_SAMPLE", matches = ".+")
    void parsesRealSample() throws IOException {
        SosArchiveReader.Result archive;
        try (InputStream input = Files.newInputStream(Path.of(System.getenv("SOS_REPORT_SAMPLE")))) {
            archive = new SosArchiveReader().read(input);
        }
        SosReportParser.Result result = SosReportParser.parse(archive.files());

        assertFalse(archive.files().containsKey("etc/ansible/hosts"));
        assertFalse(archive.files().containsKey("root/anaconda-ks.cfg"));
        assertTrue(result.facts().containsKey("system.hostname"));

        String output = System.getenv("SOS_REPORT_OUTPUT");
        if (output != null) {
            Map<String, Object> dump = new HashMap<>();
            dump.put("facts", result.facts());
            dump.put("warnings", result.warnings());
            dump.put("sosVersion", result.sosVersion());
            dump.put("collectedAt", result.collectedAt());
            dump.put("files", archive.files().keySet().stream().sorted().toList());
            dump.put("entries", archive.entries());
            dump.put("skippedSpecial", archive.skippedSpecial());
            Files.writeString(Path.of(output), new ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(dump));
        }
    }
}
