package com.cwgsyw.platform.module.sosreport.parser;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.cleanDmi;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.cleanUuid;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.firstNonNull;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.leadingInteger;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.pciKey;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.putIfUseful;

/** 整机身份、主板、BIOS、机箱、电源和插槽，主要来自 dmidecode。 */
final class SystemFacts {

    private static final DateTimeFormatter US_DATE = DateTimeFormatter.ofPattern("MM/dd/yyyy");
    private static final Pattern VIRTUAL_PRODUCT = Pattern.compile(
        "vmware|virtualbox|kvm|qemu|bochs|xen|hvm domu|virtual machine|openstack|alibaba cloud ecs|cloud server",
        Pattern.CASE_INSENSITIVE);
    private static final String DMI_ID = "sys/class/dmi/id/";

    private final SosParseContext ctx;

    SystemFacts(SosParseContext ctx) {
        this.ctx = ctx;
    }

    Map<String, String> system() {
        List<Map<String, String>> sections = ctx.dmi("System Information");
        return sections.isEmpty() ? Map.of() : sections.get(0);
    }

    void parse() {
        Map<String, String> system = system();
        parseIdentity(system);
        parseBaseboardAndBios();
        parseChassis();
        parsePowerSupplies();
        parseSlots();
        parseOnboardDevices();
    }

    // ─── 身份 ────────────────────────────────────────────────────────────────

    private void parseIdentity(Map<String, String> system) {
        String hostname = ctx.firstLine("sos_commands/host/hostname");
        if (hostname == null) hostname = ctx.firstLine("etc/hostname");
        ctx.put("system.hostname", hostname);
        String fqdn = ctx.firstLine("sos_commands/host/hostname_-f");
        if (fqdn != null && fqdn.contains(".") && !fqdn.contains(" ")) ctx.put("system.fqdn", fqdn);

        // dmidecode 缺失时（如部分 ARM 平台、容器内采集）退回 sysfs 中的同源数据。
        ctx.put("system.serialNumber", firstNonNull(cleanDmi(system.get("Serial Number")), dmiId("product_serial")));
        ctx.put("system.uuid", firstNonNull(cleanUuid(system.get("UUID")), cleanUuid(ctx.firstLine(DMI_ID + "product_uuid"))));
        ctx.put("system.manufacturer", firstNonNull(cleanDmi(system.get("Manufacturer")), dmiId("sys_vendor")));
        String product = firstNonNull(cleanDmi(system.get("Product Name")), dmiId("product_name"));
        if (product == null) {
            String model = ctx.firstLine("proc/device-tree/model");
            if (model == null) model = ctx.firstLine("sys/firmware/devicetree/base/model");
            product = cleanDmi(model);
        }
        ctx.put("system.productName", product);
        ctx.put("system.version", firstNonNull(cleanDmi(system.get("Version")), dmiId("product_version")));
        ctx.put("system.skuNumber", firstNonNull(cleanDmi(system.get("SKU Number")), dmiId("product_sku")));
        ctx.put("system.family", firstNonNull(cleanDmi(system.get("Family")), dmiId("product_family")));
    }

    /** 判断物理机或虚拟机，依赖 CPU 的 lscpu 结果，所以在最后调用。 */
    void parseHostType(Map<String, String> system) {
        String product = String.valueOf(system.getOrDefault("Product Name", "")) + " "
            + system.getOrDefault("Manufacturer", "");
        boolean hypervisor = ctx.text("sos_commands/processor/lscpu").lines()
            .anyMatch(line -> line.startsWith("Hypervisor vendor:") || line.startsWith("超管理器厂商"));
        if (hypervisor || VIRTUAL_PRODUCT.matcher(product).find()) {
            ctx.facts.put("system.hostType", "virtual");
        } else if (!system.isEmpty()) {
            ctx.facts.put("system.hostType", "physical");
        }
    }

