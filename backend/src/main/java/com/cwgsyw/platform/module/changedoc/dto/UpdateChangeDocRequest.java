package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.util.Map;

/**
 * 更新变更文档请求体。
 *
 * <p>支持以下场景：
 * <ul>
 *   <li>{@code draft} 状态：可改 {@link #fieldsData} 与两个模板 ID</li>
 *   <li>{@code plan_pending} 状态：可改 {@link #fieldsData} 中的 plan 字段、补填 {@link #planTemplateId}</li>
 * </ul>
 */
@Data
public class UpdateChangeDocRequest {
    private String title;
    private Map<String, String> fieldsData;
    /** 仅 draft 状态可修改 */
    private Long applicationTemplateId;
    /** draft / plan_pending 都可修改（plan_pending 用于补填方案模板） */
    private Long planTemplateId;
}
