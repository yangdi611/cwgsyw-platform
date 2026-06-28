package com.cwgsyw.platform.module.cmdb.dto.association;

import lombok.Data;

@Data
public class CiAssociationAttrDefVO {
    private Long id;
    private String associationKind;
    private String fieldKey;
    private String name;
    private String fieldType;
    private Boolean isRequired;
    private String enumOptions;
    private String defaultValue;
    private Integer sortOrder;
}
