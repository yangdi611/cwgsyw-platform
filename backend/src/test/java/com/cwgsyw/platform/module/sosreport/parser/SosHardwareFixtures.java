package com.cwgsyw.platform.module.sosreport.parser;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 硬件明细解析测试的共用样本。样本按各工具的上游文本格式编写，字段名与真实输出一致，值为虚构。
 */
@SuppressWarnings("unchecked")
final class SosHardwareFixtures {

    private SosHardwareFixtures() {
    }


    static final String DMIDECODE = """
        # dmidecode 3.3
        Handle 0x0000, DMI type 0, 26 bytes
        BIOS Information
        \tVendor: Dell Inc.
        \tVersion: 2.12.2
        \tRelease Date: 07/09/2021
        \tROM Size: 64 MB
        \tBIOS Revision: 2.12
        \tFirmware Revision: 4.40

        Handle 0x0100, DMI type 1, 27 bytes
        System Information
        \tManufacturer: Dell Inc.
        \tProduct Name: PowerEdge R740
        \tVersion: Not Specified
        \tSerial Number: ABC1234
        \tUUID: 4c4c4544-0042-4310-8031-b4c04f313233
        \tSKU Number: SKU=0715;ModelName=PowerEdge R740
        \tFamily: PowerEdge

        Handle 0x0200, DMI type 2, 15 bytes
        Base Board Information
        \tManufacturer: Dell Inc.
        \tProduct Name: 0WGD1V
        \tVersion: A00
        \tSerial Number: .ABC1234.CNFCP0081B0123.
        \tAsset Tag: Not Specified

        Handle 0x0300, DMI type 3, 22 bytes
        Chassis Information
        \tManufacturer: Dell Inc.
        \tType: Rack Mount Chassis
        \tSerial Number: ABC1234
        \tAsset Tag: IT-0042
        \tBoot-up State: Safe
        \tPower Supply State: Safe
        \tThermal State: Warning
        \tHeight: 2 U
        \tNumber Of Power Cords: 2

        Handle 0x0400, DMI type 4, 48 bytes
        Processor Information
        \tSocket Designation: CPU1
        \tType: Central Processor
        \tFamily: Xeon
        \tManufacturer: Intel
        \tSignature: Type 0, Family 6, Model 85, Stepping 7
        \tVersion: Intel(R) Xeon(R) Gold 6248R CPU @ 3.00GHz
        \tMax Speed: 4000 MHz
        \tCurrent Speed: 3000 MHz
        \tStatus: Populated, Enabled
        \tSerial Number: Not Specified
        \tCore Count: 24
        \tCore Enabled: 24
        \tThread Count: 48

        Handle 0x0401, DMI type 4, 48 bytes
        Processor Information
        \tSocket Designation: CPU2
        \tStatus: Unpopulated
        \tCore Count: Unknown

        Handle 0x1000, DMI type 16, 23 bytes
        Physical Memory Array
        \tLocation: System Board Or Motherboard
        \tUse: System Memory
        \tError Correction Type: Multi-bit ECC
        \tMaximum Capacity: 3 TB
        \tNumber Of Devices: 24

        Handle 0x1100, DMI type 17, 84 bytes
        Memory Device
        \tTotal Width: 72 bits
        \tData Width: 64 bits
        \tSize: 32 GB
        \tForm Factor: DIMM
        \tLocator: A1
        \tBank Locator: Not Specified
        \tType: DDR4
        \tType Detail: Synchronous Registered (Buffered)
        \tSpeed: 2933 MT/s
        \tManufacturer: 00CE00B300CE
        \tSerial Number: 12345678
        \tPart Number: M393A4K40CB2-CVF
        \tRank: 2
        \tConfigured Memory Speed: 2666 MT/s

        Handle 0x1101, DMI type 17, 84 bytes
        Memory Device
        \tTotal Width: 72 bits
        \tData Width: 64 bits
        \tSize: 32 GB
        \tLocator: A2
        \tType: DDR4
        \tSpeed: 2933 MT/s
        \tManufacturer: SK Hynix
        \tSerial Number: 87654321
        \tPart Number: HMA84GR7CJR4N-WM
        \tRank: 2

        Handle 0x1102, DMI type 17, 84 bytes
        Memory Device
        \tSize: No Module Installed
        \tLocator: B1
        \tType: Unknown

        Handle 0x2700, DMI type 39, 22 bytes
        System Power Supply
        \tPower Unit Group: 1
        \tLocation: PSU1
        \tName: PWR SPLY,750W,RDNT,DELTA
        \tManufacturer: DELL
        \tSerial Number: CNDED0081A0123
        \tModel Part Number: 0D2CVPA02
        \tRevision: 00.1B.53
        \tMax Power Capacity: 750 W
        \tStatus: Present, OK
        \tPlugged: Yes
        \tHot Replaceable: Yes

        Handle 0x2701, DMI type 39, 22 bytes
        System Power Supply
        \tPower Unit Group: 1
        \tLocation: PSU2
        \tStatus: Not Present

        Handle 0x0900, DMI type 9, 17 bytes
        System Slot Information
        \tDesignation: PCIe Slot 1
        \tType: x8 PCI Express 3 x16
        \tCurrent Usage: In Use
        \tLength: Long
        \tBus Address: 0000:3b:00.0

        Handle 0x0901, DMI type 9, 17 bytes
        System Slot Information
        \tDesignation: PCIe Slot 2
        \tType: x16 PCI Express 3 x16
        \tCurrent Usage: Available
        \tLength: Long
        \tBus Address: 0000:00:00.0

        Handle 0x2900, DMI type 41, 11 bytes
        Onboard Device
        \tReference Designation: Integrated NIC 1
        \tType: Ethernet
        \tStatus: Enabled
        \tBus Address: 0000:5e:00.0

        Handle 0x2600, DMI type 38, 18 bytes
        IPMI Device Information
        \tInterface Type: KCS (Keyboard Control Style)
        \tSpecification Version: 2.0
        """;

