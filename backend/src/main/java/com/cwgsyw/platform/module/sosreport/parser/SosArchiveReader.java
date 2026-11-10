package com.cwgsyw.platform.module.sosreport.parser;

import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.compress.compressors.gzip.GzipCompressorInputStream;
import org.apache.commons.compress.compressors.xz.XZCompressorInputStream;
import org.tukaani.xz.MemoryLimitException;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Pattern;

/**
 * 以流的方式读取 sosreport 压缩包，只取出白名单内的普通文件。
 *
 * <p>压缩包是不可信输入，可能含明文凭据，因此：不写磁盘；不跟随 symlink；
 * 白名单之外的内容不进入内存；解压总量、条目数、单文件大小和耗时都有上限。
 * 新增白名单前要确认该文件不会包含凭据。
 */
public final class SosArchiveReader {

    private static final Set<String> EXACT_FILES = Set.of(
        "version.txt",
        "etc/hostname",
        "etc/os-release",
        "etc/system-release",
        "etc/uos-release",
        "etc/resolv.conf",
        "etc/chrony.conf",
        "proc/mdstat",
        "proc/meminfo",
        "sos_commands/block/blockdev_--report",
        "sos_commands/block/lsblk",
        "sos_commands/date/date",
        "sos_commands/hardware/dmidecode",
        "sos_commands/host/hostname",
        "sos_commands/kernel/uname_-a",
        "sos_commands/memory/free",
        "sos_commands/networking/ip_-o_addr",
        "sos_commands/networking/ip_route_show_table_all",
        "sos_commands/networking/route_-n",
        "sos_commands/processor/lscpu",
        "sos_commands/scsi/lsscsi",
        "sos_commands/selinux/sestatus",
        "sos_commands/systemd/systemctl_list-units",
        "sos_commands/systemd/systemctl_list-units_--failed",
        "sos_commands/systemd/timedatectl",
        // 以下为硬件明细和扩展解析（PARSER_VERSION 2）。逐个确认只含清单、状态或统计输出，不含凭据。
        "etc/ntp.conf",
        "proc/cpuinfo",
        // /proc/device-tree 和 /sys/class/dmi/id 是符号链接，sos 把文件存在链接目标下，两处都要读。
        "proc/device-tree/model",
        "sys/firmware/devicetree/base/model",
        "proc/sys/kernel/tainted",
        "sys/kernel/mm/transparent_hugepage/enabled",
        "sos_commands/block/lsblk_-O_-P",
        "sos_commands/boot/mokutil_--sb-state",
        "sos_commands/chrony/chronyc_tracking",
        "sos_commands/dellrac/idracadm7_getsysinfo",
        "sos_commands/dpkg/dpkg_-l",
        "sos_commands/firewalld/firewall-cmd_--state",
        "sos_commands/hpssm/ssacli_ctrl_all_show_config_detail",
        "sos_commands/host/hostname_-f",
        "sos_commands/host/uptime",
        "sos_commands/infiniband/ibstat",
        "sos_commands/kdump/kdumpctl_status",
        "sos_commands/kernel/lsmod",
        "sos_commands/megacli/opt.MegaRAID.MegaCli.MegaCli64_-AdpAllInfo_-aALL",
        "sos_commands/megacli/opt.MegaRAID.MegaCli.MegaCli64_LDPDInfo_-aALL",
        "sos_commands/multipath/multipath_-ll",
        "sos_commands/networking/ip_-s_-d_link",
        "sos_commands/nvidia/nvidia-smi_-q",
        "sos_commands/nvme/nvme_list",
        "sos_commands/pci/lspci_-nnvvv",
        // sos 3.x 运行的是 lspci -nnvv。
        "sos_commands/pci/lspci_-nnvv",
        "sos_commands/systemd/systemctl_list-unit-files",
        "sos_commands/tuned/tuned-adm_active");

