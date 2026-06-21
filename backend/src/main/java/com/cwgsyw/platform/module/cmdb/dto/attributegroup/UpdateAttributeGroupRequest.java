package com.cwgsyw.platform.module.cmdb.dto.attributegroup;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateAttributeGroupRequest {
    @Size(max = 128)
    private String name;

    @JsonProperty("sortOrder")
    private Integer sortOrder;
}
