package com.cwgsyw.platform.module.sosreport.parser;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.cwgsyw.platform.module.sosreport.parser.RaidFacts.set;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.leadingInteger;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.parseInteger;

/** MegaCli、HPE ssacli、Microchip arcconf、Broadcom sas3ircu 的文本输出。 */
final class LegacyRaidParsers {

    private final SosParseContext ctx;
    private final RaidFacts raid;

    LegacyRaidParsers(SosParseContext ctx, RaidFacts raid) {
        this.ctx = ctx;
        this.raid = raid;
    }

    /** 拆分 {@code key : value}。优先按两侧带空格的冒号切分，键里可能本身含冒号（如 {@code Device(T:L)}）。 */
    static String[] split(String line) {
        String trimmed = line.trim();
        int index = trimmed.indexOf(" : ");
        int width = 3;
        if (index < 0) {
            index = trimmed.indexOf(':');
            width = 1;
        }
        if (index <= 0) return null;
        return new String[] {trimmed.substring(0, index).trim(), trimmed.substring(index + width).trim()};
    }

    private static int indent(String line) {
        int count = 0;
        while (count < line.length() && (line.charAt(count) == ' ' || line.charAt(count) == '\t')) count++;
        return count;
    }

    // ─── MegaCli ─────────────────────────────────────────────────────────────

    void megacli() {
        String base = "sos_commands/megacli/opt.MegaRAID.MegaCli.MegaCli64_";
        String adapterInfo = ctx.text(base + "-AdpAllInfo_-aALL");
        String drives = ctx.text(base + "LDPDInfo_-aALL");
        if (adapterInfo.isEmpty() && drives.isEmpty()) return;
        String tool = "megacli";

        Map<String, Object> controller = null;
        String bus = null;
        String device = null;
        for (String line : adapterInfo.split("\\R")) {
            Matcher adapter = Pattern.compile("^Adapter #(\\d+)").matcher(line.trim());
            if (adapter.find()) {
                controller = raid.controller(tool, adapter.group(1));
                bus = null;
                device = null;
                continue;
            }
            String[] kv = split(line);
            if (controller == null || kv == null) continue;
            switch (kv[0]) {
                case "Product Name" -> set(controller, "model", kv[1]);
                case "Serial No" -> set(controller, "serialNumber", kv[1]);
                case "FW Package Build" -> set(controller, "firmwarePackage", kv[1]);
                case "FW Version" -> set(controller, "firmwareVersion", kv[1]);
                case "BIOS Version" -> set(controller, "biosVersion", kv[1]);
                case "Memory Size" -> set(controller, "cacheSize", kv[1]);
                case "SAS Address" -> set(controller, "sasAddress", kv[1]);
                case "Bus Number" -> bus = kv[1];
                case "Device Number" -> device = kv[1];
                case "Function Number" -> {
                    Integer b = parseInteger(bus);
                    Integer d = parseInteger(device);
                    Integer f = parseInteger(kv[1]);
                    if (b != null && d != null && f != null) {
                        set(controller, "pciAddress", String.format(Locale.ROOT, "%02x:%02x.%d", b, d, f));
                    }
                }
                case "Degraded", "Offline", "Critical Disks", "Failed Disks" -> {
                    Integer count = parseInteger(kv[1]);
                    if (count != null && count > 0) ctx.issue("RAID 卡 MegaCli #" + controller.get("controller") + " " + kv[0] + "：" + count);
                }
                default -> {
                }
            }
        }

        String controllerId = null;
        Map<String, Object> vd = null;
        Map<String, Object> pd = null;
        Map<String, String> pending = new LinkedHashMap<>();
        for (String line : drives.split("\\R")) {
            String trimmed = line.trim();
            Matcher adapter = Pattern.compile("^Adapter #(\\d+)").matcher(trimmed);
            if (adapter.find()) {
                finishMegaPd(tool, controllerId, pd, pending);
                controllerId = adapter.group(1);
                raid.controller(tool, controllerId);
                vd = null;
                pd = null;
                continue;
            }
            if (controllerId == null) continue;
            Matcher virtual = Pattern.compile("^Virtual Drive:\\s*(\\d+)").matcher(trimmed);
            if (virtual.find()) {
                finishMegaPd(tool, controllerId, pd, pending);
                pd = null;
                vd = raid.virtualDrive(tool, controllerId, virtual.group(1));
                continue;
            }
            if (trimmed.matches("^PD:\\s*\\d+ Information$")) {
                finishMegaPd(tool, controllerId, pd, pending);
                pd = new LinkedHashMap<>();
                pending = new LinkedHashMap<>();
                if (vd != null) pd.put("virtualDrive", vd.get("id"));
                continue;
            }
            String[] kv = split(line);
            if (kv == null) continue;
            if (pd != null) {
                pending.putIfAbsent(kv[0], kv[1]);
            } else if (vd != null) {
                switch (kv[0]) {
                    case "Name" -> set(vd, "name", kv[1]);
                    case "RAID Level" -> set(vd, "level", megaRaidLevel(kv[1]));
                    case "Size" -> set(vd, "size", kv[1]);
                    case "State" -> set(vd, "state", kv[1]);
                    case "Current Cache Policy" -> set(vd, "cache", kv[1]);
                    default -> {
                    }
                }
            }
        }
        finishMegaPd(tool, controllerId, pd, pending);
    }

