package com.cwgsyw.platform.module.sosreport.mapping;

import java.util.Map;

/**
 * 一条生效的映射规则：从事实经转换得到字段值，或者是预置的固定值。
 */
public record SosRule(String fieldKey, String factKey, String transform, Map<String, Object> args, Object literal) {

    public static SosRule of(String fieldKey, String factKey) {
        return new SosRule(fieldKey, factKey, SosTransform.DIRECT.code(), Map.of(), null);
    }

    public static SosRule join(String fieldKey, String factKey) {
        return new SosRule(fieldKey, factKey, SosTransform.JOIN.code(), Map.of(), null);
    }

    public static SosRule enumMap(String fieldKey, String factKey, Map<String, Object> map) {
        return new SosRule(fieldKey, factKey, SosTransform.ENUM_MAP.code(), Map.of(SosTransform.ARG_MAP, map), null);
    }

    public static SosRule literal(String fieldKey, Object value) {
        return new SosRule(fieldKey, null, null, Map.of(), value);
    }
}
