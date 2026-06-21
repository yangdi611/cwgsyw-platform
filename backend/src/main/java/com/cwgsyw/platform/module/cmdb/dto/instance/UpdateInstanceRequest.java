package com.cwgsyw.platform.module.cmdb.dto.instance;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.Map;

@Data
@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
public class UpdateInstanceRequest {
    private String name;
    private String status;
    private String owner;
    private String description;
    private Map<String, Object> fieldsData;
}
