package com.cwgsyw.platform.module.cmdb.dto.association;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
@Data
public class CiAssociationKindVO {
    private Long id;
    private String code;
    private String name;
    private Boolean isBuiltIn;
}
