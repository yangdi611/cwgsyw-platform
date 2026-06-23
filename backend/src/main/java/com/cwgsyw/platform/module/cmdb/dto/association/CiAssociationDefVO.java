package com.cwgsyw.platform.module.cmdb.dto.association;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@JsonNaming(PropertyNamingStrategies.LowerCamelCaseStrategy.class)
@Data
public class CiAssociationDefVO {
    private Long id;
    private String defId;
    private String name;
    private String kindId;
    private String kindName;
    private String srcModelId;
    private String srcModelName;
    private String dstModelId;
    private String dstModelName;
    /** 基数：1:1 | 1:n | n:n */
    private String mapping;
    /** 删除策略：none | cascade | restrict */
    private String onDelete;
    private Boolean isBuiltIn;
}
