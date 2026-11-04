package com.cwgsyw.platform.module.sosreport.parser;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 把白名单文件解析成结构化事实。纯函数，不依赖 Spring。
 *
 * <p>输入来自不可信归档：每个字段都做长度限制和控制字符清理，取不到就留空，不抛异常。
 * 输出的 key 全部来自 {@link SosFactCatalog}。
 */
public final class SosReportParser {

    /** 解析规则变化时递增，便于识别旧版本解析的结果。 */
    public static final int PARSER_VERSION = 1;

    private static final int MAX_VALUE_LENGTH = 512;
    private static final int MAX_LIST_ITEMS = 5000;

    private static final Set<String> PLACEHOLDERS = Set.of(
        "", "not specified", "not present", "not available", "not applicable", "n/a", "na", "none", "unknown",
        "to be filled by o.e.m.", "to be filled by oem", "default string", "default", "system serial number",
        "system manufacturer", "system product name", "system version", "chassis serial number", "invalid",
        "0", "00000000", "0123456789", "1234567890", "123456789", "xxxxxxxx");

    private static final Pattern VIRTUAL_PRODUCT = Pattern.compile(
        "vmware|virtualbox|kvm|qemu|bochs|xen|hvm domu|virtual machine|openstack|alibaba cloud ecs|cloud server",
        Pattern.CASE_INSENSITIVE);

    private static final DateTimeFormatter US_DATE = DateTimeFormatter.ofPattern("MM/dd/yyyy");
    private static final Pattern RPM_LINE = Pattern.compile(
        "^(\\S+)\\s+\\w{3}\\s+(\\w{3})\\s+(\\d{1,2})\\s+\\d{2}:\\d{2}:\\d{2}\\s+(\\d{4})\\s*$");
    private static final Pattern IP_ADDR_LINE = Pattern.compile(
        "^\\d+:\\s+(\\S+)\\s+inet\\s+(\\d+\\.\\d+\\.\\d+\\.\\d+)(?:/(\\d+))?\\s.*");
    private static final Pattern SIZE_TOKEN = Pattern.compile("^(\\d+(?:\\.\\d+)?)([KMGTP]?)$");
    private static final Pattern MD_LINE = Pattern.compile("^(md\\S*)\\s*:\\s*(active|inactive)\\s+(?:\\(\\S+\\)\\s+)?(raid\\d+|linear)\\s+(.*)$");
    private static final Pattern IPV4 = Pattern.compile("^\\d{1,3}(\\.\\d{1,3}){3}$");
    private static final Pattern SAFE_INTERFACE = Pattern.compile("^[A-Za-z0-9_.:-]{1,64}$");

    private final Map<String, String> files;
    private final Map<String, Object> facts = new LinkedHashMap<>();
    private final List<String> warnings = new ArrayList<>();

    private SosReportParser(Map<String, String> files) {
        this.files = files;
    }

    public static Result parse(Map<String, String> files) {
        SosReportParser parser = new SosReportParser(files);
        parser.run();
        return new Result(parser.facts, parser.warnings, parser.sosVersion(), parser.collectedAt());
    }

    public record Result(Map<String, Object> facts, List<String> warnings, String sosVersion, String collectedAt) {
    }

    private void run() {
        List<Map<String, String>> systemSections = dmi("System Information");
        Map<String, String> system = systemSections.isEmpty() ? Map.of() : systemSections.get(0);
        parseIdentity(system);
        parseBaseboardAndBios();
        parseOs();
        parseCpu();
        parseMemory();
        parseNetwork();
        parseStorage();
        parseSoftware();
        parseHostType(system);

        if (!facts.containsKey("system.serialNumber")) warnings.add("未取得整机序列号，提交入库前需要人工填写");
        if (!facts.containsKey("network.primaryIp")) warnings.add("未取得主 IP，提交入库前需要人工填写");
        if (!files.containsKey("sos_commands/hardware/dmidecode")) warnings.add("报告不含 dmidecode，硬件信息可能不完整");
    }

    // ─── 身份 ────────────────────────────────────────────────────────────────