    /** 文件名里带命令参数，不同 sos 版本会变化，因此按固定模式匹配，不接受任意子路径。 */
    private static final List<Pattern> FILE_PATTERNS = List.of(
        Pattern.compile("proc/net/bonding/[A-Za-z0-9_.:-]{1,64}"),
        Pattern.compile("sos_commands/block/udevadm_info_\\.dev\\.[a-z0-9-]{1,32}"),
        Pattern.compile("sos_commands/filesys/df_-al(_[A-Za-z0-9_-]{0,32})?"),
        Pattern.compile("sos_commands/networking/ethtool_(-i_|-P_|-m_)?[A-Za-z0-9_.:-]{1,64}"),
        Pattern.compile("sos_commands/networking/netstat_-W_-neopa"),
        Pattern.compile("sos_commands/rpm/sh_-c_rpm_[A-Za-z0-9_.-]{1,200}"),
        // DMI 的 sysfs 镜像，dmidecode 缺失时的备用来源。
        Pattern.compile("sys/(class|devices/virtual)/dmi/id/[a-z_]{1,32}"),
        Pattern.compile("sos_commands/ata/smartctl_-a_\\.dev\\.[a-z0-9]{1,32}"),
        Pattern.compile("sos_commands/nvme/smartctl_--all_\\.dev\\.nvme[0-9]{1,3}n[0-9]{1,3}"),
        // sos 3.x 采集 sel list，4.x 采集 sel elist。
        Pattern.compile("sos_commands/ipmitool/ipmitool(_-I_usb)?_(mc_info|lan_print(_[0-9]{1,2})?|fru_print|sensor_list|sel_info|sel_elist|sel_list|chassis_status)"),
        // nvidia-smi 的 CSV 查询，列名随 sos 版本不同；只接受以这几列开头的。
        Pattern.compile("sos_commands/nvidia/nvidia-smi_--query-gpu_gpu_name_gpu_bus_id_vbios_version_[A-Za-z0-9_.]{1,200}_--format_csv"),
        Pattern.compile("sos_commands/(storcli/storcli64|perccli/perccli64|perccli2/perccli2)_\\.call(_show_all|\\.eall\\.sall_show_all|\\.sall_show_all)"),
        Pattern.compile("sos_commands/arcconf/arcconf_getconfig_[0-9]{1,2}"),
        Pattern.compile("sos_commands/sas3ircu/sas3ircu_[0-9]{1,2}_display"),
        Pattern.compile("sos_commands/fibrechannel/udevadm_info_-a_\\.sys\\.class\\.fc_host\\.host[0-9]{1,4}"),
        // lvm2 命令带列名和 --config 参数，随版本变化，只限定前缀和字符集。
        Pattern.compile("sos_commands/lvm2/(vgs_-v_-o_|lvs_-a_-o_|pvs_-a_-v_-o_)[A-Za-z0-9_.,=-]{1,300}"));

    private static final Pattern PLAIN_FILE_NAME = Pattern.compile("[A-Za-z0-9_./:-]+");

    /** {@code ethtool_-S_} 这类统计输出量大且无用，不读取。 */
    private static final Pattern ETHTOOL_OTHER_OPTION = Pattern.compile("sos_commands/networking/ethtool_-(?![iPm]_).*");

    private final Limits limits;

    public SosArchiveReader() {
        this(Limits.defaults());
    }

    public SosArchiveReader(Limits limits) {
        this.limits = limits;
    }

    /** 判断路径是否在白名单内。路径相对于压缩包顶层目录。 */
    public static boolean isWhitelisted(String path) {
        if (EXACT_FILES.contains(path)) return true;
        if (ETHTOOL_OTHER_OPTION.matcher(path).matches()) return false;
        return FILE_PATTERNS.stream().anyMatch(pattern -> pattern.matcher(path).matches());
    }

    public Result read(InputStream rawInput) {
        return read(rawInput, SosArchiveReader::isWhitelisted);
    }

    Result read(InputStream rawInput, Predicate<String> selector) {
        long deadline = System.nanoTime() + limits.maxDuration().toNanos();
        Map<String, String> files = new HashMap<>();
        List<String> warnings = new ArrayList<>();
        int entries = 0;
        int skippedSpecial = 0;
        long retainedBytes = 0;
        try (BufferedInputStream buffered = new BufferedInputStream(rawInput);
             BudgetInputStream budget = new BudgetInputStream(decompress(buffered), limits.maxTotalBytes());
             TarArchiveInputStream tar = new TarArchiveInputStream(budget)) {
            TarArchiveEntry entry;
            while ((entry = tar.getNextEntry()) != null) {
                if (++entries > limits.maxEntries()) {
                    throw new SosParseException("ARCHIVE_TOO_LARGE", "归档条目过多，已拒绝解析");
                }
                if (System.nanoTime() > deadline) {
                    throw new SosParseException("ARCHIVE_TIMEOUT", "归档解析超时，已拒绝解析");
                }
                String relative = relativePath(entry.getName());
                if (relative == null) continue;
                // 先判断特殊条目：isFile() 对 FIFO 这类条目也可能返回 true。
                if (entry.isSymbolicLink() || entry.isLink() || entry.isFIFO()
                        || entry.isCharacterDevice() || entry.isBlockDevice()) {
                    skippedSpecial++;
                    continue;
                }
                if (entry.isDirectory() || !selector.test(relative)) continue;
                if (entry.getSize() > limits.maxFileBytes()) {
                    warnings.add("文件过大，已跳过：" + safeName(relative));
                    continue;
                }
                String text = readText(tar);
                // 部分白名单是模式匹配，恶意归档可以放很多匹配的小文件，所以总量也要有上限。
                retainedBytes += text.length();
                if (retainedBytes > limits.maxRetainedBytes()) {
                    throw new SosParseException("ARCHIVE_TOO_LARGE", "归档中需要读取的内容过多，已拒绝解析");
                }
                files.put(relative, text);
            }
        } catch (SosParseException e) {
            throw e;
        } catch (MemoryLimitException | org.apache.commons.compress.MemoryLimitException e) {
            throw new SosParseException("ARCHIVE_TOO_LARGE", "归档解压所需内存超过上限，已拒绝解析", e);
        } catch (IOException | IllegalArgumentException e) {
            // 不回显底层异常消息：其中可能带有归档内的文件名。
            throw new SosParseException("ARCHIVE_CORRUPT", "归档已损坏或不是有效的 tar 文件", e);
        }
        if (files.isEmpty()) {
            throw new SosParseException("NOT_SOSREPORT", "归档中没有找到 sosreport 的文件");
        }
        return new Result(files, warnings, entries, skippedSpecial);
    }

