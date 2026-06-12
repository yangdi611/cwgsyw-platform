package com.cwgsyw.platform.module.cmdb.dto.instance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
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