    private void parseIdentity(Map<String, String> system) {
        String hostname = firstLine("sos_commands/host/hostname");
        if (hostname == null) hostname = firstLine("etc/hostname");
        put("system.hostname", hostname);
        put("system.serialNumber", cleanDmi(system.get("Serial Number")));
        put("system.uuid", cleanUuid(system.get("UUID")));
        put("system.manufacturer", cleanDmi(system.get("Manufacturer")));
        put("system.productName", cleanDmi(system.get("Product Name")));
    }

    private void parseHostType(Map<String, String> system) {
        String product = String.valueOf(system.getOrDefault("Product Name", "")) + " "
            + system.getOrDefault("Manufacturer", "");
        boolean hypervisor = text("sos_commands/processor/lscpu").lines()
            .anyMatch(line -> line.startsWith("Hypervisor vendor:") || line.startsWith("超管理器厂商"));
        if (hypervisor || VIRTUAL_PRODUCT.matcher(product).find()) {
            facts.put("system.hostType", "virtual");
        } else if (!system.isEmpty()) {
            facts.put("system.hostType", "physical");
        }
    }

    private void parseBaseboardAndBios() {
        List<Map<String, String>> boards = dmi("Base Board Information");
        if (!boards.isEmpty()) {
            put("baseboard.manufacturer", cleanDmi(boards.get(0).get("Manufacturer")));
            put("baseboard.productName", cleanDmi(boards.get(0).get("Product Name")));
        }
        List<Map<String, String>> bios = dmi("BIOS Information");
        if (!bios.isEmpty()) {
            put("bios.vendor", cleanDmi(bios.get(0).get("Vendor")));
            put("bios.version", cleanDmi(bios.get(0).get("Version")));
            String date = cleanDmi(bios.get(0).get("Release Date"));
            if (date != null) {
                try {
                    facts.put("bios.releaseDate", LocalDate.parse(date, US_DATE).toString());
                } catch (DateTimeParseException ignored) {
                    // 厂商格式不统一，取不到就留空。
                }
            }
        }
    }

    // ─── 操作系统 ────────────────────────────────────────────────────────────

    private void parseOs() {
        Map<String, String> osRelease = keyValues(text("etc/os-release"));
        put("os.name", osRelease.get("PRETTY_NAME"));
        put("os.versionId", osRelease.get("VERSION_ID"));
        String release = firstLine("etc/uos-release");
        if (release == null) release = firstLine("etc/system-release");
        if (release == null) release = osRelease.get("PRETTY_NAME");
        put("os.release", release);

        String[] uname = text("sos_commands/kernel/uname_-a").trim().split("\\s+");
        if (uname.length >= 3 && !uname[0].isBlank()) {
            put("os.family", uname[0].toLowerCase(Locale.ROOT));
            put("os.kernel", uname[2]);
        }
        Matcher arch = Pattern.compile("\\b(x86_64|aarch64|arm64|loongarch64|mips64\\w*|ppc64\\w*|s390x|riscv64|i[3-6]86)\\b")
            .matcher(text("sos_commands/kernel/uname_-a"));
        String lastArch = null;
        while (arch.find()) lastArch = arch.group(1);
        if (lastArch == null) lastArch = keyColonValues(text("sos_commands/processor/lscpu")).get("Architecture");
        put("os.arch", lastArch);

        Matcher zone = Pattern.compile("(?m)^\\s*Time zone:\\s*(\\S+)").matcher(text("sos_commands/systemd/timedatectl"));
        if (zone.find()) put("os.timezone", zone.group(1));

        Map<String, String> selinux = keyColonValues(text("sos_commands/selinux/sestatus"));
        String status = selinux.get("SELinux status");
        if ("disabled".equalsIgnoreCase(status)) {
            facts.put("os.selinux", "disabled");
        } else if ("enabled".equalsIgnoreCase(status)) {
            String mode = selinux.get("Current mode");
            if ("enforcing".equalsIgnoreCase(mode) || "permissive".equalsIgnoreCase(mode)) {
                facts.put("os.selinux", mode.toLowerCase(Locale.ROOT));
            }
        }

        String mounts = pathWithPrefix("sos_commands/filesys/df_-al").map(this::text).orElse("");
        if (!mounts.isEmpty()) {
            boolean uefi = mounts.lines().anyMatch(line -> line.startsWith("efivarfs ") || line.endsWith(" /boot/efi"));
            facts.put("os.bootMode", uefi ? "uefi" : "bios");
        }
    }

