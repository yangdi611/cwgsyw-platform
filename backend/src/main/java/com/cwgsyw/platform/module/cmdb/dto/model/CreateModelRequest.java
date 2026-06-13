package com.cwgsyw.platform.module.cmdb.dto.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateModelRequest {
    @NotBlank @Pattern(regexp = "^[a-z][a-z0-9_]*$")
    private String name;

    @NotBlank @Size(max = 128)
    private String displayName;

    @NotBlank
    private String group;
}
