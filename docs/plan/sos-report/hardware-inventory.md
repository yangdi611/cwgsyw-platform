# SOS 报告：硬件明细与扩展解析

- Linear：YAN-116（首次提交前补建，见下）
- 分支：`feat/YAN-116-sos-hardware-inventory`，基于 `origin/development`（dfaeba25c）
- 风险：Medium（扩大不可信归档的读取白名单；`facts` 和事实目录是对外接口，只做增量）
- 前置：YAN-109 的解析和入库流程，见 [README.md](README.md)

## DoR 结论：READY WITH APPROVED EXCEPTION（已关闭）

实现阶段缺少 Linear issue，按下表的授权例外在本地进行。2026-11-10 首次提交前补建 YAN-116，范围、验收和文档影响已写入该 issue，例外关闭。

| 项 | 内容 |
|---|---|
| 授权人 | 项目负责人（2026-11-09，在任务对话中选择“授权例外，不建 issue”） |
| 原因 | 先在本地完成并评审解析范围，再决定是否立项交付 |
| 缺失的关卡 | Linear issue（ID、优先级、里程碑、验收记录） |
| 风险 | 交付证据无法挂到 Linear；范围可能与后续立项不一致 |
| 临时控制 | 只在独立 worktree 本地实现，不提交、不推送、不开 PR；验收条件写在本文 |
| 后续 | 合入前补建 Linear issue，把本文的验收和证据链接过去 |
| 到期 | 首次 commit、push 或开 PR 之前 |

## 目标

依据 sos 上游插件的实际输出（`sosreport/sos` main，bc52394，2026-11-09），把报告里与资产、位置、厂商、
固件版本、健康状态相关的内容尽可能多、尽可能准确地解析成结构化事实，并在详情页分组展示。

## 非目标

- 不改 CMDB 模型、映射预置规则、审批流程和数据库结构。新事实只进入 `facts` JSON 和事实目录，
  是否映射到 CMDB 字段由管理员按现有流程配置。
- 不解析日志（journal、dmesg、messages）、进程表、内核命令行、用户账号、各类配置文件中的凭据项。
- 不解析 JSON 格式的厂商输出（`storcli ... J`、`smartctl -j`），它们只在开启插件选项或新版本中存在；只解析默认的文本输出。
- 不引入 pci.ids 等外部数据库。PCI 厂商只对少数确定的 vendor ID 给出名称，其余保留 lspci 原文。

## 数据来源（sos 插件 → 归档文件）

sos 把命令转换为文件名的规则：去掉 `/usr/bin/` 等前缀，`[^\w\-./]` 替换为 `_`，`/` 替换为 `.`。

| 类别 | 插件 | 文件（`sos_commands/` 下） | 产出 |
|---|---|---|---|
| 整机、机箱、主板、BIOS | hardware | `hardware/dmidecode`；`sys/class/dmi/id/*`（备用） | 型号、序列号、版本、SKU、机箱类型和高度、资产标签 |
| CPU | hardware、processor | DMI type 4；`processor/lscpu`；`proc/cpuinfo` | 每颗 CPU 的插槽、型号、主频、核数、序列号；缓存、NUMA、虚拟化、微码、漏洞缓解 |
| 内存 | hardware、memory | DMI type 16/17；`proc/meminfo`；THP | 每条内存的位置、容量、类型、速率、厂商、序列号、料号、Rank；最大容量和 ECC；大页 |
| 电源、插槽、板载设备 | hardware | DMI type 39/9/41 | 电源位置、厂商、型号、序列号、功率、状态；PCIe 插槽占用和总线地址 |
| PCI 设备 | pci | `pci/lspci_-nnvvv` | 网卡、存储控制器、GPU、HBA 的地址、厂商、型号、驱动、插槽、NUMA、PCIe 链路、VPD 料号和序列号 |
| BMC / IPMI | ipmitool、dellrac | `ipmitool/ipmitool_{mc_info,lan_print*,fru_print,sensor_list,sel_info,sel_elist,chassis_status}`；`dellrac/idracadm7_getsysinfo` | BMC IP、MAC、固件；FRU；传感器和异常；SEL 事件；机箱故障 |
| RAID 卡 | storcli、perccli、perccli2、megacli、hpssm、arcconf、sas3ircu | `storcli64_.call_show_all`、`storcli64_.call.eall.sall_show_all` 等 | 控制器型号、序列号、固件/BIOS/驱动版本；逻辑盘；物理盘槽位、型号、序列号、固件、状态 |
| 磁盘 | block、ata、nvme、scsi | `block/lsblk_-O_-P`、`block/udevadm_info_.dev.*`、`ata/smartctl_-a_.dev.*`、`nvme/smartctl_--all_.dev.*`、`nvme/nvme_list`、`scsi/lsscsi` | 固件、WWN、物理路径、HCTL、转速、SMART 健康、通电时间、温度、寿命 |
| 网卡 | networking | `ethtool_-i_*`、`ethtool_-m_*`、`ethtool_*`、`ip_-s_-d_link` | 驱动版本、光模块厂商/料号/序列号/波长、端口类型、MTU、VLAN、IPv6 |
| IB / FC / GPU | infiniband、fibrechannel、nvidia | `infiniband/ibstat`、`fibrechannel/udevadm_info_-a_.sys.class.fc_host.host*`、`nvidia/nvidia-smi_-q` | HCA 固件和端口状态；FC WWPN、速率、状态；GPU 型号、序列号、VBIOS |
| 存储逻辑层 | multipath、lvm2 | `multipath/multipath_-ll`、`lvm2/{vgs,lvs,pvs}_*` | 多路径 LUN、路径状态；VG/LV/PV 容量 |
| 系统 | host、boot、tuned、kdump、firewalld、chrony、systemd、kernel、dpkg | `host/uptime`、`host/hostname_-f`、`boot/mokutil_--sb-state`、`tuned/tuned-adm_active`、`kdump/kdumpctl_status`、`firewalld/firewall-cmd_--state`、`chrony/chronyc_tracking`、`systemd/systemctl_list-unit-files`、`kernel/lsmod`、`dpkg/dpkg_-l`、`proc/sys/kernel/tainted`、`etc/ntp.conf` | 运行时长、安全启动、调优配置、kdump、防火墙、时间同步、开机自启服务、内核模块、deb 包 |

