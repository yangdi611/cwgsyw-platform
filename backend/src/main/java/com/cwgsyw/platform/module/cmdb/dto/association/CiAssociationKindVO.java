package com.cwgsyw.platform.module.cmdb.dto.association;

import lombok.Data;

@Data
public class CiAssociationKindVO {
    private Long id;
    private String code;
    private String name;
    private Boolean isBuiltIn;
}
