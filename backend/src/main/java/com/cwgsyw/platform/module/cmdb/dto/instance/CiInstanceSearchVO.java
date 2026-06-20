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
}
