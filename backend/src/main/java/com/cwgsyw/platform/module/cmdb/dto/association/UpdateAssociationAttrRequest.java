package com.cwgsyw.platform.module.cmdb.dto.association;

import lombok.Data;

@Data
public class UpdateAssociationAttrRequest {
    private String name;
    private Boolean isRequired;
    private String enumOptions;
    private String defaultValue;
    private Integer sortOrder;
}
