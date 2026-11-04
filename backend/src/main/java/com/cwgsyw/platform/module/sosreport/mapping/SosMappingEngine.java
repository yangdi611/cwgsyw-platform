package com.cwgsyw.platform.module.sosreport.mapping;

import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.sosreport.parser.SosFactCatalog;
import com.cwgsyw.platform.module.sosreport.parser.SosFactCatalog.FactType;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;

/**
 * 映射规则的校验和求值。纯函数，手动规则和 AI 建议都走这里。
 */
public final class SosMappingEngine {

    /** v1 支持映射的字段类型。table、enummulti、objuser 只能人工填写。 */
    public static final Set<String> SUPPORTED_FIELD_TYPES =
        Set.of("singlechar", "longchar", "int", "float", "bool", "date", "enum");

    private SosMappingEngine() {
    }

    public record Evaluation(Object value, String problem) {
    }

    public static boolean isSupported(CiAttribute attribute) {
        return SUPPORTED_FIELD_TYPES.contains(attribute.getFieldType());
    }

    /** 字段类型和枚举选项的指纹。任一变化后，已确认的规则不再生效。 */
    public static String fingerprint(CiAttribute attribute) {
        String source = attribute.getFieldType() + "|" + String.join(",", new TreeSet<>(optionIds(attribute)));
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(source.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public static List<String> optionIds(CiAttribute attribute) {
        List<String> ids = new ArrayList<>();
        if (attribute.getOption() instanceof List<?> options) {
            for (Object option : options) {
                if (option instanceof Map<?, ?> row && row.get("id") != null) {
                    ids.add(String.valueOf(row.get("id")));
                }
            }
        }
        return ids;
    }

    /**
     * 校验一条规则能否用于该字段。
     *
     * @return 不兼容的原因；兼容时返回 null
     */
    public static String incompatibility(String factKey, String transformCode, Map<String, Object> args, CiAttribute attribute) {
        if (!isSupported(attribute)) {
            return "字段类型 " + attribute.getFieldType() + " 不支持自动映射";
        }
        SosFactCatalog.Fact fact = SosFactCatalog.find(factKey).orElse(null);
        if (fact == null) return "事实不存在";
        SosTransform transform = SosTransform.fromCode(transformCode).orElse(null);
        if (transform == null) return "转换方式不存在";
        if (!transform.accepts(fact)) {
            return "事实“" + fact.label() + "”不能使用转换方式 " + transform.code();
        }

        FactType output = transform.outputType(fact);
        return switch (attribute.getFieldType()) {
            case "singlechar", "longchar" -> output == FactType.LIST ? "列表需要先拼接或计数" : null;
            case "int" -> output == FactType.INTEGER ? null : "整数字段需要整数值，小数请使用 round";
            case "float" -> output == FactType.INTEGER || output == FactType.DECIMAL ? null : "浮点字段需要数值";
            case "bool" -> output == FactType.BOOLEAN ? null : "布尔字段需要布尔值";
            case "date" -> output == FactType.DATE ? null : "日期字段需要日期值";
            case "enum" -> enumIncompatibility(transform, args, attribute);
            default -> "字段类型不支持自动映射";
        };
    }

    private static String enumIncompatibility(SosTransform transform, Map<String, Object> args, CiAttribute attribute) {
        if (transform != SosTransform.ENUM_MAP) return "枚举字段需要使用 enum_map";
        Map<String, Object> map = SosTransform.enumMap(args);
        if (map.isEmpty()) return "枚举映射不能为空";
        List<String> ids = optionIds(attribute);
        for (Object target : map.values()) {
            if (target == null || !ids.contains(String.valueOf(target))) {
                return "枚举映射的目标不是该字段的选项";
            }
        }
        return null;
    }

    /** 按规则取值，并转换成字段需要的类型。取不到值时 value 为 null，problem 说明原因。 */
    public static Evaluation evaluate(SosRule rule, Map<String, Object> facts, CiAttribute attribute) {
        if (rule.literal() != null) {
            return optionIds(attribute).isEmpty() || optionIds(attribute).contains(String.valueOf(rule.literal()))
                ? new Evaluation(rule.literal(), null)
                : new Evaluation(null, "预置值不在字段选项内");
        }
        Object fact = facts == null ? null : facts.get(rule.factKey());
        if (fact == null) return new Evaluation(null, "报告中没有这项数据");

        SosTransform transform = SosTransform.fromCode(rule.transform()).orElse(null);
        if (transform == null) return new Evaluation(null, "转换方式不存在");
        Object transformed = transform.apply(fact, rule.args());
        if (transformed == null) {
            return new Evaluation(null, transform == SosTransform.ENUM_MAP
                ? "值“" + fact + "”没有对应的枚举选项"
                : "转换失败");
        }
        return coerce(transformed, attribute);
    }

    private static Evaluation coerce(Object value, CiAttribute attribute) {
        return switch (attribute.getFieldType()) {
            case "singlechar", "longchar", "date" -> new Evaluation(plainString(value), null);
            case "enum" -> {
                String id = String.valueOf(value);
                yield optionIds(attribute).contains(id)
                    ? new Evaluation(id, null)
                    : new Evaluation(null, "值“" + id + "”不在字段选项内");
            }
            case "int" -> value instanceof Number number
                ? new Evaluation(new BigDecimal(number.toString()).setScale(0, RoundingMode.HALF_UP).longValue(), null)
                : new Evaluation(null, "值不是数字");
            case "float" -> value instanceof Number
                ? new Evaluation(value, null)
                : new Evaluation(null, "值不是数字");
            case "bool" -> value instanceof Boolean
                ? new Evaluation(value, null)
                : new Evaluation(null, "值不是布尔值");
            default -> new Evaluation(null, "字段类型不支持自动映射");
        };
    }

    private static String plainString(Object value) {
        if (value instanceof BigDecimal number) return number.toPlainString();
        return String.valueOf(value);
    }

    /** 比较新旧值。CMDB 里数字可能存成字符串，所以按文本和数值比较。 */
    public static boolean sameValue(Object a, Object b) {
        if (Objects.equals(a, b)) return true;
        if (a == null || b == null) return false;
        String left = String.valueOf(a).trim();
        String right = String.valueOf(b).trim();
        if (left.equals(right)) return true;
        try {
            return new BigDecimal(left).compareTo(new BigDecimal(right)) == 0;
        } catch (NumberFormatException e) {
            return false;
        }
    }
}
