package com.cwgsyw.platform.module.sosreport.parser;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.cleanDmi;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.firstNonNull;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.firstToken;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.keyColonValues;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.leadingInteger;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.parseDmiSizeMb;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.parseInteger;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.parseLong;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.putIfPresent;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.putIfUseful;

/** CPU 和内存：汇总值、每颗 CPU 和每条内存的明细。 */
final class CpuMemoryFacts {

    /**
     * 部分 BIOS 把内存厂商写成 JEDEC 编码。只收录确定的编码，其余保留原值。
     * 编码形如 {@code 80CE}、{@code 00CE000080CE}，取最后一个非 00/80/7F 的字节。
     */
    private static final Map<String, String> JEDEC_MEMORY_VENDORS = Map.of(
        "CE", "Samsung",
        "AD", "SK Hynix",
        "2C", "Micron");
    private static final Pattern JEDEC_CODE = Pattern.compile("^(?:[0-9A-F]{2}){2,8}$");

    private final SosParseContext ctx;

    CpuMemoryFacts(SosParseContext ctx) {
        this.ctx = ctx;
    }

    void parse() {
        parseCpu();
        parseCpuDetails();
        parseMemory();
        parseMemoryDetails();
    }

    // ─── CPU ─────────────────────────────────────────────────────────────────

    private List<Map<String, String>> populatedProcessors() {
        return ctx.dmi("Processor Information").stream()
            .filter(p -> String.valueOf(p.get("Status")).toLowerCase(Locale.ROOT).contains("populated")
                && !String.valueOf(p.get("Status")).toLowerCase(Locale.ROOT).contains("unpopulated"))
            .toList();
    }

    /** lscpu 在部分平台上把 die 报成 socket（如海光），所以优先使用 DMI。 */
    private void parseCpu() {
        Map<String, String> lscpu = keyColonValues(ctx.text("sos_commands/processor/lscpu"));
        List<Map<String, String>> populated = populatedProcessors();

        Integer lscpuThreads = parseInteger(lscpu.get("CPU(s)"));
        ctx.put("cpu.model", firstNonNull(lscpu.get("Model name"),
            populated.isEmpty() ? null : cleanDmi(populated.get(0).get("Version"))));
        ctx.put("cpu.vendor", firstNonNull(
            populated.isEmpty() ? null : cleanDmi(populated.get(0).get("Manufacturer")), lscpu.get("Vendor ID")));

        boolean usable = !populated.isEmpty() && populated.stream().allMatch(p -> parseInteger(p.get("Core Count")) != null);
        if (usable) {
            ctx.facts.put("cpu.sockets", populated.size());
            ctx.facts.put("cpu.cores", populated.stream().mapToInt(p -> parseInteger(p.get("Core Count"))).sum());
            int dmiThreads = populated.stream().mapToInt(p -> {
                Integer threads = parseInteger(p.get("Thread Count"));
                return threads != null ? threads : 0;
            }).sum();
            Integer threads = lscpuThreads != null ? lscpuThreads : (dmiThreads > 0 ? Integer.valueOf(dmiThreads) : null);
            if (threads != null) ctx.facts.put("cpu.threads", threads);
            return;
        }

        Integer sockets = parseInteger(lscpu.get("Socket(s)"));
        Integer coresPerSocket = parseInteger(lscpu.get("Core(s) per socket"));
        if (sockets != null) ctx.facts.put("cpu.sockets", sockets);
        if (sockets != null && coresPerSocket != null) ctx.facts.put("cpu.cores", sockets * coresPerSocket);
        if (lscpuThreads != null) ctx.facts.put("cpu.threads", lscpuThreads);
    }

