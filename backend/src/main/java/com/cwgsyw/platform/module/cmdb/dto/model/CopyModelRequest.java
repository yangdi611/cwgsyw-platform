package com.cwgsyw.platform.module.cmdb.dto.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CopyModelRequest {
    @NotBlank
    @Pattern(regexp = "^[a-z][a-z0-9_]*$", message = "模型标识只能使用小写字母、数字、下划线，且必须以字母开头")
    @JsonProperty("modelId")
    private String modelId;

    @NotBlank
    @Size(max = 128)
    private String name;

    private String groupCode;
}