    private void parseBaseboardAndBios() {
        List<Map<String, String>> boards = ctx.dmi("Base Board Information");
        Map<String, String> board = boards.isEmpty() ? Map.of() : boards.get(0);
        ctx.put("baseboard.manufacturer", firstNonNull(cleanDmi(board.get("Manufacturer")), dmiId("board_vendor")));
        ctx.put("baseboard.productName", firstNonNull(cleanDmi(board.get("Product Name")), dmiId("board_name")));
        ctx.put("baseboard.serialNumber", firstNonNull(cleanDmi(board.get("Serial Number")), dmiId("board_serial")));
        ctx.put("baseboard.version", firstNonNull(cleanDmi(board.get("Version")), dmiId("board_version")));
        ctx.put("baseboard.assetTag", cleanDmi(board.get("Asset Tag")));

        List<Map<String, String>> bios = ctx.dmi("BIOS Information");
        Map<String, String> first = bios.isEmpty() ? Map.of() : bios.get(0);
        ctx.put("bios.vendor", firstNonNull(cleanDmi(first.get("Vendor")), dmiId("bios_vendor")));
        ctx.put("bios.version", firstNonNull(cleanDmi(first.get("Version")), dmiId("bios_version")));
        String date = firstNonNull(cleanDmi(first.get("Release Date")), dmiId("bios_date"));
        if (date != null) {
            try {
                ctx.facts.put("bios.releaseDate", LocalDate.parse(date, US_DATE).toString());
            } catch (DateTimeParseException ignored) {
                // 厂商格式不统一，取不到就留空。
            }
        }
        ctx.put("bios.revision", cleanDmi(first.get("BIOS Revision")));
        // 多数厂商在这里填写嵌入式控制器或 BMC 的固件版本。
        ctx.put("bios.firmwareRevision", cleanDmi(first.get("Firmware Revision")));
        ctx.put("bios.romSize", cleanDmi(first.get("ROM Size")));

        Object biosVersion = ctx.facts.get("bios.version");
        if (biosVersion != null) ctx.firmware("BIOS", (String) ctx.facts.get("bios.vendor"), "主板", (String) biosVersion);
    }

    // ─── 机箱 ────────────────────────────────────────────────────────────────

    private void parseChassis() {
        List<Map<String, String>> sections = ctx.dmi("Chassis Information");
        Map<String, String> chassis = sections.isEmpty() ? Map.of() : sections.get(0);
        ctx.put("chassis.manufacturer", firstNonNull(cleanDmi(chassis.get("Manufacturer")), dmiId("chassis_vendor")));
        ctx.put("chassis.type", cleanDmi(chassis.get("Type")));
        ctx.put("chassis.serialNumber", firstNonNull(cleanDmi(chassis.get("Serial Number")), dmiId("chassis_serial")));
        ctx.put("chassis.assetTag", firstNonNull(cleanDmi(chassis.get("Asset Tag")), dmiId("chassis_asset_tag")));
        String height = cleanDmi(chassis.get("Height"));
        if (height != null && height.toUpperCase(Locale.ROOT).endsWith("U")) ctx.putNumber("chassis.heightU", leadingInteger(height));
        Integer cords = leadingInteger(cleanDmi(chassis.get("Number Of Power Cords")));
        if (cords != null && cords > 0) ctx.putNumber("chassis.powerCords", cords);
        for (String key : List.of("Boot-up State", "Power Supply State", "Thermal State")) {
            String state = cleanDmi(chassis.get(key));
            if (state != null && !state.equalsIgnoreCase("Safe") && !state.equalsIgnoreCase("Other")) {
                ctx.issue("机箱" + switch (key) {
                    case "Boot-up State" -> "启动状态";
                    case "Power Supply State" -> "电源状态";
                    default -> "散热状态";
                } + "：" + state);
            }
        }
    }

    // ─── 电源、插槽、板载设备 ────────────────────────────────────────────────