    private void finishMegaPd(String tool, String controllerId, Map<String, Object> virtualInfo, Map<String, String> values) {
        if (virtualInfo == null || values.isEmpty()) return;
        String enclosure = values.getOrDefault("Enclosure Device ID", "");
        String slot = values.get("Slot Number");
        if (slot == null) return;
        String location = "Adapter" + controllerId + (enclosure.isEmpty() || enclosure.equals("N/A") ? "" : "/E" + enclosure) + "/S" + slot;
        Map<String, Object> row = raid.physicalDrive(tool, controllerId, location);
        if (!enclosure.isEmpty()) row.put("enclosure", enclosure);
        row.put("slot", slot);
        row.put("installed", true);
        if (virtualInfo.get("virtualDrive") != null) row.put("virtualDrive", virtualInfo.get("virtualDrive"));
        set(row, "deviceId", values.get("Device Id"));
        set(row, "state", values.get("Firmware state"));
        set(row, "size", stripSectors(values.get("Raw Size")));
        set(row, "interface", values.get("PD Type"));
        set(row, "mediaType", values.get("Media Type"));
        set(row, "firmware", values.get("Device Firmware Level"));
        set(row, "wwn", values.get("WWN"));
        // Inquiry Data 是厂商、型号、固件、序列号首尾相连的原文，各厂商排列不同，不拆分。
        set(row, "inquiry", values.get("Inquiry Data"));
        set(row, "deviceSpeed", values.get("Device Speed"));
        set(row, "linkSpeed", values.get("Link Speed"));
        Integer temperature = leadingInteger(values.get("Drive Temperature"));
        if (temperature != null) row.put("temperatureC", temperature);
        Integer media = parseInteger(values.get("Media Error Count"));
        if (media != null) row.put("mediaErrors", media);
        Integer other = parseInteger(values.get("Other Error Count"));
        if (other != null) row.put("otherErrors", other);
        Integer predictive = parseInteger(values.get("Predictive Failure Count"));
        if (predictive != null) row.put("predictiveFailures", predictive);
        String alert = values.get("Drive has flagged a S.M.A.R.T alert");
        if (alert != null) row.put("smartAlert", alert.equalsIgnoreCase("Yes"));
    }