    static final String LSPCI = """
        00:00.0 Host bridge [0600]: Intel Corporation Sky Lake-E DMI3 Registers [8086:2020] (rev 07)
        \tSubsystem: Intel Corporation Device [8086:0000]

        03:00.0 VGA compatible controller [0300]: Matrox Electronics Systems Ltd. Integrated Matrox G200eW3 Graphics Controller [102b:0536] (rev 04)
        \tSubsystem: Dell Device [1028:0715]

        3b:00.0 RAID bus controller [0104]: Broadcom / LSI MegaRAID SAS-3 3108 [Invader] [1000:005d] (rev 02)
        \tSubsystem: Broadcom / LSI MegaRAID SAS 9361-8i [1000:9361]
        \tPhysical Slot: 1
        \tCapabilities: [68] Express (v2) Endpoint, MSI 00
        \t\tLnkCap:\tPort #0, Speed 8GT/s, Width x8, ASPM L0s, Exit Latency L0s <2us
        \t\tLnkSta:\tSpeed 8GT/s (ok), Width x8 (ok)
        \tKernel driver in use: megaraid_sas
        \tKernel modules: megaraid_sas
        \tNUMA node: 0

        5e:00.0 Ethernet controller [0200]: Intel Corporation Ethernet Controller X710 for 10GbE SFP+ [8086:1572] (rev 02)
        \tSubsystem: Intel Corporation Ethernet Converged Network Adapter X710-2 [8086:0007]
        \tCapabilities: [a0] Express (v2) Endpoint, MSI 00
        \t\tLnkCap:\tPort #0, Speed 8GT/s, Width x8
        \t\tLnkSta:\tSpeed 5GT/s (downgraded), Width x8 (ok)
        \tCapabilities: [e0] Vital Product Data
        \t\tProduct Name: XL710 40GbE Controller
        \t\tRead-only fields:
        \t\t\t[PN] Part number: X710DA2G2P5
        \t\t\t[EC] Engineering changes: K12345-002
        \t\t\t[SN] Serial number: A0B1C2D3E4F5
        \t\t\t[RV] Reserved: checksum good, 0 byte(s) reserved
        \t\tEnd
        \tCapabilities: [140 v1] Device Serial Number 3c-fd-fe-ff-ff-a1-b2-c3
        \tKernel driver in use: i40e
        \tNUMA node: 1

        af:00.0 3D controller [0302]: NVIDIA Corporation GA100 [A100 PCIe 40GB] [10de:20f1] (rev a1)
        \tSubsystem: NVIDIA Corporation Device [10de:145f]
        \tKernel driver in use: nvidia

        d8:00.0 Fibre Channel [0c04]: QLogic Corp. ISP2722-based 16/32Gb Fibre Channel to PCIe Adapter [1077:2261] (rev 01)
        \tKernel driver in use: qla2xxx
        """;

