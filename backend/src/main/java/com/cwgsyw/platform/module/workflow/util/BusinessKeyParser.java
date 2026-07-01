package com.cwgsyw.platform.module.workflow.util;

import java.util.Map;

/**
 * businessKey 解析器。
 *
 * <p>新格式统一使用下划线业务类型，如 {@code daily_report:123}。
 * 兼容历史驼峰格式，如 {@code dailyReport:123} / {@code wikiPage:456}。
 * 未知格式返回 {@link ParsedBusinessKey#isRecognized()} = false，调用方应降级展示
 * rawBusinessKey，而不能让整个待办列表因为一条无法识别的记录而失败。
 */
public final class BusinessKeyParser {

    /** 历史驼峰格式 -> 新下划线业务类型。仅用于兼容旧运行中/历史流程实例。 */
    private static final Map<String, String> LEGACY_TYPE_ALIASES = Map.of(
        "dailyReport", "daily_report",
        "wikiPage", "wiki_page"
    );

    private BusinessKeyParser() {
    }

    public static ParsedBusinessKey parse(String rawBusinessKey) {
        if (rawBusinessKey == null || rawBusinessKey.isBlank()) {
            return ParsedBusinessKey.unrecognized(rawBusinessKey);
        }
        int idx = rawBusinessKey.indexOf(':');
        if (idx <= 0 || idx == rawBusinessKey.length() - 1) {
            return ParsedBusinessKey.unrecognized(rawBusinessKey);
        }
        String typePart = rawBusinessKey.substring(0, idx);
        String idPart = rawBusinessKey.substring(idx + 1);
        if (idPart.isBlank()) {
            return ParsedBusinessKey.unrecognized(rawBusinessKey);
        }

        if (LEGACY_TYPE_ALIASES.containsKey(typePart)) {
            return ParsedBusinessKey.recognized(LEGACY_TYPE_ALIASES.get(typePart), idPart, true, rawBusinessKey);
        }
        if (isNewFormatType(typePart)) {
            return ParsedBusinessKey.recognized(typePart, idPart, false, rawBusinessKey);
        }
        return ParsedBusinessKey.unrecognized(rawBusinessKey);
    }

    /** 新格式业务类型必须是下划线小写标识符（字母数字下划线，不能以数字开头）。 */
    private static boolean isNewFormatType(String type) {
        if (type.isEmpty()) return false;
        for (int i = 0; i < type.length(); i++) {
            char c = type.charAt(i);
            boolean ok = (c >= 'a' && c <= 'z') || c == '_' || (i > 0 && c >= '0' && c <= '9');
            if (!ok) return false;
        }
        return true;
    }

    /** 构造新格式 businessKey：{businessType}:{businessId} */
    public static String build(String businessType, Object businessId) {
        return businessType + ":" + businessId;
    }
}
