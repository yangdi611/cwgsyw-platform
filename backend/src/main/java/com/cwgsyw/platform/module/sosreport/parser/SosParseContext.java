package com.cwgsyw.platform.module.sosreport.parser;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 解析过程的共享状态和工具方法：读取白名单文件、拆分 DMI、清洗不可信文本、写入事实。
 *
 * <p>各领域解析类只通过这里写事实，保证长度限制、占位值过滤和列表上限一致。
 */
final class SosParseContext {

    static final int MAX_VALUE_LENGTH = 512;
    static final int MAX_LIST_ITEMS = 5000;
    /** 传感器、事件这类明细只保留有限条数，避免事实 JSON 过大。 */
    static final int MAX_DETAIL_ROWS = 500;

    static final Set<String> PLACEHOLDERS = Set.of(
        "", "not specified", "not present", "not available", "not applicable", "n/a", "na", "none", "unknown",
        "to be filled by o.e.m.", "to be filled by oem", "default string", "default", "system serial number",
        "system manufacturer", "system product name", "system version", "chassis serial number", "invalid",
        "0", "00000000", "0123456789", "1234567890", "123456789", "xxxxxxxx",
        "no module installed", "unknown!", "not settable", "none provided", "type1productconfigid",
        "sku", "o.e.m.", "oem", "base board serial number", "base board product name", "asset tag", "asset-1234567890");

    private static final Pattern SIZE_TOKEN = Pattern.compile("^(\\d+(?:\\.\\d+)?)\\s*([KMGTP]?)(i?B)?$", Pattern.CASE_INSENSITIVE);

    final Map<String, String> files;
    final Map<String, Object> facts = new LinkedHashMap<>();
    final List<String> warnings = new ArrayList<>();
    /** 健康告警，最后写入 {@code health.issues}。 */
    final List<String> issues = new ArrayList<>();
    /** 固件清单，各解析类追加，最后写入 {@code hardware.firmwareInventory}。 */
    final List<Map<String, Object>> firmware = new ArrayList<>();
    /** lspci 设备，按去掉 PCI 域后的地址索引，供网卡、GPU、控制器关联。 */
    final Map<String, Map<String, Object>> pciByAddress = new LinkedHashMap<>();

    private final Map<String, List<Map<String, String>>> dmiCache = new LinkedHashMap<>();

    SosParseContext(Map<String, String> files) {
        this.files = files;
    }

    // ─── 文件访问 ────────────────────────────────────────────────────────────

    String text(String path) {
        return files.getOrDefault(path, "");
    }

    boolean has(String path) {
        return files.containsKey(path);
    }

    Optional<String> pathWithPrefix(String prefix) {
        return files.keySet().stream().filter(path -> path.startsWith(prefix)).sorted().findFirst();
    }

    List<String> sortedPaths(String prefix) {
        return files.keySet().stream().filter(path -> path.startsWith(prefix)).sorted().toList();
    }

    /** 按顺序取第一个存在的文件内容。 */
    String firstText(String... paths) {
        for (String path : paths) {
            if (files.containsKey(path)) return files.get(path);
        }
        return "";
    }

    String firstLine(String path) {
        return text(path).lines().map(SosParseContext::clean).filter(line -> line != null && !line.isEmpty()).findFirst().orElse(null);
    }

    /** dmidecode 按空行分段，段首是标题，其余是缩进的 key: value。 */
    List<Map<String, String>> dmi(String title) {
        return dmiCache.computeIfAbsent(title, this::readDmi);
    }

    private List<Map<String, String>> readDmi(String title) {
        List<Map<String, String>> sections = new ArrayList<>();
        Map<String, String> current = null;
        for (String line : text("sos_commands/hardware/dmidecode").split("\\R")) {
            if (line.isBlank()) {
                current = null;
            } else if (!line.startsWith("\t") && !line.startsWith(" ")) {
                if (line.trim().equals(title)) {
                    current = new LinkedHashMap<>();
                    sections.add(current);
                } else {
                    current = null;
                }
            } else if (current != null && line.startsWith("\t") && !line.startsWith("\t\t")) {
                int colon = line.indexOf(':');
                if (colon > 0) current.put(line.substring(0, colon).trim(), line.substring(colon + 1).trim());
            }
        }
        return sections;
    }

    // ─── 写入事实 ────────────────────────────────────────────────────────────

    void put(String key, String value) {
        String cleaned = clean(value);
        if (cleaned != null) facts.put(key, cleaned);
    }

    /** 与 {@link #put} 相同，但占位值视为空。 */
    void putUseful(String key, String value) {
        String cleaned = useful(value);
        if (cleaned != null) facts.put(key, cleaned);
    }

    void putNumber(String key, Number value) {
        if (value != null) facts.put(key, value);
    }

    void putList(String key, List<String> values) {
        List<String> cleaned = values.stream().map(SosParseContext::clean)
            .filter(value -> value != null && !value.isEmpty()).distinct().limit(MAX_LIST_ITEMS).toList();
        if (!cleaned.isEmpty()) facts.put(key, cleaned);
    }

    void putRows(String key, List<Map<String, Object>> rows) {
        List<Map<String, Object>> kept = rows.stream().filter(row -> !row.isEmpty()).limit(MAX_LIST_ITEMS).toList();
        if (!kept.isEmpty()) facts.put(key, new ArrayList<>(kept));
    }

    void issue(String message) {
        if (issues.size() < MAX_DETAIL_ROWS && !issues.contains(message)) issues.add(limit(message, MAX_VALUE_LENGTH));
    }

