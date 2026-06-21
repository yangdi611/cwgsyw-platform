package com.cwgsyw.platform.module.cmdb.dto.attributegroup;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateAttributeGroupRequest {
    /** Group code, lowercase + underscore. */
    @NotBlank
    @Pattern(regexp = "^[a-z][a-z0-9_]*$")
    @JsonProperty("groupId")
    private String groupId;

    @NotBlank
    @Size(max = 128)
    private String name;

    @JsonProperty("sortOrder")
    private Integer sortOrder = 0;
}