    // ─── CPU ─────────────────────────────────────────────────────────────────

    /** lscpu 在部分平台上把 die 报成 socket（如海光），所以优先使用 DMI。 */
    private void parseCpu() {
        Map<String, String> lscpu = keyColonValues(text("sos_commands/processor/lscpu"));
        List<Map<String, String>> populated = dmi("Processor Information").stream()
            .filter(p -> String.valueOf(p.get("Status")).toLowerCase(Locale.ROOT).contains("populated")
                && !String.valueOf(p.get("Status")).toLowerCase(Locale.ROOT).contains("unpopulated"))
            .toList();

        Integer lscpuThreads = parseInteger(lscpu.get("CPU(s)"));
        put("cpu.model", firstNonNull(lscpu.get("Model name"),
            populated.isEmpty() ? null : cleanDmi(populated.get(0).get("Version"))));
        put("cpu.vendor", firstNonNull(
            populated.isEmpty() ? null : cleanDmi(populated.get(0).get("Manufacturer")), lscpu.get("Vendor ID")));

        boolean usable = !populated.isEmpty() && populated.stream().allMatch(p -> parseInteger(p.get("Core Count")) != null);
        if (usable) {
            facts.put("cpu.sockets", populated.size());
            facts.put("cpu.cores", populated.stream().mapToInt(p -> parseInteger(p.get("Core Count"))).sum());
            int dmiThreads = populated.stream().mapToInt(p -> {
                Integer threads = parseInteger(p.get("Thread Count"));
                return threads != null ? threads : 0;
            }).sum();
            Integer threads = lscpuThreads != null ? lscpuThreads : (dmiThreads > 0 ? Integer.valueOf(dmiThreads) : null);
            if (threads != null) facts.put("cpu.threads", threads);
            return;
        }

        Integer sockets = parseInteger(lscpu.get("Socket(s)"));
        Integer coresPerSocket = parseInteger(lscpu.get("Core(s) per socket"));
        if (sockets != null) facts.put("cpu.sockets", sockets);
        if (sockets != null && coresPerSocket != null) facts.put("cpu.cores", sockets * coresPerSocket);
        if (lscpuThreads != null) facts.put("cpu.threads", lscpuThreads);
    }

    // ─── 内存 ────────────────────────────────────────────────────────────────

    private void parseMemory() {
        List<Map<String, String>> devices = dmi("Memory Device");
        if (!devices.isEmpty()) {
            long totalMb = 0;
            int used = 0;
            for (Map<String, String> device : devices) {
                Long sizeMb = parseDmiSizeMb(device.get("Size"));
                if (sizeMb != null && sizeMb > 0) {
                    totalMb += sizeMb;
                    used++;
                }
            }
            facts.put("memory.slotsTotal", devices.size());
            facts.put("memory.slotsUsed", used);
            if (totalMb > 0) facts.put("memory.installedGb", totalMb / 1024);
        }

        long totalKib = -1;
        long swapKib = -1;
        for (String line : text("sos_commands/memory/free").split("\\R")) {
            String[] parts = line.trim().split("\\s+");
            if (parts.length >= 2 && parts[0].equals("Mem:")) totalKib = parseLong(parts[1], -1);
            if (parts.length >= 2 && parts[0].equals("Swap:")) swapKib = parseLong(parts[1], -1);
        }
        if (totalKib < 0 || swapKib < 0) {
            Map<String, String> meminfo = keyColonValues(text("proc/meminfo"));
            if (totalKib < 0) totalKib = parseLong(firstToken(meminfo.get("MemTotal")), -1);
            if (swapKib < 0) swapKib = parseLong(firstToken(meminfo.get("SwapTotal")), -1);
        }
        if (totalKib > 0) {
            facts.put("memory.usableGb", BigDecimal.valueOf(totalKib)
                .divide(BigDecimal.valueOf(1024L * 1024L), 1, RoundingMode.HALF_UP));
        }
        if (swapKib >= 0) facts.put("memory.swapGb", Math.round(swapKib / (1024.0 * 1024.0)));
    }

