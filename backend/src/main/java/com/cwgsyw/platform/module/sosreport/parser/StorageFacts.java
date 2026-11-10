package com.cwgsyw.platform.module.sosreport.parser;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.clean;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.firstNonNull;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.keyColonValues;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.leadingInteger;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.parseLong;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.parseSizeBytes;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.putIfPresent;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.putIfUseful;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.useful;

/** 操作系统可见的磁盘、文件系统、软 RAID、多路径和 LVM。RAID 卡见 {@link RaidFacts}。 */
final class StorageFacts {

    private static final Pattern MD_LINE = Pattern.compile("^(md\\S*)\\s*:\\s*(active|inactive)\\s+(?:\\(\\S+\\)\\s+)?(raid\\d+|linear)\\s+(.*)$");
    private static final Pattern PAIR = Pattern.compile("([A-Z0-9:_-]+)=\"([^\"]*)\"");
    private static final Pattern LSSCSI = Pattern.compile("^\\[(\\d+:\\d+:\\d+:\\d+)]\\s+(\\S+)\\s+(.*?)\\s+(\\S+)\\s+/dev/(\\S+)(?:\\s+\\S+)?\\s*$");
    private static final Pattern MPATH_HEADER = Pattern.compile("^(\\S+)\\s+(?:\\(([0-9A-Za-z_.:-]+)\\)\\s+)?(dm-\\d+)\\s+(.*)$");
    private static final Pattern MPATH_PATH = Pattern.compile("(\\d+:\\d+:\\d+:\\d+)\\s+(\\S+)\\s+\\d+:\\d+\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)");

    private final SosParseContext ctx;

    StorageFacts(SosParseContext ctx) {
        this.ctx = ctx;
    }

    void parse() {
        Map<String, Long> exactSizes = new LinkedHashMap<>();
        for (String line : ctx.text("sos_commands/block/blockdev_--report").split("\\R")) {
            String[] parts = line.trim().split("\\s+");
            if (parts.length >= 7 && parts[6].startsWith("/dev/")) {
                long size = parseLong(parts[5], -1);
                if (size >= 0) exactSizes.put(parts[6].substring("/dev/".length()), size);
            }
        }

        Map<String, Map<String, String>> lsblkPairs = lsblkPairs();
        Map<String, String[]> lsscsi = lsscsi();
        Map<String, Map<String, String>> nvmeList = nvmeList();

        Map<String, Map<String, Object>> disks = new LinkedHashMap<>();
        for (String line : ctx.text("sos_commands/block/lsblk").split("\\R")) {
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

            enrich(disk, parts[0], udev, lsblkPairs.getOrDefault(parts[0], Map.of()), lsscsi.get(parts[0]), nvmeList.get(parts[0]));
            disks.put(parts[0], disk);
        }
        if (!disks.isEmpty()) {
            ctx.facts.put("storage.disks", new ArrayList<>(disks.values()));
            boolean complete = disks.values().stream().allMatch(d -> d.get("sizeBytes") != null);
            if (complete) {
                long total = disks.values().stream().mapToLong(d -> (Long) d.get("sizeBytes")).sum();
                ctx.facts.put("storage.totalDiskGb", Math.round(total / 1_000_000_000.0));
            }
        }

        parseFilesystems();
        parseMdRaid();
        parseMultipath();
        parseLvm();
    }

    // ─── 磁盘明细 ────────────────────────────────────────────────────────────

