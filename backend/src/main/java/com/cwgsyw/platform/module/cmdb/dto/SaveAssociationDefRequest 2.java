package com.cwgsyw.platform.module.cmdb.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SaveAssociationDefRequest {
    @NotBlank private String kindId;
    @NotBlank private String srcModelId;
    @NotBlank private String dstModelId;
    private String name;
    private String mapping;
    private String onDelete;
}