    static String nvmeList() {
        String format = "%-16s %-20s %-40s %-9s %-26s %-16s %-8s%n";
        return String.format(format, "Node", "SN", "Model", "Namespace", "Usage", "Format", "FW Rev")
            + String.format(format, "-".repeat(16), "-".repeat(20), "-".repeat(40), "-".repeat(9), "-".repeat(26), "-".repeat(16), "-".repeat(8))
            + String.format(format, "/dev/nvme0n1", "PHLJ9999", "INTEL SSDPE2KX040T8", "1", "4.00  TB /   4.00  TB", "512   B +  0 B", "VDV10131");
    }

    static Map<String, String> files() {
        Map<String, String> files = new HashMap<>();
        files.put("sos_commands/hardware/dmidecode", DMIDECODE);
        files.put("sos_commands/pci/lspci_-nnvvv", LSPCI);
        files.put("sos_commands/host/hostname", "db-01\n");
        files.put("sos_commands/host/hostname_-f", "db-01.example.org\n");
        files.put("sos_commands/processor/lscpu", """
            Architecture:          x86_64
            CPU(s):                48
            Thread(s) per core:    2
            Core(s) per socket:    24
            Socket(s):             1
            NUMA node(s):          1
            Vendor ID:             GenuineIntel
            CPU family:            6
            Model:                 85
            Model name:            Intel(R) Xeon(R) Gold 6248R CPU @ 3.00GHz
            Stepping:              7
            CPU max MHz:           4000.0000
            CPU min MHz:           1200.0000
            Virtualization:        VT-x
            L3 cache:              36608K
            Vulnerability Meltdown: Not affected
            Vulnerability Spectre v2: Mitigation; Enhanced IBRS
            """);
        files.put("proc/cpuinfo", "processor\t: 0\nmicrocode\t: 0x5003302\nprocessor\t: 1\nmicrocode\t: 0x5003302\n");
        files.put("proc/meminfo", "MemTotal:       65681452 kB\nHugePages_Total:      16\nHugepagesize:       2048 kB\n");
        files.put("sys/kernel/mm/transparent_hugepage/enabled", "always [madvise] never\n");

        // 网络
        files.put("sos_commands/networking/ip_-o_addr", """
            2: ens5f0    inet 10.1.0.5/24 brd 10.1.0.255 scope global ens5f0\\       valid_lft forever
            2: ens5f0    inet6 2001:db8::5/64 scope global \\       valid_lft forever
            2: ens5f0    inet6 fe80::1/64 scope link \\       valid_lft forever
            3: ens5f0.100    inet 10.100.0.5/24 brd 10.100.0.255 scope global ens5f0.100\\       valid_lft forever
            """);
        files.put("sos_commands/networking/route_-n",
            "Destination Gateway Genmask Flags Metric Ref Use Iface\n0.0.0.0 10.1.0.1 0.0.0.0 UG 0 0 0 ens5f0\n");
        files.put("sos_commands/networking/ethtool_ens5f0", "Settings for ens5f0:\n\tSpeed: 10000Mb/s\n\tDuplex: Full\n\tPort: FIBRE\n\tLink detected: yes\n");
        files.put("sos_commands/networking/ethtool_-i_ens5f0",
            "driver: i40e\nversion: 2.8.20-k\nfirmware-version: 6.80 0x80003d05 1.2007.0\nbus-info: 0000:5e:00.0\n");
        files.put("sos_commands/networking/ethtool_-m_ens5f0", """
            \tIdentifier                                : 0x03 (SFP)
            \tConnector                                 : 0x07 (LC)
            \tTransceiver type                          : 10G Ethernet: 10G Base-SR
            \tLength (OM3)                              : 300m
            \tLaser wavelength                          : 850nm
            \tVendor name                               : FINISAR CORP.
            \tVendor OUI                                : 00:90:65
            \tVendor PN                                 : FTLX8571D3BCL
            \tVendor rev                                : A
            \tVendor SN                                 : AQA0B1C
            """);
        files.put("sos_commands/networking/ip_-s_-d_link", """
            1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000
                link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00 promiscuity 0
            2: ens5f0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 9000 qdisc mq state UP mode DEFAULT group default qlen 1000
                link/ether 3c:fd:fe:a1:b2:c3 brd ff:ff:ff:ff:ff:ff promiscuity 0 minmtu 68 maxmtu 9702
                RX: bytes  packets  errors  dropped missed  mcast
                1234       10       0       0       0       0
            3: ens5f0.100@ens5f0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP mode DEFAULT group default qlen 1000
                link/ether 3c:fd:fe:a1:b2:c3 brd ff:ff:ff:ff:ff:ff promiscuity 0
                vlan protocol 802.1Q id 100 <REORDER_HDR> addrgenmode eui64
            """);
        files.put("etc/ntp.conf", "server 127.127.1.0\nserver 10.0.0.32 iburst\n");
        files.put("sos_commands/infiniband/ibstat", """
            CA 'mlx5_0'
            \tCA type: MT4123
            \tNumber of ports: 1
            \tFirmware version: 20.31.1014
            \tHardware version: 0
            \tNode GUID: 0x0c42a10300abcdef
            \tPort 1:
            \t\tState: Active
            \t\tPhysical state: LinkUp
            \t\tRate: 200
            \t\tPort GUID: 0x0c42a10300abcdef
            \t\tLink layer: InfiniBand
            """);
        files.put("sos_commands/fibrechannel/udevadm_info_-a_.sys.class.fc_host.host1", """

            Udevadm info starts with the device specified by the devpath and then
            walks up the chain of parent devices.

              looking at device '/devices/pci0000:d7/0000:d7:00.0/0000:d8:00.0/host1/fc_host/host1':
                KERNEL=="host1"
                SUBSYSTEM=="fc_host"
                ATTR{node_name}=="0x20000024ff7d1234"
                ATTR{port_name}=="0x21000024ff7d1234"
                ATTR{port_state}=="Linkdown"
                ATTR{speed}=="unknown"
                ATTR{symbolic_name}=="QLE2692 FW:v8.08.231 DVR:v10.02.00.106-k"

              looking at parent device '/devices/pci0000:d7/0000:d7:00.0/0000:d8:00.0/host1':
                KERNELS=="host1"
                ATTR{port_name}=="0x0000000000000000"
            """);

        // 存储
        files.put("sos_commands/block/lsblk", """
            NAME    MAJ:MIN RM   SIZE RO TYPE MOUNTPOINT
            sda       8:0    0 447.1G  0 disk
            nvme0n1 259:0    0   3.7T  0 disk
            """);
        files.put("sos_commands/block/lsblk_-O_-P", """
            NAME="sda" KNAME="sda" TYPE="disk" ROTA="0" TRAN="sata" VENDOR="ATA     " HCTL="0:0:0:0" WWN="0x55cd2e414f6d1234"
            NAME="sda1" KNAME="sda1" TYPE="part" ROTA="0"
            NAME="nvme0n1" KNAME="nvme0n1" TYPE="disk" ROTA="0" TRAN="nvme" WWN="eui.0123"
            """);
        files.put("sos_commands/block/udevadm_info_.dev.nvme0n1",
            "E: ID_MODEL=INTEL SSDPE2KX040T8\nE: ID_SERIAL_SHORT=PHLJ9999\nE: ID_PATH=pci-0000:5f:00.0-nvme-1\n");
        files.put("sos_commands/ata/smartctl_-a_.dev.sda", """
            smartctl 7.1 2019-12-30 r5022 [x86_64-linux-4.18.0] (local build)
            === START OF INFORMATION SECTION ===
            Model Family:     Intel S4510/S4610/S4500/S4600 Series SSDs
            Device Model:     INTEL SSDSC2KB480G8
            Serial Number:    PHYF812345678
            LU WWN Device Id: 5 5cd2e4 14f6d1234
            Firmware Version: XCV10132
            Rotation Rate:    Solid State Device
            Form Factor:      2.5 inches
            SATA Version is:  SATA 3.2, 6.0 Gb/s (current: 6.0 Gb/s)

            === START OF READ SMART DATA SECTION ===
            SMART overall-health self-assessment test result: PASSED

            ID# ATTRIBUTE_NAME          FLAG     VALUE WORST THRESH TYPE      UPDATED  WHEN_FAILED RAW_VALUE
              5 Reallocated_Sector_Ct   0x0032   100   100   000    Old_age   Always       -       3
              9 Power_On_Hours          0x0032   100   100   000    Old_age   Always       -       12345
            194 Temperature_Celsius     0x0022   100   100   000    Old_age   Always       -       27 (Min/Max 18/40)
            """);
        files.put("sos_commands/nvme/smartctl_--all_.dev.nvme0n1", """
            === START OF INFORMATION SECTION ===
            Model Number:                       INTEL SSDPE2KX040T8
            Serial Number:                      PHLJ9999
            Firmware Version:                   VDV10131
            Total NVM Capacity:                 4,000,787,030,016 [4.00 TB]

            === START OF SMART DATA SECTION ===
            SMART overall-health self-assessment test result: PASSED
            Temperature:                        31 Celsius
            Percentage Used:                    92%
            Power On Hours:                     20,123
            Media and Data Integrity Errors:    0
            """);
        files.put("sos_commands/nvme/nvme_list", nvmeList());
        files.put("sos_commands/multipath/multipath_-ll", """
            mpatha (36005076303ffc5a60000000000001234) dm-2 IBM,2107900
            size=50G features='1 queue_if_no_path' hwhandler='0' wp=rw
            `-+- policy='service-time 0' prio=1 status=active
              |- 1:0:0:0 sdb 8:16 active ready running
              `- 2:0:0:0 sdc 8:32 failed faulty running
            """);
        files.put("sos_commands/lvm2/vgs_-v_-o_vg_mda_count_vg_mda_free_vg_mda_size_vg_mda_used_count_vg_tags_systemid_lock_type_--foreign", """
                Using volume group(s) on command line.
              VG     Attr   Ext   #PV #LV #SN VSize    VFree   VG UUID   VProfile #VMda
              rootvg wz--n- 4.00m   1   2   0 <445.62g 100.00g 3Qx2-abcd          1
            """);
        files.put("sos_commands/lvm2/lvs_-a_-o_lv_tags_devices_--foreign", """
              LV              VG     Attr       LSize   Pool Origin Devices
              root            rootvg -wi-ao---- 300.00g             /dev/sda3(0)
              [lvol0_pmspare] rootvg ewi-------   4.00m
            """);
        files.put("sos_commands/lvm2/pvs_-a_-v_-o_pv_mda_free_--foreign", """
              PV         VG     Fmt  Attr PSize    PFree   DevSize
              /dev/sda1              ---        0       0  200.00m
              /dev/sda3  rootvg lvm2 a--  <445.62g 100.00g 445.62g
              /dev/sdb          lvm2 ---    50.00g  50.00g  50.00g
            """);

        // BMC
        files.put("sos_commands/ipmitool/ipmitool_mc_info", """
            Device ID                 : 32
            Device Revision           : 1
            Firmware Revision         : 4.40
            IPMI Version              : 2.0
            Manufacturer ID           : 674
            Manufacturer Name         : DELL Inc
            Product Name              : Unknown (0x100)
            """);
        files.put("sos_commands/ipmitool/ipmitool_lan_print", "IP Address Source       : Static Address\nIP Address              : 0.0.0.0\n");
        files.put("sos_commands/ipmitool/ipmitool_lan_print_1", """
            Set in Progress         : Set Complete
            IP Address Source       : Static Address
            IP Address              : 10.9.0.21
            Subnet Mask             : 255.255.255.0
            MAC Address             : d0:94:66:aa:bb:cc
            Default Gateway IP      : 10.9.0.1
            802.1q VLAN ID          : Disabled
            """);
        files.put("sos_commands/ipmitool/ipmitool_fru_print", """
            FRU Device Description : Builtin FRU Device (ID 0)
             Board Mfg Date        : Mon Jan  1 00:00:00 2018
             Board Mfg             : DELL
             Board Product         : PowerEdge R740
             Board Serial          : CNFCP0081B0123
             Product Name          : PowerEdge R740
             Product Serial        : ABC1234

            FRU Device Description : PS2 (ID 3)
             Device not present (Requested sensor, data, or record not found)
            """);
        files.put("sos_commands/ipmitool/ipmitool_sensor_list", """
            Inlet Temp       | 23.000     | degrees C  | ok    | na        | -7.000    | 3.000     | 38.000    | 42.000    | na
            Fan1             | 0.000      | RPM        | cr    | na        | 360.000   | 600.000   | na        | na        | na
            PS1 Status       | 0x0        | discrete   | 0x0100| na        | na        | na        | na        | na        | na
            PS2 Status       | na         | discrete   | na    | na        | na        | na        | na        | na        | na
            """);
        files.put("sos_commands/ipmitool/ipmitool_sel_info", "Entries          : 312\nPercent Used     : 95%\n");
        files.put("sos_commands/ipmitool/ipmitool_sel_elist", """
               1 | 01/05/2026 | 10:00:01 | Power Supply PS2 | Power Supply AC lost | Asserted
               2 | 01/06/2026 | 11:00:00 | Memory #0x53 | Correctable ECC | Asserted
            """);
        files.put("sos_commands/ipmitool/ipmitool_chassis_status",
            "System Power         : on\nPower Overload       : false\nDrive Fault          : true\nCooling/Fan Fault    : false\n");

        // GPU
        files.put("sos_commands/nvidia/nvidia-smi_-q", """
            ==============NVSMI LOG==============

            Timestamp                                 : Mon Nov  9 10:00:00 2026
            Driver Version                            : 535.104.05
            CUDA Version                              : 12.2

            Attached GPUs                             : 1
            GPU 00000000:AF:00.0
                Product Name                          : NVIDIA A100-PCIE-40GB
                Serial Number                         : 1320221012345
                GPU UUID                              : GPU-1111-2222
                VBIOS Version                         : 92.00.25.00.08
                Board Part Number                     : 900-21001-0000-000
                FB Memory Usage
                    Total                             : 40960 MiB
                    Used                              : 0 MiB
                Temperature
                    GPU Current Temp                  : 33 C
            """);

        // 系统
        files.put("sos_commands/host/uptime", " 15:53:20 up 120 days,  3:01,  2 users,  load average: 0.00, 0.01, 0.05\n");
        files.put("sos_commands/boot/mokutil_--sb-state", "SecureBoot disabled\n");
        files.put("sos_commands/tuned/tuned-adm_active", "Current active profile: throughput-performance\n");
        files.put("sos_commands/kdump/kdumpctl_status", "kdump: Kdump is not operational\n");
        files.put("sos_commands/firewalld/firewall-cmd_--state", "not running\n");
        files.put("proc/sys/kernel/tainted", "0\n");
        files.put("sos_commands/systemd/timedatectl",
            "           Time zone: Asia/Shanghai (CST, +0800)\nSystem clock synchronized: no\n              NTP service: active\n");
        files.put("sos_commands/chrony/chronyc_tracking",
            "Reference ID    : 0A00001F (10.0.0.31)\nStratum         : 3\nSystem time     : 0.000012 seconds fast of NTP time\nLeap status     : Normal\n");
        files.put("sos_commands/systemd/systemctl_list-unit-files",
            "UNIT FILE STATE VENDOR PRESET\nsshd.service enabled enabled\nkdump.service disabled disabled\ntmp.mount static -\n");
        files.put("sos_commands/kernel/lsmod", "Module                  Size  Used by\nmegaraid_sas          172032  4\ni40e                  425984  0\n");
        return files;
    }

