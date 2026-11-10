package com.cwgsyw.platform.module.sosreport.parser;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.clean;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.pciKey;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.useful;

/**
 * 硬件 RAID 卡：控制器、逻辑盘和物理盘。RAID 卡后的物理盘操作系统看不到，只能从厂商工具的输出取得。
 *
 * <p>各厂商工具的输出统一成三张表，行里的 {@code tool} 标明来源。
 */
final class RaidFacts {

    /** 物理盘正常状态（各工具的写法）。其余状态记为告警。 */
    private static final Set<String> HEALTHY_DRIVE_STATES = Set.of(
        "onln", "online", "ugood", "jbod", "ghs", "dhs", "ok", "optimal", "optimal (opt)", "ready (rdy)",
        "hot spare (hsp)", "online, spun up", "unconfigured(good), spun up", "unconfigured(good), spun down",
        "hotspare, spun up", "hotspare, spun down", "jbod, spun up", "ready", "hot spare", "空槽位");
    private static final Set<String> HEALTHY_VOLUME_STATES = Set.of("optl", "optimal", "ok", "okay (oky)", "okay");

    final List<Map<String, Object>> controllers = new ArrayList<>();
    final List<Map<String, Object>> virtualDrives = new ArrayList<>();
    final List<Map<String, Object>> physicalDrives = new ArrayList<>();

    private final SosParseContext ctx;

    RaidFacts(SosParseContext ctx) {
        this.ctx = ctx;
    }

    void parse() {
        new StorcliParser(ctx, this, "storcli", "sos_commands/storcli/storcli64_").parse();
        new StorcliParser(ctx, this, "perccli", "sos_commands/perccli/perccli64_").parse();
        new StorcliParser(ctx, this, "perccli2", "sos_commands/perccli2/perccli2_").parse();
        LegacyRaidParsers legacy = new LegacyRaidParsers(ctx, this);
        legacy.megacli();
        legacy.ssacli();
        legacy.arcconf();
        legacy.sas3ircu();

        for (Map<String, Object> controller : controllers) enrichController(controller);
        checkHealth();
        ctx.putRows("storage.raidControllers", controllers);
        ctx.putRows("storage.raidVirtualDrives", virtualDrives);
        ctx.putRows("storage.raidPhysicalDrives", physicalDrives);
    }

    // ─── 行构造 ──────────────────────────────────────────────────────────────

    Map<String, Object> controller(String tool, String id) {
        for (Map<String, Object> row : controllers) {
            if (tool.equals(row.get("tool")) && id.equals(row.get("controller"))) return row;
        }
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("tool", tool);
        row.put("controller", id);
        controllers.add(row);
        return row;
    }

