package com.cwgsyw.platform.module.sosreport.parser;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.clean;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.pciKey;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.putIfPresent;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.putIfUseful;

/**
 * 解析 {@code lspci -nnvvv}。只保留存储、网络、显示、加速、FC、InfiniBand 等板卡，
 * 桥、系统外设、内存控制器这类芯片组设备数量多且没有资产意义，不保留。
 */
final class PciFacts {

    /** sos 4.x 运行 lspci -nnvvv，3.x 运行 lspci -nnvv，输出格式相同。 */
    static final String LSPCI = "sos_commands/pci/lspci_-nnvvv";
    static final String LSPCI_SOS3 = "sos_commands/pci/lspci_-nnvv";

    /** 设备行：{@code 3b:00.0 RAID bus controller [0104]: Broadcom / LSI MegaRAID SAS-3 3108 [1000:005d] (rev 02)}。 */
    private static final Pattern DEVICE_LINE = Pattern.compile(
        "^((?:[0-9a-f]{4,8}:)?[0-9a-f]{2}:[0-9a-f]{2}\\.[0-7])\\s+(.+?)\\s+\\[([0-9a-f]{4})]:\\s+(.+?)\\s+\\[([0-9a-f]{4}):([0-9a-f]{4})](?:\\s+\\(rev\\s+([0-9a-f]+)\\))?.*$");
    private static final Pattern SUBSYSTEM = Pattern.compile("^(.*?)\\s*\\[([0-9a-f]{4}):([0-9a-f]{4})]\\s*$");
    private static final Pattern VPD_FIELD = Pattern.compile("^\\[(PN|SN|EC|MN|V\\d)]\\s+[^:]*:\\s*(.*)$");
    private static final Pattern LINK = Pattern.compile("Speed\\s+([^,\\s]+)([^,]*),\\s*Width\\s+(x\\d+)(\\s*\\(\\w+\\))?");

    /** 类别代码前缀 → 中文类别。只列出需要保留的设备。 */
    private static final Map<String, String> KEPT_CLASSES = new LinkedHashMap<>();

    static {
        KEPT_CLASSES.put("0100", "SCSI 控制器");
        KEPT_CLASSES.put("0101", "IDE 控制器");
        KEPT_CLASSES.put("0104", "RAID 控制器");
        KEPT_CLASSES.put("0106", "SATA 控制器");
        KEPT_CLASSES.put("0107", "SAS 控制器");
        KEPT_CLASSES.put("0108", "NVMe 控制器");
        KEPT_CLASSES.put("01", "存储控制器");
        KEPT_CLASSES.put("0200", "以太网卡");
        KEPT_CLASSES.put("0207", "InfiniBand 网卡");
        KEPT_CLASSES.put("02", "网络控制器");
        KEPT_CLASSES.put("0300", "VGA 显示控制器");
        KEPT_CLASSES.put("0302", "3D 控制器");
        KEPT_CLASSES.put("03", "显示控制器");
        KEPT_CLASSES.put("0b40", "协处理器");
        KEPT_CLASSES.put("0c04", "光纤通道 HBA");
        KEPT_CLASSES.put("0c06", "InfiniBand 控制器");
        KEPT_CLASSES.put("0d", "无线控制器");
        KEPT_CLASSES.put("12", "加速卡");
    }

    /**
     * 常见 PCI 厂商 ID。lspci 的描述把厂商名和设备名连在一起，无法可靠拆开，
     * 所以只对确定的 ID 给出厂商名，其他设备看 description。
     */
    private static final Map<String, String> VENDORS = Map.ofEntries(
        Map.entry("8086", "Intel"), Map.entry("1022", "AMD"), Map.entry("1002", "AMD"),
        Map.entry("1000", "Broadcom / LSI"), Map.entry("14e4", "Broadcom"), Map.entry("15b3", "Mellanox (NVIDIA)"),
        Map.entry("10de", "NVIDIA"), Map.entry("1077", "QLogic"), Map.entry("10df", "Emulex"),
        Map.entry("9005", "Microchip (Adaptec)"), Map.entry("1590", "HPE"), Map.entry("103c", "HP"),
        Map.entry("1028", "Dell"), Map.entry("19e5", "Huawei"), Map.entry("1d94", "Hygon"),
        Map.entry("8088", "WangXun"), Map.entry("144d", "Samsung"), Map.entry("1344", "Micron"),
        Map.entry("1179", "Toshiba"), Map.entry("1e0f", "KIOXIA"), Map.entry("1c5f", "Memblaze"),
        Map.entry("1bb1", "Seagate"), Map.entry("1b96", "Western Digital"), Map.entry("15b7", "SanDisk"),
        Map.entry("1a03", "ASPEED"), Map.entry("102b", "Matrox"), Map.entry("1b4b", "Marvell"),
        Map.entry("10ec", "Realtek"), Map.entry("1924", "Solarflare"), Map.entry("1137", "Cisco"),
        Map.entry("15ad", "VMware"), Map.entry("1af4", "Red Hat (virtio)"), Map.entry("1bd4", "Inspur"),
        Map.entry("1d17", "Zhaoxin"), Map.entry("1dd8", "AMD Pensando"), Map.entry("1fc9", "Tehuti"),
        Map.entry("177d", "Cavium"), Map.entry("1425", "Chelsio"), Map.entry("1fc1", "QLogic (InfiniPath)"),
        // 国产芯片：hwdb 和较旧的 pci.ids 里常常没有名称。ID 与 Linux 内核驱动（rnpgbe、sssraid）中的定义一致。
        Map.entry("8848", "Mucse（沐创）"), Map.entry("1f3f", "3SNIC"), Map.entry("1e49", "YMTC（长江存储）"));

