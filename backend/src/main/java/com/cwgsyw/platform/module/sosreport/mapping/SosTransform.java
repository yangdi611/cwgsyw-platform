package com.cwgsyw.platform.module.sosreport.mapping;

import com.cwgsyw.platform.module.sosreport.parser.SosFactCatalog;
import com.cwgsyw.platform.module.sosreport.parser.SosFactCatalog.FactType;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 映射规则可用的转换方式。这是封闭集合，不接受自由表达式：
 * 规则可能来自 AI，不能让它决定执行什么。
 */
public enum SosTransform {
    DIRECT("direct"),
    COUNT("count"),
    JOIN("join"),
    ROUND("round"),
    GB_TO_MB("gb_to_mb"),
    GB_TO_TB("gb_to_tb"),
    ENUM_MAP("enum_map");

    public static final String ARG_MAP = "map";

    private final String code;

    SosTransform(String code) {
        this.code = code;
    }

    public String code() {
        return code;
    }

    public static Optional<SosTransform> fromCode(String code) {
        return Arrays.stream(values()).filter(value -> value.code.equals(code)).findFirst();
    }

    /** 这个事实能否使用这种转换。 */
    public boolean accepts(SosFactCatalog.Fact fact) {
        FactType type = fact.type();
        boolean numeric = type == FactType.INTEGER || type == FactType.DECIMAL;
        boolean gigabytes = numeric && fact.unit() != null && fact.unit().startsWith("G");
        return switch (this) {
            case DIRECT -> type != FactType.LIST;
            case COUNT -> type == FactType.LIST;
            case JOIN -> SCALAR_LISTS.contains(fact.key());
            case ROUND -> numeric;
            case GB_TO_MB, GB_TO_TB -> gigabytes;
            case ENUM_MAP -> type == FactType.STRING;
        };
    }

    /** 转换后的值类型。{@link #ENUM_MAP} 的结果是枚举选项 id，按字符串处理。 */
    public FactType outputType(SosFactCatalog.Fact fact) {
        return switch (this) {
            case DIRECT -> fact.type();
            case COUNT, ROUND, GB_TO_MB -> FactType.INTEGER;
            case GB_TO_TB -> FactType.DECIMAL;
            case JOIN, ENUM_MAP -> FactType.STRING;
        };
    }

    /**
     * 执行转换。{@code value} 为 null 时返回 null。
     * 枚举映射找不到对应项时也返回 null，由调用方提示。
     */
    public Object apply(Object value, Map<String, Object> args) {
        if (value == null) return null;
        return switch (this) {
            case DIRECT -> value;
            case COUNT -> value instanceof List<?> list ? list.size() : null;
            case JOIN -> value instanceof List<?> list
                ? list.stream().map(String::valueOf).collect(Collectors.joining(","))
                : null;
            case ROUND -> decimal(value).map(number -> number.setScale(0, RoundingMode.HALF_UP).longValue()).orElse(null);
            case GB_TO_MB -> decimal(value).map(number -> number.multiply(BigDecimal.valueOf(1024)).setScale(0, RoundingMode.HALF_UP).longValue()).orElse(null);
            case GB_TO_TB -> decimal(value).map(number -> number.divide(BigDecimal.valueOf(1024), 2, RoundingMode.HALF_UP)).orElse(null);
            case ENUM_MAP -> enumMap(args).get(String.valueOf(value));
        };
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> enumMap(Map<String, Object> args) {
        if (args != null && args.get(ARG_MAP) instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
    }

    private static Optional<BigDecimal> decimal(Object value) {
        if (value instanceof BigDecimal number) return Optional.of(number);
        if (value instanceof Number number) return Optional.of(new BigDecimal(number.toString()));
        return Optional.empty();
    }

    /** 元素是简单值的列表才能拼接；网卡、磁盘这类对象列表只能计数。 */
    private static final List<String> SCALAR_LISTS = List.of(
        "network.ipv4Addresses", "network.ipv6Addresses", "network.dnsServers", "network.ntpServers",
        "software.packages", "software.runningServices", "software.failedServices",
        "software.enabledServices", "software.kernelModules", "cpu.vulnerabilities",
        "hardware.chassisFaults", "health.issues");
}