### sos 3.x 的差异（YAN-117）

上表按 sos 4.x 编写。UOS 20 等系统常见的 sos 3.9 有以下不同，已对照 3.9 插件源码处理：

| 插件 | sos 3.x | sos 4.x | 处理 |
|---|---|---|---|
| pci | `lspci -nnvv` → `lspci_-nnvv` | `lspci -nnvvv` | 两个文件都读，格式相同 |
| ipmitool | `sel list`；不采集 `lan print` | `sel elist`、`lan print` | 读 `sel list`；3.x 报告取不到 BMC IP |
| nvidia | 只有 `--query-gpu=... --format=csv` | 另有 `-q` | 没有 `-q` 时按 CSV 列名读 |
| block | 不采集 `lsblk -O -P` | 采集 | 3.x 缺少转速、HCTL 等补充字段 |
| networking | 不采集 `ethtool -m` | 采集 | 3.x 没有光模块信息 |
| storcli、perccli、hpssm、arcconf、dellrac | 没有这些插件 | 有 | 3.x 报告没有这些 RAID 卡和 iDRAC 的数据 |

bond 优先读 `proc/net/bonding/*`。实测的 3.9 报告没有这个文件（原包已删除，原因无法确认），因此没有时改从 `ip -s -d link`
还原：主接口的 `bond mode`，成员的 `master`、`bond_slave` 状态、`mii_status` 和 `perm_hwaddr`。

其他修正：bonding、team、bridge 等虚拟接口在 `ethtool -i` 中的 `firmware-version`（如 `2`）不是固件版本，不再记录；
PCIe 插槽和板载设备按总线地址补充插入设备的类别和型号（只匹配板卡类设备，不匹配上游桥）；
磁盘的 `ID_PATH` 指向 RAID 类 PCI 设备时标为 RAID 逻辑盘（`raidVolume`）并记录所属控制器。

汇总事实：`hardware.firmwareInventory` 把 BIOS、BMC、CPU 微码、网卡、RAID 卡、磁盘、GPU、IB、FC、电源的固件版本合并成一张表；
`health.issues` 汇总 SMART 失败、RAID 降级、传感器异常、机箱故障、失败的服务等告警。

## 白名单的安全判断

新增文件逐个确认不含凭据：都是硬件清单、状态或统计输出。`idracadm7 getsysinfo` 和 `ipmitool lan print` 不输出密码；
没有加入 `ipmitool user list`、`/proc/cmdline`、`/etc/passwd`、NetworkManager 连接、kickstart、日志。
文件名带设备名的模式都限定字符集和长度，不接受任意子路径。总量仍受 128 MiB 读入上限约束。

## 结构调整

`SosReportParser` 原有 742 行，按 `AGENTS.md` 的大文件规则拆分：

- `SosParseContext`：文件访问、DMI 分段、清洗和写入事实的公共方法。
- 按领域拆分为 `SystemFacts`、`CpuMemoryFacts`、`PciFacts`、`NetworkFacts`、`StorageFacts`、`RaidFacts`、
  `StorcliParser`、`LegacyRaidParsers`（MegaCli、ssacli、arcconf、sas3ircu）、`BmcFacts`、`AcceleratorFacts`、`OsFacts`、`SoftwareFacts`。
  固件清单和健康告警由各类在解析时追加到 `SosParseContext`，最后统一写出。