    private void parsePowerSupplies() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, String> psu : ctx.dmi("System Power Supply")) {
            Map<String, Object> row = new LinkedHashMap<>();
            putIfUseful(row, "location", psu.get("Location"));
            putIfUseful(row, "name", psu.get("Name"));
            putIfUseful(row, "manufacturer", psu.get("Manufacturer"));
            putIfUseful(row, "model", psu.get("Model Part Number"));
            putIfUseful(row, "serialNumber", psu.get("Serial Number"));
            putIfUseful(row, "revision", psu.get("Revision"));
            putIfUseful(row, "maxPower", psu.get("Max Power Capacity"));
            putIfUseful(row, "status", psu.get("Status"));
            putIfUseful(row, "plugged", psu.get("Plugged"));
            putIfUseful(row, "hotReplaceable", psu.get("Hot Replaceable"));
            if (row.isEmpty()) continue;
            // 未插电源的位置同样保留，标为空槽位。
            boolean present = !String.valueOf(psu.get("Status")).toLowerCase(Locale.ROOT).startsWith("not present");
            row.put("installed", present);
            if (!present) row.put("status", "空槽位");
            rows.add(row);
            String status = String.valueOf(row.getOrDefault("status", ""));
            String name = String.valueOf(row.getOrDefault("location", row.getOrDefault("name", "电源")));
            if (status.startsWith("Present") && !status.contains("OK")) ctx.issue("电源 " + name + " 状态：" + status);
            if (row.get("revision") != null) {
                ctx.firmware("电源", (String) row.get("model"), name, (String) row.get("revision"));
            }
        }
        ctx.putRows("hardware.powerSupplies", rows);
    }

    private void parseSlots() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, String> slot : ctx.dmi("System Slot Information")) {
            Map<String, Object> row = new LinkedHashMap<>();
            putIfUseful(row, "designation", slot.get("Designation"));
            putIfUseful(row, "type", slot.get("Type"));
            putIfUseful(row, "usage", slot.get("Current Usage"));
            putIfUseful(row, "length", slot.get("Length"));
            // Available 即空插槽，In Use 为已占用；两者都保留。
            String usage = String.valueOf(slot.get("Current Usage"));
            row.put("installed", usage.equalsIgnoreCase("In Use"));
            if (usage.equalsIgnoreCase("Available")) row.put("status", "空槽位");
            // 空插槽的总线地址是无效值（ff:1f.7、00:00.0 等），只记录已占用插槽的地址。
            String bus = pciKey(slot.get("Bus Address"));
            if (bus != null && usage.equalsIgnoreCase("In Use")) row.put("busAddress", bus);
            if (!row.isEmpty()) rows.add(row);
        }
        ctx.putRows("hardware.pciSlots", rows);
    }

    private void parseOnboardDevices() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, String> device : ctx.dmi("Onboard Device")) {
            Map<String, Object> row = new LinkedHashMap<>();
            putIfUseful(row, "designation", device.get("Reference Designation"));
            putIfUseful(row, "type", device.get("Type"));
            putIfUseful(row, "status", device.get("Status"));
            String bus = pciKey(device.get("Bus Address"));
            if (bus != null && !bus.startsWith("ff:")) row.put("busAddress", bus);
            if (!row.isEmpty()) rows.add(row);
        }
        ctx.putRows("hardware.onboardDevices", rows);
    }

    /** 插槽或板载设备的名称，按 PCI 总线地址查找，用来标注设备的物理位置。 */
    static String locationOf(SosParseContext ctx, String pciAddress) {
        String key = pciKey(pciAddress);
        if (key == null) return null;
        for (String title : List.of("System Slot Information", "Onboard Device")) {
            for (Map<String, String> section : ctx.dmi(title)) {
                boolean slot = title.startsWith("System");
                if (slot && !"In Use".equalsIgnoreCase(section.get("Current Usage"))) continue;
                if (key.equals(pciKey(section.get("Bus Address")))) {
                    String name = cleanDmi(section.get(slot ? "Designation" : "Reference Designation"));
                    if (name != null) return name;
                }
            }
        }
        return null;
    }

    /** 地址是否登记在 DMI 的板载设备（type 41）里。 */
    static boolean isOnboard(SosParseContext ctx, String pciAddress) {
        String key = pciKey(pciAddress);
        if (key == null) return false;
        for (Map<String, String> section : ctx.dmi("Onboard Device")) {
            if (key.equals(pciKey(section.get("Bus Address")))) return true;
        }
        return false;
    }

    private String dmiId(String name) {
        String value = ctx.firstLine(DMI_ID + name);
        if (value == null) value = ctx.firstLine("sys/devices/virtual/dmi/id/" + name);
        return cleanDmi(value);
    }
}
