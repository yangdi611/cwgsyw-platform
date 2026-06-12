package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ci_association_def")
public class CiAssociationDef extends BaseEntity {
    private String srcModelId;
    private String dstModelId;
    private String associationKind;
}
