package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;

@Data
public class CiAttributeGroupVO {
    private Long id;
    private String groupId;
    private String name;
    private Boolean isDefault;
    private Boolean isBuiltIn;
    private Integer sortOrder;
}