    /** "Primary-1, Secondary-3, RAID Level Qualifier-0" → RAID10。 */
    static String megaRaidLevel(String value) {
        Matcher matcher = Pattern.compile("Primary-(\\d+),\\s*Secondary-(\\d+)").matcher(value);
        if (!matcher.find()) return value;
        String primary = matcher.group(1);
        boolean spanned = matcher.group(2).equals("3");
        return switch (primary) {
            case "1" -> spanned ? "RAID10" : "RAID1";
            case "5" -> spanned ? "RAID50" : "RAID5";
            case "6" -> spanned ? "RAID60" : "RAID6";
            default -> "RAID" + primary;
        };
    }

    private static String stripSectors(String value) {
        return value == null ? null : value.replaceAll("\\s*\\[.*]", "");
    }

    // ─── HPE ssacli ──────────────────────────────────────────────────────────

    /** {@code ssacli ctrl all show config detail}：按缩进区分控制器、阵列、逻辑盘和物理盘。 */
    void ssacli() {
        String content = ctx.text("sos_commands/hpssm/ssacli_ctrl_all_show_config_detail");
        if (content.isEmpty()) return;
        String tool = "ssacli";
        Pattern controllerHeader = Pattern.compile("^(.+?) in Slot (\\S+)");
        Map<String, Object> controller = null;
        String controllerId = null;
        Map<String, Object> object = null;
        int objectIndent = 0;
        String array = null;
        for (String line : content.split("\\R")) {
            if (line.isBlank()) continue;
            int indent = indent(line);
            String trimmed = line.trim();
            Matcher header = controllerHeader.matcher(trimmed);
            if (indent == 0 && header.find()) {
                controllerId = header.group(2);
                controller = raid.controller(tool, controllerId);
                set(controller, "model", header.group(1));
                set(controller, "slot", header.group(2));
                object = controller;
                objectIndent = 0;
                array = null;
                continue;
            }
            if (controller == null) continue;
            if (trimmed.startsWith("Array: ")) {
                array = trimmed.substring("Array: ".length()).trim();
                object = null;
                objectIndent = indent;
                continue;
            }
            if (trimmed.equals("Unassigned") || trimmed.equals("HBA Drives")) {
                array = null;
                object = null;
                objectIndent = indent;
                continue;
            }
            Matcher logical = Pattern.compile("^Logical Drive: (\\d+)$").matcher(trimmed);
            if (logical.matches()) {
                object = raid.virtualDrive(tool, controllerId, logical.group(1));
                if (array != null) object.put("array", array);
                objectIndent = indent;
                continue;
            }
            Matcher physical = Pattern.compile("^physicaldrive (\\S+)$").matcher(trimmed);
            if (physical.matches()) {
                object = raid.physicalDrive(tool, controllerId, physical.group(1));
                object.put("installed", true);
                if (array != null) object.put("array", array);
                objectIndent = indent;
                continue;
            }
            if (trimmed.startsWith("PCI Address (Domain:Bus:Device.Function):")) {
                set(controller, "pciAddress", trimmed.substring(trimmed.indexOf("):") + 2).trim());
                continue;
            }
            String[] kv = split(trimmed);
            if (kv == null) {
                object = null;
                objectIndent = indent;
                continue;
            }
            if (object != null && indent > objectIndent) {
                ssacliValue(object, object == controller, kv[0], kv[1]);
            } else if (indent <= 3) {
                ssacliValue(controller, true, kv[0], kv[1]);
            }
        }
    }