    private void parseCpuDetails() {
        Map<String, String> lscpu = keyColonValues(ctx.text("sos_commands/processor/lscpu"));
        ctx.put("cpu.family", lscpu.get("CPU family"));
        ctx.put("cpu.modelId", lscpu.get("Model"));
        ctx.put("cpu.stepping", lscpu.get("Stepping"));
        ctx.putNumber("cpu.threadsPerCore", parseInteger(lscpu.get("Thread(s) per core")));
        ctx.putNumber("cpu.numaNodes", parseInteger(lscpu.get("NUMA node(s)")));
        ctx.putNumber("cpu.maxMhz", decimal(lscpu.get("CPU max MHz")));
        ctx.putNumber("cpu.minMhz", decimal(lscpu.get("CPU min MHz")));
        ctx.put("cpu.virtualization", lscpu.get("Virtualization"));
        ctx.put("cpu.l1dCache", lscpu.get("L1d cache"));
        ctx.put("cpu.l1iCache", lscpu.get("L1i cache"));
        ctx.put("cpu.l2Cache", lscpu.get("L2 cache"));
        ctx.put("cpu.l3Cache", lscpu.get("L3 cache"));

        List<String> vulnerabilities = new ArrayList<>();
        for (String line : ctx.text("sos_commands/processor/lscpu").split("\\R")) {
            if (!line.startsWith("Vulnerability ")) continue;
            int colon = line.indexOf(':');
            if (colon < 0) continue;
            String name = line.substring("Vulnerability ".length(), colon).trim();
            String state = line.substring(colon + 1).trim();
            if (!name.isEmpty() && !state.isEmpty()) vulnerabilities.add(name + ": " + state);
        }
        ctx.putList("cpu.vulnerabilities", vulnerabilities);

        // x86 的 /proc/cpuinfo 有 microcode 字段，所有逻辑 CPU 相同，取第一个。
        Matcher microcode = Pattern.compile("(?m)^microcode\\s*:\\s*(\\S+)").matcher(ctx.text("proc/cpuinfo"));
        if (microcode.find()) {
            ctx.put("cpu.microcode", microcode.group(1));
            ctx.firmware("CPU 微码", (String) ctx.facts.get("cpu.model"), "全部 CPU", microcode.group(1));
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, String> cpu : ctx.dmi("Processor Information")) {
            Map<String, Object> row = new LinkedHashMap<>();
            putIfUseful(row, "socket", cpu.get("Socket Designation"));
            String status = String.valueOf(cpu.get("Status")).toLowerCase(Locale.ROOT);
            // 未安装的插座同样保留，标为空槽位。
            row.put("installed", status.contains("populated") && !status.contains("unpopulated"));
            putIfUseful(row, "status", Boolean.TRUE.equals(row.get("installed")) ? cpu.get("Status") : "空槽位");
            putIfUseful(row, "manufacturer", cpu.get("Manufacturer"));
            putIfUseful(row, "model", cpu.get("Version"));
            putIfUseful(row, "family", cpu.get("Family"));
            putIfUseful(row, "signature", cpu.get("Signature"));
            putIfUseful(row, "maxSpeed", cpu.get("Max Speed"));
            putIfUseful(row, "currentSpeed", cpu.get("Current Speed"));
            putIfUseful(row, "externalClock", cpu.get("External Clock"));
            putIfPresent(row, "cores", parseInteger(cpu.get("Core Count")));
            putIfPresent(row, "coresEnabled", parseInteger(cpu.get("Core Enabled")));
            putIfPresent(row, "threads", parseInteger(cpu.get("Thread Count")));
            putIfUseful(row, "voltage", cpu.get("Voltage"));
            putIfUseful(row, "serialNumber", cpu.get("Serial Number"));
            putIfUseful(row, "partNumber", cpu.get("Part Number"));
            putIfUseful(row, "assetTag", cpu.get("Asset Tag"));
            putIfUseful(row, "upgrade", cpu.get("Upgrade"));
            if (!row.isEmpty()) rows.add(row);
        }
        ctx.putRows("hardware.processors", rows);
    }

    // ─── 内存 ────────────────────────────────────────────────────────────────

    private void parseMemory() {
        List<Map<String, String>> devices = ctx.dmi("Memory Device");
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
            ctx.facts.put("memory.slotsTotal", devices.size());
            ctx.facts.put("memory.slotsUsed", used);
            if (totalMb > 0) ctx.facts.put("memory.installedGb", totalMb / 1024);
        }

        long totalKib = -1;
        long swapKib = -1;
        for (String line : ctx.text("sos_commands/memory/free").split("\\R")) {
            String[] parts = line.trim().split("\\s+");
            if (parts.length >= 2 && parts[0].equals("Mem:")) totalKib = parseLong(parts[1], -1);
            if (parts.length >= 2 && parts[0].equals("Swap:")) swapKib = parseLong(parts[1], -1);
        }
        Map<String, String> meminfo = keyColonValues(ctx.text("proc/meminfo"));
        if (totalKib < 0 || swapKib < 0) {
            if (totalKib < 0) totalKib = parseLong(firstToken(meminfo.get("MemTotal")), -1);
            if (swapKib < 0) swapKib = parseLong(firstToken(meminfo.get("SwapTotal")), -1);
        }
        if (totalKib > 0) {
            ctx.facts.put("memory.usableGb", BigDecimal.valueOf(totalKib)
                .divide(BigDecimal.valueOf(1024L * 1024L), 1, RoundingMode.HALF_UP));
        }
        if (swapKib >= 0) ctx.facts.put("memory.swapGb", Math.round(swapKib / (1024.0 * 1024.0)));

