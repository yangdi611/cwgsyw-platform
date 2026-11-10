package com.cwgsyw.platform.module.sosreport.parser;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.cwgsyw.platform.module.sosreport.parser.RaidFacts.set;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.leadingInteger;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.parseInteger;

/**
 * Broadcom storcli 及其 Dell 版本 perccli 的文本输出。sos 收集：
 * {@code /call show all}（控制器、逻辑盘、物理盘、背板列表）和
 * {@code /call/eall/sall show all}、{@code /call/sall show all}（物理盘序列号、固件等）。
 */
final class StorcliParser {

    private static final Pattern KEY_VALUE = Pattern.compile("^([A-Za-z][^=]{0,80}?)\\s+=\\s*(.*)$");
    /** DG/VD TYPE State Access Consist Cache Cac sCC Size Name */
    private static final Pattern VD_ROW = Pattern.compile(
        "^(\\d+)/(\\d+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+([\\d.]+\\s+[KMGTP]i?B)\\s*(.*)$");
    /** EID:Slt DID State DG Size Intf Med SED PI SeSz Model Sp Type */
    private static final Pattern PD_ROW = Pattern.compile(
        "^(\\d*):(\\d+)\\s+(\\d+)\\s+(\\S+)\\s+(\\S+)\\s+([\\d.]+\\s+[KMGTP]i?B)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(.+?)\\s+(\\S+)\\s+(\\S+)\\s*$");
    /** EID State Slots PD PS Fans ... */
    private static final Pattern ENCLOSURE_ROW = Pattern.compile("^(\\d+)\\s+(\\S+)\\s+(\\d+)\\s+(\\d+)\\s+.*$");
    /** Cachevault_Info / BBU_Info：Model State ... */
    private static final Pattern BATTERY_ROW = Pattern.compile("^(\\S+)\\s+(Optimal|Degraded\\S*|Failed|Missing|Learning|Charging|\\S+)\\s+.*$");
    private static final Pattern DRIVE_HEADER = Pattern.compile("^Drive /c(\\d+)(?:/e(\\d+))?/s(\\d+)\\b.*$");

    private final SosParseContext ctx;
    private final RaidFacts raid;
    private final String tool;
    private final String prefix;

    StorcliParser(SosParseContext ctx, RaidFacts raid, String tool, String prefix) {
        this.ctx = ctx;
        this.raid = raid;
        this.tool = tool;
        this.prefix = prefix;
    }

    void parse() {
        String summary = ctx.text(prefix + ".call_show_all");
        if (!summary.isEmpty()) parseSummary(summary);
        parseDrives(ctx.text(prefix + ".call.eall.sall_show_all"));
        parseDrives(ctx.text(prefix + ".call.sall_show_all"));
    }

