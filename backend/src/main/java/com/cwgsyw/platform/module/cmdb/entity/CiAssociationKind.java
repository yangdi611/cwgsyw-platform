package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ci_association_kind")
public class CiAssociationKind extends BaseEntity {
    private String code;
    private String name;
    private Boolean isBuiltIn;
}