    private static void ssacliValue(Map<String, Object> row, boolean isController, String key, String value) {
        if (isController) {
            switch (key) {
                case "Serial Number" -> set(row, "serialNumber", value);
                case "Firmware Version" -> set(row, "firmwareVersion", value);
                case "Controller Status" -> set(row, "status", value);
                case "Hardware Revision" -> set(row, "hardwareRevision", value);
                case "Driver Name" -> set(row, "driver", value);
                case "Driver Version" -> set(row, "driverVersion", value);
                case "Total Cache Size" -> set(row, "cacheSize", value.matches("[\\d.]+") ? value + " GB" : value);
                case "Battery/Capacitor Status" -> set(row, "batteryStatus", value);
                case "Controller Mode" -> set(row, "mode", value);
                default -> {
                }
            }
            return;
        }
        if (row.containsKey("location")) {
            switch (key) {
                case "Port" -> set(row, "port", value);
                case "Box" -> set(row, "enclosure", value);
                case "Bay" -> set(row, "slot", value);
                case "Status" -> set(row, "state", value);
                case "Drive Type" -> set(row, "role", value);
                case "Interface Type" -> set(row, "interface", value);
                case "Size" -> set(row, "size", value);
                case "Rotational Speed" -> set(row, "rotationRate", value);
                case "Firmware Revision" -> set(row, "firmware", value);
                case "Serial Number" -> set(row, "serialNumber", value);
                case "WWID" -> set(row, "wwn", value);
                case "Model" -> set(row, "model", value.replaceAll("\\s+", " "));
                case "Current Temperature (C)" -> {
                    Integer temperature = leadingInteger(value);
                    if (temperature != null) row.put("temperatureC", temperature);
                }
                case "PHY Transfer Rate" -> set(row, "linkSpeed", value);
                default -> {
                }
            }
            return;
        }
        switch (key) {
            case "Size" -> set(row, "size", value);
            case "Fault Tolerance" -> set(row, "level", value.matches("[\\d+]+") ? "RAID" + value.replace("+", "") : value);
            case "Status" -> set(row, "state", value);
            case "Disk Name" -> set(row, "osDevice", value);
            case "Logical Drive Label" -> set(row, "name", value);
            case "Caching" -> set(row, "cache", value);
            default -> {
            }
        }
    }

    // ─── Microchip / Adaptec arcconf ─────────────────────────────────────────

