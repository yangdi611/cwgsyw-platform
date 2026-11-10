package com.cwgsyw.platform.module.sosreport.parser;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.clean;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.keyColonValues;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.keySeparatorValues;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.parseInteger;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.putIfUseful;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.useful;

/**
 * BMC：ipmitool 的 mc info、lan print、fru print、sensor list、sel、chassis status，以及 Dell iDRAC 的 getsysinfo。
 *
 * <p>ipmitool 插件在 USB 接口可用时会在命令里加 {@code -I usb}，文件名随之变化，两种都要找。
 */
final class BmcFacts {

    private static final String DIR = "sos_commands/ipmitool/";
    private static final Pattern IPV4 = Pattern.compile("^\\d{1,3}(\\.\\d{1,3}){3}$");
    private static final Set<String> NORMAL_SENSOR = Set.of("ok", "ns", "na", "n/a", "");
    /** FRU 中保留的字段：位置、厂商、型号、料号、序列号、版本、日期。 */
    private static final Map<String, String> FRU_FIELDS = new LinkedHashMap<>();

    static {
        FRU_FIELDS.put("Chassis Type", "chassisType");
        FRU_FIELDS.put("Chassis Part Number", "chassisPartNumber");
        FRU_FIELDS.put("Chassis Serial", "chassisSerial");
        FRU_FIELDS.put("Board Mfg Date", "boardMfgDate");
        FRU_FIELDS.put("Board Mfg", "boardManufacturer");
        FRU_FIELDS.put("Board Product", "boardProduct");
        FRU_FIELDS.put("Board Serial", "boardSerial");
        FRU_FIELDS.put("Board Part Number", "boardPartNumber");
        FRU_FIELDS.put("Product Manufacturer", "productManufacturer");
        FRU_FIELDS.put("Product Name", "productName");
        FRU_FIELDS.put("Product Part Number", "productPartNumber");
        FRU_FIELDS.put("Product Version", "productVersion");
        FRU_FIELDS.put("Product Serial", "productSerial");
        FRU_FIELDS.put("Product Asset Tag", "productAssetTag");
    }

    private final SosParseContext ctx;

    BmcFacts(SosParseContext ctx) {
        this.ctx = ctx;
    }

    private String ipmi(String command) {
        return ctx.firstText(DIR + "ipmitool_" + command, DIR + "ipmitool_-I_usb_" + command);
    }

    void parse() {
        parseMcInfo();
        parseLan();
        parseFru();
        parseSensors();
        parseSel();
        parseChassisStatus();
        parseIdrac();
        if (ctx.facts.containsKey("bmc.firmwareVersion")) {
            ctx.firmware("BMC", (String) ctx.facts.getOrDefault("bmc.productName", ctx.facts.get("bmc.manufacturer")),
                "管理控制器", (String) ctx.facts.get("bmc.firmwareVersion"));
        }
    }

    private void parseMcInfo() {
        Map<String, String> info = keyColonValues(ipmi("mc_info"));
        if (info.isEmpty()) {
            // 没有 ipmitool 时，DMI type 38 至少能说明有 IPMI 接口及其版本。
            List<Map<String, String>> ipmiDevices = ctx.dmi("IPMI Device Information");
            if (!ipmiDevices.isEmpty()) {
                ctx.putUseful("bmc.ipmiVersion", ipmiDevices.get(0).get("Specification Version"));
                ctx.putUseful("bmc.interface", ipmiDevices.get(0).get("Interface Type"));
            }
            return;
        }
        ctx.put("bmc.source", "ipmitool");
        ctx.putUseful("bmc.firmwareVersion", info.get("Firmware Revision"));
        ctx.putUseful("bmc.ipmiVersion", info.get("IPMI Version"));
        ctx.putUseful("bmc.manufacturer", info.get("Manufacturer Name"));
        ctx.putUseful("bmc.manufacturerId", info.get("Manufacturer ID"));
        String product = info.get("Product Name");
        // 部分 BMC 返回 "Unknown (0x...)"。
        if (product != null && !product.toLowerCase(Locale.ROOT).startsWith("unknown")) ctx.putUseful("bmc.productName", product);
        ctx.putUseful("bmc.deviceRevision", info.get("Device Revision"));
    }