        Integer hugepages = parseInteger(firstToken(meminfo.get("HugePages_Total")));
        if (hugepages != null) ctx.facts.put("memory.hugepagesTotal", hugepages);
        Integer hugepageSize = parseInteger(firstToken(meminfo.get("Hugepagesize")));
        if (hugepageSize != null) ctx.facts.put("memory.hugepageSizeKb", hugepageSize);
        Matcher thp = Pattern.compile("\\[(\\w+)]").matcher(ctx.text("sys/kernel/mm/transparent_hugepage/enabled"));
        if (thp.find()) ctx.facts.put("memory.transparentHugepage", thp.group(1));
    }

    private void parseMemoryDetails() {
        List<Map<String, String>> arrays = ctx.dmi("Physical Memory Array").stream()
            .filter(array -> String.valueOf(array.get("Use")).equalsIgnoreCase("System Memory"))
            .toList();
        if (!arrays.isEmpty()) {
            ctx.put("memory.errorCorrection", cleanDmi(arrays.get(0).get("Error Correction Type")));
            if (arrays.size() == 1) ctx.put("memory.maxCapacity", cleanDmi(arrays.get(0).get("Maximum Capacity")));
        }

        // 空插槽也保留，便于看出还能扩多少内存、空槽在哪个通道。
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, String> device : ctx.dmi("Memory Device")) {
            Long sizeMb = parseDmiSizeMb(device.get("Size"));
            boolean installed = sizeMb != null && sizeMb > 0;
            Map<String, Object> row = new LinkedHashMap<>();
            putIfUseful(row, "locator", device.get("Locator"));
            putIfUseful(row, "bankLocator", device.get("Bank Locator"));
            row.put("installed", installed);
            if (!installed) {
                row.put("status", "空槽位");
                rows.add(row);
                continue;
            }
            row.put("status", "已安装");
            row.put("sizeGb", sizeMb % 1024 == 0 ? (Object) (sizeMb / 1024) : BigDecimal.valueOf(sizeMb)
                .divide(BigDecimal.valueOf(1024), 2, RoundingMode.HALF_UP));
            putIfUseful(row, "type", device.get("Type"));
            putIfUseful(row, "typeDetail", device.get("Type Detail"));
            putIfUseful(row, "formFactor", device.get("Form Factor"));
            putIfUseful(row, "speed", device.get("Speed"));
            // dmidecode 3.0 起改名为 Configured Memory Speed。
            putIfUseful(row, "configuredSpeed", firstNonNull(device.get("Configured Memory Speed"), device.get("Configured Clock Speed")));
            putIfUseful(row, "manufacturer", memoryVendor(device.get("Manufacturer")));
            putIfUseful(row, "serialNumber", device.get("Serial Number"));
            putIfUseful(row, "partNumber", device.get("Part Number"));
            putIfPresent(row, "rank", parseInteger(device.get("Rank")));
            Integer dataWidth = leadingInteger(device.get("Data Width"));
            Integer totalWidth = leadingInteger(device.get("Total Width"));
            if (dataWidth != null && totalWidth != null) row.put("ecc", totalWidth > dataWidth);
            putIfUseful(row, "assetTag", device.get("Asset Tag"));
            rows.add(row);
        }
        ctx.putRows("hardware.memoryModules", rows);
        List<Map<String, Object>> installed = rows.stream().filter(row -> Boolean.TRUE.equals(row.get("installed"))).toList();
        if (!installed.isEmpty()) {
            ctx.put("memory.type", (String) installed.get(0).get("type"));
            ctx.put("memory.speed", (String) firstPresent(installed.get(0), "configuredSpeed", "speed"));
            long kinds = installed.stream().map(row -> row.get("partNumber")).filter(part -> part != null).distinct().count();
            if (kinds > 1) ctx.issue("内存条料号不一致（" + kinds + " 种），可能影响性能或兼容性");
        }
    }

    static String memoryVendor(String raw) {
        String value = cleanDmi(raw);
        if (value == null) return null;
        String upper = value.toUpperCase(Locale.ROOT).replace(" ", "");
        if (!JEDEC_CODE.matcher(upper).matches()) return value;
        for (int i = upper.length() - 2; i >= 0; i -= 2) {
            String code = upper.substring(i, i + 2);
            if (code.equals("00") || code.equals("80") || code.equals("7F")) continue;
            String name = JEDEC_MEMORY_VENDORS.get(code);
            return name == null ? value : name + "（" + value + "）";
        }
        return value;
    }

    private static Object firstPresent(Map<String, Object> row, String... keys) {
        for (String key : keys) {
            if (row.get(key) != null) return row.get(key);
        }
        return null;
    }

    private static BigDecimal decimal(String value) {
        if (value == null) return null;
        try {
            return new BigDecimal(value.trim()).setScale(0, RoundingMode.HALF_UP);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
