package com.cwgsyw.platform.module.cmdb.dto.relation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateRelationRequest {
    @NotNull
    private Long dstInstanceId;

    @NotBlank
    private String associationKind;
}
