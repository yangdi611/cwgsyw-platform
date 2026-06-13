package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("ci_instance_rel")
public class CiInstanceRel extends BaseEntity {
    private Long srcInstanceId;
    private Long dstInstanceId;
    private String associationKind;
}
