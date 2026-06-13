package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ci_association_kind")
public class CiAssociationKind {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String kindId;
    private String name;
    private String srcToDst;
    private String dstToSrc;
    private Boolean isBuiltIn;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime createdAt;
}