    private void enrich(Map<String, Object> disk, String name, Map<String, String> udev, Map<String, String> pairs,
                        String[] scsi, Map<String, String> nvme) {
        Map<String, String> smart = keyColonValues(ctx.firstText(
            "sos_commands/ata/smartctl_-a_.dev." + name, "sos_commands/nvme/smartctl_--all_.dev." + name));

        if (!disk.containsKey("vendor")) putIfUseful(disk, "vendor", firstNonNull(pairs.get("VENDOR"), smart.get("Vendor")));
        if (!disk.containsKey("model")) {
            putIfUseful(disk, "model", firstNonNull(firstNonNull(smart.get("Device Model"), smart.get("Model Number")),
                firstNonNull(smart.get("Product"), firstNonNull(pairs.get("MODEL"), nvme == null ? null : nvme.get("Model")))));
        }
        if (!disk.containsKey("serial")) {
            putIfUseful(disk, "serial", firstNonNull(firstNonNull(smart.get("Serial Number"), smart.get("Serial number")),
                firstNonNull(pairs.get("SERIAL"), nvme == null ? null : nvme.get("SN"))));
        }
        putIfUseful(disk, "modelFamily", smart.get("Model Family"));
        String firmware = firstNonNull(firstNonNull(smart.get("Firmware Version"), smart.get("Revision")),
            firstNonNull(nvme == null ? null : nvme.get("FW Rev"), firstNonNull(udev.get("ID_REVISION"),
                firstNonNull(pairs.get("REV"), scsi == null ? null : scsi[2]))));
        putIfUseful(disk, "firmware", firmware);
        putIfUseful(disk, "wwn", firstNonNull(udev.get("ID_WWN"), firstNonNull(pairs.get("WWN"), smart.get("LU WWN Device Id"))));
        putIfUseful(disk, "location", udev.get("ID_PATH"));
        putIfUseful(disk, "hctl", firstNonNull(pairs.get("HCTL"), scsi == null ? null : scsi[0]));
        putIfUseful(disk, "transport", firstNonNull(pairs.get("TRAN"), smart.get("Transport protocol")));
        String rota = pairs.get("ROTA");
        if ("0".equals(rota) || "1".equals(rota)) disk.put("rotational", "1".equals(rota));
        putIfUseful(disk, "rotationRate", smart.get("Rotation Rate"));
        putIfUseful(disk, "formFactor", smart.get("Form Factor"));
        putIfUseful(disk, "interfaceSpeed", smart.get("SATA Version is"));

        String health = firstNonNull(smart.get("SMART overall-health self-assessment test result"), smart.get("SMART Health Status"));
        putIfUseful(disk, "smartHealth", health);
        Integer powerOn = number(smart.get("Power On Hours"));
        if (powerOn == null) {
            // SAS 盘：Accumulated power on time, hours:minutes 12345:12
            Matcher sas = Pattern.compile("(?m)^Accumulated power on time, hours:minutes\\s+(\\d{1,9}):").matcher(ctx.firstText(
                "sos_commands/ata/smartctl_-a_.dev." + name, "sos_commands/nvme/smartctl_--all_.dev." + name));
            if (sas.find()) powerOn = parseIntSafe(sas.group(1));
        }
        if (powerOn == null) powerOn = ataAttribute(name, "Power_On_Hours");
        putIfPresent(disk, "powerOnHours", powerOn);
        Integer temperature = leadingInteger(firstNonNull(smart.get("Temperature"), smart.get("Current Drive Temperature")));
        if (temperature == null) temperature = ataAttribute(name, "Temperature_Celsius");
        putIfPresent(disk, "temperatureC", temperature);
        putIfPresent(disk, "percentageUsed", leadingInteger(smart.get("Percentage Used")));
        Integer mediaErrors = number(smart.get("Media and Data Integrity Errors"));
        putIfPresent(disk, "mediaErrors", mediaErrors);
        Integer reallocated = ataAttribute(name, "Reallocated_Sector_Ct");
        if (reallocated == null) reallocated = number(smart.get("Elements in grown defect list"));
        putIfPresent(disk, "reallocatedSectors", reallocated);
        Integer pending = ataAttribute(name, "Current_Pending_Sector");
        putIfPresent(disk, "pendingSectors", pending);

        String label = "磁盘 " + name;
        if (health != null && !health.equalsIgnoreCase("PASSED") && !health.equalsIgnoreCase("OK")) ctx.issue(label + " SMART 健康状态：" + health);
        if (reallocated != null && reallocated > 0) ctx.issue(label + " 重映射扇区 " + reallocated);
        if (pending != null && pending > 0) ctx.issue(label + " 待映射扇区 " + pending);
        if (mediaErrors != null && mediaErrors > 0) ctx.issue(label + " 介质错误 " + mediaErrors);
        Object used = disk.get("percentageUsed");
        if (used instanceof Integer percent && percent >= 90) ctx.issue(label + " 寿命已用 " + percent + "%");

        if (disk.get("firmware") != null) {
            String location = disk.get("location") != null ? name + "（" + disk.get("location") + "）" : name;
            ctx.firmware("磁盘", (String) disk.get("model"), location, (String) disk.get("firmware"));
        }
    }

    /** smartctl ATA 属性表的原始值，如 {@code 9 Power_On_Hours ... - 12345}。 */
    private Integer ataAttribute(String device, String attribute) {
        Pattern pattern = Pattern.compile("(?m)^\\s*\\d+\\s+" + attribute + "\\s+\\S+\\s+\\d+\\s+\\d+\\s+\\S+\\s+\\S+\\s+\\S+\\s+\\S+\\s+(\\d+)");
        Matcher matcher = pattern.matcher(ctx.text("sos_commands/ata/smartctl_-a_.dev." + device));
        return matcher.find() ? parseIntSafe(matcher.group(1)) : null;
    }

    /** 带千分位的整数，如 "12,345"。 */
    private static Integer number(String value) {
        if (value == null) return null;
        Matcher matcher = Pattern.compile("^\\s*([\\d,]{1,15})").matcher(value);
        return matcher.find() ? parseIntSafe(matcher.group(1).replace(",", "")) : null;
    }

