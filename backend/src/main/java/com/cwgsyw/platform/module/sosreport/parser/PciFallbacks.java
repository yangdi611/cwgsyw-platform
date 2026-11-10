package com.cwgsyw.platform.module.sosreport.parser;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.putIfUseful;

/**
 * 没有 lspci 输出时的 PCI 设备来源。常见于主机只装了 pciutils-libs、没装 pciutils，sos 运行不了 lspci。
 *
 * <ol>
 *   <li>{@code udevadm info --export-db}（devices 插件）：有地址、类别、ID、驱动，以及 hwdb 查出的厂商名和型号名。</li>
 *   <li>{@code /proc/bus/pci/devices}（pci 插件复制）：只有地址、ID 和驱动，没有类别；只列出已绑定驱动的设备，类别记为“未知类别”。</li>
 * </ol>
 * 这两种来源都没有 VPD、PCIe 链路和 NUMA 信息。
 */
final class PciFallbacks {

    static final String UDEV_DB = "sos_commands/devices/udevadm_info_--export-db";
    static final String PROC_DEVICES = "proc/bus/pci/devices";

    private static final Pattern PCI_ID = Pattern.compile("^([0-9A-Fa-f]{4}):([0-9A-Fa-f]{4})$");
    private static final Pattern HEX = Pattern.compile("^[0-9A-Fa-f]{1,8}$");

    private PciFallbacks() {
    }

    /** udev 数据库按空行分段，每段 {@code P:} 开头，属性为 {@code E: KEY=VALUE}；只取 SUBSYSTEM=pci 的段。 */
    static List<Map<String, Object>> fromUdevDatabase(String content) {
        List<Map<String, Object>> rows = new ArrayList<>();
        Map<String, String> values = new LinkedHashMap<>();
        for (String line : content.split("\\R")) {
            if (line.isBlank()) {
                Map<String, Object> row = udevRow(values);
                if (row != null) rows.add(row);
                values = new LinkedHashMap<>();
                continue;
            }
            if (!line.startsWith("E: ")) continue;
            int equals = line.indexOf('=');
            if (equals > 3) values.put(line.substring(3, equals), line.substring(equals + 1));
        }
        // 最后一段后面可能没有空行（split 也会丢掉末尾的空串），单独收尾。
        Map<String, Object> last = udevRow(values);
        if (last != null) rows.add(last);
        return rows;
    }

    private static Map<String, Object> udevRow(Map<String, String> values) {
        if (!"pci".equals(values.get("SUBSYSTEM"))) return null;
        String address = SosParseContext.pciKey(values.get("PCI_SLOT_NAME"));
        Matcher id = PCI_ID.matcher(String.valueOf(values.get("PCI_ID")));
        if (address == null || !id.matches()) return null;
        String classCode = null;
        String pciClass = values.get("PCI_CLASS");
        // PCI_CLASS 是 24 位类别代码（类别、子类别、编程接口），如 20000 表示以太网卡 0200。
        if (pciClass != null && HEX.matcher(pciClass).matches()) {
            String padded = String.format("%6s", pciClass.toLowerCase(Locale.ROOT)).replace(' ', '0');
            classCode = padded.substring(0, 4);
        }
        String className = values.getOrDefault("ID_PCI_SUBCLASS_FROM_DATABASE", values.get("ID_PCI_CLASS_FROM_DATABASE"));
        // 与 lspci 一致，地址不带 PCI 域（0000:）。
        Map<String, Object> row = PciFacts.baseRow(address, classCode,
            id.group(1).toLowerCase(Locale.ROOT), id.group(2).toLowerCase(Locale.ROOT), className);
        String vendorName = values.get("ID_VENDOR_FROM_DATABASE");
        if (!row.containsKey("vendor")) putIfUseful(row, "vendor", vendorName);
        String model = values.get("ID_MODEL_FROM_DATABASE");
        if (model != null) putIfUseful(row, "description", vendorName != null ? vendorName + " " + model : model);
        Matcher subsystem = PCI_ID.matcher(String.valueOf(values.get("PCI_SUBSYS_ID")));
        if (subsystem.matches()) row.put("subsystemId", subsystem.group(1).toLowerCase(Locale.ROOT) + ":" + subsystem.group(2).toLowerCase(Locale.ROOT));
        putIfUseful(row, "driver", values.get("DRIVER"));
        row.put("source", "udev");
        return row;
    }

    /**
     * {@code /proc/bus/pci/devices} 每行以制表符分隔：总线和设备功能号（BBDD）、厂商和设备 ID（VVVVDDDD）、中断、
     * 基址和大小，末尾可能有驱动名。不含 PCI 域和类别，类别未知的设备不能判断是不是板卡，所以都保留。
     */
    static List<Map<String, Object>> fromProcDevices(String content) {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String line : content.split("\\R")) {
            String[] fields = line.trim().split("\t");
            if (fields.length < 3 || !fields[0].matches("[0-9a-fA-F]{4}") || !fields[1].matches("[0-9a-fA-F]{8}")) continue;
            int busDevfn = Integer.parseInt(fields[0], 16);
            String address = String.format(Locale.ROOT, "%02x:%02x.%d", busDevfn >> 8, (busDevfn & 0xff) >> 3, busDevfn & 0x7);
            String ids = fields[1].toLowerCase(Locale.ROOT);
            Map<String, Object> row = PciFacts.baseRow(address, null, ids.substring(0, 4), ids.substring(4), null);
            row.put("category", "未知类别");
            // 前 17 列固定（地址、ID、中断、7 个基址、7 个大小），驱动名是第 18 列。
            // 按位置取，不能按“是否十六进制”判断，e1000e 这类驱动名本身就是十六进制字符。
            if (fields.length > 17) putIfUseful(row, "driver", fields[17].trim());
            row.put("source", "proc");
            // 没有类别时只能靠驱动判断：未绑定驱动的（主机桥等）和 PCIe 根端口不是板卡，只用于地址关联，不列出。
            Object driver = row.get("driver");
            if (driver != null && !"pcieport".equals(driver)) row.put("kept", Boolean.TRUE);
            rows.add(row);
        }
        return rows;
    }
}