    // ─── 网络 ────────────────────────────────────────────────────────────────

    private void parseNetwork() {
        Map<String, List<String>> ipsByInterface = new LinkedHashMap<>();
        for (String line : text("sos_commands/networking/ip_-o_addr").split("\\R")) {
            Matcher matcher = IP_ADDR_LINE.matcher(line);
            if (!matcher.matches() || matcher.group(1).equals("lo")) continue;
            String cidr = matcher.group(3) == null ? matcher.group(2) : matcher.group(2) + "/" + matcher.group(3);
            ipsByInterface.computeIfAbsent(matcher.group(1), k -> new ArrayList<>()).add(cidr);
        }

        String gateway = null;
        String primaryInterface = null;
        for (String line : text("sos_commands/networking/route_-n").split("\\R")) {
            String[] parts = line.trim().split("\\s+");
            if (parts.length >= 8 && parts[0].equals("0.0.0.0") && parts[3].contains("G")) {
                gateway = parts[1];
                primaryInterface = parts[7];
                break;
            }
        }
        if (gateway == null) {
            Matcher matcher = Pattern.compile("(?m)^default via (\\S+) dev (\\S+)")
                .matcher(text("sos_commands/networking/ip_route_show_table_all"));
            if (matcher.find()) {
                gateway = matcher.group(1);
                primaryInterface = matcher.group(2);
            }
        }
        if (gateway != null && IPV4.matcher(gateway).matches()) facts.put("network.defaultGateway", gateway);
        put("network.primaryInterface", primaryInterface);

        String primaryIp = null;
        if (primaryInterface != null && ipsByInterface.containsKey(primaryInterface)) {
            primaryIp = stripPrefix(ipsByInterface.get(primaryInterface).get(0));
        } else if (primaryInterface == null && ipsByInterface.size() == 1) {
            primaryIp = stripPrefix(ipsByInterface.values().iterator().next().get(0));
        }
        put("network.primaryIp", primaryIp);

        List<String> all = ipsByInterface.values().stream().flatMap(List::stream).map(SosReportParser::stripPrefix).distinct().toList();
        putList("network.ipv4Addresses", all);

        putList("network.dnsServers", text("etc/resolv.conf").lines()
            .map(String::trim)
            .filter(line -> line.startsWith("nameserver"))
            .map(line -> line.substring("nameserver".length()).trim())
            .map(SosReportParser::firstToken)
            .filter(token -> token != null && !token.isEmpty())
            .toList());

        putList("network.ntpServers", text("etc/chrony.conf").lines()
            .map(String::trim)
            .filter(line -> line.startsWith("server ") || line.startsWith("pool "))
            .map(line -> line.split("\\s+")[1])
            .toList());

        List<Map<String, Object>> bonds = parseBonds();
        if (!bonds.isEmpty()) facts.put("network.bonds", bonds);
        List<Map<String, Object>> interfaces = parseInterfaces(ipsByInterface, bonds);
        if (!interfaces.isEmpty()) facts.put("network.interfaces", interfaces);
        List<Map<String, Object>> ports = parseListeningPorts();
        if (!ports.isEmpty()) facts.put("network.listeningPorts", ports);
    }

    private List<Map<String, Object>> parseBonds() {
        String prefix = "proc/net/bonding/";
        List<Map<String, Object>> bonds = new ArrayList<>();
        for (String path : sortedPaths(prefix)) {
            Map<String, Object> bond = new LinkedHashMap<>();
            bond.put("name", path.substring(prefix.length()));
            List<Map<String, Object>> members = new ArrayList<>();
            Map<String, Object> member = null;
            for (String line : text(path).split("\\R")) {
                int colon = line.indexOf(':');
                if (colon < 0) continue;
                String key = line.substring(0, colon).trim();
                String value = clean(line.substring(colon + 1));
                switch (key) {
                    case "Bonding Mode" -> bond.put("mode", value);
                    case "Slave Interface" -> {
                        member = new LinkedHashMap<>();
                        member.put("name", value);
                        members.add(member);
                    }
                    case "MII Status" -> (member == null ? bond : member).put("status", value);
                    case "Speed" -> {
                        if (member != null) member.put("speed", value);
                    }
                    case "Permanent HW addr" -> {
                        if (member != null) member.put("mac", value);
                    }
                    default -> {
                    }
                }
            }
            bond.put("members", members);
            bonds.add(bond);
        }
        return bonds;
    }

