package com.cwgsyw.platform.module.cmdb.dto.instance;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class CiInstanceSearchVO {
    private Long id;
    private String name;

    /** Canonical model code (camelCase, AD-4). */
    @JsonProperty("modelCode")
    private String modelCode;

    @JsonProperty("model_id")
    private String modelId;

    @JsonProperty("model_name")
    private String modelName;

    /**
     * 命中的属性片段。当搜索关键词匹配到 {@code attrs} 内的属性值（而非实例名）时，
     * 返回形如 {@code "inner_ip: 10.0.0.1"} 的字符串，便于前端展示命中原因。
     * 按名称命中时为 {@code null}。
     */
    private String snippet;
}