    void arcconf() {
        String prefix = "sos_commands/arcconf/arcconf_getconfig_";
        for (String path : ctx.sortedPaths(prefix)) {
            String controllerId = path.substring(prefix.length());
            if (!controllerId.matches("\\d{1,2}")) continue;
            String tool = "arcconf";
            Map<String, Object> controller = raid.controller(tool, controllerId);
            String section = "";
            Map<String, Object> object = null;
            boolean isDrive = false;
            for (String line : ctx.text(path).split("\\R")) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("---")) continue;
                String lower = trimmed.toLowerCase(Locale.ROOT);
                if (lower.equals("controller information")) {
                    section = "controller";
                    object = controller;
                    continue;
                }
                if (lower.startsWith("logical device information") || lower.startsWith("logical drive information")) {
                    section = "logical";
                    object = null;
                    continue;
                }
                if (lower.startsWith("physical device information")) {
                    section = "physical";
                    object = null;
                    continue;
                }
                if (lower.startsWith("maxcache") || lower.startsWith("connector information")
                        || lower.startsWith("array information") || lower.startsWith("enclosure information")) {
                    section = "";
                    object = null;
                    continue;
                }
                Matcher logical = Pattern.compile("^Logical (?:Device|drive) number (\\d+)$", Pattern.CASE_INSENSITIVE).matcher(trimmed);
                if (section.equals("logical") && logical.matches()) {
                    object = raid.virtualDrive(tool, controllerId, logical.group(1));
                    continue;
                }
                Matcher device = Pattern.compile("^Device #(\\d+)$").matcher(trimmed);
                if (section.equals("physical") && device.matches()) {
                    object = new LinkedHashMap<>();
                    object.put("deviceId", device.group(1));
                    isDrive = false;
                    continue;
                }
                if (section.equals("physical") && object != null && lower.startsWith("device is a")) {
                    isDrive = lower.contains("hard drive") || lower.contains("solid state") || lower.contains("hard disk");
                    continue;
                }
                String[] kv = split(trimmed);
                if (kv == null || object == null) continue;
                switch (section) {
                    case "controller" -> arcconfController(controller, kv[0], kv[1]);
                    case "logical" -> {
                        switch (kv[0]) {
                            case "Logical Device name", "Logical drive name" -> set(object, "name", kv[1]);
                            case "RAID level" -> set(object, "level", kv[1].matches("\\d+") ? "RAID" + kv[1] : kv[1]);
                            case "Status of Logical Device", "Status of logical drive", "Status of Logical drive" -> set(object, "state", kv[1]);
                            case "Size" -> set(object, "size", kv[1]);
                            case "Disk Name" -> set(object, "osDevice", kv[1]);
                            default -> {
                            }
                        }
                    }
                    case "physical" -> {
                        if (!isDrive) continue;
                        if (kv[0].equals("Reported Location")) {
                            Map<String, Object> row = raid.physicalDrive(tool, controllerId, kv[1]);
                            row.putAll(object);
                            row.put("installed", true);
                            Matcher where = Pattern.compile("Enclosure (\\d+), Slot (\\d+)").matcher(kv[1]);
                            if (where.find()) {
                                row.put("enclosure", where.group(1));
                                row.put("slot", where.group(2));
                            }
                            object = row;
                            continue;
                        }
                        switch (kv[0]) {
                            case "State" -> set(object, "state", kv[1]);
                            case "Vendor" -> set(object, "vendor", kv[1]);
                            case "Model" -> set(object, "model", kv[1]);
                            case "Firmware" -> set(object, "firmware", kv[1]);
                            case "Serial number", "Serial Number" -> set(object, "serialNumber", kv[1]);
                            case "World-wide name" -> set(object, "wwn", kv[1]);
                            case "Total Size" -> set(object, "size", kv[1]);
                            case "Transfer Speed" -> set(object, "interface", kv[1]);
                            case "SSD" -> set(object, "mediaType", kv[1].equalsIgnoreCase("Yes") ? "SSD" : "HDD");
                            case "Current Temperature" -> {
                                Integer temperature = leadingInteger(kv[1]);
                                if (temperature != null) object.put("temperatureC", temperature);
                            }
                            default -> {
                            }
                        }
                    }
                    default -> {
                    }
                }
            }
        }
    }

    private static void arcconfController(Map<String, Object> controller, String key, String value) {
        switch (key) {
            case "Controller Status" -> set(controller, "status", value);
            case "Controller Mode" -> set(controller, "mode", value);
            case "Controller Model" -> set(controller, "model", value);
            case "Controller Serial Number" -> set(controller, "serialNumber", value);
            case "Controller World Wide Name" -> set(controller, "sasAddress", value);
            case "Installed memory", "Cache Size" -> set(controller, "cacheSize", value);
            case "BIOS" -> set(controller, "biosVersion", value);
            case "Firmware" -> set(controller, "firmwareVersion", value);
            case "Driver" -> set(controller, "driverVersion", value);
            case "PCI Address" -> set(controller, "pciAddress", value);
            default -> {
            }
        }
    }

    // ─── Broadcom sas3ircu ───────────────────────────────────────────────────

    void sas3ircu() {
        Pattern file = Pattern.compile("^sos_commands/sas3ircu/sas3ircu_(\\d{1,2})_display$");
        for (String path : ctx.sortedPaths("sos_commands/sas3ircu/sas3ircu_")) {
            Matcher name = file.matcher(path);
            if (!name.matches()) continue;
            String controllerId = name.group(1);
            String tool = "sas3ircu";
            Map<String, Object> controller = raid.controller(tool, controllerId);
            String section = "";
            Map<String, Object> object = null;
            Map<String, String> enclosure = new LinkedHashMap<>();
            for (String line : ctx.text(path).split("\\R")) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("---")) continue;
                String lower = trimmed.toLowerCase(Locale.ROOT);
                if (lower.equals("controller information")) {
                    section = "controller";
                    continue;
                }
                if (lower.equals("ir volume information")) {
                    section = "volume";
                    continue;
                }
                if (lower.equals("physical device information")) {
                    section = "physical";
                    continue;
                }
                if (lower.equals("enclosure information")) {
                    section = "enclosure";
                    continue;
                }
                Matcher volume = Pattern.compile("^IR volume (\\d+)$").matcher(trimmed);
                if (section.equals("volume") && volume.matches()) {
                    object = raid.virtualDrive(tool, controllerId, volume.group(1));
                    continue;
                }
                if (section.equals("physical") && lower.startsWith("device is a")) {
                    object = lower.contains("disk") ? new LinkedHashMap<>() : null;
                    continue;
                }
                if (section.equals("enclosure") && lower.startsWith("enclosure#")) {
                    addSasEnclosure(tool, controllerId, enclosure);
                    enclosure = new LinkedHashMap<>();
                }
                String[] kv = split(trimmed);
                if (kv == null) continue;
                switch (section) {
                    case "controller" -> {
                        switch (kv[0]) {
                            case "Controller type" -> set(controller, "model", kv[1]);
                            case "BIOS version" -> set(controller, "biosVersion", kv[1]);
                            case "Firmware version" -> set(controller, "firmwareVersion", kv[1]);
                            case "Slot" -> set(controller, "slot", kv[1]);
                            case "Bus" -> controller.put("pciBus", kv[1]);
                            case "Device" -> controller.put("pciDevice", kv[1]);
                            case "Function" -> {
                                Integer b = parseInteger(String.valueOf(controller.remove("pciBus")));
                                Integer d = parseInteger(String.valueOf(controller.remove("pciDevice")));
                                Integer f = parseInteger(kv[1]);
                                if (b != null && d != null && f != null) {
                                    set(controller, "pciAddress", String.format(Locale.ROOT, "%02x:%02x.%d", b, d, f));
                                }
                            }
                            default -> {
                            }
                        }
                    }
                    case "volume" -> {
                        if (object == null) continue;
                        switch (kv[0]) {
                            case "Status of volume" -> set(object, "state", kv[1]);
                            case "RAID level" -> set(object, "level", kv[1]);
                            case "Size (in MB)" -> set(object, "size", kv[1] + " MB");
                            case "Volume Name" -> set(object, "name", kv[1]);
                            default -> {
                            }
                        }
                    }
                    case "physical" -> {
                        if (object == null) continue;
                        if (kv[0].equals("Enclosure #")) object.put("enclosure", kv[1]);
                        if (kv[0].equals("Slot #")) {
                            String enclosureId = String.valueOf(object.getOrDefault("enclosure", ""));
                            Map<String, Object> row = raid.physicalDrive(tool, controllerId, "E" + enclosureId + "/S" + kv[1]);
                            row.putAll(object);
                            row.put("slot", kv[1]);
                            row.put("installed", true);
                            object = row;
                            continue;
                        }
                        switch (kv[0]) {
                            case "State" -> set(object, "state", kv[1]);
                            case "Size (in MB)/(in sectors)" -> set(object, "size", kv[1].split("/")[0] + " MB");
                            case "Manufacturer" -> set(object, "vendor", kv[1]);
                            case "Model Number" -> set(object, "model", kv[1]);
                            case "Firmware Revision" -> set(object, "firmware", kv[1]);
                            case "Serial No" -> set(object, "serialNumber", kv[1]);
                            case "GUID" -> set(object, "wwn", kv[1]);
                            case "Protocol" -> set(object, "interface", kv[1]);
                            case "Drive Type" -> set(object, "mediaType", kv[1]);
                            default -> {
                            }
                        }
                    }
                    case "enclosure" -> enclosure.put(kv[0], kv[1]);
                    default -> {
                    }
                }
            }
            addSasEnclosure(tool, controllerId, enclosure);
        }
    }

    private void addSasEnclosure(String tool, String controllerId, Map<String, String> enclosure) {
        String id = enclosure.get("Enclosure#");
        Integer slots = parseInteger(enclosure.get("Numslots"));
        Integer start = parseInteger(enclosure.get("StartSlot"));
        if (id == null || slots == null) return;
        raid.addEmptySlots(tool, controllerId, id, start == null ? 0 : start, slots, -1, slot -> "E" + id + "/S" + slot);
    }
}
