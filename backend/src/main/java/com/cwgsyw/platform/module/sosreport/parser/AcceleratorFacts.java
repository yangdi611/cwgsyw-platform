package com.cwgsyw.platform.module.sosreport.parser;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.pciKey;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.putIfPresent;
import static com.cwgsyw.platform.module.sosreport.parser.SosParseContext.putIfUseful;

/** GPU 和加速卡。NVIDIA 卡用 nvidia-smi 的详情；其他厂商只有 lspci 能看到。 */
final class AcceleratorFacts {

    private static final Pattern GPU_HEADER = Pattern.compile("^GPU ([0-9A-Fa-f]{4,8}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}\\.[0-7])$");
    /** BMC 自带的 VGA 芯片（ASPEED、Matrox、华为 Hi171x）不是 GPU。 */
    private static final Set<String> BMC_VGA_VENDORS = Set.of("1a03", "102b", "19e5");

    private final SosParseContext ctx;

    AcceleratorFacts(SosParseContext ctx) {
        this.ctx = ctx;
    }

    void parse() {
        List<Map<String, Object>> rows = nvidia();
        Set<String> seen = new java.util.LinkedHashSet<>();
        for (Map<String, Object> row : rows) seen.add(pciKey(String.valueOf(row.get("busId"))));
        for (Map.Entry<String, Map<String, Object>> entry : ctx.pciByAddress.entrySet()) {
            Map<String, Object> device = entry.getValue();
            String classCode = String.valueOf(device.get("classCode"));
            boolean gpu = classCode.equals("0302") || classCode.startsWith("12") || classCode.equals("0b40")
                || classCode.equals("0300") && !BMC_VGA_VENDORS.contains(String.valueOf(device.get("vendorId")));
            if (!gpu || seen.contains(entry.getKey())) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("busId", entry.getKey());
            putIfPresent(row, "vendor", device.get("vendor"));
            putIfPresent(row, "model", PciFacts.model(device));
            putIfPresent(row, "location", device.get("location"));
            putIfPresent(row, "driver", device.get("driver"));
            putIfPresent(row, "serialNumber", device.get("vpdSerialNumber"));
            putIfPresent(row, "pcieLink", device.get("linkStatus"));
            row.put("source", "lspci");
            rows.add(row);
        }
        ctx.putRows("hardware.gpus", rows);
    }

    /**
     * sos 3.x 没有 {@code nvidia-smi -q}，只有 {@code --query-gpu=... --format=csv}。
     * 首行是列名（如 {@code name, pci.bus_id, vbios_version, memory.total [MiB]}），按列名取值。
     */
    private List<Map<String, Object>> nvidiaCsv() {
        List<Map<String, Object>> rows = new ArrayList<>();
        String content = ctx.pathWithPrefix("sos_commands/nvidia/nvidia-smi_--query-gpu_gpu_name_gpu_bus_id_vbios_version_")
            .map(ctx::text).orElse("");
        List<String> lines = content.lines().filter(line -> !line.isBlank()).toList();
        if (lines.size() < 2) return rows;
        String[] header = lines.get(0).split(",");
        for (int i = 0; i < header.length; i++) header[i] = header[i].replaceAll("\\[.*]", "").trim();
        for (String line : lines.subList(1, lines.size())) {
            String[] cells = line.split(",");
            if (cells.length != header.length) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            for (int i = 0; i < header.length; i++) {
                String value = cells[i].trim();
                switch (header[i]) {
                    case "name" -> putIfUseful(row, "model", value);
                    case "pci.bus_id" -> putIfPresent(row, "busId", pciKey(value));
                    case "vbios_version" -> putIfUseful(row, "vbios", value);
                    case "memory.total" -> putIfUseful(row, "memoryTotal", value);
                    case "temperature.gpu" -> putIfUseful(row, "temperature", value.matches("\\d+") ? value + " C" : value);
                    default -> {
                    }
                }
            }
            if (row.get("busId") == null) continue;
            row.put("vendor", "NVIDIA");
            row.put("source", "nvidia-smi");
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, Object>> nvidia() {
        String content = ctx.text("sos_commands/nvidia/nvidia-smi_-q");
        List<Map<String, Object>> rows = new ArrayList<>();
        String driver = null;
        String cuda = null;
        Map<String, Object> gpu = null;
        String subsection = "";
        for (String line : content.split("\\R")) {
            if (line.isBlank()) continue;
            String trimmed = line.trim();
            Matcher header = GPU_HEADER.matcher(trimmed);
            if (header.matches() && !Character.isWhitespace(line.charAt(0))) {
                gpu = new LinkedHashMap<>();
                gpu.put("busId", pciKey(header.group(1)));
                gpu.put("vendor", "NVIDIA");
                gpu.put("source", "nvidia-smi");
                rows.add(gpu);
                subsection = "";
                continue;
            }
            int index = trimmed.indexOf(" : ");
            String key = index > 0 ? trimmed.substring(0, index).trim() : trimmed;
            String value = index > 0 ? trimmed.substring(index + 3).trim() : null;
            if (gpu == null) {
                if ("Driver Version".equals(key)) driver = value;
                if ("CUDA Version".equals(key)) cuda = value;
                continue;
            }
            int indent = line.length() - line.stripLeading().length();
            if (value == null) {
                if (indent <= 4) subsection = key;
                continue;
            }
            if (indent <= 4) {
                subsection = "";
                switch (key) {
                    case "Product Name" -> putIfUseful(gpu, "model", value);
                    case "Product Architecture" -> putIfUseful(gpu, "architecture", value);
                    case "Serial Number" -> putIfUseful(gpu, "serialNumber", value);
                    case "GPU UUID" -> putIfUseful(gpu, "uuid", value);
                    case "VBIOS Version" -> putIfUseful(gpu, "vbios", value);
                    case "Board Part Number" -> putIfUseful(gpu, "partNumber", value);
                    case "Minor Number" -> putIfUseful(gpu, "minorNumber", value);
                    case "Persistence Mode" -> putIfUseful(gpu, "persistenceMode", value);
                    default -> {
                    }
                }
            } else if (subsection.equals("FB Memory Usage") && key.equals("Total")) {
                putIfUseful(gpu, "memoryTotal", value);
            } else if (subsection.equals("Temperature") && key.equals("GPU Current Temp")) {
                putIfUseful(gpu, "temperature", value);
            } else if (subsection.equals("Ecc Mode") && key.equals("Current")) {
                putIfUseful(gpu, "eccMode", value);
            }
        }
        if (rows.isEmpty()) rows.addAll(nvidiaCsv());
        for (Map<String, Object> row : rows) {
            if (driver != null) row.put("driverVersion", driver);
            if (cuda != null) row.put("cudaVersion", cuda);
            Map<String, Object> device = ctx.pciByAddress.get(String.valueOf(row.get("busId")));
            if (device != null) {
                putIfPresent(row, "location", device.get("location"));
                putIfPresent(row, "pcieLink", device.get("linkStatus"));
            }
            if (row.get("vbios") != null) {
                ctx.firmware("GPU VBIOS", (String) row.get("model"), String.valueOf(row.getOrDefault("location", row.get("busId"))), (String) row.get("vbios"));
            }
        }
        return rows;
    }
}