    private InputStream decompress(BufferedInputStream input) throws IOException {
        input.mark(8);
        byte[] magic = input.readNBytes(6);
        input.reset();
        if (isXz(magic)) {
            return new XZCompressorInputStream(input, true, limits.maxXzMemoryKib());
        }
        if (isGzip(magic)) {
            return new GzipCompressorInputStream(input, true);
        }
        throw new SosParseException("UNSUPPORTED_FORMAT", "只支持 .tar.xz 和 .tar.gz 格式");
    }

    public static boolean isSupportedMagic(byte[] magic) {
        return isXz(magic) || isGzip(magic);
    }

    private static boolean isXz(byte[] magic) {
        return magic.length >= 6
            && (magic[0] & 0xFF) == 0xFD && magic[1] == '7' && magic[2] == 'z'
            && magic[3] == 'X' && magic[4] == 'Z' && magic[5] == 0;
    }

    private static boolean isGzip(byte[] magic) {
        return magic.length >= 2 && (magic[0] & 0xFF) == 0x1F && (magic[1] & 0xFF) == 0x8B;
    }

    /** 去掉顶层目录。路径穿越一律视为恶意归档；顶层目录本身返回 null。 */
    static String relativePath(String name) {
        if (name == null || name.isEmpty()) return null;
        String normalized = name.startsWith("./") ? name.substring(2) : name;
        // 反斜杠是合法文件名字符（systemd 单元常见 \x2d），这里不写磁盘，无需拒绝。
        if (normalized.startsWith("/") || normalized.indexOf('\0') >= 0) {
            throw new SosParseException("ARCHIVE_UNSAFE", "归档含有不安全的路径，已拒绝解析");
        }
        for (String part : normalized.split("/")) {
            if ("..".equals(part)) {
                throw new SosParseException("ARCHIVE_UNSAFE", "归档含有不安全的路径，已拒绝解析");
            }
        }
        int slash = normalized.indexOf('/');
        if (slash < 0 || slash == normalized.length() - 1) return null;
        return normalized.substring(slash + 1);
    }

    private String readText(InputStream entryStream) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        long remaining = limits.maxFileBytes();
        int read;
        while (remaining > 0 && (read = entryStream.read(buffer, 0, (int) Math.min(buffer.length, remaining))) != -1) {
            out.write(buffer, 0, read);
            remaining -= read;
        }
        return out.toString(StandardCharsets.UTF_8);
    }

    /** 文件名来自归档，只在字符集安全时才写入警告。 */
    private static String safeName(String path) {
        String name = path.length() > 120 ? path.substring(0, 120) : path;
        return PLAIN_FILE_NAME.matcher(name).matches() ? name : "(文件名已隐藏)";
    }

    public record Result(Map<String, String> files, List<String> warnings, int entries, int skippedSpecial) {
    }

    public record Limits(long maxTotalBytes, int maxEntries, long maxFileBytes, long maxRetainedBytes,
                         int maxXzMemoryKib, Duration maxDuration) {
        public static Limits defaults() {
            return new Limits(5L * 1024 * 1024 * 1024, 500_000, 16L * 1024 * 1024, 128L * 1024 * 1024,
                256 * 1024, Duration.ofMinutes(5));
        }
    }

    /** 统计解压后的总字节数，防止解压炸弹。跳过的条目同样计入。 */
    private static final class BudgetInputStream extends FilterInputStream {
        private long remaining;

        BudgetInputStream(InputStream in, long budget) {
            super(in);
            this.remaining = budget;
        }

        @Override
        public int read() throws IOException {
            int value = super.read();
            if (value != -1) consume(1);
            return value;
        }

        @Override
        public int read(byte[] target, int offset, int length) throws IOException {
            int count = super.read(target, offset, length);
            if (count > 0) consume(count);
            return count;
        }

        @Override
        public long skip(long length) throws IOException {
            long count = super.skip(length);
            if (count > 0) consume(count);
            return count;
        }

        private void consume(long count) {
            remaining -= count;
            if (remaining < 0) {
                throw new SosParseException("ARCHIVE_TOO_LARGE", "归档解压后体积超过上限，已拒绝解析");
            }
        }
    }
}
