package com.cwgsyw.platform.common;

public final class AuditRemark {
    private static final int MAX_CODE_POINTS = 512;
    private static final String ELLIPSIS = "...";

    private AuditRemark() {
    }

    public static String bounded(String value) {
        if (value == null || value.codePointCount(0, value.length()) <= MAX_CODE_POINTS) {
            return value;
        }
        int prefixCodePoints = MAX_CODE_POINTS - ELLIPSIS.length();
        int endIndex = value.offsetByCodePoints(0, prefixCodePoints);
        return value.substring(0, endIndex) + ELLIPSIS;
    }
}
