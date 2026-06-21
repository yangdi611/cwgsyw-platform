package com.cwgsyw.platform.module.cmdb.dto.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateModelRequest {
    /** Model code, e.g. "host". Frontend sends this as camelCase "modelId"
     *  (overriding the global SNAKE_CASE strategy). */
    @NotBlank
    @Pattern(regexp = "^[a-z][a-z0-9_]*$")
    @JsonProperty("modelId")
    private String modelId;

    /** Display name (Chinese), e.g. "主机". */
    @NotBlank
    @Size(max = 128)
    private String name;

    @NotBlank
    private String groupCode;

    private String description;
    private String icon;
}
