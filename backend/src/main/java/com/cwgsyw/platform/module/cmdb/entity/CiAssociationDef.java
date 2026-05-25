package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ci_association_def")
public class CiAssociationDef {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String defId;
    private String kindId;
    private String srcModelId;
    private String dstModelId;
    private String name;
    private String mapping;
    private String onDelete;
    private Boolean isBuiltIn;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime createdAt;
}