    private static Integer parseIntSafe(String digits) {
        try {
            return Integer.valueOf(digits);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Map<String, String> udevProperties(String device) {
        Map<String, String> values = new LinkedHashMap<>();
        for (String line : ctx.text("sos_commands/block/udevadm_info_.dev." + device).split("\\R")) {
            if (!line.startsWith("E: ")) continue;
            int equals = line.indexOf('=');
            if (equals > 3) values.put(line.substring(3, equals), line.substring(equals + 1));
        }
        return values;
    }

    /** {@code lsblk -O -P}：每行一组 KEY="value"。 */
    private Map<String, Map<String, String>> lsblkPairs() {
        Map<String, Map<String, String>> rows = new LinkedHashMap<>();
        for (String line : ctx.text("sos_commands/block/lsblk_-O_-P").split("\\R")) {
            Map<String, String> row = new LinkedHashMap<>();
            Matcher matcher = PAIR.matcher(line);
            while (matcher.find()) row.put(matcher.group(1), matcher.group(2));
            String name = row.get("NAME");
            if (name != null && "disk".equals(row.get("TYPE"))) rows.put(name, row);
        }
        return rows;
    }

    /** {@code lsscsi -i}：设备名 → [HCTL, 类型, 固件版本]。 */
    private Map<String, String[]> lsscsi() {
        Map<String, String[]> rows = new LinkedHashMap<>();
        for (String line : ctx.text("sos_commands/scsi/lsscsi").split("\\R")) {
            Matcher matcher = LSSCSI.matcher(line.trim());
            if (matcher.matches()) rows.put(matcher.group(5), new String[] {matcher.group(1), matcher.group(2), matcher.group(4)});
        }
        return rows;
    }

    /** {@code nvme list} 是定宽表格，按分隔线的位置切列，兼容 nvme-cli 1.x 和 2.x。 */
    private Map<String, Map<String, String>> nvmeList() {
        Map<String, Map<String, String>> rows = new LinkedHashMap<>();
        List<String> lines = ctx.text("sos_commands/nvme/nvme_list").lines().toList();
        for (int i = 1; i < lines.size(); i++) {
            String rule = lines.get(i);
            if (!rule.trim().matches("-+(\\s+-+)+")) continue;
            String header = lines.get(i - 1);
            List<int[]> columns = new ArrayList<>();
            Matcher dashes = Pattern.compile("-+").matcher(rule);
            while (dashes.find()) columns.add(new int[] {dashes.start(), dashes.end()});
            for (int j = i + 1; j < lines.size(); j++) {
                String line = lines.get(j);
                if (!line.startsWith("/dev/")) continue;
                Map<String, String> row = new LinkedHashMap<>();
                for (int c = 0; c < columns.size(); c++) {
                    int start = columns.get(c)[0];
                    int end = c + 1 < columns.size() ? columns.get(c + 1)[0] : Math.max(line.length(), start);
                    String name = slice(header, start, end);
                    if (!name.isEmpty()) row.put(name, slice(line, start, end));
                }
                String node = row.get("Node");
                if (node != null) rows.put(node.substring("/dev/".length()), row);
            }
            break;
        }
        return rows;
    }

    private static String slice(String line, int start, int end) {
        if (start >= line.length()) return "";
        return line.substring(start, Math.min(end, line.length())).trim();
    }

    // ─── 文件系统和软 RAID ───────────────────────────────────────────────────

    private void parseFilesystems() {
        String content = ctx.pathWithPrefix("sos_commands/filesys/df_-al").map(ctx::text).orElse("");
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
            Integer percent = leadingInteger(parts[4]);
            if (percent != null && percent >= 90) ctx.issue("文件系统 " + parts[5] + " 使用率 " + percent + "%");
        }
        if (!rows.isEmpty()) ctx.facts.put("storage.filesystems", rows);
    }

    private void parseMdRaid() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String line : ctx.text("proc/mdstat").split("\\R")) {
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
                if (token.endsWith("(F)")) ctx.issue("软 RAID " + matcher.group(1) + " 成员故障：" + token);
            }
            members.sort(Comparator.naturalOrder());
            row.put("members", members);
            rows.add(row);
        }
        if (!rows.isEmpty()) ctx.facts.put("storage.softwareRaids", rows);
    }

    // ─── 多路径 ──────────────────────────────────────────────────────────────

    private void parseMultipath() {
        List<Map<String, Object>> rows = new ArrayList<>();
        Map<String, Object> current = null;
        List<String> devices = new ArrayList<>();
        int active = 0;
        for (String line : ctx.text("sos_commands/multipath/multipath_-ll").split("\\R")) {
            Matcher header = MPATH_HEADER.matcher(line);
            if (!line.isEmpty() && !Character.isWhitespace(line.charAt(0)) && !line.startsWith("size=")
                    && !line.startsWith("|") && !line.startsWith("`") && header.matches()) {
                finishMultipath(current, devices, active);
                current = new LinkedHashMap<>();
                rows.add(current);
                devices = new ArrayList<>();
                active = 0;
                String name = clean(header.group(1));
                current.put("name", name);
                current.put("wwid", clean(header.group(2) != null ? header.group(2) : name));
                current.put("dm", header.group(3));
                String[] vendorProduct = header.group(4).trim().split(",", 2);
                putIfUseful(current, "vendor", vendorProduct[0]);
                if (vendorProduct.length > 1) putIfUseful(current, "product", vendorProduct[1]);
                continue;
            }
            if (current == null) continue;
            Matcher size = Pattern.compile("^size=(\\S+)").matcher(line.trim());
            if (size.find()) {
                current.put("size", clean(size.group(1)));
                continue;
            }
            Matcher path = MPATH_PATH.matcher(line);
            if (path.find()) {
                devices.add(clean(path.group(2)) + "（" + path.group(3) + " " + path.group(4) + "）");
                if ("active".equals(path.group(3)) && "ready".equals(path.group(4))) active++;
            }
        }
        finishMultipath(current, devices, active);
        ctx.putRows("storage.multipaths", rows);
    }

    private void finishMultipath(Map<String, Object> row, List<String> devices, int active) {
        if (row == null) return;
        row.put("paths", devices.size());
        row.put("activePaths", active);
        row.put("pathDevices", devices);
        if (active < devices.size()) ctx.issue("多路径 " + row.get("name") + " 有 " + (devices.size() - active) + " 条路径不可用");
    }

    // ─── LVM ─────────────────────────────────────────────────────────────────

    /** 只取各命令前几列，这些列总有值；后面的可选列可能为空，按空白切分会错位。 */
    private void parseLvm() {
        List<Map<String, Object>> groups = new ArrayList<>();
        for (String line : lvmLines("sos_commands/lvm2/vgs_-v_-o_", "VG")) {
            String[] parts = line.trim().split("\\s+");
            if (parts.length < 8) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", clean(parts[0]));
            row.put("attributes", clean(parts[1]));
            putIfPresent(row, "pvCount", leadingInteger(parts[3]));
            putIfPresent(row, "lvCount", leadingInteger(parts[4]));
            row.put("size", clean(parts[6]));
            row.put("free", clean(parts[7]));
            groups.add(row);
        }
        ctx.putRows("storage.volumeGroups", groups);

        List<Map<String, Object>> volumes = new ArrayList<>();
        for (String line : lvmLines("sos_commands/lvm2/lvs_-a_-o_", "LV")) {
            String[] parts = line.trim().split("\\s+");
            // 方括号包裹的是 LVM 内部卷（元数据、镜像日志等）。
            if (parts.length < 4 || parts[0].startsWith("[")) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", clean(parts[0]));
            row.put("volumeGroup", clean(parts[1]));
            row.put("attributes", clean(parts[2]));
            row.put("size", clean(parts[3]));
            volumes.add(row);
        }
        ctx.putRows("storage.logicalVolumes", volumes);

        List<Map<String, Object>> physical = new ArrayList<>();
        for (String line : lvmLines("sos_commands/lvm2/pvs_-a_-v_-o_", "PV")) {
            String[] parts = line.trim().split("\\s+");
            if (parts.length < 5 || !parts[0].startsWith("/dev/")) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("device", clean(parts[0]));
            int offset;
            if (parts.length >= 6 && parts[2].toLowerCase(Locale.ROOT).startsWith("lvm")) {
                row.put("volumeGroup", clean(parts[1]));
                offset = 3;
            } else if (parts[1].toLowerCase(Locale.ROOT).startsWith("lvm")) {
                offset = 2;
            } else {
                continue;  // -a 会列出不是 PV 的块设备。
            }
            row.put("attributes", clean(parts[offset]));
            row.put("size", clean(parts[offset + 1]));
            if (parts.length > offset + 2) row.put("free", clean(parts[offset + 2]));
            physical.add(row);
        }
        ctx.putRows("storage.physicalVolumes", physical);
    }

    /** 文件名里带列名和 --config 参数，因 sos 和 lvm 版本不同而变化，按前缀取第一个。 */
    private List<String> lvmLines(String prefix, String headerStart) {
        String content = ctx.pathWithPrefix(prefix).map(ctx::text).orElse("");
        List<String> lines = new ArrayList<>();
        boolean afterHeader = false;
        for (String line : content.split("\\R")) {
            String trimmed = line.trim();
            if (trimmed.startsWith(headerStart + " ")) {
                afterHeader = true;
                continue;
            }
            // vgs -v 会在表格前输出诊断信息，表头之后才是数据。
            if (afterHeader && !trimmed.isEmpty() && useful(trimmed) != null) lines.add(trimmed);
        }
        return lines;
    }
}
