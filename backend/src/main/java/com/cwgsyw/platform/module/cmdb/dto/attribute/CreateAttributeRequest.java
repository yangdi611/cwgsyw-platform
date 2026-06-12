package com.cwgsyw.platform.module.cmdb.dto.attribute;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class CreateAttributeRequest {
    @NotBlank @Pattern(regexp = "^[a-z][a-z0-9_]*$")
    private String fieldKey;

    @NotBlank
    private String name;

    @NotBlank
    private String groupId;

    @NotBlank
    private String fieldType;

    private Boolean isRequired = false;
    private Boolean isEditable = true;
    private Boolean isUnique = false;
    private Boolean isListShow = false;
    private String defaultValue;
    private String enumOptions;
    private Integer sortOrder = 0;
}