    private final SosParseContext ctx;

    PciFacts(SosParseContext ctx) {
        this.ctx = ctx;
    }

    void parse() {
        List<Map<String, Object>> rows = new ArrayList<>();
        Map<String, Object> current = null;
        boolean inVpd = false;
        for (String line : ctx.firstText(LSPCI, LSPCI_SOS3).split("\\R")) {
            if (line.isBlank()) {
                current = null;
                continue;
            }
            if (!Character.isWhitespace(line.charAt(0))) {
                current = device(line);
                inVpd = false;
                if (current != null) rows.add(current);
                continue;
            }
            if (current == null) continue;
            String trimmed = line.trim();
            // VPD 的内容比 Capabilities 行多一级缩进；回到一级缩进（如 Kernel driver in use）即 VPD 结束。
            if (inVpd && indent(line) <= 1) inVpd = false;
            if (trimmed.startsWith("Capabilities:")) {
                inVpd = trimmed.contains("Vital Product Data");
                if (trimmed.contains("Device Serial Number")) {
                    putIfUseful(current, "serialNumber", trimmed.substring(trimmed.indexOf("Device Serial Number") + 20));
                }
                continue;
            }
            if (inVpd) {
                vpd(current, trimmed);
                continue;
            }
            int colon = trimmed.indexOf(':');
            if (colon <= 0) continue;
            String key = trimmed.substring(0, colon);
            String value = trimmed.substring(colon + 1).trim();
            switch (key) {
                case "Subsystem" -> {
                    Matcher matcher = SUBSYSTEM.matcher(value);
                    if (matcher.matches()) {
                        putIfUseful(current, "subsystem", matcher.group(1));
                        current.put("subsystemId", matcher.group(2) + ":" + matcher.group(3));
                    } else {
                        putIfUseful(current, "subsystem", value);
                    }
                }
                // 插槽号和 NUMA 节点可以是 0，不能按占位值过滤。
                case "Physical Slot" -> putIfPresent(current, "physicalSlot", clean(value));
                case "NUMA node" -> putIfPresent(current, "numaNode", clean(value));
                case "Kernel driver in use" -> putIfUseful(current, "driver", value);
                case "LnkCap" -> link(current, "linkCapability", value);
                case "LnkSta" -> link(current, "linkStatus", value);
                default -> {
                }
            }
        }
        // 主机没有安装 pciutils 时 sos 运行不了 lspci，依次退回 udev 数据库和 /proc/bus/pci/devices。
        if (rows.isEmpty()) rows = PciFallbacks.fromUdevDatabase(ctx.text(PciFallbacks.UDEV_DB));
        if (rows.isEmpty()) rows = PciFallbacks.fromProcDevices(ctx.text(PciFallbacks.PROC_DEVICES));

        List<Map<String, Object>> kept = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String address = String.valueOf(row.get("address"));
            String key = pciKey(address);
            String location = SystemFacts.locationOf(ctx, address);
            // 多功能设备（如双口网卡的 .1）在 DMI 里只登记功能 0 的地址，沿用同一张卡的位置。
            if (location == null && key != null && !key.endsWith(".0")) {
                location = SystemFacts.locationOf(ctx, key.substring(0, key.length() - 1) + "0");
            }
            if (location != null) row.put("location", location);
            else if (row.get("physicalSlot") != null) row.put("location", "Slot " + row.get("physicalSlot"));
            if (key != null) ctx.pciByAddress.put(key, row);
            if (row.remove("kept") != null) kept.add(row);
            if (kept.size() >= SosParseContext.MAX_DETAIL_ROWS) break;
        }
        ctx.putRows("hardware.pciDevices", kept);
        describeOccupants("hardware.pciSlots");
        describeOccupants("hardware.onboardDevices");
    }

    /**
     * 插槽和板载设备只有总线地址，这里按地址补上插在其中的设备类别和型号，
     * 让插槽表能直接看出“哪个槽插了什么卡”。
     */
    @SuppressWarnings("unchecked")
    private void describeOccupants(String key) {
        if (!(ctx.facts.get(key) instanceof List<?> rows)) return;
        for (Object item : rows) {
            if (!(item instanceof Map<?, ?> raw)) continue;
            Map<String, Object> row = (Map<String, Object>) raw;
            Map<String, Object> device = ctx.pciByAddress.get(pciKey((String) row.get("busAddress")));
            // 部分 BIOS 填的是上游桥的地址，桥不是插在槽里的卡，不能当成占用设备。
            if (device == null || !isCard(device)) continue;
            putIfPresent(row, "deviceCategory", device.get("category"));
            putIfPresent(row, "deviceVendor", device.get("vendor"));
            putIfPresent(row, "deviceModel", label(device));
        }
    }

    /** 缩进层级：lspci 每级一个制表符；以空格缩进时按 8 个空格一级。 */
    private static int indent(String line) {
        int tabs = 0;
        int spaces = 0;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '\t') tabs++;
            else if (c == ' ') spaces++;
            else break;
        }
        return tabs + spaces / 8;
    }

    /** 是否为板卡类设备。有类别代码时按类别判断；/proc 来源没有类别，按是否绑定了非根端口驱动判断。 */
    static boolean isCard(Map<String, Object> device) {
        Object classCode = device.get("classCode");
        if (classCode != null) return category(String.valueOf(classCode)) != null;
        Object driver = device.get("driver");
        return driver != null && !"pcieport".equals(driver);
    }

    /** 各来源共用的设备行：地址、类别代码、厂商和设备 ID；只保留板卡类设备（打上 kept 标记）。 */
    static Map<String, Object> baseRow(String address, String classCode, String vendorId, String deviceId, String className) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("address", clean(address));
        if (classCode != null) row.put("classCode", classCode);
        String category = classCode == null ? null : category(classCode);
        if (category != null) row.put("category", category);
        else putIfUseful(row, "category", className);
        row.put("vendorId", vendorId);
        row.put("deviceId", deviceId);
        if (VENDORS.containsKey(vendorId)) row.put("vendor", VENDORS.get(vendorId));
        if (category != null) row.put("kept", Boolean.TRUE);
        return row;
    }

    private static Map<String, Object> device(String line) {
        Matcher matcher = DEVICE_LINE.matcher(line.trim());
        if (!matcher.matches()) return null;
        Map<String, Object> row = baseRow(matcher.group(1), matcher.group(3).toLowerCase(Locale.ROOT),
            matcher.group(5).toLowerCase(Locale.ROOT), matcher.group(6).toLowerCase(Locale.ROOT), matcher.group(2));
        putIfUseful(row, "description", matcher.group(4));
        if (matcher.group(7) != null) row.put("revision", matcher.group(7));
        row.put("source", "lspci");
        return row;
    }

    static String category(String classCode) {
        if (KEPT_CLASSES.containsKey(classCode)) return KEPT_CLASSES.get(classCode);
        String prefix = classCode.length() >= 2 ? classCode.substring(0, 2) : classCode;
        return KEPT_CLASSES.get(prefix);
    }

    private static void vpd(Map<String, Object> row, String line) {
        if (line.startsWith("Product Name:")) {
            putIfUseful(row, "productName", line.substring("Product Name:".length()));
            return;
        }
        Matcher matcher = VPD_FIELD.matcher(line);
        if (!matcher.matches()) return;
        switch (matcher.group(1)) {
            case "PN" -> putIfUseful(row, "partNumber", matcher.group(2));
            case "SN" -> putIfUseful(row, "vpdSerialNumber", matcher.group(2));
            case "EC" -> putIfUseful(row, "engineeringChange", matcher.group(2));
            case "MN" -> putIfUseful(row, "manufacturerId", matcher.group(2));
            default -> {
            }
        }
    }

    private static void link(Map<String, Object> row, String key, String value) {
        Matcher matcher = LINK.matcher(value);
        if (!matcher.find()) return;
        String text = matcher.group(1) + " " + matcher.group(3);
        boolean downgraded = matcher.group(2).contains("downgraded")
            || (matcher.group(4) != null && matcher.group(4).contains("downgraded"));
        row.put(key, clean(downgraded ? text + "（降级）" : text));
    }

    /** 设备的“型号”：优先 VPD 产品名，其次子系统名，再次 lspci 或 hwdb 描述；都没有时给出 PCI ID。 */
    static String model(Map<String, Object> device) {
        for (String key : List.of("productName", "subsystem", "description")) {
            Object value = device.get(key);
            if (value != null) return String.valueOf(value);
        }
        Object vendorId = device.get("vendorId");
        Object deviceId = device.get("deviceId");
        return vendorId != null && deviceId != null ? "PCI ID " + vendorId + ":" + deviceId : null;
    }

    /** 单独展示设备时的名称：型号只有 PCI ID 时在前面加上厂商名。 */
    static String label(Map<String, Object> device) {
        String model = model(device);
        Object vendor = device.get("vendor");
        return model != null && model.startsWith("PCI ID ") && vendor != null ? vendor + " " + model : model;
    }
}
