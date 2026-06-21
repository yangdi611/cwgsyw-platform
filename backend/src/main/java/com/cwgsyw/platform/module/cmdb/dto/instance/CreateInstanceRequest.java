package com.cwgsyw.platform.module.cmdb.dto.instance;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
public class CreateInstanceRequest {
    @NotBlank
    private String modelId;

    @NotBlank
    private String name;

    private String status = "online";
    private String owner;
    private String description;

    @NotNull
    private Map<String, Object> fieldsData;
}
