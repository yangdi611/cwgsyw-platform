package com.cwgsyw.platform.module.cmdb.dto.association;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class CreateAssociationAttrRequest {
    @JsonProperty("fieldKey")
    @NotBlank @Pattern(regexp = "^[a-z][a-z0-9_]*$")
    private String fieldKey;

    @JsonProperty("name")
    @NotBlank
    private String name;

    @JsonProperty("fieldType")
    @NotBlank
    private String fieldType;

    private Boolean isRequired = false;

    private String enumOptions;

    private String defaultValue;

    private Integer sortOrder = 0;
}