    static final String STORCLI_SUMMARY = """
        CLI Version = 007.1017.0000.0000 May 10, 2019
        Operating system = Linux 4.18.0
        Controller = 0
        Status = Success
        Description = None

        Basics :
        ======
        Controller = 0
        Model = AVAGO MegaRAID SAS 9361-8i
        Serial Number = SK71234567
        SAS Address =  500605b00c0c0c0c
        PCI Address = 00:3b:00:00

        Version :
        =======
        Firmware Package Build = 24.21.0-0067
        Firmware Version = 4.680.00-8417
        Bios Version = 6.36.00.2_4.19.08.00_0x06180203
        Driver Name = megaraid_sas
        Driver Version = 07.705.02.00-rh1

        Status :
        ======
        Controller Status = Optimal

        HwCfg :
        =====
        On Board Memory Size = 1024MB

        VD LIST :
        =======

        ---------------------------------------------------------------
        DG/VD TYPE  State Access Consist Cache Cac sCC       Size Name
        ---------------------------------------------------------------
        0/0   RAID1 Optl  RW     Yes     RWBD  -   ON  446.625 GB os
        1/1   RAID5 Dgrd  RW     Yes     RWBD  -   ON    7.276 TB data
        ---------------------------------------------------------------

        Cac=CacheCade|Rec=Recovery|OfLn=OffLine|Pdgd=Partially Degraded|Dgrd=Degraded

        PD LIST :
        =======

        ---------------------------------------------------------------------------------
        EID:Slt DID State DG       Size Intf Med SED PI SeSz Model                Sp Type
        ---------------------------------------------------------------------------------
        252:0     8 Onln   0 446.625 GB SATA SSD N   N  512B INTEL SSDSC2KB480G7  U  -
        252:1     9 Onln   0 446.625 GB SATA SSD N   N  512B INTEL SSDSC2KB480G7  U  -
        252:2    10 Onln   1   3.637 TB SAS  HDD N   N  512B ST4000NM0025         U  -
        252:3    11 Offln  1   3.637 TB SAS  HDD N   N  512B ST4000NM0025         U  -
        ---------------------------------------------------------------------------------

        Enclosure LIST :
        ==============

        ------------------------------------------------------------------------
        EID State Slots PD PS Fans TSs Alms SIM Port#          ProdID     VendorSpecific
        ------------------------------------------------------------------------
        252 OK        8  4  0    0   0    0   1 -              SGPIO
        ------------------------------------------------------------------------

        Cachevault_Info :
        ===============

        ------------------------------------
        Model  State   Temp Mode MfgDate
        ------------------------------------
        CVPM02 Optimal 28C  -    2016/12/26
        ------------------------------------
        """;

