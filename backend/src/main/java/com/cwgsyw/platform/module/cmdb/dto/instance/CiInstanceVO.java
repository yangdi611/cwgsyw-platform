package com.cwgsyw.platform.module.cmdb.dto.instance;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CiInstanceVO {
    private Long id;
    private String name;
    private String modelId;
    private String modelName;
    private String status;
    private String owner;
    private String description;
    private Map<String, Object> fieldsData;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