    /** 依次查看默认通道、通道 1 和通道 3，取第一个有有效 IP 的。 */
    private void parseLan() {
        for (String command : List.of("lan_print", "lan_print_1", "lan_print_3", "lan_print_8")) {
            Map<String, String> lan = keyColonValues(ipmi(command));
            String ip = lan.get("IP Address");
            if (ip == null || !IPV4.matcher(ip).matches() || ip.equals("0.0.0.0")) continue;
            ctx.put("bmc.ipAddress", ip);
            ctx.putUseful("bmc.ipSource", lan.get("IP Address Source"));
            ctx.putUseful("bmc.netmask", lan.get("Subnet Mask"));
            ctx.putUseful("bmc.macAddress", lan.get("MAC Address"));
            String gateway = lan.get("Default Gateway IP");
            if (gateway != null && IPV4.matcher(gateway).matches() && !gateway.equals("0.0.0.0")) ctx.put("bmc.gateway", gateway);
            String vlan = lan.get("802.1q VLAN ID");
            if (vlan != null && !vlan.equalsIgnoreCase("Disabled")) ctx.putUseful("bmc.vlanId", vlan);
            if (command.startsWith("lan_print_")) ctx.put("bmc.lanChannel", command.substring("lan_print_".length()));
            return;
        }
    }

    private void parseFru() {
        List<Map<String, Object>> rows = new ArrayList<>();
        Map<String, Object> current = null;
        for (String line : ipmi("fru_print").split("\\R")) {
            int colon = line.indexOf(':');
            if (colon <= 0) continue;
            String key = line.substring(0, colon).trim();
            String value = line.substring(colon + 1).trim();
            if (key.equals("FRU Device Description")) {
                current = new LinkedHashMap<>();
                putIfUseful(current, "device", value);
                rows.add(current);
                continue;
            }
            if (current != null && FRU_FIELDS.containsKey(key)) putIfUseful(current, FRU_FIELDS.get(key), value);
        }
        rows.removeIf(row -> row.size() <= 1);
        ctx.putRows("hardware.fruDevices", rows);
    }

    /** {@code ipmitool sensor list}：名称 | 读数 | 单位 | 状态 | 阈值...，以竖线分隔。 */
    private void parseSensors() {
        List<Map<String, Object>> rows = new ArrayList<>();
        List<Map<String, Object>> alerts = new ArrayList<>();
        for (String line : ipmi("sensor_list").split("\\R")) {
            String[] parts = line.split("\\|");
            if (parts.length < 4) continue;
            String name = clean(parts[0]);
            if (name == null) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", name);
            String value = clean(parts[1]);
            if (value != null && !value.equalsIgnoreCase("na")) row.put("value", value);
            putIfUseful(row, "unit", parts[2]);
            String status = String.valueOf(clean(parts[3])).toLowerCase(Locale.ROOT);
            if (!status.equals("null")) row.put("status", status);
            if (parts.length >= 10) {
                putIfThreshold(row, "lowerCritical", parts[5]);
                putIfThreshold(row, "upperCritical", parts[8]);
            }
            if (rows.size() < SosParseContext.MAX_DETAIL_ROWS) rows.add(row);
            // 离散传感器的状态是 0x 开头的位图，不能按阈值状态判断。
            if (!NORMAL_SENSOR.contains(status) && !status.startsWith("0x") && !status.equals("null")) {
                alerts.add(row);
                ctx.issue("传感器 " + name + " 状态 " + status + (row.get("value") != null ? "，读数 " + row.get("value") + " " + row.getOrDefault("unit", "") : ""));
            }
        }
        ctx.putRows("hardware.sensors", rows);
        ctx.putRows("hardware.sensorAlerts", alerts);
    }

    private static void putIfThreshold(Map<String, Object> row, String key, String value) {
        String cleaned = clean(value);
        if (cleaned != null && !cleaned.equalsIgnoreCase("na")) row.put(key, cleaned);
    }