- 原有事实的取值逻辑原样迁移，现有测试不改断言。拆分后 `SosReportParser` 只负责调度，最大的文件不超过 600 行。
- 前端 `FactsPanel` 拆出 `FactParts`（公共展示组件）和 `HardwareFacts`、`StorageFacts`、`NetworkFacts`、`BmcFacts` 四个分组。
- 测试拆为 `SosHardwareFixtures`（共用样本）和 `SosHardwareInventoryTest`、`SosStorageParserTest`、`SosNetworkBmcOsParserTest`。

`PARSER_VERSION` 升为 2。旧报告保留版本 1 的事实；原包解析后即删除，需重新上传才能得到新事实。

## 空槽位

插槽类明细保留没有安装部件的位置，行内 `installed: false`，详情页显示“空槽位”标签，标题显示“已用 x / 共 y”：

- 内存插槽、CPU 插座、电源位、PCIe 插槽：来自 DMI，是 BIOS 报告的真实插槽。
- RAID 物理盘：storcli 的 Enclosure LIST 和 sas3ircu 的 Enclosure information 给出背板槽位总数时，
  补出没有盘的槽位，行内 `inferred: true`。槽位号按从 0（sas3ircu 按 StartSlot）连续编号推算，个别背板编号不连续时可能不准。
  ssacli、arcconf、MegaCli 的默认输出没有槽位总数，不补空槽位。

## 详情页

“结构化数据”页签内分为：概览（告警和基本信息）、硬件部件、存储、网络、BMC 与传感器、系统与软件。
只有特定硬件或厂商工具才有数据的表（RAID 逻辑盘和物理盘、GPU、VLAN、光模块、IB、FC、多路径、LVM 明细、FRU、传感器、SEL）
没有数据时不显示；RAID 卡和 BMC 没有数据时说明需要主机安装哪些工具。

## 验收

1. 原有事实 key 的取值不变，`SosReportParserTest` 原有用例全部通过。
2. 每类新增来源至少有一个用例，覆盖正常输出、缺失文件和占位值。
3. 新增事实全部登记在 `SosFactCatalog`，`emitsOnlyCatalogKeys` 通过。
4. 白名单测试覆盖新增文件和应拒绝的相邻文件。
5. 详情页新增分组展示，没有数据时显示空状态；`npm run typecheck`、`npm run lint` 不新增错误。

## 验证记录（2026-11-09，本地）

| 检查 | 结果 |
|---|---|
| 解析器包单元测试（JDK 21 + JUnit 5.10 独立运行器） | PASS：62 个用例，61 通过，1 个需要真实样本的用例跳过 |
| 上游文件名核对：按 sos `_mangle_command` 规则推出 46 个文件名，逐个调用 `isWhitelisted` | PASS：0 个遗漏 |
| `SosTransform` 单独编译 | PASS |
| 前端 `npm test` | PASS：379 个用例 |
| 前端 `npm run typecheck` | PASS |
| 前端 `npm run lint` | PASS：0 个错误；35 个警告均在本任务未修改的文件中 |
| 后端完整 `mvn test` | NOT RUN：开发环境没有 Maven，由 CI 执行 |
| 真实报告核对 | NOT RUN：没有含 RAID 卡、BMC、NVMe、FC/IB 的样本；容器不是 root 且没有 dmidecode/lspci，无法自行生成 |

## 验证限制

开发环境没有 JDK 和 Maven。后端用临时下载的 JDK 21 与 JUnit 独立运行器只编译解析器包并运行解析器和白名单测试；
完整的 `mvn test` 留给 CI。厂商工具输出的测试样本按上游格式手写，尚未用真实报告核对，
发布前需要用含 RAID 卡、BMC、NVMe、FC/IB 的真实报告运行 `SosReportParserTest#parsesRealSample`，
重点核对 storcli 表格列、ssacli 缩进层级、sas3ircu 背板编号和 nvme list 列宽。

## 已知风险

- 事实目录从 52 项增加到 146 项，AI 映射建议的请求体约为原来的 3 倍。目录只含静态定义，不含主机的值。
- perccli2（PERC 12）的物理盘表格列与 storcli 不同，目前只能取到控制器信息，取不到物理盘。
- MegaCli 的 `Inquiry Data` 是厂商、型号、固件、序列号首尾相连的原文，各厂商排列不同，没有拆出序列号。
- PCI 厂商名只覆盖常见的 vendor ID，其余厂商只能看 lspci 原文描述。

## 回滚

只改解析代码、白名单和前端展示，没有迁移。回滚应用版本即可；回滚后新上传的报告按版本 1 解析，已解析报告的 `facts` 中多出的 key 不被旧前端读取，无副作用。