    Map<String, Object> virtualDrive(String tool, String controller, String id) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("tool", tool);
        row.put("controller", controller);
        row.put("id", id);
        virtualDrives.add(row);
        return row;
    }

    /** 按“工具 + 控制器 + 位置”查找物理盘，同一块盘在多份输出里出现时合并。 */
    Map<String, Object> physicalDrive(String tool, String controller, String location) {
        for (Map<String, Object> row : physicalDrives) {
            if (tool.equals(row.get("tool")) && controller.equals(row.get("controller")) && location.equals(row.get("location"))) {
                return row;
            }
        }
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("tool", tool);
        row.put("controller", controller);
        row.put("location", location);
        physicalDrives.add(row);
        return row;
    }

    /** 写入字段。编号类字段（槽位、DG、设备号）可以是 0，所以 "0" 不当作占位值。 */
    static void set(Map<String, Object> row, String key, String value) {
        String cleaned = clean(value);
        if (cleaned == null || cleaned.equals("-")) return;
        if (!cleaned.equals("0") && useful(cleaned) == null) return;
        row.putIfAbsent(key, cleaned);
    }

    /**
     * 背板槽位数已知时，补出没有插盘的槽位。槽位号从 {@code firstSlot} 起连续编号，是按槽位总数推算的。
     *
     * <p>{@code expectedDrives} 是工具报告的该背板盘数（未知时传 -1）。与实际解析到的盘数不一致时，
     * 说明有盘没解析出来，此时不推算，避免把有盘的槽位标成空。
     */
    void addEmptySlots(String tool, String controller, String enclosure, int firstSlot, int slots, int expectedDrives,
                       java.util.function.Function<Integer, String> locationOf) {
        if (slots <= 0 || slots > 512) return;
        Set<Integer> occupied = new LinkedHashSet<>();
        for (Map<String, Object> row : physicalDrives) {
            if (tool.equals(row.get("tool")) && controller.equals(row.get("controller"))
                    && enclosure.equals(String.valueOf(row.get("enclosure")))) {
                Object slot = row.get("slot");
                if (slot != null) occupied.add(Integer.valueOf(String.valueOf(slot)));
            }
        }
        if (expectedDrives >= 0 && occupied.size() != expectedDrives) return;
        for (int slot = firstSlot; slot < firstSlot + slots; slot++) {
            if (occupied.contains(slot)) continue;
            Map<String, Object> row = physicalDrive(tool, controller, locationOf.apply(slot));
            row.put("enclosure", enclosure);
            row.put("slot", String.valueOf(slot));
            row.put("installed", false);
            row.put("state", "空槽位");
            row.put("inferred", true);
        }
    }

    // ─── 汇总 ────────────────────────────────────────────────────────────────

    private void enrichController(Map<String, Object> controller) {
        String key = pciKey((String) controller.get("pciAddress"));
        Map<String, Object> device = key == null ? null : ctx.pciByAddress.get(key);
        if (device != null) {
            controller.putIfAbsent("location", device.get("location"));
            if (controller.get("location") == null) controller.remove("location");
            if (device.get("numaNode") != null) controller.putIfAbsent("numaNode", device.get("numaNode"));
            if (device.get("linkStatus") != null) controller.putIfAbsent("pcieLink", device.get("linkStatus"));
        }
        String name = (String) controller.getOrDefault("model", controller.get("tool"));
        String where = "控制器 " + controller.get("controller")
            + (controller.get("location") != null ? "（" + controller.get("location") + "）" : "");
        ctx.firmware("RAID 卡", name, where, (String) controller.get("firmwareVersion"));
        ctx.firmware("RAID 卡 BIOS", name, where, (String) controller.get("biosVersion"));
        long drives = physicalDrives.stream()
            .filter(row -> controller.get("tool").equals(row.get("tool")) && controller.get("controller").equals(row.get("controller")))
            .filter(row -> !Boolean.FALSE.equals(row.get("installed")))
            .count();
        controller.put("physicalDriveCount", (int) drives);
    }

    private void checkHealth() {
        for (Map<String, Object> controller : controllers) {
            String status = lower(controller.get("status"));
            if (status != null && !status.equals("optimal") && !status.equals("ok")) {
                ctx.issue("RAID 卡 " + label(controller) + " 状态：" + controller.get("status"));
            }
            String battery = lower(controller.get("batteryStatus"));
            if (battery != null && !battery.equals("optimal") && !battery.equals("ok") && !battery.startsWith("ok")) {
                ctx.issue("RAID 卡 " + label(controller) + " 电池/电容状态：" + controller.get("batteryStatus"));
            }
        }
        for (Map<String, Object> vd : virtualDrives) {
            String state = lower(vd.get("state"));
            if (state != null && !HEALTHY_VOLUME_STATES.contains(state)) {
                ctx.issue("逻辑盘 " + vd.get("tool") + " 控制器 " + vd.get("controller") + " / " + vd.get("id") + " 状态：" + vd.get("state"));
            }
        }
        for (Map<String, Object> pd : physicalDrives) {
            String state = lower(pd.get("state"));
            if (state != null && !HEALTHY_DRIVE_STATES.contains(state)) {
                ctx.issue("物理盘 " + pd.get("location") + " 状态：" + pd.get("state"));
            }
            for (String counter : List.of("mediaErrors", "predictiveFailures")) {
                Object value = pd.get(counter);
                if (value instanceof Integer count && count > 0) {
                    ctx.issue("物理盘 " + pd.get("location") + (counter.equals("mediaErrors") ? " 介质错误 " : " 预测性故障 ") + count);
                }
            }
            if (Boolean.TRUE.equals(pd.get("smartAlert"))) ctx.issue("物理盘 " + pd.get("location") + " SMART 告警");
            if (pd.get("firmware") != null) ctx.firmware("RAID 物理盘", (String) pd.get("model"), (String) pd.get("location"), (String) pd.get("firmware"));
        }
    }

    private static String label(Map<String, Object> controller) {
        return controller.getOrDefault("model", controller.get("tool")) + " #" + controller.get("controller");
    }

    private static String lower(Object value) {
        String cleaned = value == null ? null : clean(String.valueOf(value));
        return cleaned == null ? null : cleaned.toLowerCase(Locale.ROOT);
    }
}
