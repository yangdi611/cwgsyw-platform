package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ci_association_attr_def")
public class CiAssociationAttrDef extends BaseEntity {
    private String associationKind;
    private String fieldKey;
    private String name;
    private String fieldType;
    private Boolean isRequired;
    private String enumOptions;
    private String defaultValue;
    private Integer sortOrder;
}
