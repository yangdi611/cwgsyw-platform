package com.cwgsyw.platform.module.cmdb.dto.modelgroup;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateModelGroupRequest {
    /** Group code, lowercase + underscore. */
    @NotBlank
    @Pattern(regexp = "^[a-z][a-z0-9_]*$")
    private String code;

    @NotBlank
    @Size(max = 128)
    private String name;

    private String icon;

    @JsonProperty("sortOrder")
    private Integer sortOrder = 0;
}
