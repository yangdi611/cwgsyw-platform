package com.cwgsyw.platform.module.workflow.util;

import lombok.Getter;

/**
 * businessKey 解析结果。
 *
 * <p>businessKey 约定格式：{@code {businessType}:{businessId}}，例如 {@code daily_report:123}。
 * 历史遗留格式（驼峰）也需要兼容解析，例如 {@code dailyReport:123} / {@code wikiPage:456}。
 */
@Getter
public class ParsedBusinessKey {
    /** 是否成功解析出已知业务类型；未知格式时为 false，调用方应降级展示 rawBusinessKey。 */
    private final boolean recognized;
    /** 统一后的业务类型（下划线格式），未识别时为 null。 */
    private final String businessType;
    /** 业务对象 ID（字符串形式，由调用方自行转换为 Long 等），未识别时为 null。 */
    private final String businessId;
    /** 是否来自历史驼峰格式（如 dailyReport / wikiPage）。 */
    private final boolean legacyFormat;
    /** 原始 businessKey，始终非空。 */
    private final String rawBusinessKey;

    private ParsedBusinessKey(boolean recognized, String businessType, String businessId,
                               boolean legacyFormat, String rawBusinessKey) {
        this.recognized = recognized;
        this.businessType = businessType;
        this.businessId = businessId;
        this.legacyFormat = legacyFormat;
        this.rawBusinessKey = rawBusinessKey;
    }

    static ParsedBusinessKey recognized(String businessType, String businessId,
                                         boolean legacyFormat, String rawBusinessKey) {
        return new ParsedBusinessKey(true, businessType, businessId, legacyFormat, rawBusinessKey);
    }

    static ParsedBusinessKey unrecognized(String rawBusinessKey) {
        return new ParsedBusinessKey(false, null, null, false, rawBusinessKey);
    }
}
