package com.cwgsyw.platform.module.changedoc.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
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
    @JsonAlias("fields_data")             private Map<String, String> fieldsData;
    /** 仅 draft 状态可修改 */
    @JsonAlias("application_template_id") private Long applicationTemplateId;
    /** draft / plan_pending 都可修改（plan_pending 用于补填方案模板） */
    @JsonAlias("plan_template_id")        private Long planTemplateId;
}