    static final String STORCLI_DRIVES = """
        Drive /c0/e252/s0 :
        =================

        ---------------------------------------------------------------------------------
        EID:Slt DID State DG       Size Intf Med SED PI SeSz Model                Sp Type
        ---------------------------------------------------------------------------------
        252:0     8 Onln   0 446.625 GB SATA SSD N   N  512B INTEL SSDSC2KB480G7  U  -
        ---------------------------------------------------------------------------------

        Drive /c0/e252/s0 - Detailed Information :
        ========================================

        Drive /c0/e252/s0 State :
        =======================
        Shield Counter = 0
        Media Error Count = 0
        Other Error Count = 0
        Drive Temperature =  22C (71.60 F)
        Predictive Failure Count = 0
        S.M.A.R.T alert flagged by drive = No

        Drive /c0/e252/s0 Device attributes :
        ===================================
        SN = PHDV7234567A480BGN
        Manufacturer Id = ATA
        Model Number = INTEL SSDSC2KB480G7
        WWN = 55cd2e414e5fca5b
        Firmware Revision = SCV10111
        Raw size = 447.130 GB [0x37e436b0 Sectors]
        Link Speed = 6.0Gb/s
        """;

    static Map<String, Object> parse(Map<String, String> files) {
        return SosReportParser.parse(files).facts();
    }

    static List<Map<String, Object>> rows(Map<String, Object> facts, String key) {
        return (List<Map<String, Object>>) facts.get(key);
    }

    static Map<String, Object> row(Map<String, Object> facts, String key, String field, Object value) {
        return rows(facts, key).stream().filter(row -> value.equals(row.get(field))).findFirst()
            .orElseThrow(() -> new AssertionError(key + " 中没有 " + field + "=" + value));
    }

    static List<String> issues(Map<String, Object> facts) {
        return (List<String>) facts.getOrDefault("health.issues", List.of());
    }

    static boolean hasIssue(Map<String, Object> facts, String fragment) {
        return issues(facts).stream().anyMatch(issue -> issue.contains(fragment));
    }
}
