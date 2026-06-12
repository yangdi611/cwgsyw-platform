package com.cwgsyw.platform.module.cmdb.dto.instance;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class CiInstanceSearchVO {
    private Long id;
    private String name;

    @JsonProperty("model_id")
    private String modelId;

    @JsonProperty("model_name")
    private String modelName;
}
