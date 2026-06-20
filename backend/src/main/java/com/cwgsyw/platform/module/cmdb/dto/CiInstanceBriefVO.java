package com.cwgsyw.platform.module.cmdb.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
@Data
public class CiInstanceBriefVO {
    private Long id;
    private String name;
    private String modelId;
    private String modelName;
}
