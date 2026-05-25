package com.cwgsyw.platform.module.cmdb.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SaveAssociationKindRequest {
    @NotBlank private String kindId;
    @NotBlank private String name;
    private String srcToDst;
    private String dstToSrc;
}