    private List<Map<String, Object>> parseInterfaces(Map<String, List<String>> ips, List<Map<String, Object>> bonds) {
        String prefix = "sos_commands/networking/ethtool_";
        Set<String> names = new LinkedHashSet<>();
        for (String path : sortedPaths(prefix)) {
            String rest = path.substring(prefix.length());
            if (rest.startsWith("-i_") || rest.startsWith("-P_")) rest = rest.substring(3);
            if (!rest.startsWith("-") && !rest.equals("lo") && SAFE_INTERFACE.matcher(rest).matches()) names.add(rest);
        }
        names.addAll(ips.keySet());

        Map<String, String> masterByMember = new LinkedHashMap<>();
        for (Map<String, Object> bond : bonds) {
            if (bond.get("members") instanceof List<?> members) {
                for (Object member : members) {
                    if (member instanceof Map<?, ?> row) {
                        masterByMember.put(String.valueOf(row.get("name")), String.valueOf(bond.get("name")));
                    }
                }
            }
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (String name : names) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", name);
            Map<String, String> ethtool = keyColonValues(text(prefix + name));
            Map<String, String> driver = keyColonValues(text(prefix + "-i_" + name));
            Matcher permanent = Pattern.compile("Permanent address:\\s*([0-9a-fA-F:]{17})").matcher(text(prefix + "-P_" + name));
            if (permanent.find() && !permanent.group(1).equals("00:00:00:00:00:00")) row.put("mac", permanent.group(1));
            putIfUseful(row, "speed", ethtool.get("Speed"));
            putIfUseful(row, "linkDetected", ethtool.get("Link detected"));
            putIfUseful(row, "driver", driver.get("driver"));
            putIfUseful(row, "firmware", driver.get("firmware-version"));
            putIfUseful(row, "busInfo", driver.get("bus-info"));
            if (masterByMember.containsKey(name)) row.put("master", masterByMember.get(name));
            if (ips.containsKey(name)) row.put("ipv4", ips.get(name));
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, Object>> parseListeningPorts() {
        Set<String> seen = new LinkedHashSet<>();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String line : text("sos_commands/networking/netstat_-W_-neopa").split("\\R")) {
            String[] parts = line.trim().split("\\s+");
            if (parts.length < 6 || !parts[0].startsWith("tcp") || !"LISTEN".equals(parts[5])) continue;
            int colon = parts[3].lastIndexOf(':');
            if (colon < 0) continue;
            String address = parts[3].substring(0, colon);
            Integer port = parseInteger(parts[3].substring(colon + 1));
            if (port == null) continue;
            String process = null;
            if (parts.length >= 9 && parts[8].contains("/")) {
                // 只保留进程名，不保留路径和参数。
                String name = parts[8].substring(parts[8].indexOf('/') + 1);
                process = clean(name.substring(name.lastIndexOf('/') + 1));
            }
            if (!seen.add(parts[0] + "|" + address + "|" + port)) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("protocol", parts[0]);
            row.put("address", clean(address));
            row.put("port", port);
            if (process != null) row.put("process", process);
            rows.add(row);
            if (rows.size() >= MAX_LIST_ITEMS) break;
        }
        return rows;
    }

    // ─── 存储 ────────────────────────────────────────────────────────────────

    private void parseStorage() {
        Map<String, Long> exactSizes = new LinkedHashMap<>();
        for (String line : text("sos_commands/block/blockdev_--report").split("\\R")) {
            String[] parts = line.trim().split("\\s+");
            if (parts.length >= 7 && parts[6].startsWith("/dev/")) {
                long size = parseLong(parts[5], -1);
                if (size >= 0) exactSizes.put(parts[6].substring("/dev/".length()), size);
            }
        }

        Map<String, Map<String, Object>> disks = new LinkedHashMap<>();
        for (String line : text("sos_commands/block/lsblk").split("\\R")) {
            String[] parts = line.trim().split("\\s+");
            // 只有顶层设备才是整盘；子设备的名称带树形符号。
            if (parts.length < 6 || !parts[5].equals("disk") || !Character.isLetterOrDigit(parts[0].charAt(0))) continue;
            Map<String, Object> disk = new LinkedHashMap<>();
            disk.put("name", clean(parts[0]));
            Long bytes = exactSizes.get(parts[0]);
            if (bytes == null) bytes = parseSizeBytes(parts[3]);
            if (bytes != null) disk.put("sizeGb", Math.round(bytes / 1_000_000_000.0));
            if (bytes != null) disk.put("sizeBytes", bytes);
            Map<String, String> udev = udevProperties(parts[0]);
            putIfUseful(disk, "vendor", udev.get("ID_VENDOR"));
            putIfUseful(disk, "model", udev.get("ID_MODEL"));
            putIfUseful(disk, "serial", udev.get("ID_SERIAL_SHORT"));
            String bus = udev.get("ID_BUS");
            if (parts[0].startsWith("nvme")) disk.put("type", "nvme");
            else if (bus != null) disk.put("type", clean(bus));
            disks.put(parts[0], disk);
        }
        if (!disks.isEmpty()) {
            facts.put("storage.disks", new ArrayList<>(disks.values()));
            boolean complete = disks.values().stream().allMatch(d -> d.get("sizeBytes") != null);
            if (complete) {
                long total = disks.values().stream().mapToLong(d -> (Long) d.get("sizeBytes")).sum();
                facts.put("storage.totalDiskGb", Math.round(total / 1_000_000_000.0));
            }
        }

        parseFilesystems();
        parseMdRaid();
    }

    private Map<String, String> udevProperties(String device) {
        Map<String, String> values = new LinkedHashMap<>();
        for (String line : text("sos_commands/block/udevadm_info_.dev." + device).split("\\R")) {
            if (!line.startsWith("E: ")) continue;
            int equals = line.indexOf('=');
            if (equals > 3) values.put(line.substring(3, equals), line.substring(equals + 1));
        }
        return values;
    }

    private void parseFilesystems() {
        String content = pathWithPrefix("sos_commands/filesys/df_-al").map(this::text).orElse("");
        List<Map<String, Object>> rows = new ArrayList<>();
        Set<String> seenMounts = new LinkedHashSet<>();
        for (String line : content.split("\\R")) {
            String[] parts = line.trim().split("\\s+");
            if (parts.length < 6 || !parts[0].startsWith("/dev/")) continue;
            long blocks = parseLong(parts[1], -1);
            if (blocks <= 0 || !seenMounts.add(parts[5])) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("device", clean(parts[0]));
            row.put("mountPoint", clean(parts[5]));
            row.put("sizeGb", Math.round(blocks * 1024 / 1_000_000_000.0));
            row.put("usedPercent", clean(parts[4]));
            rows.add(row);
        }
        if (!rows.isEmpty()) facts.put("storage.filesystems", rows);
    }

    private void parseMdRaid() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String line : text("proc/mdstat").split("\\R")) {
            Matcher matcher = MD_LINE.matcher(line.trim());
            if (!matcher.matches()) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", clean(matcher.group(1)));
            row.put("state", matcher.group(2));
            row.put("level", matcher.group(3));
            List<String> members = new ArrayList<>();
            for (String token : matcher.group(4).trim().split("\\s+")) {
                int bracket = token.indexOf('[');
                members.add(clean(bracket > 0 ? token.substring(0, bracket) : token));
            }
            members.sort(Comparator.naturalOrder());
            row.put("members", members);
            rows.add(row);
        }
        if (!rows.isEmpty()) facts.put("storage.softwareRaids", rows);
    }

    // ─── 软件 ────────────────────────────────────────────────────────────────

    private void parseSoftware() {
        Optional<String> rpmPath = pathWithPrefix("sos_commands/rpm/sh_-c_rpm_");
        if (rpmPath.isPresent()) {
            List<String> packages = new ArrayList<>();
            LocalDate earliest = null;
            for (String line : text(rpmPath.get()).split("\\R")) {
                Matcher matcher = RPM_LINE.matcher(line);
                if (!matcher.matches()) continue;
                packages.add(clean(matcher.group(1)));
                try {
                    LocalDate date = LocalDate.parse(
                        matcher.group(2) + " " + String.format("%2s", matcher.group(3)).replace(' ', '0') + " " + matcher.group(4),
                        DateTimeFormatter.ofPattern("MMM dd yyyy", Locale.ENGLISH));
                    if (earliest == null || date.isBefore(earliest)) earliest = date;
                } catch (DateTimeParseException ignored) {
                    // 单行日期不规范不影响其他包。
                }
            }
            if (!packages.isEmpty()) {
                facts.put("software.packageCount", packages.size());
                putList("software.packages", packages);
            }
            if (earliest != null) facts.put("os.installDate", earliest.toString());
        }

        List<String> running = new ArrayList<>();
        List<String> failed = new ArrayList<>();
        for (String line : text("sos_commands/systemd/systemctl_list-units").split("\\R")) {
            String[] parts = line.replace("●", " ").replace("*", " ").trim().split("\\s+");
            if (parts.length < 4 || !parts[0].endsWith(".service")) continue;
            if ("running".equals(parts[3])) running.add(clean(parts[0]));
            if ("failed".equals(parts[2]) || "failed".equals(parts[3])) failed.add(clean(parts[0]));
        }
        putList("software.runningServices", running);
        putList("software.failedServices", failed);
    }

    // ─── 元数据 ──────────────────────────────────────────────────────────────

    private String sosVersion() {
        Matcher matcher = Pattern.compile("(?m)^sos(?:report)?(?:\\s+version)?:?\\s*(\\S+)\\s*$").matcher(text("version.txt"));
        return matcher.find() ? limit(clean(matcher.group(1)), 64) : null;
    }

    private String collectedAt() {
        String value = firstLine("sos_commands/date/date");
        return value == null ? null : limit(value, 64);
    }

    // ─── 工具方法 ────────────────────────────────────────────────────────────

    private String text(String path) {
        return files.getOrDefault(path, "");
    }

    private Optional<String> pathWithPrefix(String prefix) {
        return files.keySet().stream().filter(path -> path.startsWith(prefix)).sorted().findFirst();
    }

    private List<String> sortedPaths(String prefix) {
        return files.keySet().stream().filter(path -> path.startsWith(prefix)).sorted().toList();
    }

    private String firstLine(String path) {
        return text(path).lines().map(SosReportParser::clean).filter(line -> line != null && !line.isEmpty()).findFirst().orElse(null);
    }

    /** dmidecode 按空行分段，段首是标题，其余是缩进的 key: value。 */
    private List<Map<String, String>> dmi(String title) {
        List<Map<String, String>> sections = new ArrayList<>();
        Map<String, String> current = null;
        for (String line : text("sos_commands/hardware/dmidecode").split("\\R")) {
            if (line.isBlank()) {
                current = null;
            } else if (!line.startsWith("\t") && !line.startsWith(" ")) {
                if (line.trim().equals(title)) {
                    current = new LinkedHashMap<>();
                    sections.add(current);
                } else {
                    current = null;
                }
            } else if (current != null && line.startsWith("\t") && !line.startsWith("\t\t")) {
                int colon = line.indexOf(':');
                if (colon > 0) current.put(line.substring(0, colon).trim(), line.substring(colon + 1).trim());
            }
        }
        return sections;
    }

    private static Map<String, String> keyValues(String content) {
        Map<String, String> values = new LinkedHashMap<>();
        for (String line : content.split("\\R")) {
            int equals = line.indexOf('=');
            if (equals <= 0 || line.startsWith("#")) continue;
            values.put(line.substring(0, equals).trim(), unquote(line.substring(equals + 1).trim()));
        }
        return values;
    }

    private static Map<String, String> keyColonValues(String content) {
        Map<String, String> values = new LinkedHashMap<>();
        for (String line : content.split("\\R")) {
            int colon = line.indexOf(':');
            if (colon > 0) values.putIfAbsent(line.substring(0, colon).trim(), line.substring(colon + 1).trim());
        }
        return values;
    }

    private static String unquote(String value) {
        if (value.length() >= 2 && (value.startsWith("\"") && value.endsWith("\"") || value.startsWith("'") && value.endsWith("'"))) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    private static String cleanDmi(String value) {
        String cleaned = clean(value);
        if (cleaned == null) return null;
        return PLACEHOLDERS.contains(cleaned.toLowerCase(Locale.ROOT)) ? null : cleaned;
    }

    private static String cleanUuid(String value) {
        String cleaned = cleanDmi(value);
        if (cleaned == null) return null;
        if (cleaned.matches("[0Ff-]+")) return null;
        return cleaned.toLowerCase(Locale.ROOT);
    }

    /** 去除控制字符、裁剪空白并限制长度。 */
    private static String clean(String value) {
        if (value == null) return null;
        String stripped = value.replaceAll("\\p{Cntrl}", " ").trim();
        if (stripped.isEmpty()) return null;
        return limit(stripped, MAX_VALUE_LENGTH);
    }

    private static String limit(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }

    private void put(String key, String value) {
        String cleaned = clean(value);
        if (cleaned != null) facts.put(key, cleaned);
    }

    private void putList(String key, List<String> values) {
        List<String> cleaned = values.stream().map(SosReportParser::clean)
            .filter(value -> value != null && !value.isEmpty()).distinct().limit(MAX_LIST_ITEMS).toList();
        if (!cleaned.isEmpty()) facts.put(key, cleaned);
    }

    private static void putIfUseful(Map<String, Object> row, String key, String value) {
        String cleaned = clean(value);
        if (cleaned != null && !PLACEHOLDERS.contains(cleaned.toLowerCase(Locale.ROOT)) && !cleaned.equals("Unknown!")) {
            row.put(key, cleaned);
        }
    }

    private static String firstNonNull(String a, String b) {
        return a != null && !a.isBlank() ? a : b;
    }

    private static String stripPrefix(String cidr) {
        int slash = cidr.indexOf('/');
        return slash > 0 ? cidr.substring(0, slash) : cidr;
    }

    private static String firstToken(String value) {
        if (value == null) return null;
        String[] parts = value.trim().split("\\s+");
        return parts.length == 0 ? null : parts[0];
    }

    private static Integer parseInteger(String value) {
        if (value == null) return null;
        try {
            return Integer.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static long parseLong(String value, long fallback) {
        if (value == null) return fallback;
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    /** DMI 的 Size 如 "64 GB"、"512 MB"，未安装时为 "No Module Installed"。 */
    private static Long parseDmiSizeMb(String value) {
        if (value == null) return null;
        String[] parts = value.trim().split("\\s+");
        if (parts.length != 2) return null;
        long number = parseLong(parts[0], -1);
        if (number < 0) return null;
        return switch (parts[1].toUpperCase(Locale.ROOT)) {
            case "MB" -> number;
            case "GB" -> number * 1024;
            case "TB" -> number * 1024 * 1024;
            default -> null;
        };
    }

    /** lsblk 的容量是二进制单位，如 3.5T。 */
    private static Long parseSizeBytes(String value) {
        Matcher matcher = SIZE_TOKEN.matcher(value);
        if (!matcher.matches()) return null;
        double number = Double.parseDouble(matcher.group(1));
        double multiplier = switch (matcher.group(2)) {
            case "K" -> 1024d;
            case "M" -> 1024d * 1024;
            case "G" -> 1024d * 1024 * 1024;
            case "T" -> 1024d * 1024 * 1024 * 1024;
            case "P" -> 1024d * 1024 * 1024 * 1024 * 1024;
            default -> 1d;
        };
        return Math.round(number * multiplier);
    }
}