    private void parseSummary(String content) {
        String controllerId = null;
        Map<String, Object> controller = null;
        String section = "";
        for (String raw : content.split("\\R")) {
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("---") || line.startsWith("===")) continue;
            if (line.endsWith(" :") || line.endsWith(":") && !line.contains("=")) {
                section = line.replace(":", "").trim();
                continue;
            }
            Matcher kv = KEY_VALUE.matcher(line);
            if (kv.matches()) {
                String key = kv.group(1).trim();
                String value = kv.group(2).trim();
                if (key.equals("Controller")) {
                    Integer id = parseInteger(value);
                    if (id != null) {
                        controllerId = String.valueOf(id);
                        controller = raid.controller(tool, controllerId);
                    }
                    continue;
                }
                if (controller != null) controllerValue(controller, key, value);
                continue;
            }
            if (controller == null) continue;
            switch (section) {
                case "VD LIST" -> virtualDrive(controllerId, line);
                case "PD LIST" -> physicalDrive(controllerId, line);
                case "Enclosure LIST" -> enclosure(controllerId, line);
                case "Cachevault_Info", "BBU_Info" -> battery(controller, line);
                default -> {
                }
            }
        }
    }

    private static void controllerValue(Map<String, Object> controller, String key, String value) {
        switch (key) {
            case "Model", "Product Name" -> set(controller, "model", value);
            case "Serial Number" -> set(controller, "serialNumber", value);
            case "SAS Address" -> set(controller, "sasAddress", value);
            case "PCI Address" -> set(controller, "pciAddress", storcliPci(value));
            case "Firmware Package Build" -> set(controller, "firmwarePackage", value);
            case "Firmware Version" -> set(controller, "firmwareVersion", value);
            case "Bios Version" -> set(controller, "biosVersion", value);
            case "Driver Name" -> set(controller, "driver", value);
            case "Driver Version" -> set(controller, "driverVersion", value);
            case "Controller Status" -> set(controller, "status", value);
            case "On Board Memory Size" -> set(controller, "cacheSize", value);
            case "Current Personality" -> set(controller, "mode", value);
            case "Mfg Date" -> set(controller, "manufactureDate", value);
            default -> {
            }
        }
    }

    /** storcli 的 PCI 地址形如 {@code 00:3b:00:00}（域:总线:设备:功能），转成 {@code 3b:00.0}。 */
    static String storcliPci(String value) {
        Matcher matcher = Pattern.compile("^[0-9a-fA-F]{2}:([0-9a-fA-F]{2}):([0-9a-fA-F]{2}):([0-9a-fA-F]{2})$").matcher(value.trim());
        if (!matcher.matches()) return value;
        return matcher.group(1).toLowerCase() + ":" + matcher.group(2).toLowerCase() + "." + Integer.parseInt(matcher.group(3), 16);
    }

    private void virtualDrive(String controllerId, String line) {
        Matcher matcher = VD_ROW.matcher(line);
        if (!matcher.matches()) return;
        Map<String, Object> row = raid.virtualDrive(tool, controllerId, matcher.group(1) + "/" + matcher.group(2));
        set(row, "level", matcher.group(3));
        set(row, "state", matcher.group(4));
        set(row, "access", matcher.group(5));
        set(row, "cache", matcher.group(7));
        set(row, "size", matcher.group(10));
        set(row, "name", matcher.group(11));
    }

    private void physicalDrive(String controllerId, String line) {
        Matcher matcher = PD_ROW.matcher(line);
        if (!matcher.matches()) return;
        String enclosure = matcher.group(1);
        Map<String, Object> row = raid.physicalDrive(tool, controllerId, location(controllerId, enclosure, matcher.group(2)));
        if (!enclosure.isEmpty()) row.put("enclosure", enclosure);
        row.put("slot", matcher.group(2));
        row.put("installed", true);
        set(row, "deviceId", matcher.group(3));
        set(row, "state", matcher.group(4));
        set(row, "driveGroup", matcher.group(5));
        set(row, "size", matcher.group(6));
        set(row, "interface", matcher.group(7));
        set(row, "mediaType", matcher.group(8));
        set(row, "model", matcher.group(12));
    }

    private void enclosure(String controllerId, String line) {
        Matcher matcher = ENCLOSURE_ROW.matcher(line);
        if (!matcher.matches()) return;
        String eid = matcher.group(1);
        int slots = Integer.parseInt(matcher.group(3));
        raid.addEmptySlots(tool, controllerId, eid, 0, slots, slot -> location(controllerId, eid, String.valueOf(slot)));
    }

    private static void battery(Map<String, Object> controller, String line) {
        if (line.startsWith("Model ")) return;
        Matcher matcher = BATTERY_ROW.matcher(line);
        if (!matcher.matches()) return;
        set(controller, "batteryModel", matcher.group(1));
        set(controller, "batteryStatus", matcher.group(2));
    }

    /** {@code show all} 的物理盘详情：逐块盘的状态和属性段。 */
    private void parseDrives(String content) {
        Map<String, Object> drive = null;
        for (String raw : content.split("\\R")) {
            String line = raw.trim();
            Matcher header = DRIVE_HEADER.matcher(line);
            if (header.matches()) {
                String controllerId = header.group(1);
                String enclosure = header.group(2) == null ? "" : header.group(2);
                drive = raid.physicalDrive(tool, controllerId, location(controllerId, enclosure, header.group(3)));
                if (!enclosure.isEmpty()) drive.put("enclosure", enclosure);
                drive.put("slot", header.group(3));
                drive.put("installed", true);
                raid.controller(tool, controllerId);
                continue;
            }
            if (drive == null) continue;
            Matcher table = PD_ROW.matcher(line);
            if (table.matches()) {
                set(drive, "state", table.group(4));
                set(drive, "size", table.group(6));
                set(drive, "interface", table.group(7));
                set(drive, "mediaType", table.group(8));
                set(drive, "model", table.group(12));
                continue;
            }
            Matcher kv = KEY_VALUE.matcher(line);
            if (!kv.matches()) continue;
            String value = kv.group(2).trim();
            switch (kv.group(1).trim()) {
                case "SN" -> set(drive, "serialNumber", value);
                case "Manufacturer Id" -> set(drive, "vendor", value);
                case "Model Number" -> {
                    // 详情里的型号比 PD 表格完整，覆盖表格里的值。
                    String model = SosParseContext.useful(value);
                    if (model != null) drive.put("model", model);
                }
                case "WWN" -> set(drive, "wwn", value);
                case "Firmware Revision" -> set(drive, "firmware", value);
                case "Raw size" -> set(drive, "rawSize", value.replaceAll("\\s*\\[.*]", ""));
                case "Device Speed" -> set(drive, "deviceSpeed", value);
                case "Link Speed" -> set(drive, "linkSpeed", value);
                case "Drive Temperature" -> {
                    Integer temperature = leadingInteger(value);
                    if (temperature != null) drive.put("temperatureC", temperature);
                }
                case "Media Error Count" -> putCount(drive, "mediaErrors", value);
                case "Other Error Count" -> putCount(drive, "otherErrors", value);
                case "Predictive Failure Count" -> putCount(drive, "predictiveFailures", value);
                case "S.M.A.R.T alert flagged by drive" -> drive.put("smartAlert", value.equalsIgnoreCase("Yes"));
                case "Connector Name" -> set(drive, "connector", value);
                default -> {
                }
            }
        }
    }

    private static void putCount(Map<String, Object> row, String key, String value) {
        Integer count = parseInteger(value);
        if (count != null) row.put(key, count);
    }

    private static String location(String controller, String enclosure, String slot) {
        return "/c" + controller + (enclosure.isEmpty() ? "" : "/e" + enclosure) + "/s" + slot;
    }
}