    /** 追加一条固件记录。版本为空时不记录。 */
    void firmware(String category, String component, String location, String version) {
        String cleanedVersion = useful(version);
        if (cleanedVersion == null) return;
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("category", category);
        putIfUseful(row, "component", component);
        putIfUseful(row, "location", location);
        row.put("version", cleanedVersion);
        firmware.add(row);
    }

    // ─── 文本工具 ────────────────────────────────────────────────────────────

    static Map<String, String> keyValues(String content) {
        Map<String, String> values = new LinkedHashMap<>();
        for (String line : content.split("\\R")) {
            int equals = line.indexOf('=');
            if (equals <= 0 || line.startsWith("#")) continue;
            values.put(line.substring(0, equals).trim(), unquote(line.substring(equals + 1).trim()));
        }
        return values;
    }

    /** 每行一个 {@code key: value}，重复的 key 保留第一个。 */
    static Map<String, String> keyColonValues(String content) {
        return keySeparatorValues(content, ':');
    }

    static Map<String, String> keySeparatorValues(String content, char separator) {
        Map<String, String> values = new LinkedHashMap<>();
        for (String line : content.split("\\R")) {
            int index = line.indexOf(separator);
            if (index > 0) values.putIfAbsent(line.substring(0, index).trim(), line.substring(index + 1).trim());
        }
        return values;
    }

    static String unquote(String value) {
        if (value.length() >= 2 && (value.startsWith("\"") && value.endsWith("\"") || value.startsWith("'") && value.endsWith("'"))) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    static String cleanDmi(String value) {
        String cleaned = clean(value);
        if (cleaned == null) return null;
        return PLACEHOLDERS.contains(cleaned.toLowerCase(Locale.ROOT)) ? null : cleaned;
    }

    static String cleanUuid(String value) {
        String cleaned = cleanDmi(value);
        if (cleaned == null) return null;
        if (cleaned.matches("[0Ff-]+")) return null;
        return cleaned.toLowerCase(Locale.ROOT);
    }

    /** 去除控制字符、裁剪空白并限制长度。 */
    static String clean(String value) {
        if (value == null) return null;
        String stripped = value.replaceAll("\\p{Cntrl}", " ").trim();
        if (stripped.isEmpty()) return null;
        return limit(stripped, MAX_VALUE_LENGTH);
    }

    /** 清洗后再过滤占位值。 */
    static String useful(String value) {
        String cleaned = clean(value);
        if (cleaned == null || PLACEHOLDERS.contains(cleaned.toLowerCase(Locale.ROOT))) return null;
        return cleaned;
    }

    static String limit(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }

    static void putIfUseful(Map<String, Object> row, String key, String value) {
        String cleaned = useful(value);
        if (cleaned != null) row.put(key, cleaned);
    }

    static void putIfPresent(Map<String, Object> row, String key, Object value) {
        if (value != null) row.put(key, value);
    }

    static String firstNonNull(String a, String b) {
        return a != null && !a.isBlank() ? a : b;
    }

    static String firstToken(String value) {
        if (value == null) return null;
        String[] parts = value.trim().split("\\s+");
        return parts.length == 0 ? null : parts[0];
    }

    static String stripPrefix(String cidr) {
        int slash = cidr.indexOf('/');
        return slash > 0 ? cidr.substring(0, slash) : cidr;
    }

    static Integer parseInteger(String value) {
        if (value == null) return null;
        try {
            return Integer.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** 取文本开头的整数，如 "3200 MT/s"、"28C"。 */
    static Integer leadingInteger(String value) {
        if (value == null) return null;
        Matcher matcher = Pattern.compile("^\\s*(-?\\d{1,9})").matcher(value);
        return matcher.find() ? Integer.valueOf(matcher.group(1)) : null;
    }

    static long parseLong(String value, long fallback) {
        if (value == null) return fallback;
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    /** DMI 的 Size 如 "64 GB"、"512 MB"，未安装时为 "No Module Installed"。 */
    static Long parseDmiSizeMb(String value) {
        if (value == null) return null;
        String[] parts = value.trim().split("\\s+");
        if (parts.length != 2) return null;
        long number = parseLong(parts[0], -1);
        if (number < 0) return null;
        return switch (parts[1].toUpperCase(Locale.ROOT)) {
            case "MB" -> number;
            case "GB" -> number * 1024;
            case "TB" -> number * 1024 * 1024;
            default -> null;
        };
    }

    /** lsblk 的容量是二进制单位，如 3.5T。 */
    static Long parseSizeBytes(String value) {
        Matcher matcher = SIZE_TOKEN.matcher(value == null ? "" : value.trim());
        if (!matcher.matches()) return null;
        double number = Double.parseDouble(matcher.group(1));
        double multiplier = switch (matcher.group(2).toUpperCase(Locale.ROOT)) {
            case "K" -> 1024d;
            case "M" -> 1024d * 1024;
            case "G" -> 1024d * 1024 * 1024;
            case "T" -> 1024d * 1024 * 1024 * 1024;
            case "P" -> 1024d * 1024 * 1024 * 1024 * 1024;
            default -> 1d;
        };
        return Math.round(number * multiplier);
    }

    /** PCI 地址统一为不含域的小写形式，如 {@code 3b:00.0}。 */
    static String pciKey(String address) {
        if (address == null) return null;
        String value = address.trim().toLowerCase(Locale.ROOT);
        Matcher matcher = Pattern.compile("(?:[0-9a-f]{4,8}:)?([0-9a-f]{2}:[0-9a-f]{2}\\.[0-7])").matcher(value);
        return matcher.find() ? matcher.group(1) : null;
    }
}