    /** SEL 只保留最近的事件，按时间倒序。 */
    private void parseSel() {
        Map<String, String> info = keyColonValues(ipmi("sel_info"));
        ctx.putNumber("bmc.selEntries", parseInteger(info.get("Entries")));
        String percent = info.get("Percent Used");
        if (percent != null) {
            ctx.put("bmc.selPercentUsed", percent);
            Integer used = SosParseContext.leadingInteger(percent);
            if (used != null && used >= 90) ctx.issue("BMC 事件日志已用 " + used + "%，可能不再记录新事件");
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        // sos 4.x 采集 sel elist（传感器显示名称），3.x 只采集 sel list（传感器显示编号），格式相同。
        String events = ipmi("sel_elist");
        if (events.isEmpty()) events = ipmi("sel_list");
        for (String line : events.split("\\R")) {
            String[] parts = line.split("\\|");
            if (parts.length < 5) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            putIfUseful(row, "id", parts[0]);
            putIfUseful(row, "date", parts[1]);
            putIfUseful(row, "time", parts[2]);
            putIfUseful(row, "sensor", parts[3]);
            putIfUseful(row, "event", parts[4]);
            if (parts.length > 5) putIfUseful(row, "direction", parts[5]);
            if (row.size() >= 4) rows.add(row);
        }
        int from = Math.max(0, rows.size() - 100);
        List<Map<String, Object>> recent = new ArrayList<>(rows.subList(from, rows.size()));
        java.util.Collections.reverse(recent);
        ctx.putRows("hardware.selEvents", recent);
    }

    private void parseChassisStatus() {
        Map<String, String> status = keyColonValues(ipmi("chassis_status"));
        ctx.putUseful("bmc.powerState", status.get("System Power"));
        List<String> faults = new ArrayList<>();
        for (String key : List.of("Power Overload", "Power Interlock", "Main Power Fault", "Power Control Fault",
                "Drive Fault", "Cooling/Fan Fault", "Chassis Intrusion")) {
            String value = status.get(key);
            if (value != null && (value.equalsIgnoreCase("true") || value.equalsIgnoreCase("active"))) faults.add(key);
        }
        ctx.putList("hardware.chassisFaults", faults);
        for (String fault : faults) ctx.issue("机箱故障：" + fault);
    }

    /** Dell iDRAC：{@code racadm getsysinfo} 为 key = value 格式。 */
    private void parseIdrac() {
        String content = ctx.text("sos_commands/dellrac/idracadm7_getsysinfo");
        if (content.isEmpty()) return;
        Map<String, String> info = keySeparatorValues(content, '=');
        if (!ctx.facts.containsKey("bmc.source")) ctx.put("bmc.source", "idracadm");
        ctx.put("bmc.type", "iDRAC");
        if (!ctx.facts.containsKey("bmc.firmwareVersion")) ctx.putUseful("bmc.firmwareVersion", info.get("Firmware Version"));
        String ip = useful(info.get("Current IP Address"));
        if (!ctx.facts.containsKey("bmc.ipAddress") && ip != null && IPV4.matcher(ip).matches() && !ip.equals("0.0.0.0")) {
            ctx.put("bmc.ipAddress", ip);
            ctx.putUseful("bmc.netmask", info.get("Current IP Netmask"));
            ctx.putUseful("bmc.gateway", info.get("Current IP Gateway"));
            ctx.putUseful("bmc.macAddress", info.get("MAC Address"));
            String dhcp = info.get("DHCP Enabled");
            if (dhcp != null) ctx.put("bmc.ipSource", "1".equals(dhcp.trim()) ? "DHCP" : "Static");
        }
        ctx.putUseful("bmc.serviceTag", info.get("Service Tag"));
        ctx.putUseful("bmc.hostSystemModel", info.get("System Model"));
        if (!ctx.facts.containsKey("bmc.powerState")) ctx.putUseful("bmc.powerState", info.get("Power Status"));
    }
}
