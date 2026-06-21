package com.cwgsyw.platform.module.cmdb.dto.modelgroup;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateModelGroupRequest {
    @Size(max = 128)
    private String name;

    private String icon;

    @JsonProperty("sortOrder")
    private Integer sortOrder;
}
